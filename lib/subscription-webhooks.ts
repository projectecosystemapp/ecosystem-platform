import { db } from "@/db/db";
import {
  subscriptionBookingsTable,
  subscriptionUsageRecordsTable,
  customerSubscriptionsTable,
  subscriptionPlansTable,
  bookingsTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { recordSubscriptionUsage, resetSubscriptionPeriod } from "./subscription-service";

/**
 * Handle booking completion for subscription-linked bookings
 */
export async function handleSubscriptionBookingCompletion(bookingId: string): Promise<void> {
  try {
    // Check if this booking is linked to a subscription
    const [subscriptionBooking] = await db
      .select()
      .from(subscriptionBookingsTable)
      .where(eq(subscriptionBookingsTable.bookingId, bookingId))
      .limit(1);

    if (!subscriptionBooking) {
      // Not a subscription booking, nothing to do
      return;
    }

    // Mark the subscription booking as completed
    await db
      .update(subscriptionBookingsTable)
      .set({
        isCompleted: true,
        completedAt: new Date(),
      })
      .where(eq(subscriptionBookingsTable.id, subscriptionBooking.id));

    // Get booking details
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Check if usage was already recorded during booking creation
    const existingUsage = await db
      .select()
      .from(subscriptionUsageRecordsTable)
      .where(
        and(
          eq(subscriptionUsageRecordsTable.subscriptionId, subscriptionBooking.subscriptionId),
          eq(subscriptionUsageRecordsTable.bookingId, bookingId),
          eq(subscriptionUsageRecordsTable.action, 'service_used')
        )
      )
      .limit(1);

    // If usage wasn't recorded during creation (e.g., overage booking), record it now
    if (!existingUsage.length) {
      await recordSubscriptionUsage(
        subscriptionBooking.subscriptionId,
        bookingId,
        `Service completed: ${booking.serviceName}`,
        {
          completedAt: new Date(),
          servicePrice: parseFloat(booking.servicePrice),
          totalAmount: parseFloat(booking.totalAmount),
        }
      );
    } else {
      // Just add a completion record for audit trail
      await db
        .insert(subscriptionUsageRecordsTable)
        .values({
          subscriptionId: subscriptionBooking.subscriptionId,
          action: 'service_used', // Use same action but different description
          quantity: 0, // No usage change, just logging completion
          bookingId,
          periodStart: subscriptionBooking.billingPeriodStart!,
          periodEnd: subscriptionBooking.billingPeriodEnd!,
          balanceBefore: 0,
          balanceAfter: 0,
          description: `Service completed: ${booking.serviceName}`,
          metadata: {
            completionTimestamp: new Date(),
            servicePrice: parseFloat(booking.servicePrice),
            totalAmount: parseFloat(booking.totalAmount),
          },
        });
    }

    console.log(`[SUBSCRIPTION] Recorded completion for booking ${bookingId} on subscription ${subscriptionBooking.subscriptionId}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION] Error handling booking completion ${bookingId}:`, error);
    throw error;
  }
}

/**
 * Handle subscription renewal and reset usage counters
 */
export async function handleSubscriptionRenewal(subscriptionId: string, renewalDate: Date): Promise<void> {
  try {
    // Get subscription with plan details
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
      .where(eq(customerSubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const { plan } = subscription;

    // Calculate new period end based on billing cycle
    let newPeriodEnd = new Date(renewalDate);
    
    switch (plan.billingCycle) {
      case 'weekly':
        newPeriodEnd.setDate(newPeriodEnd.getDate() + 7);
        break;
      case 'biweekly':
        newPeriodEnd.setDate(newPeriodEnd.getDate() + 14);
        break;
      case 'monthly':
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        break;
      case 'quarterly':
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 3);
        break;
      case 'annual':
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        break;
      default:
        // Default to monthly
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    }

    // Reset subscription period
    await resetSubscriptionPeriod(subscriptionId, renewalDate, newPeriodEnd);

    console.log(`[SUBSCRIPTION] Reset usage for subscription ${subscriptionId}, new period: ${renewalDate.toISOString()} - ${newPeriodEnd.toISOString()}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION] Error handling subscription renewal ${subscriptionId}:`, error);
    throw error;
  }
}

/**
 * Handle subscription cancellation
 */
export async function handleSubscriptionCancellation(subscriptionId: string, canceledAt: Date, reason?: string): Promise<void> {
  try {
    // Mark subscription as canceled
    await db
      .update(customerSubscriptionsTable)
      .set({
        status: 'canceled',
        canceledAt,
        cancelationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Create cancellation record
    await db
      .insert(subscriptionUsageRecordsTable)
      .values({
        subscriptionId,
        action: 'period_reset', // Use period_reset as closest action type
        quantity: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
        balanceBefore: 0,
        balanceAfter: 0,
        description: `Subscription canceled: ${reason || 'No reason provided'}`,
        metadata: {
          canceledAt,
          reason,
        },
      });

    console.log(`[SUBSCRIPTION] Canceled subscription ${subscriptionId}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION] Error handling subscription cancellation ${subscriptionId}:`, error);
    throw error;
  }
}

/**
 * Handle subscription pause
 */
export async function handleSubscriptionPause(subscriptionId: string, pausedAt: Date, resumeAt?: Date, reason?: string): Promise<void> {
  try {
    // Mark subscription as paused
    await db
      .update(customerSubscriptionsTable)
      .set({
        status: 'paused',
        pausedAt,
        resumeAt,
        pauseReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Create pause record
    await db
      .insert(subscriptionUsageRecordsTable)
      .values({
        subscriptionId,
        action: 'manual_adjustment', // Use manual_adjustment for pause
        quantity: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
        balanceBefore: 0,
        balanceAfter: 0,
        description: `Subscription paused${resumeAt ? ` until ${resumeAt.toISOString()}` : ''}: ${reason || 'No reason provided'}`,
        metadata: {
          pausedAt,
          resumeAt,
          reason,
        },
      });

    console.log(`[SUBSCRIPTION] Paused subscription ${subscriptionId}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION] Error handling subscription pause ${subscriptionId}:`, error);
    throw error;
  }
}

/**
 * Handle subscription resume
 */
export async function handleSubscriptionResume(subscriptionId: string, resumedAt: Date): Promise<void> {
  try {
    // Mark subscription as active
    await db
      .update(customerSubscriptionsTable)
      .set({
        status: 'active',
        pausedAt: null,
        resumeAt: null,
        pauseReason: null,
        updatedAt: new Date(),
      })
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Create resume record
    await db
      .insert(subscriptionUsageRecordsTable)
      .values({
        subscriptionId,
        action: 'manual_adjustment', // Use manual_adjustment for resume
        quantity: 0,
        periodStart: new Date(),
        periodEnd: new Date(),
        balanceBefore: 0,
        balanceAfter: 0,
        description: 'Subscription resumed',
        metadata: {
          resumedAt,
        },
      });

    console.log(`[SUBSCRIPTION] Resumed subscription ${subscriptionId}`);
  } catch (error) {
    console.error(`[SUBSCRIPTION] Error handling subscription resume ${subscriptionId}:`, error);
    throw error;
  }
}