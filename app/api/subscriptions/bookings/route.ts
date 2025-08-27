// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { 
  customerSubscriptionsTable,
  subscriptionPlansTable,
  subscriptionBookingsTable,
  subscriptionUsageRecordsTable,
  bookingsTable,
  providersTable,
  profilesTable,
  transactionsTable
} from "@/db/schema";
import { eq, and, desc, gte, lte, or, isNull } from "drizzle-orm";
import { z } from "zod";
import { calculateFees } from "@/lib/payments/fee-calculator";
import { stripe } from "@/lib/stripe";

// Validation schemas
const linkBookingSchema = z.object({
  subscriptionId: z.string().uuid(),
  bookingId: z.string().uuid(),
  autoApply: z.boolean().default(true),
});

const createSubscriptionBookingSchema = z.object({
  subscriptionId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  serviceName: z.string(),
  servicePrice: z.number().positive(),
  serviceDuration: z.number().int().positive(),
  bookingDate: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  customerNotes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/subscriptions/bookings
 * Get bookings linked to subscriptions
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
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status"); // upcoming, completed, all
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build query
    let query = db
      .select({
        subscriptionBooking: subscriptionBookingsTable,
        booking: bookingsTable,
        subscription: {
          id: customerSubscriptionsTable.id,
          status: customerSubscriptionsTable.status,
          planId: customerSubscriptionsTable.planId,
        },
        plan: {
          name: subscriptionPlansTable.name,
          billingCycle: subscriptionPlansTable.billingCycle,
        },
      })
      .from(subscriptionBookingsTable)
      .innerJoin(
        bookingsTable,
        eq(subscriptionBookingsTable.bookingId, bookingsTable.id)
      )
      .innerJoin(
        customerSubscriptionsTable,
        eq(subscriptionBookingsTable.subscriptionId, customerSubscriptionsTable.id)
      )
      .innerJoin(
        subscriptionPlansTable,
        eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
      );

    // Apply filters
    const conditions = [];

    if (subscriptionId) {
      conditions.push(eq(subscriptionBookingsTable.subscriptionId, subscriptionId));
    }

    if (customerId) {
      conditions.push(eq(customerSubscriptionsTable.customerId, customerId));
    }

    // Filter by status
    if (status === "upcoming") {
      conditions.push(
        and(
          eq(subscriptionBookingsTable.isCompleted, false),
          gte(bookingsTable.bookingDate, new Date())
        )
      );
    } else if (status === "completed") {
      conditions.push(eq(subscriptionBookingsTable.isCompleted, true));
    }

    // Verify access - user can only see their own bookings unless provider
    if (!customerId || customerId === userId) {
      conditions.push(eq(customerSubscriptionsTable.customerId, userId));
    } else {
      // Check if user is a provider with access
      const [user] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      if (!user || user.role !== 'provider') {
        return NextResponse.json(
          { error: "Unauthorized access" },
          { status: 403 }
        );
      }
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const bookings = await query
      .orderBy(desc(bookingsTable.bookingDate))
      .limit(limit);

    // Format response
    const formattedBookings = bookings.map(item => ({
      id: item.subscriptionBooking.id,
      subscriptionId: item.subscription.id,
      subscriptionStatus: item.subscription.status,
      planName: item.plan.name,
      booking: {
        id: item.booking.id,
        serviceName: item.booking.serviceName,
        servicePrice: parseFloat(item.booking.servicePrice),
        bookingDate: item.booking.bookingDate,
        startTime: item.booking.startTime,
        endTime: item.booking.endTime,
        status: item.booking.status,
        totalAmount: parseFloat(item.booking.totalAmount),
        isGuestBooking: item.booking.isGuestBooking,
      },
      scheduledFor: item.subscriptionBooking.scheduledFor,
      autoScheduled: item.subscriptionBooking.autoScheduled,
      isCompleted: item.subscriptionBooking.isCompleted,
      completedAt: item.subscriptionBooking.completedAt,
      createdAt: item.subscriptionBooking.createdAt,
    }));

    // Get usage statistics
    let usageStats = null;
    if (subscriptionId) {
      const [subscription] = await db
        .select()
        .from(customerSubscriptionsTable)
        .innerJoin(
          subscriptionPlansTable,
          eq(customerSubscriptionsTable.planId, subscriptionPlansTable.id)
        )
        .where(eq(customerSubscriptionsTable.id, subscriptionId))
        .limit(1);

      if (subscription) {
        usageStats = {
          servicesPerCycle: subscription.subscription_plans.servicesPerCycle,
          servicesUsedThisPeriod: subscription.customer_subscriptions.servicesUsedThisPeriod,
          servicesRemaining: 
            (subscription.subscription_plans.servicesPerCycle || 0) - 
            (subscription.customer_subscriptions.servicesUsedThisPeriod || 0),
          currentPeriodStart: subscription.customer_subscriptions.currentPeriodStart,
          currentPeriodEnd: subscription.customer_subscriptions.currentPeriodEnd,
        };
      }
    }

    return NextResponse.json({
      success: true,
      bookings: formattedBookings,
      count: formattedBookings.length,
      usageStats,
    });

  } catch (error) {
    console.error("Error fetching subscription bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription bookings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscriptions/bookings
 * Create a booking using subscription benefits
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
    const validatedData = createSubscriptionBookingSchema.parse(body);

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Get subscription with plan
      const [subscription] = await tx
        .select({
          subscription: customerSubscriptionsTable,
          plan: subscriptionPlansTable,
          provider: providersTable,
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
        .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId))
        .limit(1);

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const { subscription: sub, plan, provider } = subscription;

      // Verify ownership
      if (sub.customerId !== userId) {
        throw new Error("Unauthorized - You don't own this subscription");
      }

      // Check subscription status
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        throw new Error(`Subscription is ${sub.status}, cannot create booking`);
      }

      // Check usage allowance
      const servicesUsed = sub.servicesUsedThisPeriod || 0;
      const allowance = plan.servicesPerCycle || 1;
      let isOverage = false;
      let overageCharge = 0;

      if (servicesUsed >= allowance) {
        isOverage = true;
        // Check if overage is allowed
        if (plan.metadata) {
          const meta = plan.metadata as any;
          if (!meta.allowOverage) {
            throw new Error("Service allowance exceeded for this period");
          }
          // Calculate overage charge
          const overageRate = meta.overageRateCents || 0;
          if (overageRate > 0) {
            overageCharge = overageRate / 100;
          }
        } else {
          throw new Error("Service allowance exceeded for this period");
        }
      }

      // Apply subscription benefits
      let finalPrice = validatedData.servicePrice;
      let discountApplied = 0;

      if (plan.benefits && !isOverage) {
        const benefits = plan.benefits as any;
        
        // Apply discount if available
        if (benefits.discountPercent) {
          discountApplied = (validatedData.servicePrice * benefits.discountPercent) / 100;
          finalPrice = validatedData.servicePrice - discountApplied;
        }
        
        // For subscription bookings within allowance, price might be 0
        if (benefits.includedInSubscription && servicesUsed < allowance) {
          finalPrice = 0; // Service is included in subscription
        }
      } else if (isOverage) {
        // Add overage charge to the price
        finalPrice = validatedData.servicePrice + overageCharge;
      }

      // Calculate fees
      const fees = calculateFees(finalPrice, false); // Not a guest booking

      // Create the booking
      const [booking] = await tx
        .insert(bookingsTable)
        .values({
          providerId: provider.id,
          customerId: userId,
          serviceName: validatedData.serviceName,
          servicePrice: finalPrice.toString(),
          serviceDuration: validatedData.serviceDuration,
          bookingDate: new Date(validatedData.bookingDate),
          startTime: validatedData.startTime,
          endTime: validatedData.endTime,
          status: 'pending',
          totalAmount: fees.totalAmount.toString(),
          platformFee: fees.platformFee.toString(),
          providerPayout: fees.providerPayout.toString(),
          customerNotes: validatedData.customerNotes,
          isGuestBooking: false,
          bookingType: 'service',
          serviceId: validatedData.serviceId,
          metadata: {
            ...validatedData.metadata,
            subscriptionId: validatedData.subscriptionId,
            discountApplied,
            isOverage,
            overageCharge,
          },
        })
        .returning();

      // Link booking to subscription
      const [subscriptionBooking] = await tx
        .insert(subscriptionBookingsTable)
        .values({
          subscriptionId: validatedData.subscriptionId,
          bookingId: booking.id,
          scheduledFor: new Date(validatedData.bookingDate),
          autoScheduled: false,
          billingPeriodStart: sub.currentPeriodStart,
          billingPeriodEnd: sub.currentPeriodEnd,
        })
        .returning();

      // Record usage if not overage (overage will be recorded on completion)
      if (!isOverage && finalPrice === 0) {
        // Service is included, record usage immediately
        await tx
          .insert(subscriptionUsageRecordsTable)
          .values({
            subscriptionId: validatedData.subscriptionId,
            action: 'service_used',
            quantity: -1,
            bookingId: booking.id,
            periodStart: sub.currentPeriodStart!,
            periodEnd: sub.currentPeriodEnd!,
            balanceBefore: allowance - servicesUsed,
            balanceAfter: allowance - servicesUsed - 1,
            description: `Booking created: ${validatedData.serviceName}`,
          });

        // Update subscription usage counter
        await tx
          .update(customerSubscriptionsTable)
          .set({
            servicesUsedThisPeriod: servicesUsed + 1,
            totalServicesUsed: (sub.totalServicesUsed || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId));
      }

      // Create transaction record if payment is required
      if (finalPrice > 0) {
        await tx
          .insert(transactionsTable)
          .values({
            bookingId: booking.id,
            amount: fees.totalAmount.toString(),
            platformFee: fees.platformFee.toString(),
            providerPayout: fees.providerPayout.toString(),
            status: 'pending',
          });
      }

      return {
        booking,
        subscriptionBooking,
        pricing: {
          originalPrice: validatedData.servicePrice,
          discountApplied,
          overageCharge,
          finalPrice,
          totalAmount: fees.totalAmount,
          platformFee: fees.platformFee,
          providerPayout: fees.providerPayout,
        },
        subscription: {
          id: sub.id,
          servicesUsed: servicesUsed + (finalPrice === 0 ? 1 : 0),
          servicesRemaining: Math.max(0, allowance - servicesUsed - 1),
          isOverage,
        },
      };
    });

    return NextResponse.json({
      success: true,
      message: "Booking created successfully with subscription benefits",
      data: result,
    });

  } catch (error) {
    console.error("Error creating subscription booking:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create booking";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/subscriptions/bookings
 * Link an existing booking to a subscription
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
    const validatedData = linkBookingSchema.parse(body);

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Get booking
      const [booking] = await tx
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, validatedData.bookingId))
        .limit(1);

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Verify ownership
      if (booking.customerId !== userId) {
        throw new Error("Unauthorized - You don't own this booking");
      }

      // Check if booking is already linked
      const existingLink = await tx
        .select()
        .from(subscriptionBookingsTable)
        .where(eq(subscriptionBookingsTable.bookingId, validatedData.bookingId))
        .limit(1);

      if (existingLink.length > 0) {
        throw new Error("Booking is already linked to a subscription");
      }

      // Get subscription
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

      // Verify subscription ownership
      if (sub.customerId !== userId) {
        throw new Error("Unauthorized - You don't own this subscription");
      }

      // Check if subscription can be applied
      if (sub.status !== 'active' && sub.status !== 'trialing') {
        throw new Error(`Cannot apply ${sub.status} subscription to booking`);
      }

      // Link booking to subscription
      const [subscriptionBooking] = await tx
        .insert(subscriptionBookingsTable)
        .values({
          subscriptionId: validatedData.subscriptionId,
          bookingId: validatedData.bookingId,
          scheduledFor: booking.bookingDate,
          autoScheduled: false,
          billingPeriodStart: sub.currentPeriodStart,
          billingPeriodEnd: sub.currentPeriodEnd,
          metadata: {
            linkedAfterCreation: true,
            linkedAt: new Date(),
          },
        })
        .returning();

      // If auto-apply is enabled and booking is pending payment, apply benefits
      let benefitsApplied = null;
      if (validatedData.autoApply && booking.status === 'pending') {
        const servicesUsed = sub.servicesUsedThisPeriod || 0;
        const allowance = plan.servicesPerCycle || 1;

        if (servicesUsed < allowance) {
          // Apply subscription benefits
          let newPrice = parseFloat(booking.servicePrice);
          let discount = 0;

          if (plan.benefits) {
            const benefits = plan.benefits as any;
            
            // Apply discount
            if (benefits.discountPercent) {
              discount = (newPrice * benefits.discountPercent) / 100;
              newPrice = newPrice - discount;
            }

            // Or make it free if included
            if (benefits.includedInSubscription) {
              newPrice = 0;
            }
          }

          // Recalculate fees
          const fees = calculateFees(newPrice, booking.isGuestBooking);

          // Update booking with new pricing
          await tx
            .update(bookingsTable)
            .set({
              servicePrice: newPrice.toString(),
              totalAmount: fees.totalAmount.toString(),
              platformFee: fees.platformFee.toString(),
              providerPayout: fees.providerPayout.toString(),
              metadata: {
                ...booking.metadata,
                subscriptionApplied: true,
                originalPrice: booking.servicePrice,
                discountApplied: discount,
              },
            })
            .where(eq(bookingsTable.id, validatedData.bookingId));

          // Record usage
          await tx
            .insert(subscriptionUsageRecordsTable)
            .values({
              subscriptionId: validatedData.subscriptionId,
              action: 'service_used',
              quantity: -1,
              bookingId: validatedData.bookingId,
              periodStart: sub.currentPeriodStart!,
              periodEnd: sub.currentPeriodEnd!,
              balanceBefore: allowance - servicesUsed,
              balanceAfter: allowance - servicesUsed - 1,
              description: `Subscription applied to existing booking`,
            });

          // Update usage counter
          await tx
            .update(customerSubscriptionsTable)
            .set({
              servicesUsedThisPeriod: servicesUsed + 1,
              totalServicesUsed: (sub.totalServicesUsed || 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(customerSubscriptionsTable.id, validatedData.subscriptionId));

          benefitsApplied = {
            originalPrice: parseFloat(booking.servicePrice),
            discount,
            newPrice,
            servicesUsedAfter: servicesUsed + 1,
          };
        }
      }

      return {
        subscriptionBooking,
        booking: {
          id: booking.id,
          serviceName: booking.serviceName,
        },
        benefitsApplied,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Booking successfully linked to subscription",
      data: result,
    });

  } catch (error) {
    console.error("Error linking booking to subscription:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to link booking";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscriptions/bookings
 * Unlink a booking from a subscription
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

    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get("linkId");
    const bookingId = searchParams.get("bookingId");

    if (!linkId && !bookingId) {
      return NextResponse.json(
        { error: "Link ID or Booking ID required" },
        { status: 400 }
      );
    }

    // Start transaction
    const result = await db.transaction(async (tx) => {
      // Find the link
      let subscriptionBooking;
      if (linkId) {
        [subscriptionBooking] = await tx
          .select()
          .from(subscriptionBookingsTable)
          .where(eq(subscriptionBookingsTable.id, linkId))
          .limit(1);
      } else {
        [subscriptionBooking] = await tx
          .select()
          .from(subscriptionBookingsTable)
          .where(eq(subscriptionBookingsTable.bookingId, bookingId!))
          .limit(1);
      }

      if (!subscriptionBooking) {
        throw new Error("Subscription booking link not found");
      }

      // Verify ownership
      const [subscription] = await tx
        .select()
        .from(customerSubscriptionsTable)
        .where(eq(customerSubscriptionsTable.id, subscriptionBooking.subscriptionId))
        .limit(1);

      if (!subscription || subscription.customerId !== userId) {
        // Check if user is admin or provider
        const [user] = await tx
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.userId, userId))
          .limit(1);

        if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
          throw new Error("Unauthorized");
        }
      }

      // Check if booking is completed
      if (subscriptionBooking.isCompleted) {
        throw new Error("Cannot unlink completed bookings");
      }

      // Delete the link
      await tx
        .delete(subscriptionBookingsTable)
        .where(eq(subscriptionBookingsTable.id, subscriptionBooking.id));

      // If usage was recorded, create a reversal
      const [usageRecord] = await tx
        .select()
        .from(subscriptionUsageRecordsTable)
        .where(
          and(
            eq(subscriptionUsageRecordsTable.subscriptionId, subscriptionBooking.subscriptionId),
            eq(subscriptionUsageRecordsTable.bookingId, subscriptionBooking.bookingId)
          )
        )
        .limit(1);

      if (usageRecord && usageRecord.quantity < 0) {
        // Create reversal record
        await tx
          .insert(subscriptionUsageRecordsTable)
          .values({
            subscriptionId: subscriptionBooking.subscriptionId,
            action: 'service_credited',
            quantity: Math.abs(usageRecord.quantity),
            bookingId: subscriptionBooking.bookingId,
            periodStart: usageRecord.periodStart,
            periodEnd: usageRecord.periodEnd,
            balanceBefore: usageRecord.balanceAfter,
            balanceAfter: usageRecord.balanceBefore,
            description: 'Booking unlinked - usage reversed',
            adjustedBy: userId,
          });

        // Update usage counter
        if (subscription) {
          await tx
            .update(customerSubscriptionsTable)
            .set({
              servicesUsedThisPeriod: Math.max(0, (subscription.servicesUsedThisPeriod || 0) - 1),
              updatedAt: new Date(),
            })
            .where(eq(customerSubscriptionsTable.id, subscription.id));
        }
      }

      return {
        unlinkedBookingId: subscriptionBooking.bookingId,
        subscriptionId: subscriptionBooking.subscriptionId,
        usageReversed: !!usageRecord,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Booking unlinked from subscription",
      data: result,
    });

  } catch (error) {
    console.error("Error unlinking booking from subscription:", error);
    const message = error instanceof Error ? error.message : "Failed to unlink booking";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}