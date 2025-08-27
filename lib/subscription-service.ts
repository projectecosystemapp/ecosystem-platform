import { db } from "@/db/db";
import {
  customerSubscriptionsTable,
  subscriptionPlansTable,
  subscriptionUsageRecordsTable,
  subscriptionUsageSummariesTable,
  subscriptionBookingsTable,
} from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { calculateFees } from "@/lib/fees";

export interface SubscriptionBenefit {
  discountPercent?: number;
  includedInSubscription?: boolean;
  priorityBooking?: boolean;
  allowOverage?: boolean;
  overageRateCents?: number;
}

export interface SubscriptionUsage {
  subscriptionId: string;
  planId: string;
  status: string;
  servicesPerCycle: number;
  servicesUsedThisPeriod: number;
  servicesRemaining: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  benefits: SubscriptionBenefit;
  canUseService: boolean;
  isOverage: boolean;
  overageRate?: number;
}

export interface PricingAdjustment {
  originalPrice: number;
  finalPrice: number;
  discountApplied: number;
  overageCharge: number;
  isIncludedInSubscription: boolean;
  platformFee: number;
  providerPayout: number;
  totalAmount: number;
}

/**
 * Get active subscription for a customer and provider
 */
export async function getActiveSubscription(
  customerId: string, 
  providerId: string
): Promise<SubscriptionUsage | null> {
  try {
    const [subscription] = await db
      .select({
        subscription: customerSubscriptionsTable,
        plan: subscriptionPlansTable,
      })
      .from(customerSubscriptionsTable)
      .innerJoin(
        subscriptionPlansTable,
        eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
      )
      .where(
        and(
          eq(customerSubscriptionsTable.customerId, customerId),
          eq(subscriptionPlansTable.providerId, providerId),
          eq(customerSubscriptionsTable.status, 'active')
        )
      )
      .limit(1);

    if (!subscription) {
      return null;
    }

    const { subscription: sub, plan } = subscription;
    const servicesUsed = sub.servicesUsedThisPeriod || 0;
    const allowance = plan.servicesPerCycle || 1;
    const benefits = (plan.benefits as SubscriptionBenefit) || {};

    return {
      subscriptionId: sub.id,
      planId: plan.id,
      status: sub.status,
      servicesPerCycle: allowance,
      servicesUsedThisPeriod: servicesUsed,
      servicesRemaining: Math.max(0, allowance - servicesUsed),
      currentPeriodStart: sub.currentPeriodStart!,
      currentPeriodEnd: sub.currentPeriodEnd!,
      benefits,
      canUseService: servicesUsed < allowance || benefits.allowOverage === true,
      isOverage: servicesUsed >= allowance,
      overageRate: benefits.overageRateCents ? benefits.overageRateCents / 100 : undefined,
    };
  } catch (error) {
    console.error("Error getting active subscription:", error);
    return null;
  }
}

/**
 * Calculate pricing with subscription benefits applied
 */
export function calculateSubscriptionPricing(
  originalPrice: number,
  subscription: SubscriptionUsage,
  isGuestBooking: boolean = false
): PricingAdjustment {
  let finalPrice = originalPrice;
  let discountApplied = 0;
  let overageCharge = 0;
  let isIncludedInSubscription = false;

  const { benefits, isOverage, overageRate } = subscription;

  if (isOverage) {
    // Handle overage charges
    if (overageRate) {
      overageCharge = overageRate;
      finalPrice = originalPrice + overageCharge;
    } else if (!benefits.allowOverage) {
      throw new Error("Service allowance exceeded and overage not allowed");
    }
  } else {
    // Apply subscription benefits for services within allowance
    if (benefits.includedInSubscription) {
      // Service is completely included in subscription
      finalPrice = 0;
      isIncludedInSubscription = true;
    } else if (benefits.discountPercent) {
      // Apply percentage discount
      discountApplied = (originalPrice * benefits.discountPercent) / 100;
      finalPrice = originalPrice - discountApplied;
    }
  }

  // Calculate platform fees on the final price
  const fees = calculateFees(finalPrice, isGuestBooking);

  return {
    originalPrice,
    finalPrice,
    discountApplied,
    overageCharge,
    isIncludedInSubscription,
    platformFee: fees.platformFee,
    providerPayout: fees.providerPayout,
    totalAmount: fees.totalAmount,
  };
}

/**
 * Record subscription usage when a service is consumed
 */
