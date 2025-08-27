/**
 * Subscription Service
 * 
 * Core business logic for subscription management
 * Handles plan creation, subscription lifecycle, usage tracking
 */

import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { 
  subscriptionPlansTable,
  customerSubscriptionsTable,
  subscriptionUsageTable,
  subscriptionBookingsTable,
  type SubscriptionPlan,
  type CustomerSubscription,
  type NewCustomerSubscription,
  type NewSubscriptionUsage
} from "@/db/schema/subscriptions-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, gte, lte, sql, desc, isNull } from "drizzle-orm";
import { calculateFees, toStripeCents, fromStripeCents, PLATFORM_FEE_PERCENTAGE } from "@/lib/fees";

/**
 * Create a Stripe subscription for a customer
 */
export async function createStripeSubscription(params: {
  customerId: string;
  priceId: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}) {
  try {
    // First, ensure customer exists in Stripe
    let stripeCustomer;
    try {
      stripeCustomer = await stripe.customers.retrieve(params.customerId);
    } catch (error) {
      // Customer doesn't exist, create one
      const profile = await db.select().from(profilesTable)
        .where(eq(profilesTable.userId, params.customerId))
        .limit(1);
      
      if (profile.length === 0) {
        throw new Error("Profile not found");
      }

      stripeCustomer = await stripe.customers.create({
        email: profile[0].email,
        metadata: {
          userId: params.customerId,
          profileId: profile[0].id
        }
      });
    }

    // Create subscription with trial period if specified
    const subscriptionData: any = {
      customer: typeof stripeCustomer === 'string' ? stripeCustomer : stripeCustomer.id,
      items: [{ price: params.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { 
        save_default_payment_method: 'on_subscription' 
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: params.metadata
    };

    if (params.trialDays && params.trialDays > 0) {
      subscriptionData.trial_period_days = params.trialDays;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);

    return {
      subscription,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret
    };
  } catch (error) {
    console.error('Error creating Stripe subscription:', error);
    throw error;
  }
}

/**
 * Cancel a Stripe subscription
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
) {
  try {
    if (cancelAtPeriodEnd) {
      // Cancel at end of billing period
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } else {
      // Cancel immediately
      return await stripe.subscriptions.cancel(subscriptionId);
    }
  } catch (error) {
    console.error('Error canceling Stripe subscription:', error);
    throw error;
  }
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(
  subscriptionId: string,
  resumeAt?: Date
) {
  try {
    const pauseData: any = {
      pause_collection: {
        behavior: 'mark_uncollectible'
      }
    };

    if (resumeAt) {
      pauseData.pause_collection.resumes_at = Math.floor(resumeAt.getTime() / 1000);
    }

    return await stripe.subscriptions.update(subscriptionId, pauseData);
  } catch (error) {
    console.error('Error pausing subscription:', error);
    throw error;
  }
}

/**
 * Resume a paused subscription
 */
export async function resumeSubscription(subscriptionId: string) {
  try {
    return await stripe.subscriptions.update(subscriptionId, {
      pause_collection: null
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    throw error;
  }
}

/**
 * Get available subscription plans
 */
export async function getAvailablePlans(params?: {
  providerId?: string;
  isPublic?: boolean;
  includeInactive?: boolean;
}) {
  try {
    let query = db.select().from(subscriptionPlansTable);

    const conditions = [];
    
    if (params?.providerId) {
      conditions.push(eq(subscriptionPlansTable.providerId, params.providerId));
    }
    
    if (params?.isPublic !== undefined) {
      conditions.push(eq(subscriptionPlansTable.isPublic, params.isPublic));
    }
    
    if (!params?.includeInactive) {
      conditions.push(eq(subscriptionPlansTable.isActive, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const plans = await query;
    
    // Add calculated fields
    return plans.map(plan => ({
      ...plan,
      priceDisplay: fromStripeCents(plan.basePriceCents),
      setupFeeDisplay: plan.setupFeeCents ? fromStripeCents(plan.setupFeeCents) : 0,
      hasAvailability: !plan.maxSubscribers || plan.currentSubscribers < plan.maxSubscribers
    }));
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    throw error;
  }
}

/**
 * Get customer's active subscriptions
 */
export async function getCustomerSubscriptions(customerId: string) {
  try {
    const subscriptions = await db.select({
      subscription: customerSubscriptionsTable,
      plan: subscriptionPlansTable
    })
    .from(customerSubscriptionsTable)
    .innerJoin(
      subscriptionPlansTable,
      eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
    )
    .where(
      and(
        eq(customerSubscriptionsTable.customerId, customerId),
        eq(customerSubscriptionsTable.status, 'active')
      )
    );

    return subscriptions.map(({ subscription, plan }) => ({
      ...subscription,
      plan,
      canUseService: subscription.servicesUsedThisPeriod < plan.servicesPerCycle,
      servicesRemaining: plan.servicesPerCycle - subscription.servicesUsedThisPeriod
    }));
  } catch (error) {
    console.error('Error fetching customer subscriptions:', error);
    throw error;
  }
}

/**
 * Track subscription usage
 */
export async function trackSubscriptionUsage(
  subscriptionId: string,
  bookingId?: string
) {
  try {
    // Get subscription details
    const subscription = await db.select({
      subscription: customerSubscriptionsTable,
      plan: subscriptionPlansTable
    })
    .from(customerSubscriptionsTable)
    .innerJoin(
      subscriptionPlansTable,
      eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
    )
    .where(eq(customerSubscriptionsTable.id, subscriptionId))
    .limit(1);

    if (subscription.length === 0) {
      throw new Error("Subscription not found");
    }

    const { subscription: sub, plan } = subscription[0];

    // Check if usage limit reached
    const servicesPerCycle = plan.servicesPerCycle ?? 0;
    const servicesUsedThisPeriod = sub.servicesUsedThisPeriod ?? 0;
    
    if (servicesUsedThisPeriod >= servicesPerCycle) {
      throw new Error("Subscription usage limit reached for this period");
    }

    // Update usage count
    await db.update(customerSubscriptionsTable)
      .set({
        servicesUsedThisPeriod: sql`${customerSubscriptionsTable.servicesUsedThisPeriod} + 1`,
        totalServicesUsed: sql`${customerSubscriptionsTable.totalServicesUsed} + 1`,
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Link booking to subscription if provided
    if (bookingId) {
      await db.insert(subscriptionBookingsTable).values({
        subscriptionId,
        bookingId,
        scheduledFor: new Date(),
        billingPeriodStart: sub.currentPeriodStart,
        billingPeriodEnd: sub.currentPeriodEnd
      });
    }

    return {
      success: true,
      servicesUsed: servicesUsedThisPeriod + 1,
      servicesRemaining: servicesPerCycle - (servicesUsedThisPeriod + 1)
    };
  } catch (error) {
    console.error('Error tracking subscription usage:', error);
    throw error;
  }
}

/**
 * Reset subscription usage for new billing period
 */
export async function resetPeriodUsage(subscriptionId: string) {
  try {
    const subscription = await db.select()
      .from(customerSubscriptionsTable)
      .where(eq(customerSubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (subscription.length === 0) {
      throw new Error("Subscription not found");
    }

    const sub = subscription[0];

    // Record usage history before reset
    await db.insert(subscriptionUsageTable).values({
      subscriptionId,
      periodStart: sub.currentPeriodStart!,
      periodEnd: sub.currentPeriodEnd!,
      servicesIncluded: 0, // Will be set from plan
      servicesUsed: sub.servicesUsedThisPeriod ?? 0,
      servicesRemaining: 0 // Will be calculated
    });

    // Reset usage counter
    await db.update(customerSubscriptionsTable)
      .set({
        servicesUsedThisPeriod: 0,
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    return { success: true };
  } catch (error) {
    console.error('Error resetting period usage:', error);
    throw error;
  }
}

/**
 * Update subscription status from Stripe webhook
 */
export async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  periodStart?: Date,
  periodEnd?: Date
) {
  try {
    const updates: any = {
      status,
      updatedAt: new Date()
    };

    if (periodStart) updates.currentPeriodStart = periodStart;
    if (periodEnd) updates.currentPeriodEnd = periodEnd;

    if (status === 'canceled') {
      updates.canceledAt = new Date();
    }

    await db.update(customerSubscriptionsTable)
      .set(updates)
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, stripeSubscriptionId));

    return { success: true };
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
}

/**
 * Check if customer has access through subscription
 */
export async function hasSubscriptionAccess(
  customerId: string,
  providerId: string
): Promise<boolean> {
  try {
    const activeSubscriptions = await db.select()
      .from(customerSubscriptionsTable)
      .innerJoin(
        subscriptionPlansTable,
        eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
      )
      .where(
        and(
          eq(customerSubscriptionsTable.customerId, customerId),
          eq(customerSubscriptionsTable.status, 'active'),
          eq(subscriptionPlansTable.providerId, providerId)
        )
      )
      .limit(1);

    return activeSubscriptions.length > 0;
  } catch (error) {
    console.error('Error checking subscription access:', error);
    return false;
  }
}

/**
 * Calculate subscription fees (includes platform fee)
 */
export function calculateSubscriptionFees(
  basePriceCents: number,
  isGuest: boolean = false
) {
  const baseAmount = fromStripeCents(basePriceCents);
  return calculateFees(baseAmount, isGuest);
}