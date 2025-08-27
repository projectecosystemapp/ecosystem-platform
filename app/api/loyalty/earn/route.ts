// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { 
  loyaltyAccountsTable, 
  pointsTransactionsTable,
  referralsTable,
  loyaltyTiersTable,
  type PointsTransaction
} from "@/db/schema/loyalty-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";
import crypto from "crypto";

// Input validation schemas
const earnPointsBookingSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  amountPaidCents: z.number().int().positive("Amount must be positive"),
});

const earnPointsReferralSchema = z.object({
  referralCode: z.string().min(1, "Referral code is required"),
  referredUserId: z.string().min(1, "Referred user ID is required"),
});

const earnPointsBonusSchema = z.object({
  reason: z.enum(["review", "birthday", "milestone", "campaign", "manual"]),
  points: z.number().int().positive("Points must be positive"),
  description: z.string().max(500),
  metadata: z.record(z.any()).optional(),
});

const earnPointsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("booking"),
    data: earnPointsBookingSchema,
  }),
  z.object({
    type: z.literal("referral"),
    data: earnPointsReferralSchema,
  }),
  z.object({
    type: z.literal("bonus"),
    data: earnPointsBonusSchema,
  }),
]);

// Constants
const POINTS_PER_DOLLAR = 10; // 10 points per dollar spent
const REFERRER_POINTS = 500;
const REFERRED_POINTS = 250;
const POINTS_EXPIRATION_MONTHS = 12;

// Tier thresholds
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 10000,
  diamond: 25000,
};

// Helper function to determine tier based on lifetime points
function calculateTier(lifetimePoints: number): keyof typeof TIER_THRESHOLDS {
  if (lifetimePoints >= TIER_THRESHOLDS.diamond) return "diamond";
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return "platinum";
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

// Helper function to calculate points expiration date
function calculateExpirationDate(): Date {
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + POINTS_EXPIRATION_MONTHS);
  return expirationDate;
}

