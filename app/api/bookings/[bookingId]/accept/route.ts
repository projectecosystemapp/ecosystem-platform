// @ts-nocheck
/**
 * Provider Accept Booking API
 * 
 * Allows providers to accept pending bookings.
 * Triggers notifications and moves booking to payment collection phase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { bookingsTable, providersTable } from '@/db/schema/enhanced-booking-schema';
import { eq, and } from 'drizzle-orm';
import { bookingStateMachine, BookingState } from '@/lib/bookings/booking-state-machine';
import { notificationService } from '@/lib/notifications/notification-service';
import { z } from 'zod';
import { RateLimiter } from '@/lib/rate-limiter';

// Rate limiter for provider actions
const rateLimiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 60 * 1000, // 1 minute
  fireImmediately: true
});

// Request validation schema
const acceptBookingSchema = z.object({
  notes: z.string().optional(),
  estimatedArrivalTime: z.string().optional(),
  specialInstructions: z.string().optional()
});

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
    const validationResult = acceptBookingSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { notes, estimatedArrivalTime, specialInstructions } = validationResult.data;

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
        { error: 'You are not authorized to accept this booking' },
        { status: 403 }
      );
    }

    // Check current state - must be PENDING_PROVIDER
    const currentState = booking.booking.status as BookingState;
    if (currentState !== BookingState.PENDING_PROVIDER) {
      return NextResponse.json(
        { 
          error: 'Invalid booking state',
          message: `Booking is in ${currentState} state and cannot be accepted`,
          currentState 
        },
        { status: 400 }
      );
    }

    // Accept the booking using state machine
    await bookingStateMachine.acceptBooking(
      bookingId,
      userId,
      notes
    );

    // Update booking with additional provider information
    if (estimatedArrivalTime || specialInstructions) {
      await db
        .update(bookingsTable)
        .set({
          providerNotes: JSON.stringify({
            acceptanceNotes: notes,
            estimatedArrivalTime,
            specialInstructions,
            acceptedAt: new Date().toISOString()
          }),
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, bookingId));
    }

    // Send immediate notification to customer
    await notificationService.sendBookingAcceptedNotification({
      bookingId,
      customerId: booking.booking.customerId || undefined,
      guestEmail: booking.booking.guestEmail || undefined,
      providerName: booking.provider?.businessName || 'Provider',
      estimatedArrivalTime,
      specialInstructions,
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
      message: 'Booking accepted successfully',
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        updatedAt: updatedBooking.updatedAt,
        providerNotes: updatedBooking.providerNotes
      },
      nextSteps: {
        customer: 'Customer has been notified and will proceed to payment',
        provider: 'You will be notified once payment is confirmed',
        paymentDeadline: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
      }
    });

  } catch (error) {
    console.error('Error accepting booking:', error);
    
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
        error: 'Failed to accept booking',
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if booking can be accepted
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
    const canAccept = isProvider && currentState === BookingState.PENDING_PROVIDER;

    return NextResponse.json({
      canAccept,
      currentState,
      isProvider,
      booking: {
        id: booking.booking.id,
        status: booking.booking.status,
        serviceName: booking.booking.serviceName,
        bookingDate: booking.booking.bookingDate,
        startTime: booking.booking.startTime,
        endTime: booking.booking.endTime,
        totalAmount: booking.booking.totalAmount,
        customerNotes: booking.booking.customerNotes
      }
    });

  } catch (error) {
    console.error('Error checking booking accept status:', error);
    return NextResponse.json(
      { error: 'Failed to check booking status' },
      { status: 500 }
    );
  }
}