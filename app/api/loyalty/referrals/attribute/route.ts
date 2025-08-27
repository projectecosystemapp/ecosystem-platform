import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  referralsTable, 
  loyaltyAccountsTable, 
  pointsTransactionsTable 
} from "@/db/schema/loyalty-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

// Schema for attributing a referral during signup
const attributeReferralSchema = z.object({
  referralCode: z.string().min(6),
  userEmail: z.string().email(),
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Create a new loyalty account for a user
 */
async function createLoyaltyAccount(userId: string, initialPoints: number = 0): Promise<string> {
  const [newAccount] = await db
    .insert(loyaltyAccountsTable)
    .values({
      customerId: userId,
      pointsBalance: initialPoints,
      lifetimePointsEarned: initialPoints,
      tier: "bronze",
      isActive: true,
      lastActivityAt: initialPoints > 0 ? new Date() : undefined,
      lastEarnedAt: initialPoints > 0 ? new Date() : undefined,
    })
    .returning({ id: loyaltyAccountsTable.id });

  return newAccount.id;
}

/**
 * Award referral bonus points
 */
async function awardReferralBonus(
  userId: string,
  points: number,
  referralId: string,
  description: string
): Promise<{ accountId: string; transactionId: string }> {
  // Create loyalty account with initial points
  const accountId = await createLoyaltyAccount(userId, points);

  // Create points transaction
  const [transaction] = await db
    .insert(pointsTransactionsTable)
    .values({
      accountId,
      type: "earned_referral",
      points,
      balanceBefore: 0,
      balanceAfter: points,
      referralId,
      description,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Points expire in 1 year
    })
    .returning({ id: pointsTransactionsTable.id });

  return { accountId, transactionId: transaction.id };
}

// ==================== POST: ATTRIBUTE REFERRAL TO NEW USER ====================

/**
 * Called during user signup to attribute a referral
 * Awards signup bonus to the new user
 */
export const POST = withRateLimitRedis(
  { type: "auth" }, // Use auth rate limiting for signup-related endpoints
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }

      const body = await req.json();
      const validationResult = attributeReferralSchema.safeParse(body);
      
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

      // Get user profile to verify email
      const [userProfile] = await db
        .select({
          email: profilesTable.email,
          userId: profilesTable.userId,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      if (!userProfile) {
        return NextResponse.json(
          { success: false, error: "User profile not found" },
          { status: 404 }
        );
      }

      // Verify email matches
      if (userProfile.email.toLowerCase() !== data.userEmail.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: "Email mismatch" },
          { status: 400 }
        );
      }

      // Find the referral
      const [referral] = await db
        .select()
        .from(referralsTable)
        .where(
          and(
            eq(referralsTable.referralCode, data.referralCode),
            eq(referralsTable.referredEmail, data.userEmail.toLowerCase())
          )
        )
        .limit(1);

      if (!referral) {
        return NextResponse.json(
          { 
            success: false, 
            error: "No valid referral found for this email and code" 
          },
          { status: 404 }
        );
      }

      // Check referral status
      if (referral.status === "completed") {
        return NextResponse.json(
          { 
            success: false, 
            error: "Referral has already been completed" 
          },
          { status: 400 }
        );
      }

      if (referral.status === "cancelled" || referral.status === "expired") {
        return NextResponse.json(
          { 
            success: false, 
            error: `Referral is ${referral.status}` 
          },
          { status: 400 }
        );
      }

      // Check if expired
      if (referral.expiresAt && referral.expiresAt < new Date()) {
        await db
          .update(referralsTable)
          .set({ status: "expired" })
          .where(eq(referralsTable.id, referral.id));

        return NextResponse.json(
          { success: false, error: "Referral has expired" },
          { status: 400 }
        );
      }

      // Check if already attributed
      if (referral.referredUserId) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Referral has already been attributed to another user" 
          },
          { status: 400 }
        );
      }

      // Check for existing loyalty account (prevent duplicate attribution)
      const [existingAccount] = await db
        .select({ id: loyaltyAccountsTable.id })
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, userId))
        .limit(1);

      if (existingAccount) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Loyalty account already exists for this user" 
          },
          { status: 400 }
        );
      }

      // Get referrer info for the description
      const [referrer] = await db
        .select({
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, referral.referrerId))
        .limit(1);

      const referrerName = referrer 
        ? `${referrer.firstName} ${referrer.lastName}`
        : "a friend";

      // Process referral attribution in a transaction
      const result = await db.transaction(async (tx) => {
        // Update referral with user attribution
        await tx
          .update(referralsTable)
          .set({
            status: "signed_up",
            referredUserId: userId,
            signedUpAt: new Date(),
          })
          .where(eq(referralsTable.id, referral.id));

        // Award signup bonus to new user
        const { accountId, transactionId } = await awardReferralBonus(
          userId,
          referral.referredRewardPoints,
          referral.id,
          `Welcome bonus! You were referred by ${referrerName}`
        );

        // Mark referred reward as issued
        await tx
          .update(referralsTable)
          .set({ referredRewardIssued: true })
          .where(eq(referralsTable.id, referral.id));

        return {
          accountId,
          transactionId,
          pointsAwarded: referral.referredRewardPoints,
        };
      });

      // Log successful attribution
      console.log("Referral attributed:", {
        referralId: referral.id,
        referredUserId: userId,
        referrerId: referral.referrerId,
        pointsAwarded: result.pointsAwarded,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          success: true,
          message: "Referral successfully attributed",
          loyaltyAccount: {
            id: result.accountId,
            initialBalance: result.pointsAwarded,
          },
          referral: {
            id: referral.id,
            referrerId: referral.referrerId,
            referrerName,
            pointsAwarded: result.pointsAwarded,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      console.error("Attribute referral error:", error);
      
      // Check for unique constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        const dbError = error as any;
        if (dbError.code === '23505') { // PostgreSQL unique violation
          return NextResponse.json(
            { 
              success: false, 
              error: "Referral has already been processed" 
            },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { success: false, error: "Failed to attribute referral" },
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