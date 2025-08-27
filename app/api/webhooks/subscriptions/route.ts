// @ts-nocheck
/**
 * POST /api/webhooks/subscriptions
 * Handle Stripe subscription webhook events
 */

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { 
  customerSubscriptionsTable,
  subscriptionUsageTable
} from "@/db/schema/subscriptions-schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Stripe from "stripe";

// Webhook secret from Stripe Dashboard
const endpointSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = headers().get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        endpointSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle different subscription events
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionPaused(subscription);
        break;
      }

      case 'customer.subscription.resumed': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionResumed(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handleInvoicePaid(invoice);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handleInvoicePaymentFailed(invoice);
        }
        break;
      }

      default:
        console.log(`Unhandled subscription event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error("Error processing subscription webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    // Update subscription status if it already exists
    // (created through our API before Stripe webhook)
    await db.update(customerSubscriptionsTable)
      .set({
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscription.id));

    console.log(`Subscription created: ${subscription.id}`);
  } catch (error) {
    console.error("Error handling subscription created:", error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const updates: any = {
      status: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date()
    };

    if (subscription.canceled_at) {
      updates.canceledAt = new Date(subscription.canceled_at * 1000);
    }

    await db.update(customerSubscriptionsTable)
      .set(updates)
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscription.id));

    // If entering new billing period, reset usage counter
    const existingSubscription = await db.select()
      .from(customerSubscriptionsTable)
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscription.id))
      .limit(1);

    if (existingSubscription.length > 0) {
      const existing = existingSubscription[0];
      const newPeriodStart = new Date(subscription.current_period_start * 1000);
      
      if (existing.currentPeriodStart && newPeriodStart > existing.currentPeriodStart) {
        // New billing period started - reset usage
        await resetSubscriptionUsage(existing.id);
      }
    }

    console.log(`Subscription updated: ${subscription.id}`);
  } catch (error) {
    console.error("Error handling subscription updated:", error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    await db.update(customerSubscriptionsTable)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscription.id));

    console.log(`Subscription deleted: ${subscription.id}`);
  } catch (error) {
    console.error("Error handling subscription deleted:", error);
    throw error;
  }
}

async function handleSubscriptionPaused(subscription: Stripe.Subscription) {
  try {
    await db.update(customerSubscriptionsTable)
      .set({
        status: 'paused',
        pausedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscription.id));

    console.log(`Subscription paused: ${subscription.id}`);
  } catch (error) {
    console.error("Error handling subscription paused:", error);
    throw error;
  }
}

async function handleSubscriptionResumed(subscription: Stripe.Subscription) {
  try {
    await db.update(customerSubscriptionsTable)
      .set({
        status: 'active',
        pausedAt: null,
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscription.id));

    console.log(`Subscription resumed: ${subscription.id}`);
  } catch (error) {
    console.error("Error handling subscription resumed:", error);
    throw error;
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    
    // Update subscription status to active if it was past_due
    await db.update(customerSubscriptionsTable)
      .set({
        status: 'active',
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscriptionId));

    // Record payment in usage history
    const subscription = await db.select()
      .from(customerSubscriptionsTable)
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscriptionId))
      .limit(1);

    if (subscription.length > 0) {
      await db.insert(subscriptionUsageTable).values({
        subscriptionId: subscription[0].id,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        servicesIncluded: 0, // Will be set from plan
        servicesUsed: subscription[0].servicesUsedThisPeriod,
        servicesRemaining: 0, // Will be calculated
        amountBilledCents: invoice.amount_paid,
        stripeInvoiceId: invoice.id,
        isPaid: true,
        paidAt: new Date()
      });
    }

    console.log(`Invoice paid for subscription: ${subscriptionId}`);
  } catch (error) {
    console.error("Error handling invoice paid:", error);
    throw error;
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = invoice.subscription as string;
    
    // Update subscription status to past_due
    await db.update(customerSubscriptionsTable)
      .set({
        status: 'past_due',
        updatedAt: new Date()
      })
      .where(eq(customerSubscriptionsTable.stripeSubscriptionId, subscriptionId));

    console.log(`Invoice payment failed for subscription: ${subscriptionId}`);
  } catch (error) {
    console.error("Error handling invoice payment failed:", error);
    throw error;
  }
}

async function resetSubscriptionUsage(subscriptionId: string) {
  try {
    // Get current usage before reset
    const subscription = await db.select()
      .from(customerSubscriptionsTable)
      .where(eq(customerSubscriptionsTable.id, subscriptionId))
      .limit(1);

    if (subscription.length > 0) {
      const sub = subscription[0];
      
      // Record usage history
      if (sub.currentPeriodStart && sub.currentPeriodEnd) {
        await db.insert(subscriptionUsageTable).values({
          subscriptionId,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          servicesIncluded: 0, // Will be set from plan
          servicesUsed: sub.servicesUsedThisPeriod,
          servicesRemaining: 0 // Will be calculated
        });
      }

      // Reset usage counter for new period
      await db.update(customerSubscriptionsTable)
        .set({
          servicesUsedThisPeriod: 0,
          updatedAt: new Date()
        })
        .where(eq(customerSubscriptionsTable.id, subscriptionId));
    }
  } catch (error) {
    console.error("Error resetting subscription usage:", error);
    throw error;
  }
}