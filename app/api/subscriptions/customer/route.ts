// @ts-nocheck
/**
 * GET /api/subscriptions/customer
 * Get all subscriptions for the authenticated customer
 * 
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  customerSubscriptionsTable,
  subscriptionPlansTable
} from "@/db/schema/subscriptions-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, or, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get all subscriptions for the customer with plan and provider details
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
        eq(customerSubscriptionsTable.customerId, session.userId),
        or(
          eq(customerSubscriptionsTable.status, 'active'),
          eq(customerSubscriptionsTable.status, 'trialing'),
          eq(customerSubscriptionsTable.status, 'paused')
        )
      )
    )
    .orderBy(desc(customerSubscriptionsTable.createdAt));

    // Format the response
    const formattedSubscriptions = subscriptions.map(({ subscription, plan, provider }) => {
      const servicesRemaining = plan.servicesPerCycle - subscription.servicesUsedThisPeriod;
      const percentageUsed = (subscription.servicesUsedThisPeriod / plan.servicesPerCycle) * 100;

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        servicesUsedThisPeriod: subscription.servicesUsedThisPeriod,
        totalServicesUsed: subscription.totalServicesUsed,
        trialEnd: subscription.trialEnd,
        pausedAt: subscription.pausedAt,
        plan: {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          priceDisplay: plan.basePriceCents / 100,
          billingCycle: plan.billingCycle,
          servicesPerCycle: plan.servicesPerCycle,
          serviceDurationMinutes: plan.serviceDurationMinutes,
          features: plan.features,
          benefits: plan.benefits
        },
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          contactEmail: provider.contactEmail
        },
        usage: {
          servicesRemaining,
          percentageUsed,
          canUseService: servicesRemaining > 0 && subscription.status === 'active'
        }
      };
    });

    return NextResponse.json({
      success: true,
      subscriptions: formattedSubscriptions,
      count: formattedSubscriptions.length
    });

  } catch (error) {
    console.error("Error fetching customer subscriptions:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch subscriptions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}