export async function recordSubscriptionUsage(
  subscriptionId: string,
  bookingId: string,
  description?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await db.transaction(async (tx) => {
    // Get subscription details
    const [sub] = await tx
      .select({
        subscription: customerSubscriptionsTable,
        plan: subscriptionPlansTable,
      })
      .from(customerSubscriptionsTable)
      .innerJoin(
        subscriptionPlansTable,
        eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
      )
      .where(eq(customerSubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!sub) {
      throw new Error("Subscription not found");
    }

    const { subscription, plan } = sub;
    const currentUsage = subscription.servicesUsedThisPeriod || 0;
    const allowance = plan.servicesPerCycle || 1;
    const newUsage = currentUsage + 1;
    const isOverage = newUsage > allowance;

    // Record usage
    await tx
      .insert(subscriptionUsageRecordsTable)
      .values({
        subscriptionId,
        action: 'service_used',
        quantity: -1, // Negative for usage
        bookingId,
        periodStart: subscription.currentPeriodStart!,
        periodEnd: subscription.currentPeriodEnd!,
        balanceBefore: allowance - currentUsage,
        balanceAfter: allowance - newUsage,
        isOverage,
        description: description || `Service used: ${bookingId}`,
        metadata,
      });

    // Update subscription usage counter
    await tx
      .update(customerSubscriptionsTable)
      .set({
        servicesUsedThisPeriod: newUsage,
        totalServicesUsed: (subscription.totalServicesUsed || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Update or create usage summary
    const [existingSummary] = await tx
      .select()
      .from(subscriptionUsageSummariesTable)
      .where(
        and(
          eq(subscriptionUsageSummariesTable.subscriptionId, subscriptionId),
          eq(subscriptionUsageSummariesTable.periodStart, subscription.currentPeriodStart!),
          eq(subscriptionUsageSummariesTable.periodEnd, subscription.currentPeriodEnd!)
        )
      )
      .limit(1);

    if (existingSummary) {
      await tx
        .update(subscriptionUsageSummariesTable)
        .set({
          servicesUsed: newUsage,
          servicesRemaining: Math.max(0, allowance - newUsage),
          overageServices: isOverage ? newUsage - allowance : 0,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionUsageSummariesTable.id, existingSummary.id));
    } else {
      await tx
        .insert(subscriptionUsageSummariesTable)
        .values({
          subscriptionId,
          periodStart: subscription.currentPeriodStart!,
          periodEnd: subscription.currentPeriodEnd!,
          includedServices: allowance,
          bonusServices: 0,
          totalAllowance: allowance,
          servicesUsed: newUsage,
          servicesRemaining: Math.max(0, allowance - newUsage),
          overageServices: isOverage ? newUsage - allowance : 0,
          nextResetDate: subscription.currentPeriodEnd!,
        });
    }

    // Link booking to subscription
    await tx
      .insert(subscriptionBookingsTable)
      .values({
        subscriptionId,
        bookingId,
        scheduledFor: new Date(),
        autoScheduled: true,
        billingPeriodStart: subscription.currentPeriodStart,
        billingPeriodEnd: subscription.currentPeriodEnd,
      });
  });
}

/**
 * Check if customer has subscription benefits available
 */
export async function checkSubscriptionEligibility(
  customerId: string,
  providerId: string,
  servicePrice: number
): Promise<{
  hasSubscription: boolean;
  subscription?: SubscriptionUsage;
  pricing?: PricingAdjustment;
  eligibility: {
    canUseService: boolean;
    reason?: string;
  };
}> {
  try {
    const subscription = await getActiveSubscription(customerId, providerId);
    
    if (!subscription) {
      return {
        hasSubscription: false,
        eligibility: {
          canUseService: true, // Can use service without subscription
        },
      };
    }

    // Check if subscription allows service usage
    if (!subscription.canUseService) {
      return {
        hasSubscription: true,
        subscription,
        eligibility: {
          canUseService: false,
          reason: "Service allowance exceeded and overage not permitted",
        },
      };
    }

    // Calculate pricing with subscription benefits
    const pricing = calculateSubscriptionPricing(servicePrice, subscription);

    return {
      hasSubscription: true,
      subscription,
      pricing,
      eligibility: {
        canUseService: true,
      },
    };
  } catch (error) {
    console.error("Error checking subscription eligibility:", error);
    return {
      hasSubscription: false,
      eligibility: {
        canUseService: true, // Default to allowing service
      },
    };
  }
}

/**
 * Reset subscription usage for a new billing period
 */
export async function resetSubscriptionPeriod(
  subscriptionId: string,
  newPeriodStart: Date,
  newPeriodEnd: Date
): Promise<void> {
  await db.transaction(async (tx) => {
    // Mark current period as complete
    await tx
      .update(subscriptionUsageSummariesTable)
      .set({
        isPeriodComplete: true,
        updatedAt: new Date(),
      })
      .where(
        eq(subscriptionUsageSummariesTable.subscriptionId, subscriptionId)
      );

    // Reset usage counter
    await tx
      .update(customerSubscriptionsTable)
      .set({
        servicesUsedThisPeriod: 0,
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Record period reset
    await tx
      .insert(subscriptionUsageRecordsTable)
      .values({
        subscriptionId,
        action: 'period_reset',
        quantity: 0,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
        balanceBefore: 0,
        balanceAfter: 0,
        description: 'Billing period reset',
      });

    // Create new period summary
    const [plan] = await tx
      .select()
      .from(subscriptionPlansTable)
      .innerJoin(
        customerSubscriptionsTable,
        eq(subscriptionPlansTable.id, customerSubscriptionsTable.planId)
      )
      .where(eq(customerSubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (plan) {
      await tx
        .insert(subscriptionUsageSummariesTable)
        .values({
          subscriptionId,
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd,
          includedServices: plan.subscription_plans.servicesPerCycle || 1,
          bonusServices: 0,
          totalAllowance: plan.subscription_plans.servicesPerCycle || 1,
          servicesUsed: 0,
          servicesRemaining: plan.subscription_plans.servicesPerCycle || 1,
          overageServices: 0,
          nextResetDate: newPeriodEnd,
        });
    }
  });
}