// @ts-nocheck
/**
 * GET /api/subscriptions/[id]
 * Get subscription details
 * 
 * DELETE /api/subscriptions/[id]
 * Cancel a subscription
 * 
 * Requires authentication and ownership
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  customerSubscriptionsTable,
  subscriptionPlansTable,
  subscriptionBookingsTable,
  subscriptionUsageTable
} from "@/db/schema/subscriptions-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, desc } from "drizzle-orm";
import { cancelStripeSubscription } from "@/lib/services/subscription-service";
import { z } from "zod";

// GET - Get subscription details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const subscriptionId = params.id;

    // Get subscription with plan and provider details
    const subscriptions = await db.select({
      subscription: customerSubscriptionsTable,
      plan: subscriptionPlansTable,
      provider: providersTable
    })
    .from(customerSubscriptionsTable)
    .innerJoin(
      subscriptionPlansTable,
      eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
    )
    .innerJoin(
      providersTable,
      eq(subscriptionPlansTable.providerId, providersTable.id)
    )
    .where(
      and(
        eq(customerSubscriptionsTable.id, subscriptionId),
        eq(customerSubscriptionsTable.customerId, session.userId)
      )
    )
    .limit(1);

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Subscription not found or access denied" },
        { status: 404 }
      );
    }

    const { subscription, plan, provider } = subscriptions[0];

    // Get recent bookings for this subscription
    const recentBookings = await db.select()
      .from(subscriptionBookingsTable)
      .where(eq(subscriptionBookingsTable.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionBookingsTable.scheduledFor))
      .limit(10);

    // Get usage history
    const usageHistory = await db.select()
      .from(subscriptionUsageTable)
      .where(eq(subscriptionUsageTable.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionUsageTable.periodStart))
      .limit(6);

    // Calculate remaining services for current period
    const servicesRemaining = plan.servicesPerCycle - subscription.servicesUsedThisPeriod;

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        plan: {
          ...plan,
          priceDisplay: plan.basePriceCents / 100,
          setupFeeDisplay: plan.setupFeeCents ? plan.setupFeeCents / 100 : 0
        },
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          contactEmail: provider.contactEmail
        },
        usage: {
          servicesUsedThisPeriod: subscription.servicesUsedThisPeriod,
          servicesRemaining,
          percentageUsed: (subscription.servicesUsedThisPeriod / plan.servicesPerCycle) * 100,
          canUseService: servicesRemaining > 0
        },
        recentBookings,
        usageHistory
      }
    });

  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch subscription details",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// DELETE - Cancel subscription
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const subscriptionId = params.id;

    // Parse cancellation options from query params
    const { searchParams } = new URL(request.url);
    const cancelImmediately = searchParams.get("immediately") === "true";
    const reason = searchParams.get("reason") || "Customer requested cancellation";

    // Get subscription
    const subscriptions = await db.select()
      .from(customerSubscriptionsTable)
      .where(
        and(
          eq(customerSubscriptionsTable.id, subscriptionId),
          eq(customerSubscriptionsTable.customerId, session.userId)
        )
      )
      .limit(1);

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: "Subscription not found or access denied" },
        { status: 404 }
      );
    }

    const subscription = subscriptions[0];

    // Check if already canceled
    if (subscription.status === 'canceled') {
      return NextResponse.json(
        { success: false, error: "Subscription is already canceled" },
        { status: 400 }
      );
    }

    // Cancel in Stripe if it has a Stripe subscription ID
    if (subscription.stripeSubscriptionId) {
      await cancelStripeSubscription(
        subscription.stripeSubscriptionId,
        !cancelImmediately // Cancel at period end by default
      );
    }

    // Update database record
    const updateData: any = {
      cancelationReason: reason,
      updatedAt: new Date()
    };

    if (cancelImmediately) {
      updateData.status = 'canceled';
      updateData.canceledAt = new Date();
    } else {
      updateData.cancelAtPeriodEnd = true;
    }

    await db.update(customerSubscriptionsTable)
      .set(updateData)
      .where(eq(customerSubscriptionsTable.id, subscriptionId));

    // Update plan subscriber count
    const plan = await db.select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, subscription.planId))
      .limit(1);

    if (plan.length > 0) {
      await db.update(subscriptionPlansTable)
        .set({
          currentSubscribers: Math.max(0, plan[0].currentSubscribers - 1),
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlansTable.id, subscription.planId));
    }

    return NextResponse.json({
      success: true,
      message: cancelImmediately 
        ? "Subscription canceled immediately" 
        : "Subscription will be canceled at the end of the current billing period",
      canceledAt: cancelImmediately ? new Date() : subscription.currentPeriodEnd
    });

  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to cancel subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}