// Main POST handler for earning points
export const POST = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Authenticate user
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { 
            success: false,
            error: "Authentication required" 
          },
          { status: 401 }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const validationResult = earnPointsSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }

      const { type, data } = validationResult.data;

      // Get or create loyalty account
      let [loyaltyAccount] = await db
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, userId))
        .limit(1);

      if (!loyaltyAccount) {
        // Create new loyalty account
        [loyaltyAccount] = await db
          .insert(loyaltyAccountsTable)
          .values({
            customerId: userId,
            pointsBalance: 0,
            lifetimePointsEarned: 0,
            lifetimePointsRedeemed: 0,
            tier: "bronze",
            tierProgressAmount: 0,
            nextTierThreshold: TIER_THRESHOLDS.silver,
            benefitsUnlocked: [],
            specialOffers: [],
            isActive: true,
            isSuspended: false,
            preferences: { email_notifications: true, auto_redeem: false },
            metadata: {},
          })
          .returning();
      }

      // Check if account is suspended
      if (loyaltyAccount.isSuspended) {
        return NextResponse.json(
          { 
            success: false,
            error: "Loyalty account is suspended",
            reason: loyaltyAccount.suspensionReason 
          },
          { status: 403 }
        );
      }

      let pointsEarned = 0;
      let transactionType: PointsTransaction["type"];
      let description: string;
      let relatedBookingId: string | null = null;
      let relatedReferralId: string | null = null;
      let metadata: Record<string, any> = {};

      // Process based on earning type
      switch (type) {
        case "booking": {
          // Check if booking exists and belongs to user
          const [booking] = await db
            .select()
            .from(bookingsTable)
            .where(
              and(
                eq(bookingsTable.id, data.bookingId),
                eq(bookingsTable.customerId, userId)
              )
            )
            .limit(1);

          if (!booking) {
            return NextResponse.json(
              { 
                success: false,
                error: "Booking not found or does not belong to user" 
              },
              { status: 404 }
            );
          }

          // Check if points already awarded for this booking
          const [existingTransaction] = await db
            .select()
            .from(pointsTransactionsTable)
            .where(
              and(
                eq(pointsTransactionsTable.bookingId, data.bookingId),
                eq(pointsTransactionsTable.type, "earned_booking")
              )
            )
            .limit(1);

          if (existingTransaction) {
            return NextResponse.json(
              { 
                success: false,
                error: "Points already awarded for this booking" 
              },
              { status: 400 }
            );
          }

          // Calculate points (10 points per dollar spent)
          pointsEarned = Math.floor(data.amountPaidCents / 100) * POINTS_PER_DOLLAR;
          transactionType = "earned_booking";
          description = `Earned ${pointsEarned} points for booking ${booking.serviceName}`;
          relatedBookingId = data.bookingId;
          metadata = {
            serviceName: booking.serviceName,
            amountPaid: data.amountPaidCents / 100,
          };
          break;
        }

        case "referral": {
          // Check if referral exists and is valid
          const [referral] = await db
            .select()
            .from(referralsTable)
            .where(
              and(
                eq(referralsTable.referralCode, data.referralCode),
                eq(referralsTable.referrerId, userId)
              )
            )
            .limit(1);

          if (!referral) {
            return NextResponse.json(
              { 
                success: false,
                error: "Invalid referral code" 
              },
              { status: 404 }
            );
          }

          // Check if referral has already been completed
          if (referral.status === "completed") {
            return NextResponse.json(
              { 
                success: false,
                error: "Referral has already been completed" 
              },
              { status: 400 }
            );
          }

          // Check if referral has expired
          if (referral.expiresAt && new Date(referral.expiresAt) < new Date()) {
            return NextResponse.json(
              { 
                success: false,
                error: "Referral has expired" 
              },
              { status: 400 }
            );
          }

          // Update referral status
          await db
            .update(referralsTable)
            .set({
              status: "completed",
              referredUserId: data.referredUserId,
              completedAt: new Date(),
              referrerRewardIssued: true,
            })
            .where(eq(referralsTable.id, referral.id));

          pointsEarned = REFERRER_POINTS;
          transactionType = "earned_referral";
          description = `Earned ${pointsEarned} points for successful referral`;
          relatedReferralId = referral.id;
          metadata = {
            referredUserId: data.referredUserId,
            referralCode: data.referralCode,
          };

          // Also award points to referred user
          const [referredAccount] = await db
            .select()
            .from(loyaltyAccountsTable)
            .where(eq(loyaltyAccountsTable.customerId, data.referredUserId))
            .limit(1);

          if (referredAccount) {
            await db.transaction(async (tx) => {
              // Update referred user's balance
              await tx
                .update(loyaltyAccountsTable)
                .set({
                  pointsBalance: referredAccount.pointsBalance + REFERRED_POINTS,
                  lifetimePointsEarned: referredAccount.lifetimePointsEarned + REFERRED_POINTS,
                  lastActivityAt: new Date(),
                  lastEarnedAt: new Date(),
                })
                .where(eq(loyaltyAccountsTable.id, referredAccount.id));

              // Create transaction for referred user
              await tx.insert(pointsTransactionsTable).values({
                accountId: referredAccount.id,
                type: "earned_referral",
                points: REFERRED_POINTS,
                balanceBefore: referredAccount.pointsBalance,
                balanceAfter: referredAccount.pointsBalance + REFERRED_POINTS,
                referralId: referral.id,
                description: `Welcome bonus for joining through referral`,
                metadata: { referrerId: userId },
                expiresAt: calculateExpirationDate(),
              });
            });
          }
          break;
        }

        case "bonus": {
          pointsEarned = data.points;
          transactionType = "earned_bonus";
          description = data.description;
          metadata = {
            reason: data.reason,
            ...data.metadata,
          };
          break;
        }
      }

      // Update loyalty account with transaction
      const updatedAccount = await db.transaction(async (tx) => {
        // Calculate new balance and lifetime earned
        const newBalance = loyaltyAccount.pointsBalance + pointsEarned;
        const newLifetimeEarned = loyaltyAccount.lifetimePointsEarned + pointsEarned;
        
        // Calculate new tier
        const newTier = calculateTier(newLifetimeEarned);
        const tierChanged = newTier !== loyaltyAccount.tier;
        
        // Calculate next tier threshold
        let nextThreshold = TIER_THRESHOLDS.diamond + 1; // Max tier
        const tierKeys = Object.keys(TIER_THRESHOLDS) as Array<keyof typeof TIER_THRESHOLDS>;
        const currentTierIndex = tierKeys.indexOf(newTier);
        if (currentTierIndex < tierKeys.length - 1) {
          nextThreshold = TIER_THRESHOLDS[tierKeys[currentTierIndex + 1]];
        }

        // Update loyalty account
        const [updated] = await tx
          .update(loyaltyAccountsTable)
          .set({
            pointsBalance: newBalance,
            lifetimePointsEarned: newLifetimeEarned,
            tier: newTier,
            tierProgressAmount: newLifetimeEarned,
            nextTierThreshold: nextThreshold,
            lastActivityAt: new Date(),
            lastEarnedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(loyaltyAccountsTable.id, loyaltyAccount.id))
          .returning();

        // Create points transaction
        await tx.insert(pointsTransactionsTable).values({
          accountId: loyaltyAccount.id,
          type: transactionType,
          points: pointsEarned,
          balanceBefore: loyaltyAccount.pointsBalance,
          balanceAfter: newBalance,
          bookingId: relatedBookingId,
          referralId: relatedReferralId,
          description,
          metadata,
          expiresAt: calculateExpirationDate(),
        });

        // If tier changed, update benefits
        if (tierChanged) {
          const [tierInfo] = await tx
            .select()
            .from(loyaltyTiersTable)
            .where(eq(loyaltyTiersTable.tier, newTier))
            .limit(1);

          if (tierInfo) {
            await tx
              .update(loyaltyAccountsTable)
              .set({
                benefitsUnlocked: tierInfo.benefits as any || [],
                metadata: {
                  ...loyaltyAccount.metadata,
                  tierUpgradedAt: new Date().toISOString(),
                  previousTier: loyaltyAccount.tier,
                },
              })
              .where(eq(loyaltyAccountsTable.id, loyaltyAccount.id));
          }
        }

        return updated;
      });

      // Log the transaction
      const logger = logApiStart("/api/loyalty/earn", "POST", userId);
      logApiSuccess(logger, "Points earned successfully", {
        type: transactionType,
        points: pointsEarned,
        newBalance: updatedAccount.pointsBalance,
        tier: updatedAccount.tier
      });

      // Return success response
      return NextResponse.json(
        {
          success: true,
          data: {
            pointsEarned,
            newBalance: updatedAccount.pointsBalance,
            lifetimeEarned: updatedAccount.lifetimePointsEarned,
            tier: updatedAccount.tier,
            nextTierThreshold: updatedAccount.nextTierThreshold,
            tierProgress: updatedAccount.tierProgressAmount,
            description,
          },
        },
        { status: 200 }
      );

    } catch (error) {
      const logger = logApiStart("/api/loyalty/earn", "POST", userId || "anonymous");
      logApiError(logger, "Failed to earn points", error as Error);
      
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to award points. Please try again." 
        },
        { status: 500 }
      );
    }
  }
);

// OPTIONS request for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}