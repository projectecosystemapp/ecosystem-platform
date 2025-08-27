/**
 * Provider Reject Booking API
 * 
 * Allows providers to reject pending bookings.
 * Triggers refund if payment was made and notifies customer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { bookingsTable, providersTable } from '@/db/schema/enhanced-booking-schema';
import { eq } from 'drizzle-orm';
import { bookingStateMachine, BookingState } from '@/lib/bookings/booking-state-machine';
import { notificationService } from '@/lib/notifications/notification-service';
import { stripe } from '@/lib/stripe-enhanced';
import { z } from 'zod';
import { RateLimiter } from '@/lib/rate-limiter';

// Rate limiter for provider actions
const rateLimiter = new RateLimiter({
  tokensPerInterval: 5,
  interval: 60 * 1000, // 1 minute
  fireImmediately: true
});

// Request validation schema
const rejectBookingSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  suggestAlternative: z.boolean().optional(),
  alternativeDates: z.array(z.string()).optional(),
  additionalNotes: z.string().optional()
});

// Predefined rejection reasons
const REJECTION_REASONS = {
  UNAVAILABLE: 'Provider is unavailable at the requested time',
  FULLY_BOOKED: 'Provider is fully booked for this date',
  SERVICE_NOT_AVAILABLE: 'Service is not available at this location',
  EMERGENCY: 'Provider has an emergency and cannot fulfill booking',
  CUSTOM: 'Custom reason provided by provider'
};

export async function POST(
  req: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    // Authenticate provider
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(userId, 1);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          retryAfter: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }

    const bookingId = params.bookingId;

    // Validate request body
    const body = await req.json();
    const validationResult = rejectBookingSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { reason, suggestAlternative, alternativeDates, additionalNotes } = validationResult.data;

    // Get booking and verify provider ownership
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

    // Verify provider owns this booking
    if (booking.provider?.userId !== userId) {
      return NextResponse.json(
        { error: 'You are not authorized to reject this booking' },
        { status: 403 }
      );
    }

    // Check current state - must be PENDING_PROVIDER
    const currentState = booking.booking.status as BookingState;
    if (currentState !== BookingState.PENDING_PROVIDER) {
      return NextResponse.json(
        { 
          error: 'Invalid booking state',
          message: `Booking is in ${currentState} state and cannot be rejected`,
          currentState 
        },
        { status: 400 }
      );
    }

    // Reject the booking using state machine
    await bookingStateMachine.rejectBooking(
      bookingId,
      userId,
      reason
    );

    // Update booking with rejection details
    await db
      .update(bookingsTable)
      .set({
        providerNotes: JSON.stringify({
          rejectionReason: reason,
          suggestAlternative,
          alternativeDates,
          additionalNotes,
          rejectedAt: new Date().toISOString()
        }),
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, bookingId));

    // Process refund if payment was already made
    let refundInfo = null;
    if (booking.booking.stripePaymentIntentId) {
      try {
        // Full refund for provider rejection
        const refund = await stripe.refunds.create({
          payment_intent: booking.booking.stripePaymentIntentId,
          reason: 'requested_by_customer',
          metadata: {
            bookingId,
            refundReason: 'Provider rejected booking',
            rejectionReason: reason
          }
        });

        refundInfo = {
          refundId: refund.id,
          amount: refund.amount / 100, // Convert from cents
          status: refund.status,
          expectedArrival: refund.status === 'succeeded' ? '5-10 business days' : 'Processing'
        };

        // Update booking to REFUNDED state
        await bookingStateMachine.transition(
          bookingId,
          BookingState.REFUNDED,
          'system',
          {
            reason: 'Full refund processed due to provider rejection',
            metadata: { refundId: refund.id, refundAmount: refund.amount / 100 }
          }
        );

      } catch (refundError) {
        console.error('Refund processing failed:', refundError);
        // Continue with rejection even if refund fails - will be handled manually
      }
    }

    // Send notification to customer
    await notificationService.sendBookingRejectedNotification({
      bookingId,
      customerId: booking.booking.customerId || undefined,
      guestEmail: booking.booking.guestEmail || undefined,
      providerName: booking.provider?.businessName || 'Provider',
      rejectionReason: reason,
      suggestAlternative,
      alternativeDates,
      additionalNotes,
      refundInfo,
      bookingDate: booking.booking.bookingDate,
      startTime: booking.booking.startTime,
      serviceName: booking.booking.serviceName
    });

    // Get updated booking
    const [updatedBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Booking rejected successfully',
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        updatedAt: updatedBooking.updatedAt,
        providerNotes: updatedBooking.providerNotes
      },
      refund: refundInfo,
      customerNotified: true
    });

  } catch (error) {
    console.error('Error rejecting booking:', error);
    
    // Check for specific error types
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
    }

    return NextResponse.json(
      { 
        error: 'Failed to reject booking',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to get rejection reasons
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

    // Check if user is the provider
    const isProvider = booking.provider?.userId === userId;
    const currentState = booking.booking.status as BookingState;
    const canReject = isProvider && currentState === BookingState.PENDING_PROVIDER;

    // Get alternative available slots if provider wants to suggest alternatives
    let alternativeSlots = [];
    if (canReject) {
      // This would fetch available slots from the availability system
      // For now, returning empty array
      alternativeSlots = [];
    }

    return NextResponse.json({
      canReject,
      currentState,
      isProvider,
      rejectionReasons: REJECTION_REASONS,
      alternativeSlots,
      booking: {
        id: booking.booking.id,
        status: booking.booking.status,
        serviceName: booking.booking.serviceName,
        bookingDate: booking.booking.bookingDate,
        startTime: booking.booking.startTime,
        endTime: booking.booking.endTime,
        customerNotes: booking.booking.customerNotes
      }
    });

  } catch (error) {
    console.error('Error getting rejection info:', error);
    return NextResponse.json(
      { error: 'Failed to get rejection information' },
      { status: 500 }
    );
  }
}