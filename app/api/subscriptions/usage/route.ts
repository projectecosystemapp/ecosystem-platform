// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  customerSubscriptionsTable,
  subscriptionPlansTable,
  subscriptionUsageRecordsTable,
  subscriptionUsageSummariesTable,
  subscriptionBookingsTable,
  bookingsTable,
  profilesTable
} from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { stripe } from "@/lib/stripe";

// Validation schemas
const recordUsageSchema = z.object({
  subscriptionId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  quantity: z.number().int().default(1),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const adjustUsageSchema = z.object({
  subscriptionId: z.string().uuid(),
  quantity: z.number().int(), // Positive for credits, negative for deductions
  reason: z.string(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/subscriptions/usage
 * Get current usage statistics for a subscription
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const subscriptionId = searchParams.get("subscriptionId");
    const includeHistory = searchParams.get("includeHistory") === "true";
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID required" },
        { status: 400 }
      );
    }

    // Get subscription with plan details
    const subscription = await db
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

    if (!subscription.length) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const [{ subscription: sub, plan }] = subscription;

    // Verify ownership or admin access
    if (sub.customerId !== userId) {
      // Check if user is the provider (admin access)
      const provider = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      if (!provider.length || provider[0].role !== 'provider') {
        return NextResponse.json(
          { error: "Unauthorized access to subscription" },
          { status: 403 }
        );
      }
    }

    // Get current period usage summary
    const currentPeriod = {
      start: sub.currentPeriodStart || new Date(),
      end: sub.currentPeriodEnd || new Date(),
    };

    // Get or create usage summary for current period
    let [usageSummary] = await db
      .select()
      .from(subscriptionUsageSummariesTable)
      .where(
        and(
          eq(subscriptionUsageSummariesTable.subscriptionId, subscriptionId),
          eq(subscriptionUsageSummariesTable.periodStart, currentPeriod.start),
          eq(subscriptionUsageSummariesTable.periodEnd, currentPeriod.end)
        )
      )
      .limit(1);

    // Create summary if it doesn't exist
    if (!usageSummary) {
      [usageSummary] = await db
        .insert(subscriptionUsageSummariesTable)
        .values({
          subscriptionId,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          includedServices: plan.servicesPerCycle || 1,
          bonusServices: 0,
          totalAllowance: plan.servicesPerCycle || 1,
          servicesUsed: sub.servicesUsedThisPeriod || 0,
          servicesRemaining: (plan.servicesPerCycle || 1) - (sub.servicesUsedThisPeriod || 0),
          overageServices: 0,
          nextResetDate: currentPeriod.end,
        })
        .returning();
    }

    // Build response
    const response: any = {
      subscription: {
        id: sub.id,
        status: sub.status,
        planName: plan.name,
        billingCycle: plan.billingCycle,
      },
      currentPeriod: {
        start: currentPeriod.start,
        end: currentPeriod.end,
      },
      usage: {
        includedServices: usageSummary.includedServices,
        bonusServices: usageSummary.bonusServices,
        totalAllowance: usageSummary.totalAllowance,
        servicesUsed: usageSummary.servicesUsed,
        servicesRemaining: usageSummary.servicesRemaining,
        overageServices: usageSummary.overageServices,
        overageCharges: usageSummary.overageChargesCents ? usageSummary.overageChargesCents / 100 : 0,
      },
      nextResetDate: usageSummary.nextResetDate,
    };

    // Include usage history if requested
    if (includeHistory) {
      const conditions = [
        eq(subscriptionUsageRecordsTable.subscriptionId, subscriptionId)
      ];

      if (periodStart) {
        conditions.push(gte(subscriptionUsageRecordsTable.createdAt, new Date(periodStart)));
      }
      if (periodEnd) {
        conditions.push(lte(subscriptionUsageRecordsTable.createdAt, new Date(periodEnd)));
      }

      const history = await db
        .select({
          id: subscriptionUsageRecordsTable.id,
          action: subscriptionUsageRecordsTable.action,
          quantity: subscriptionUsageRecordsTable.quantity,
          description: subscriptionUsageRecordsTable.description,
          bookingId: subscriptionUsageRecordsTable.bookingId,
          isOverage: subscriptionUsageRecordsTable.isOverage,
          overageCharge: subscriptionUsageRecordsTable.overageChargeCents,
          createdAt: subscriptionUsageRecordsTable.createdAt,
        })
        .from(subscriptionUsageRecordsTable)
        .where(and(...conditions))
        .orderBy(desc(subscriptionUsageRecordsTable.createdAt))
        .limit(50);

      response.history = history.map(record => ({
        ...record,
        overageCharge: record.overageCharge ? record.overageCharge / 100 : null,
      }));
    }

    // Get upcoming bookings linked to subscription
    const upcomingBookings = await db
      .select({
        id: bookingsTable.id,
        serviceName: bookingsTable.serviceName,
        bookingDate: bookingsTable.bookingDate,
        startTime: bookingsTable.startTime,
      })
      .from(subscriptionBookingsTable)
      .innerJoin(
        bookingsTable,
        eq(subscriptionBookingsTable.bookingId, bookingsTable.id)
      )
      .where(
        and(
          eq(subscriptionBookingsTable.subscriptionId, subscriptionId),
          eq(subscriptionBookingsTable.isCompleted, false),
          gte(bookingsTable.bookingDate, new Date())
        )
      )
      .orderBy(bookingsTable.bookingDate)
      .limit(5);

    response.upcomingBookings = upcomingBookings;

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Error fetching subscription usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription usage" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscriptions/usage
 * Record service usage for a subscription
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = recordUsageSchema.parse(body);

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Get subscription with plan
      const [subscription] = await tx
        .select({
          subscription: customerSubscriptionsTable,
          plan: subscriptionPlansTable,
        })
        .from(customerSubscriptionsTable)
        .innerJoin(
          subscriptionPlansTable,
          eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
        )
        .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const { subscription: sub, plan } = subscription;

      // Check if subscription is active
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        throw new Error(`Subscription is ${sub.status}, cannot record usage`);
      }

      // Get current period
      const currentPeriod = {
        start: sub.currentPeriodStart || new Date(),
        end: sub.currentPeriodEnd || new Date(),
      };

      // Calculate current usage
      const currentUsage = sub.servicesUsedThisPeriod || 0;
      const allowance = plan.servicesPerCycle || 1;
      const newUsage = currentUsage + validatedData.quantity;
      const isOverage = newUsage > allowance;
      const overageQuantity = isOverage ? newUsage - allowance : 0;

      // Calculate overage charges if applicable
      let overageChargeCents = 0;
      let stripeChargeId: string | null = null;

      if (isOverage && plan.metadata) {
        const overageRate = (plan.metadata as any).overageRateCents || 0;
        if (overageRate > 0) {
          overageChargeCents = overageQuantity * overageRate;

          // Create Stripe charge for overage
          if (sub.stripeCustomerId) {
            try {
              const charge = await stripe.charges.create({
                amount: overageChargeCents,
                currency: 'usd',
                customer: sub.stripeCustomerId,
                description: `Overage charge for subscription ${sub.id}`,
                metadata: {
                  subscriptionId: sub.id,
                  overageQuantity: overageQuantity.toString(),
                },
              });
              stripeChargeId = charge.id;
            } catch (stripeError) {
              console.error("Failed to create overage charge:", stripeError);
              // Continue without charging - track overage for later billing
            }
          }
        }
      }

      // Record usage
      const [usageRecord] = await tx
        .insert(subscriptionUsageRecordsTable)
        .values({
          subscriptionId: validatedData.subscriptionId,
          action: 'service_used',
          quantity: -validatedData.quantity, // Negative for usage
          bookingId: validatedData.bookingId,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          balanceBefore: allowance - currentUsage,
          balanceAfter: allowance - newUsage,
          isOverage,
          overageChargeCents,
          stripeChargeId,
          description: validatedData.description || `Service usage recorded`,
          metadata: validatedData.metadata || {},
        })
        .returning();

      // Update subscription usage counter
      await tx
        .update(customerSubscriptionsTable)
        .set({
          servicesUsedThisPeriod: newUsage,
          totalServicesUsed: sql`${customerSubscriptionsTable.totalServicesUsed} + ${validatedData.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId));

      // Update or create usage summary
      const [existingSummary] = await tx
        .select()
        .from(subscriptionUsageSummariesTable)
        .where(
          and(
            eq(subscriptionUsageSummariesTable.subscriptionId, validatedData.subscriptionId),
            eq(subscriptionUsageSummariesTable.periodStart, currentPeriod.start),
            eq(subscriptionUsageSummariesTable.periodEnd, currentPeriod.end)
          )
        )
        .limit(1);

      if (existingSummary) {
        await tx
          .update(subscriptionUsageSummariesTable)
          .set({
            servicesUsed: newUsage,
            servicesRemaining: Math.max(0, allowance - newUsage),
            overageServices: overageQuantity,
            overageChargesCents: sql`${subscriptionUsageSummariesTable.overageChargesCents} + ${overageChargeCents}`,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionUsageSummariesTable.id, existingSummary.id));
      } else {
        await tx
          .insert(subscriptionUsageSummariesTable)
          .values({
            subscriptionId: validatedData.subscriptionId,
            periodStart: currentPeriod.start,
            periodEnd: currentPeriod.end,
            includedServices: allowance,
            bonusServices: 0,
            totalAllowance: allowance,
            servicesUsed: newUsage,
            servicesRemaining: Math.max(0, allowance - newUsage),
            overageServices: overageQuantity,
            overageChargesCents,
            nextResetDate: currentPeriod.end,
          });
      }

      // Link booking to subscription if provided
      if (validatedData.bookingId) {
        const existingLink = await tx
          .select()
          .from(subscriptionBookingsTable)
          .where(
            and(
              eq(subscriptionBookingsTable.subscriptionId, validatedData.subscriptionId),
              eq(subscriptionBookingsTable.bookingId, validatedData.bookingId)
            )
          )
          .limit(1);

        if (!existingLink.length) {
          await tx
            .insert(subscriptionBookingsTable)
            .values({
              subscriptionId: validatedData.subscriptionId,
              bookingId: validatedData.bookingId,
              scheduledFor: new Date(),
              autoScheduled: false,
              billingPeriodStart: currentPeriod.start,
              billingPeriodEnd: currentPeriod.end,
            });
        }
      }

      return {
        usageRecord,
        currentUsage: newUsage,
        remainingServices: Math.max(0, allowance - newUsage),
        isOverage,
        overageCharge: overageChargeCents ? overageChargeCents / 100 : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error("Error recording subscription usage:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to record usage";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subscriptions/usage
 * Admin usage adjustment (add/remove service credits)
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = adjustUsageSchema.parse(body);

    // Check admin permissions
    const [user] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Get subscription with plan
      const [subscription] = await tx
        .select({
          subscription: customerSubscriptionsTable,
          plan: subscriptionPlansTable,
        })
        .from(customerSubscriptionsTable)
        .innerJoin(
          subscriptionPlansTable,
          eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
        )
        .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const { subscription: sub, plan } = subscription;

      // Get current period
      const currentPeriod = {
        start: sub.currentPeriodStart || new Date(),
        end: sub.currentPeriodEnd || new Date(),
      };

      // Calculate new usage
      const currentUsage = sub.servicesUsedThisPeriod || 0;
      const allowance = plan.servicesPerCycle || 1;
      const adjustment = validatedData.quantity; // Can be positive or negative
      const newUsage = Math.max(0, currentUsage - adjustment); // Subtract because positive adjustment = credit

      // Determine action type
      const action = adjustment > 0 ? 'service_credited' : 'manual_adjustment';

      // Record adjustment
      const [usageRecord] = await tx
        .insert(subscriptionUsageRecordsTable)
        .values({
          subscriptionId: validatedData.subscriptionId,
          action,
          quantity: adjustment, // Positive for credits, negative for deductions
          adjustedBy: userId,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          balanceBefore: allowance - currentUsage,
          balanceAfter: allowance - newUsage,
          description: validatedData.reason,
          metadata: validatedData.metadata || {},
        })
        .returning();

      // Update subscription usage counter
      await tx
        .update(customerSubscriptionsTable)
        .set({
          servicesUsedThisPeriod: newUsage,
          updatedAt: new Date(),
        })
        .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId));

      // Update usage summary
      const [summary] = await tx
        .select()
        .from(subscriptionUsageSummariesTable)
        .where(
          and(
            eq(subscriptionUsageSummariesTable.subscriptionId, validatedData.subscriptionId),
            eq(subscriptionUsageSummariesTable.periodStart, currentPeriod.start),
            eq(subscriptionUsageSummariesTable.periodEnd, currentPeriod.end)
          )
        )
        .limit(1);

      if (summary) {
        const newCredits = (summary.creditsApplied || 0) + (adjustment > 0 ? adjustment : 0);
        await tx
          .update(subscriptionUsageSummariesTable)
          .set({
            servicesUsed: newUsage,
            servicesRemaining: Math.max(0, allowance - newUsage),
            bonusServices: (summary.bonusServices || 0) + (adjustment > 0 ? adjustment : 0),
            totalAllowance: allowance + newCredits,
            creditsApplied: newCredits,
            updatedAt: new Date(),
          })
          .where(eq(subscriptionUsageSummariesTable.id, summary.id));
      }

      return {
        usageRecord,
        currentUsage: newUsage,
        remainingServices: allowance - newUsage,
        adjustment,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully ${validatedData.quantity > 0 ? 'credited' : 'adjusted'} ${Math.abs(validatedData.quantity)} service(s)`,
      data: result,
    });

  } catch (error) {
    console.error("Error adjusting subscription usage:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to adjust usage";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscriptions/usage
 * Reset usage counter for a subscription period (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin permissions
    const [user] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get("subscriptionId");

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Subscription ID required" },
        { status: 400 }
      );
    }

    // Reset usage counter
    const result = await db.transaction(async (tx) => {
      const [subscription] = await tx
        .select()
        .from(customerSubscriptionsTable)
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const currentPeriod = {
        start: subscription.currentPeriodStart || new Date(),
        end: subscription.currentPeriodEnd || new Date(),
      };

      // Record reset action
      await tx
        .insert(subscriptionUsageRecordsTable)
        .values({
          subscriptionId,
          action: 'period_reset',
          quantity: subscription.servicesUsedThisPeriod || 0, // Record amount reset
          adjustedBy: userId,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          balanceBefore: 0,
          balanceAfter: 0,
          description: 'Manual period reset by admin',
        });

      // Reset subscription counter
      await tx
        .update(customerSubscriptionsTable)
        .set({
          servicesUsedThisPeriod: 0,
          updatedAt: new Date(),
        })
        .where(eq(customerSubscriptionsTable.id, subscriptionId));

      // Update summary
      await tx
        .update(subscriptionUsageSummariesTable)
        .set({
          servicesUsed: 0,
          servicesRemaining: sql`${subscriptionUsageSummariesTable.totalAllowance}`,
          overageServices: 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(subscriptionUsageSummariesTable.subscriptionId, subscriptionId),
            eq(subscriptionUsageSummariesTable.periodStart, currentPeriod.start),
            eq(subscriptionUsageSummariesTable.periodEnd, currentPeriod.end)
          )
        );

      return {
        subscriptionId,
        previousUsage: subscription.servicesUsedThisPeriod,
        resetAt: new Date(),
      };
    });

    return NextResponse.json({
      success: true,
      message: "Usage counter reset successfully",
      data: result,
    });

  } catch (error) {
    console.error("Error resetting subscription usage:", error);
    const message = error instanceof Error ? error.message : "Failed to reset usage";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}