/**
 * Subscription Manager
 * 
 * Central module for managing subscription lifecycle, usage tracking, and billing operations.
 * Provides a unified interface for subscription-related operations across the platform.
 */

import { db } from '@/db/db';
import { 
  customerSubscriptionsTable, 
  subscriptionUsageTable,
  subscriptionPlansTable,
  profilesTable,
  subscriptionBookingsTable
} from '@/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { notificationService, NotificationType } from '@/lib/notifications/notification-service';

export interface SubscriptionUsageInfo {
  subscriptionId: string;
  customerId: string;
  planId: string;
  servicesUsed: number;
  servicesRemaining: number;
  totalServicesPerPeriod: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  status: string;
  canUseService: boolean;
}

export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  description: string | null;
  billingCycle: string;
  basePriceCents: number;
  servicesPerCycle: number | null;
  trialDays: number | null;
  features: any;
  benefits: any;
  isActive: boolean;
  availableSlots?: number;
}

export class SubscriptionManager {
  /**
   * Check if a customer can use a service based on their subscription
   */
  async canUseService(customerId: string): Promise<{
    allowed: boolean;
    reason?: string;
    subscriptionInfo?: SubscriptionUsageInfo;
  }> {
    try {
      // Get active subscription
      const subscription = await this.getActiveSubscription(customerId);
      
      if (!subscription) {
        return {
          allowed: false,
          reason: 'No active subscription found'
        };
      }

      // Get current usage info
      const usageInfo = await this.getCurrentUsage(subscription.id);
      
      if (!usageInfo) {
        return {
          allowed: false,
          reason: 'Unable to retrieve usage information'
        };
      }

      // Check if service limit reached
      if (usageInfo.servicesRemaining <= 0) {
        return {
          allowed: false,
          reason: 'Service limit reached for current billing period',
          subscriptionInfo: usageInfo
        };
      }

      // Check subscription status
      if (!['active', 'trialing'].includes(subscription.status)) {
        return {
          allowed: false,
          reason: `Subscription is ${subscription.status}`,
          subscriptionInfo: usageInfo
        };
      }

      return {
        allowed: true,
        subscriptionInfo: usageInfo
      };

    } catch (error) {
      console.error('Error checking service availability:', error);
      return {
        allowed: false,
        reason: 'Error checking subscription status'
      };
    }
  }

  /**
   * Record service usage for a subscription
   */
  async recordServiceUsage(
    subscriptionId: string,
    bookingId?: string
  ): Promise<boolean> {
    try {
      const result = await db.transaction(async (tx) => {
        // Get current subscription
        const [subscription] = await tx
          .select()
          .from(customerSubscriptionsTable)
          .where(eq(customerSubscriptionsTable.id, subscriptionId))
          .limit(1);

        if (!subscription) {
          throw new Error('Subscription not found');
        }

        // Increment usage counter
        await tx
          .update(customerSubscriptionsTable)
          .set({
            servicesUsedThisPeriod: (subscription.servicesUsedThisPeriod || 0) + 1,
            totalServicesUsed: (subscription.totalServicesUsed || 0) + 1,
            updatedAt: new Date()
          })
          .where(eq(customerSubscriptionsTable.id, subscriptionId));

        // Update current period usage record
        await tx
          .update(subscriptionUsageTable)
          .set({
            servicesUsed: sql`${subscriptionUsageTable.servicesUsed} + 1`,
            servicesRemaining: sql`GREATEST(0, ${subscriptionUsageTable.servicesRemaining} - 1)`
          })
          .where(
            and(
              eq(subscriptionUsageTable.subscriptionId, subscriptionId),
              eq(subscriptionUsageTable.periodStart, subscription.currentPeriodStart!)
            )
          );

        // Create subscription booking record if bookingId provided
        if (bookingId) {
          await tx.insert(subscriptionBookingsTable).values({
            subscriptionId,
            bookingId,
            scheduledFor: new Date(),
            autoScheduled: false,
            billingPeriodStart: subscription.currentPeriodStart,
            billingPeriodEnd: subscription.currentPeriodEnd,
            isCompleted: false
          });
        }

        return true;
      });

      console.log(`Recorded service usage for subscription ${subscriptionId}`);
      return result;

    } catch (error) {
      console.error('Error recording service usage:', error);
      return false;
    }
  }

  /**
   * Get active subscription for a customer
   */
  async getActiveSubscription(customerId: string) {
    try {
      const [subscription] = await db
        .select()
        .from(customerSubscriptionsTable)
        .where(
          and(
            eq(customerSubscriptionsTable.customerId, customerId),
            sql`${customerSubscriptionsTable.status} IN ('active', 'trialing')`
          )
        )
        .orderBy(desc(customerSubscriptionsTable.createdAt))
        .limit(1);

      return subscription;
    } catch (error) {
      console.error('Error getting active subscription:', error);
      return null;
    }
  }

