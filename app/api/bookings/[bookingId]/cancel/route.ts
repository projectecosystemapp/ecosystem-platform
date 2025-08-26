/**
 * Cancel Booking API
 * 
 * Allows customers or providers to cancel a booking.
 * Handles refund calculation based on cancellation policy.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { bookingsTable, providersTable, transactionsTable } from "@/db/schema/enhanced-booking-schema";
import { eq } from "drizzle-orm";
import { bookingStateMachine, BookingState } from "@/lib/bookings/booking-state-machine";
import { notificationService } from "@/lib/notifications/notification-service";
import { RateLimiter } from "@/lib/rate-limiter";
import { createRefundWithIdempotency } from "@/lib/stripe-enhanced";
import { dollarsToCents } from "@/lib/payments/fee-calculator";

// Rate limiter for cancellation actions
const rateLimiter = new RateLimiter({
  tokensPerInterval: 3,
  interval: 60 * 1000, // 1 minute
  fireImmediately: true
});

// Validation schema for cancelling a booking
const cancelBookingSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  urgency: z.enum(['immediate', 'planned']).optional(),
  requestRefund: z.boolean().optional().default(true)
});

// Cancellation fee structure
const CANCELLATION_POLICY = {
  48: 0,     // 48+ hours: No fee (100% refund)
  24: 0.25,  // 24-48 hours: 25% fee (75% refund)
  12: 0.50,  // 12-24 hours: 50% fee (50% refund)
  6: 0.75,   // 6-12 hours: 75% fee (25% refund)
  0: 1.00    // <6 hours: 100% fee (no refund)
};

// POST /api/bookings/[bookingId]/cancel - Cancel a booking
export async function POST(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(userId, 1);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many cancellation attempts',
          retryAfter: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const validatedData = cancelBookingSchema.parse(body);
    
    // Get the booking with provider details
    const [booking] = await db
      .select({
        booking: bookingsTable,
        provider: providersTable
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .where(eq(bookingsTable.id, params.bookingId))
      .limit(1);
    
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    
    // Check authorization - both customer and provider can cancel
    const isCustomer = booking.booking.customerId === userId;
    const isProvider = booking.provider?.userId === userId;
    
    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Unauthorized to cancel this booking" },
        { status: 403 }
      );
    }
    
    // Check if booking can be cancelled based on current state
    const currentState = booking.booking.status as BookingState;
    const cancellableStates = [
      BookingState.INITIATED,
      BookingState.PENDING_PROVIDER,
      BookingState.ACCEPTED,
      BookingState.PAYMENT_PENDING,
      BookingState.PAYMENT_SUCCEEDED,
      BookingState.IN_PROGRESS // Allow cancellation even during service
    ];
    
    if (!cancellableStates.includes(currentState)) {
      return NextResponse.json(
        { 
          error: `Cannot cancel booking`,
          message: `Booking is in ${currentState} state and cannot be cancelled`,
          currentState 
        },
        { status: 400 }
      );
    }
    
    // Calculate refund amount based on cancellation policy
    const bookingDate = new Date(booking.booking.bookingDate);
    const hoursUntilBooking = Math.max(0, (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60));
    
    let cancellationFeeRate = 0;
    let refundAmount = 0;
    let refundPercentage = 100;
    
    if (booking.booking.stripePaymentIntentId && validatedData.requestRefund) {
      // Determine cancellation fee based on hours until booking
      if (hoursUntilBooking >= 48) {
        cancellationFeeRate = CANCELLATION_POLICY[48];
        refundPercentage = 100;
      } else if (hoursUntilBooking >= 24) {
        cancellationFeeRate = CANCELLATION_POLICY[24];
        refundPercentage = 75;
      } else if (hoursUntilBooking >= 12) {
        cancellationFeeRate = CANCELLATION_POLICY[12];
        refundPercentage = 50;
      } else if (hoursUntilBooking >= 6) {
        cancellationFeeRate = CANCELLATION_POLICY[6];
        refundPercentage = 25;
      } else {
        cancellationFeeRate = CANCELLATION_POLICY[0];
        refundPercentage = 0;
      }
      
      // Provider cancellations always get full refund
      if (isProvider) {
        refundAmount = booking.booking.totalAmount;
        refundPercentage = 100;
        cancellationFeeRate = 0;
      } else {
        refundAmount = booking.booking.totalAmount * (1 - cancellationFeeRate);
      }
    }
    
    // Process actual Stripe refund if refund amount > 0
    let stripeRefund = null;
    if (booking.booking.stripePaymentIntentId && refundAmount > 0 && validatedData.requestRefund) {
      try {
        console.log(`Processing Stripe refund for booking ${params.bookingId}:`, {
          paymentIntentId: booking.booking.stripePaymentIntentId,
          refundAmountCents: dollarsToCents(refundAmount),
          refundPercentage: refundPercentage + '%'
        });

        stripeRefund = await createRefundWithIdempotency({
          paymentIntentId: booking.booking.stripePaymentIntentId,
          amount: dollarsToCents(refundAmount), // Convert to cents
          reason: "requested_by_customer",
          bookingId: params.bookingId,
          metadata: {
            bookingId: params.bookingId,
            cancellationReason: validatedData.reason,
            cancelledBy: isCustomer ? 'customer' : 'provider',
            hoursBeforeBooking: Math.round(hoursUntilBooking).toString(),
            refundPercentage: refundPercentage.toString(),
          },
          refundApplicationFee: true, // Refund platform fee as well
        });

        console.log(`Stripe refund created successfully:`, {
          refundId: stripeRefund.id,
          amount: stripeRefund.amount,
          status: stripeRefund.status
        });

        // Update transaction record with refund information
        await db
          .update(transactionsTable)
          .set({
            status: "refunded",
            refundId: stripeRefund.id,
            refundAmount: (stripeRefund.amount / 100).toFixed(2), // Convert back to dollars
            refundedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(transactionsTable.bookingId, params.bookingId));

      } catch (refundError) {
        console.error('Stripe refund failed:', refundError);
        
        // Log the refund failure but don't block the cancellation
        // The booking can still be cancelled, but customer service will need to handle refund manually
        await db
          .update(transactionsTable)
          .set({
            status: "refund_pending",
            refundError: refundError instanceof Error ? refundError.message : 'Unknown refund error',
            updatedAt: new Date(),
          })
          .where(eq(transactionsTable.bookingId, params.bookingId));

        // Continue with cancellation but note the refund issue
        console.warn('Booking will be cancelled but refund requires manual processing');
      }
    }

    // Cancel the booking using state machine
    await bookingStateMachine.cancelBooking(
      params.bookingId,
      userId,
      validatedData.reason,
      refundAmount
    );
    
    // Store cancellation details
    const cancellationDetails = {
      reason: validatedData.reason,
      urgency: validatedData.urgency,
      cancelledBy: isCustomer ? 'customer' : 'provider',
      hoursBeforeBooking: Math.round(hoursUntilBooking),
      cancellationFeeRate,
      refundAmount,
      refundPercentage,
      cancelledAt: new Date().toISOString()
    };
    
    await db
      .update(bookingsTable)
      .set({
        cancellationReason: validatedData.reason,
        cancelledBy: userId,
        cancelledAt: new Date(),
        providerNotes: JSON.stringify(cancellationDetails),
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, params.bookingId));
    
    // Send cancellation notifications
    await notificationService.sendBookingCancelledNotification({
      bookingId: params.bookingId,
      customerId: booking.booking.customerId || undefined,
      guestEmail: booking.booking.guestEmail || undefined,
      providerId: booking.booking.providerId,
      providerName: booking.provider?.businessName || 'Provider',
      cancelledBy: isCustomer ? 'customer' : 'provider',
      reason: validatedData.reason,
      refundAmount,
      refundPercentage,
      bookingDate: booking.booking.bookingDate,
      startTime: booking.booking.startTime,
      serviceName: booking.booking.serviceName
    });
    
    // Prepare response message based on refund processing result
    let message = "Booking cancelled successfully";
    let refundStatus = "none";

    if (refundAmount > 0) {
      if (stripeRefund) {
        // Stripe refund processed successfully
        refundStatus = "processed";
        message = `Booking cancelled successfully. ${refundPercentage}% refund (${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(refundAmount)}) has been initiated and will appear in your account within 5-10 business days.`;
      } else if (validatedData.requestRefund) {
        // Refund was requested but failed to process
        refundStatus = "pending_manual";
        message = `Booking cancelled successfully. ${refundPercentage}% refund (${new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(refundAmount)}) is pending manual processing. Our support team will contact you within 24 hours.`;
      } else {
        // No refund requested
        refundStatus = "waived";
        message = "Booking cancelled successfully. No refund requested.";
      }
    } else if (booking.booking.stripePaymentIntentId) {
      refundStatus = "policy_denied";
      message = "Booking cancelled successfully. No refund available due to late cancellation policy.";
    }
    
    // Get updated booking
    const [updatedBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, params.bookingId))
      .limit(1);
    
    return NextResponse.json({
      success: true,
      message,
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        cancelledAt: updatedBooking.cancelledAt,
        cancellationReason: updatedBooking.cancellationReason
      },
      cancellation: {
        hoursBeforeBooking: Math.round(hoursUntilBooking),
        cancellationFee: cancellationFeeRate * 100 + '%',
        refundAmount,
        refundPercentage: refundPercentage + '%',
        cancelledBy: isCustomer ? 'customer' : 'provider'
      },
      refund: {
        status: refundStatus,
        amount: refundAmount,
        stripeRefundId: stripeRefund?.id || null,
        stripeRefundStatus: stripeRefund?.status || null,
        processingTimeBusinessDays: stripeRefund ? "5-10" : null,
      }
    });
    
  } catch (error) {
    console.error("Error cancelling booking:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid state transition')) {
        return NextResponse.json(
          { 
            error: 'Invalid operation',
            message: error.message 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to cancel booking" },
      { status: 500 }
    );
  }
}

// GET endpoint to check cancellation policy and calculate refund
export async function GET(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bookingId = params.bookingId;

    // Get booking
    const [booking] = await db
      .select({
        booking: bookingsTable,
        provider: providersTable
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const isCustomer = booking.booking.customerId === userId;
    const isProvider = booking.provider?.userId === userId;
    
    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: 'Unauthorized to view cancellation details' },
        { status: 403 }
      );
    }

    // Calculate cancellation details
    const bookingDate = new Date(booking.booking.bookingDate);
    const hoursUntilBooking = Math.max(0, (bookingDate.getTime() - Date.now()) / (1000 * 60 * 60));
    
    // Determine refund based on policy
    let refundPercentage = 0;
    if (isProvider || hoursUntilBooking >= 48) {
      refundPercentage = 100;
    } else if (hoursUntilBooking >= 24) {
      refundPercentage = 75;
    } else if (hoursUntilBooking >= 12) {
      refundPercentage = 50;
    } else if (hoursUntilBooking >= 6) {
      refundPercentage = 25;
    }
    
    const refundAmount = booking.booking.totalAmount * (refundPercentage / 100);
    const cancellationFee = booking.booking.totalAmount - refundAmount;
    
    const currentState = booking.booking.status as BookingState;
    const canCancel = [
      BookingState.INITIATED,
      BookingState.PENDING_PROVIDER,
      BookingState.ACCEPTED,
      BookingState.PAYMENT_PENDING,
      BookingState.PAYMENT_SUCCEEDED,
      BookingState.IN_PROGRESS
    ].includes(currentState);

    return NextResponse.json({
      canCancel,
      currentState,
      isCustomer,
      isProvider,
      cancellationPolicy: {
        hoursUntilBooking: Math.round(hoursUntilBooking),
        refundPercentage,
        refundAmount,
        cancellationFee,
        policy: {
          '48+ hours': '100% refund',
          '24-48 hours': '75% refund',
          '12-24 hours': '50% refund',
          '6-12 hours': '25% refund',
          'Less than 6 hours': 'No refund'
        },
        providerCancellation: 'Always 100% refund for customer'
      },
      booking: {
        id: booking.booking.id,
        status: booking.booking.status,
        serviceName: booking.booking.serviceName,
        bookingDate: booking.booking.bookingDate,
        startTime: booking.booking.startTime,
        totalAmount: booking.booking.totalAmount
      }
    });

  } catch (error) {
    console.error('Error checking cancellation policy:', error);
    return NextResponse.json(
      { error: 'Failed to check cancellation policy' },
      { status: 500 }
    );
  }
}