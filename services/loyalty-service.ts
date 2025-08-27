/**
 * Loyalty Service
 * 
 * Centralized service for handling loyalty points operations
 * Provides methods for awarding, redeeming, and managing loyalty points
 */

import { db } from "@/db/db";
import {
  loyaltyAccountsTable,
  pointsTransactionsTable,
  referralsTable,
  loyaltyTiersTable,
  type LoyaltyAccount,
  type PointsTransaction,
} from "@/db/schema/loyalty-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and } from "drizzle-orm";

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

/**
 * Calculate tier based on lifetime points earned
 */
function calculateTier(lifetimePoints: number): keyof typeof TIER_THRESHOLDS {
  if (lifetimePoints >= TIER_THRESHOLDS.diamond) return "diamond";
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return "platinum";
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

/**
 * Calculate points expiration date
 */
function calculateExpirationDate(): Date {
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + POINTS_EXPIRATION_MONTHS);
  return expirationDate;
}

/**
 * Award points for a completed booking
 */
export async function awardBookingPoints(
  bookingId: string,
  customerId: string,
  amountInCents: number
): Promise<{
  success: boolean;
  pointsEarned?: number;
  newBalance?: number;
  error?: string;
}> {
  try {
    // Check if booking exists and belongs to customer
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.id, bookingId),
          eq(bookingsTable.customerId, customerId)
        )
      )
      .limit(1);

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    // Check if points already awarded for this booking
    const [existingTransaction] = await db
      .select()
      .from(pointsTransactionsTable)
      .where(
        and(
          eq(pointsTransactionsTable.bookingId, bookingId),
          eq(pointsTransactionsTable.type, "earned_booking")
        )
      )
      .limit(1);

    if (existingTransaction) {
      return { success: false, error: "Points already awarded for this booking" };
    }

    // Get or create loyalty account
    let [loyaltyAccount] = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.customerId, customerId))
      .limit(1);

    if (!loyaltyAccount) {
      // Create new loyalty account
      [loyaltyAccount] = await db
        .insert(loyaltyAccountsTable)
        .values({
          customerId,
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

    // Calculate points (10 points per dollar)
    const pointsEarned = Math.floor(amountInCents / 100) * POINTS_PER_DOLLAR;

    // Update account and create transaction in a transaction
    const result = await db.transaction(async (tx) => {
      const newBalance = loyaltyAccount.pointsBalance + pointsEarned;
      const newLifetimeEarned = loyaltyAccount.lifetimePointsEarned + pointsEarned;
      
      // Calculate new tier
      const newTier = calculateTier(newLifetimeEarned);
      
      // Calculate next tier threshold
      let nextThreshold = TIER_THRESHOLDS.diamond + 1;
      const tierKeys = Object.keys(TIER_THRESHOLDS) as Array<keyof typeof TIER_THRESHOLDS>;
      const currentTierIndex = tierKeys.indexOf(newTier);
      if (currentTierIndex < tierKeys.length - 1) {
        nextThreshold = TIER_THRESHOLDS[tierKeys[currentTierIndex + 1]];
      }

      // Update loyalty account
      await tx
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
        .where(eq(loyaltyAccountsTable.id, loyaltyAccount.id));

      // Create points transaction
      await tx.insert(pointsTransactionsTable).values({
        accountId: loyaltyAccount.id,
        type: "earned_booking",
        points: pointsEarned,
        balanceBefore: loyaltyAccount.pointsBalance,
        balanceAfter: newBalance,
        bookingId,
        description: `Earned ${pointsEarned} points for booking ${booking.serviceName}`,
        metadata: {
          serviceName: booking.serviceName,
          amountPaid: amountInCents / 100,
        },
        expiresAt: calculateExpirationDate(),
      });

      return {
        pointsEarned,
        newBalance,
      };
    });

    console.log(`[LOYALTY] Awarded ${result.pointsEarned} points to customer ${customerId} for booking ${bookingId}`);

    return {
      success: true,
      pointsEarned: result.pointsEarned,
      newBalance: result.newBalance,
    };
  } catch (error) {
    console.error("Failed to award loyalty points:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to award points",
    };
  }
}

/**
 * Award referral points
 */
export async function awardReferralPoints(
  referralCode: string,
  referredUserId: string
): Promise<{
  success: boolean;
  referrerPoints?: number;
  referredPoints?: number;
  error?: string;
}> {
  try {
    // Get referral record
    const [referral] = await db
      .select()
      .from(referralsTable)
      .where(eq(referralsTable.referralCode, referralCode))
      .limit(1);

    if (!referral) {
      return { success: false, error: "Invalid referral code" };
    }

    if (referral.status === "completed") {
      return { success: false, error: "Referral already completed" };
    }

    // Award points to both referrer and referred in a transaction
    await db.transaction(async (tx) => {
      // Update referral status
      await tx
        .update(referralsTable)
        .set({
          status: "completed",
          referredUserId,
          completedAt: new Date(),
          referrerRewardIssued: true,
          referredRewardIssued: true,
        })
        .where(eq(referralsTable.id, referral.id));

      // Award points to referrer
      const [referrerAccount] = await tx
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, referral.referrerId))
        .limit(1);

      if (referrerAccount) {
        const newReferrerBalance = referrerAccount.pointsBalance + REFERRER_POINTS;
        const newReferrerLifetimeEarned = referrerAccount.lifetimePointsEarned + REFERRER_POINTS;

        await tx
          .update(loyaltyAccountsTable)
          .set({
            pointsBalance: newReferrerBalance,
            lifetimePointsEarned: newReferrerLifetimeEarned,
            lastActivityAt: new Date(),
            lastEarnedAt: new Date(),
          })
          .where(eq(loyaltyAccountsTable.id, referrerAccount.id));

        await tx.insert(pointsTransactionsTable).values({
          accountId: referrerAccount.id,
          type: "earned_referral",
          points: REFERRER_POINTS,
          balanceBefore: referrerAccount.pointsBalance,
          balanceAfter: newReferrerBalance,
          referralId: referral.id,
          description: `Earned ${REFERRER_POINTS} points for successful referral`,
          metadata: { referredUserId },
          expiresAt: calculateExpirationDate(),
        });
      }

      // Award points to referred user
      let [referredAccount] = await tx
        .select()
        .from(loyaltyAccountsTable)
        .where(eq(loyaltyAccountsTable.customerId, referredUserId))
        .limit(1);

      if (!referredAccount) {
        // Create account for referred user
        [referredAccount] = await tx
          .insert(loyaltyAccountsTable)
          .values({
            customerId: referredUserId,
            pointsBalance: REFERRED_POINTS,
            lifetimePointsEarned: REFERRED_POINTS,
            lifetimePointsRedeemed: 0,
            tier: "bronze",
            tierProgressAmount: REFERRED_POINTS,
            nextTierThreshold: TIER_THRESHOLDS.silver,
            benefitsUnlocked: [],
            specialOffers: [],
            isActive: true,
            isSuspended: false,
            preferences: { email_notifications: true, auto_redeem: false },
            metadata: { referredBy: referral.referrerId },
          })
          .returning();
      } else {
        const newReferredBalance = referredAccount.pointsBalance + REFERRED_POINTS;
        const newReferredLifetimeEarned = referredAccount.lifetimePointsEarned + REFERRED_POINTS;

        await tx
          .update(loyaltyAccountsTable)
          .set({
            pointsBalance: newReferredBalance,
            lifetimePointsEarned: newReferredLifetimeEarned,
            lastActivityAt: new Date(),
            lastEarnedAt: new Date(),
          })
          .where(eq(loyaltyAccountsTable.id, referredAccount.id));
      }

      await tx.insert(pointsTransactionsTable).values({
        accountId: referredAccount.id,
        type: "earned_referral",
        points: REFERRED_POINTS,
        balanceBefore: referredAccount?.pointsBalance || 0,
        balanceAfter: (referredAccount?.pointsBalance || 0) + REFERRED_POINTS,
        referralId: referral.id,
        description: `Welcome bonus for joining through referral`,
        metadata: { referrerId: referral.referrerId },
        expiresAt: calculateExpirationDate(),
      });
    });

    console.log(`[LOYALTY] Awarded referral points: ${REFERRER_POINTS} to referrer, ${REFERRED_POINTS} to referred user`);

    return {
      success: true,
      referrerPoints: REFERRER_POINTS,
      referredPoints: REFERRED_POINTS,
    };
  } catch (error) {
    console.error("Failed to award referral points:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to award referral points",
    };
  }
}

/**
 * Get customer's loyalty account summary
 */
export async function getCustomerLoyaltySummary(customerId: string): Promise<{
  hasAccount: boolean;
  pointsBalance: number;
  tier: string;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
}> {
  try {
    const [account] = await db
      .select()
      .from(loyaltyAccountsTable)
      .where(eq(loyaltyAccountsTable.customerId, customerId))
      .limit(1);

    if (!account) {
      return {
        hasAccount: false,
        pointsBalance: 0,
        tier: "bronze",
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
      };
    }

    return {
      hasAccount: true,
      pointsBalance: account.pointsBalance,
      tier: account.tier,
      lifetimeEarned: account.lifetimePointsEarned,
      lifetimeRedeemed: account.lifetimePointsRedeemed,
    };
  } catch (error) {
    console.error("Failed to get loyalty summary:", error);
    return {
      hasAccount: false,
      pointsBalance: 0,
      tier: "bronze",
      lifetimeEarned: 0,
      lifetimeRedeemed: 0,
    };
  }
}