  /**
   * Get current usage information for a subscription
   */
  async getCurrentUsage(subscriptionId: string): Promise<SubscriptionUsageInfo | null> {
    try {
      const [result] = await db
        .select({
          subscription: customerSubscriptionsTable,
          plan: subscriptionPlansTable
        })
        .from(customerSubscriptionsTable)
        .leftJoin(
          subscriptionPlansTable,
          eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
        )
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!result || !result.subscription) {
        return null;
      }

      const servicesPerPeriod = result.plan?.servicesPerCycle || 1;
      const servicesUsed = result.subscription.servicesUsedThisPeriod || 0;
      const servicesRemaining = Math.max(0, servicesPerPeriod - servicesUsed);

      return {
        subscriptionId: result.subscription.id,
        customerId: result.subscription.customerId,
        planId: result.subscription.planId,
        servicesUsed,
        servicesRemaining,
        totalServicesPerPeriod: servicesPerPeriod,
        currentPeriodStart: result.subscription.currentPeriodStart!,
        currentPeriodEnd: result.subscription.currentPeriodEnd!,
        status: result.subscription.status,
        canUseService: servicesRemaining > 0 && ['active', 'trialing'].includes(result.subscription.status)
      };

    } catch (error) {
      console.error('Error getting usage info:', error);
      return null;
    }
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerId: string) {
    try {
      const subscriptions = await db
        .select({
          subscription: customerSubscriptionsTable,
          plan: subscriptionPlansTable
        })
        .from(customerSubscriptionsTable)
        .leftJoin(
          subscriptionPlansTable,
          eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
        )
        .where(eq(customerSubscriptionsTable.customerId, customerId))
        .orderBy(desc(customerSubscriptionsTable.createdAt));

      return subscriptions;
    } catch (error) {
      console.error('Error getting customer subscriptions:', error);
      return [];
    }
  }

  /**
   * Get usage history for a subscription
   */
  async getUsageHistory(subscriptionId: string, limit = 12) {
    try {
      const usage = await db
        .select()
        .from(subscriptionUsageTable)
        .where(eq(subscriptionUsageTable.subscriptionId, subscriptionId))
        .orderBy(desc(subscriptionUsageTable.periodStart))
        .limit(limit);

      return usage;
    } catch (error) {
      console.error('Error getting usage history:', error);
      return [];
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    reason?: string,
    feedback?: string,
    cancelAtPeriodEnd = true
  ): Promise<boolean> {
    try {
      const [subscription] = await db
        .select()
        .from(customerSubscriptionsTable)
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!subscription || !subscription.stripeSubscriptionId) {
        console.error('Subscription not found or not linked to Stripe');
        return false;
      }

      // Cancel in Stripe
      const stripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: cancelAtPeriodEnd,
          cancellation_details: {
            comment: feedback,
          } as any, // Type workaround for Stripe SDK
          metadata: {
            cancellation_reason: reason || 'customer_request'
          }
        }
      );

      // Update local record
      await db
        .update(customerSubscriptionsTable)
        .set({
          cancelAtPeriodEnd,
          cancelationReason: reason,
          canceledAt: cancelAtPeriodEnd ? null : new Date(),
          status: cancelAtPeriodEnd ? subscription.status : 'canceled',
          updatedAt: new Date()
        })
        .where(eq(customerSubscriptionsTable.id, subscriptionId));

      // Send cancellation notification
      const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, subscription.customerId))
        .limit(1);

      if (profile?.email) {
        await notificationService.queue({
          type: NotificationType.BOOKING_CANCELLED,
          recipientEmail: profile.email,
          recipientId: profile.userId,
          metadata: {
            subscriptionId,
            reason,
            feedback,
            cancelAtPeriodEnd,
            endDate: (stripeSubscription as any).current_period_end 
              ? new Date((stripeSubscription as any).current_period_end * 1000).toISOString()
              : null
          }
        });
      }

      console.log(`Subscription ${subscriptionId} cancelled successfully`);
      return true;

    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(
    subscriptionId: string,
    resumeAt?: Date,
    reason?: string
  ): Promise<boolean> {
    try {
      const [subscription] = await db
        .select()
        .from(customerSubscriptionsTable)
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!subscription || !subscription.stripeSubscriptionId) {
        return false;
      }

      // Pause in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        pause_collection: {
          behavior: 'void',
          resumes_at: resumeAt ? Math.floor(resumeAt.getTime() / 1000) : undefined
        } as any // Type workaround
      });

      // Update local record
      await db
        .update(customerSubscriptionsTable)
        .set({
          status: 'paused',
          pausedAt: new Date(),
          pauseReason: reason,
          resumeAt,
          updatedAt: new Date()
        })
        .where(eq(customerSubscriptionsTable.id, subscriptionId));

      console.log(`Subscription ${subscriptionId} paused`);
      return true;

    } catch (error) {
      console.error('Error pausing subscription:', error);
      return false;
    }
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const [subscription] = await db
        .select()
        .from(customerSubscriptionsTable)
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!subscription || !subscription.stripeSubscriptionId) {
        return false;
      }

      // Resume in Stripe
      const stripeSubscription = await stripe.subscriptions.update(
        subscription.stripeSubscriptionId, 
        {
          pause_collection: null as any // Remove pause
        }
      );

      // Update local record
      await db
        .update(customerSubscriptionsTable)
        .set({
          status: 'active',
          pausedAt: null,
          pauseReason: null,
          resumeAt: null,
          updatedAt: new Date()
        })
        .where(eq(customerSubscriptionsTable.id, subscriptionId));

      console.log(`Subscription ${subscriptionId} resumed`);
      return true;

    } catch (error) {
      console.error('Error resuming subscription:', error);
      return false;
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscriptionPlan(
    subscriptionId: string,
    newPlanId: string,
    prorationBehavior: 'create_prorations' | 'none' | 'always_invoice' = 'create_prorations'
  ): Promise<boolean> {
    try {
      const [subscription] = await db
        .select()
        .from(customerSubscriptionsTable)
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      const [newPlan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, newPlanId))
        .limit(1);

      if (!subscription || !newPlan || !subscription.stripeSubscriptionId) {
        return false;
      }

      // Get current Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      // Update subscription in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price: newPlan.stripePriceId!,
        }],
        proration_behavior: prorationBehavior
      });

      // Update local record
      await db
        .update(customerSubscriptionsTable)
        .set({
          planId: newPlanId,
          updatedAt: new Date()
        })
        .where(eq(customerSubscriptionsTable.id, subscriptionId));

      console.log(`Subscription ${subscriptionId} updated to plan ${newPlanId}`);
      return true;

    } catch (error) {
      console.error('Error updating subscription plan:', error);
      return false;
    }
  }

  /**
   * Get available subscription plans
   */
  async getAvailablePlans(includeInactive = false): Promise<SubscriptionPlanInfo[]> {
    try {
      const conditions = [
        eq(subscriptionPlansTable.isPublic, true)
      ];
      
      if (!includeInactive) {
        conditions.push(eq(subscriptionPlansTable.isActive, true));
      }

      const plans = await db
        .select()
        .from(subscriptionPlansTable)
        .where(and(...conditions))
        .orderBy(subscriptionPlansTable.basePriceCents);

      return plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        billingCycle: plan.billingCycle,
        basePriceCents: plan.basePriceCents,
        servicesPerCycle: plan.servicesPerCycle,
        trialDays: plan.trialDays,
        features: plan.features,
        benefits: plan.benefits,
        isActive: plan.isActive ?? false,
        availableSlots: plan.maxSubscribers 
          ? plan.maxSubscribers - (plan.currentSubscribers || 0)
          : undefined
      }));

    } catch (error) {
      console.error('Error getting available plans:', error);
      return [];
    }
  }

  /**
   * Check if a plan has available slots
   */
  async isPlanAvailable(planId: string): Promise<boolean> {
    try {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, planId))
        .limit(1);

      if (!plan || !plan.isActive || !plan.isPublic) {
        return false;
      }

      if (plan.maxSubscribers) {
        return (plan.currentSubscribers || 0) < plan.maxSubscribers;
      }

      return true;

    } catch (error) {
      console.error('Error checking plan availability:', error);
      return false;
    }
  }

  /**
   * Get subscription metrics for analytics
   */
  async getSubscriptionMetrics(providerId?: string) {
    try {
      const baseQuery = db
        .select({
          totalSubscriptions: sql<number>`count(distinct ${customerSubscriptionsTable.id})`,
          activeSubscriptions: sql<number>`count(distinct ${customerSubscriptionsTable.id}) filter (where ${customerSubscriptionsTable.status} = 'active')`,
          trialingSubscriptions: sql<number>`count(distinct ${customerSubscriptionsTable.id}) filter (where ${customerSubscriptionsTable.status} = 'trialing')`,
          pausedSubscriptions: sql<number>`count(distinct ${customerSubscriptionsTable.id}) filter (where ${customerSubscriptionsTable.status} = 'paused')`,
          canceledSubscriptions: sql<number>`count(distinct ${customerSubscriptionsTable.id}) filter (where ${customerSubscriptionsTable.status} = 'canceled')`,
          totalRevenue: sql<number>`sum(${subscriptionUsageTable.amountBilledCents}) / 100`,
          avgServicesPerSubscription: sql<number>`avg(${customerSubscriptionsTable.totalServicesUsed})`
        })
        .from(customerSubscriptionsTable)
        .leftJoin(
          subscriptionUsageTable,
          eq(customerSubscriptionsTable.id, subscriptionUsageTable.subscriptionId)
        );

      if (providerId) {
        // Add provider filter if needed
        baseQuery.leftJoin(
          subscriptionPlansTable,
          eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
        ).where(eq(subscriptionPlansTable.providerId, providerId));
      }

      const [metrics] = await baseQuery;

      return metrics;

    } catch (error) {
      console.error('Error getting subscription metrics:', error);
      return null;
    }
  }
}

// Export singleton instance
export const subscriptionManager = new SubscriptionManager();