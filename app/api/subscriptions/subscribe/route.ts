/**
 * POST /api/subscriptions/subscribe
 * Create a new subscription for a customer
 * 
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  subscriptionPlansTable, 
  customerSubscriptionsTable,
  type NewCustomerSubscription 
} from "@/db/schema/subscriptions-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and, sql } from "drizzle-orm";
import { createStripeSubscription } from "@/lib/services/subscription-service";
import { z } from "zod";

// Request validation schema
const subscribeSchema = z.object({
  planId: z.string().uuid(),
  paymentMethodId: z.string().optional(), // For immediate payment
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid request data",
          details: validation.error.flatten()
        },
        { status: 400 }
      );
    }

    const { planId, paymentMethodId } = validation.data;

    // Get the subscription plan
    const plans = await db.select()
      .from(subscriptionPlansTable)
      .where(
        and(
          eq(subscriptionPlansTable.id, planId),
          eq(subscriptionPlansTable.isActive, true)
        )
      )
      .limit(1);

    if (plans.length === 0) {
      return NextResponse.json(
        { success: false, error: "Subscription plan not found or inactive" },
        { status: 404 }
      );
    }

    const plan = plans[0];

    // Check if plan has availability
    if (plan.maxSubscribers && plan.currentSubscribers >= plan.maxSubscribers) {
      return NextResponse.json(
        { success: false, error: "Subscription plan is at capacity" },
        { status: 400 }
      );
    }

    // Check if customer already has an active subscription to this plan
    const existingSubscriptions = await db.select()
      .from(customerSubscriptionsTable)
      .where(
        and(
          eq(customerSubscriptionsTable.customerId, session.userId),
          eq(customerSubscriptionsTable.planId, planId),
          eq(customerSubscriptionsTable.status, 'active')
        )
      )
      .limit(1);

    if (existingSubscriptions.length > 0) {
      return NextResponse.json(
        { success: false, error: "You already have an active subscription to this plan" },
        { status: 400 }
      );
    }

    // Get user profile for Stripe customer creation
    const profiles = await db.select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, session.userId))
      .limit(1);

    if (profiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "User profile not found" },
        { status: 404 }
      );
    }

    const profile = profiles[0];

    // Create Stripe subscription if plan has Stripe price ID
    let stripeSubscription = null;
    let clientSecret = null;

    if (plan.stripePriceId) {
      const stripeResult = await createStripeSubscription({
        customerId: profile.stripeCustomerId || session.userId,
        priceId: plan.stripePriceId,
        trialDays: plan.trialDays || undefined,
        metadata: {
          planId: plan.id,
          customerId: session.userId,
          planName: plan.name
        }
      });

      stripeSubscription = stripeResult.subscription;
      clientSecret = stripeResult.clientSecret;
    }

    // Create subscription record in database
    const newSubscription: NewCustomerSubscription = {
      customerId: session.userId,
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription?.id,
      stripeCustomerId: stripeSubscription?.customer as string || profile.stripeCustomerId,
      status: plan.trialDays && plan.trialDays > 0 ? 'trialing' : 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + getBillingCycleDuration(plan.billingCycle)),
      trialEnd: plan.trialDays ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000) : null,
      servicesUsedThisPeriod: 0,
      totalServicesUsed: 0,
      metadata: {
        planName: plan.name,
        planFeatures: plan.features,
        planBenefits: plan.benefits
      }
    };

    const insertedSubscriptions = await db.insert(customerSubscriptionsTable)
      .values(newSubscription)
      .returning();

    // Update plan subscriber count
    await db.update(subscriptionPlansTable)
      .set({
        currentSubscribers: sql`${subscriptionPlansTable.currentSubscribers} + 1`,
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlansTable.id, planId));

    return NextResponse.json({
      success: true,
      subscription: insertedSubscriptions[0],
      clientSecret, // For Stripe payment confirmation on frontend
      message: plan.trialDays 
        ? `Subscription created with ${plan.trialDays} day trial`
        : "Subscription created successfully"
    });

  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to create subscription",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Helper function to get billing cycle duration in milliseconds
function getBillingCycleDuration(cycle: string): number {
  switch (cycle) {
    case 'weekly':
      return 7 * 24 * 60 * 60 * 1000;
    case 'biweekly':
      return 14 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return 30 * 24 * 60 * 60 * 1000;
    case 'quarterly':
      return 90 * 24 * 60 * 60 * 1000;
    case 'annual':
      return 365 * 24 * 60 * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000; // Default to monthly
  }
}