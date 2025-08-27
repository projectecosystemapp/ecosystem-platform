// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  referralsTable, 
  loyaltyAccountsTable, 
  pointsTransactionsTable 
} from "@/db/schema/loyalty-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, sql } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

// Schema for completing a referral
const completeReferralSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get or create loyalty account for a user
 */
async function ensureLoyaltyAccount(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: loyaltyAccountsTable.id })
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.customerId, userId))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  // Create new loyalty account
  const [newAccount] = await db
    .insert(loyaltyAccountsTable)
    .values({
      customerId: userId,
      pointsBalance: 0,
      tier: "bronze",
      isActive: true,
    })
    .returning({ id: loyaltyAccountsTable.id });

  return newAccount.id;
}

/**
 * Award completion points to referrer
 */
async function awardCompletionPoints(
  referrerId: string,
  points: number,
  referralId: string,
  referredUserEmail: string
): Promise<void> {
  const accountId = await ensureLoyaltyAccount(referrerId);

  // Get current balance
  const [account] = await db
    .select({ 
      pointsBalance: loyaltyAccountsTable.pointsBalance,
      lifetimePointsEarned: loyaltyAccountsTable.lifetimePointsEarned
    })
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error("Loyalty account not found");
  }

  const newBalance = account.pointsBalance + points;
  const newLifetimeEarned = account.lifetimePointsEarned + points;

  // Update account and create transaction
  await db.transaction(async (tx) => {
    // Update account balance
    await tx
      .update(loyaltyAccountsTable)
      .set({
        pointsBalance: newBalance,
        lifetimePointsEarned: newLifetimeEarned,
        lastActivityAt: new Date(),
        lastEarnedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccountsTable.id, accountId));

    // Create transaction record
    await tx.insert(pointsTransactionsTable).values({
      accountId,
      type: "earned_referral",
      points,
      balanceBefore: account.pointsBalance,
      balanceAfter: newBalance,
      referralId,
      description: `Referral completed! ${referredUserEmail} made their first booking`,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Points expire in 1 year
    });
  });
}

// ==================== POST: COMPLETE REFERRAL ON FIRST BOOKING ====================

/**
 * Called when a referred user completes their first booking
 * Awards completion bonus to the referrer
 */
export const POST = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      // This can be called from webhook or authenticated context
      const { userId: authUserId } = await auth();

      const body = await req.json();
      const validationResult = completeReferralSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false, 
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }

      const data = validationResult.data;

      // Get booking details
      const [booking] = await db
        .select({
          id: bookingsTable.id,
          customerId: bookingsTable.customerId,
          status: bookingsTable.status,
          isGuestBooking: bookingsTable.isGuestBooking,
          createdAt: bookingsTable.createdAt,
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, data.bookingId))
        .limit(1);

      if (!booking) {
        return NextResponse.json(
          { success: false, error: "Booking not found" },
          { status: 404 }
        );
      }

      // Skip guest bookings
      if (booking.isGuestBooking) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Guest bookings do not qualify for referral completion" 
          },
          { status: 400 }
        );
      }

      // Verify booking is completed
      if (booking.status !== "completed") {
        return NextResponse.json(
          { 
            success: false, 
            error: "Booking must be completed to trigger referral completion" 
          },
          { status: 400 }
        );
      }

      // If authenticated, verify the user owns the booking
      if (authUserId && booking.customerId !== authUserId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 403 }
        );
      }

      // Find any pending referral for this user
      const [referral] = await db
        .select()
        .from(referralsTable)
        .where(
          and(
            eq(referralsTable.referredUserId, booking.customerId),
            eq(referralsTable.status, "signed_up")
          )
        )
        .limit(1);

      if (!referral) {
        // No pending referral, this is OK - user might not have been referred
        return NextResponse.json(
          { 
            success: true, 
            message: "No pending referral found for this user",
            referralProcessed: false,
          },
          { status: 200 }
        );
      }

      // Check if this is actually the first booking
      const [bookingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.customerId, booking.customerId),
            eq(bookingsTable.status, "completed"),
            eq(bookingsTable.isGuestBooking, false)
          )
        );

      if (bookingCount.count > 1) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Referral completion only applies to first booking",
            isFirstBooking: false,
          },
          { status: 400 }
        );
      }

      // Get referrer and referred user details
      const [referrerProfile] = await db
        .select({
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          email: profilesTable.email,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, referral.referrerId))
        .limit(1);

      const [referredProfile] = await db
        .select({
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          email: profilesTable.email,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, booking.customerId))
        .limit(1);

      // Complete the referral in a transaction
      const result = await db.transaction(async (tx) => {
        // Update referral status
        await tx
          .update(referralsTable)
          .set({
            status: "completed",
            firstBookingAt: new Date(),
            completedAt: new Date(),
          })
          .where(eq(referralsTable.id, referral.id));

        // Award points to referrer only if not already issued
        if (!referral.referrerRewardIssued) {
          await awardCompletionPoints(
            referral.referrerId,
            referral.referrerRewardPoints,
            referral.id,
            referredProfile?.email || referral.referredEmail
          );

          // Mark referrer reward as issued
          await tx
            .update(referralsTable)
            .set({ referrerRewardIssued: true })
            .where(eq(referralsTable.id, referral.id));
        }

        return {
          referralId: referral.id,
          pointsAwarded: !referral.referrerRewardIssued ? referral.referrerRewardPoints : 0,
          alreadyIssued: referral.referrerRewardIssued,
        };
      });

      // Log successful completion
      console.log("Referral completed:", {
        referralId: result.referralId,
        bookingId: booking.id,
        referrerId: referral.referrerId,
        referredUserId: booking.customerId,
        pointsAwarded: result.pointsAwarded,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          message: result.alreadyIssued 
            ? "Referral was already completed" 
            : "Referral completed successfully",
          referralProcessed: true,
          referral: {
            id: result.referralId,
            referrerId: referral.referrerId,
            referrerName: referrerProfile 
              ? `${referrerProfile.firstName} ${referrerProfile.lastName}`
              : "Unknown",
            referredUserId: booking.customerId,
            referredUserName: referredProfile
              ? `${referredProfile.firstName} ${referredProfile.lastName}`
              : "Unknown",
            pointsAwarded: result.pointsAwarded,
            totalRewards: {
              referrer: referral.referrerRewardPoints,
              referred: referral.referredRewardPoints,
            },
          },
        },
        { status: 200 }
      );

    } catch (error) {
      console.error("Complete referral error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to complete referral" },
        { status: 500 }
      );
    }
  }
);

// ==================== OPTIONS: CORS PREFLIGHT ====================

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}