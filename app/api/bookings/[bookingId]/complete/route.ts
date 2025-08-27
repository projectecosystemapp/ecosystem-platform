// @ts-nocheck
/**
 * Complete Booking API
 * 
 * Allows providers to mark a booking as completed.
 * Triggers provider payout and enables customer review.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { bookingsTable, providersTable } from "@/db/schema/enhanced-booking-schema";
import { eq } from "drizzle-orm";
import { bookingStateMachine, BookingState } from "@/lib/bookings/booking-state-machine";
import { payoutService } from "@/lib/payments/payout-service";
import { notificationService } from "@/lib/notifications/notification-service";
import { RateLimiter } from "@/lib/rate-limiter";

// Rate limiter for completion actions
const rateLimiter = new RateLimiter({
  tokensPerInterval: 5,
  interval: 60 * 1000, // 1 minute
  fireImmediately: true
});

// Validation schema for completing a booking
const completeBookingSchema = z.object({
  notes: z.string().max(500).optional(),
  serviceQuality: z.enum(['excellent', 'good', 'satisfactory', 'poor']).optional(),
  additionalCharges: z.object({
    amount: z.number().min(0).optional(),
    description: z.string().optional()
  }).optional(),
  photosUrl: z.array(z.string().url()).optional()
});

// POST /api/bookings/[bookingId]/complete - Mark booking as complete
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
          error: 'Too many requests',
          retryAfter: rateLimitResult.reset 
        },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const validatedData = completeBookingSchema.parse(body);
    
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
    
    // Only provider or admin can mark as complete
    const isProvider = booking.provider?.userId === userId;
    const isCustomer = booking.booking.customerId === userId;
    
    if (!isProvider) {
      // Allow customer to confirm completion in certain cases
      if (isCustomer && booking.booking.status === BookingState.IN_PROGRESS) {
        // Customer can confirm service completion
      } else {
        return NextResponse.json(
          { error: "Only the provider can mark booking as complete" },
          { status: 403 }
        );
      }
    }
    
    // Check if booking can be completed
    const currentState = booking.booking.status as BookingState;
    const validStatesForCompletion = [
      BookingState.IN_PROGRESS,
      BookingState.PAYMENT_SUCCEEDED // Allow direct completion after payment for instant services
    ];
    
    if (!validStatesForCompletion.includes(currentState)) {
      return NextResponse.json(
        { 
          error: `Cannot complete booking`,
          message: `Booking is in ${currentState} state and cannot be completed`,
          currentState 
        },
        { status: 400 }
      );
    }
    
    // Complete the booking using state machine
    await bookingStateMachine.completeBooking(
      params.bookingId,
      userId,
      validatedData.notes
    );
    
    // Store completion details
    await db
      .update(bookingsTable)
      .set({
        providerNotes: JSON.stringify({
          completionNotes: validatedData.notes,
          serviceQuality: validatedData.serviceQuality,
          additionalCharges: validatedData.additionalCharges,
          photosUrl: validatedData.photosUrl,
          completedBy: userId,
          completedAt: new Date().toISOString()
        }),
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, params.bookingId));
    
    // Trigger provider payout (will be processed after escrow period)
    const payoutInfo = await payoutService.scheduleProviderPayout({
      bookingId: params.bookingId,
      providerId: booking.booking.providerId,
      amount: booking.booking.providerPayout,
      platformFee: booking.booking.platformFee,
      escrowDays: 7 // 7-day escrow period
    });
    
    // Send completion notifications
    await notificationService.sendBookingCompletedNotification({
      bookingId: params.bookingId,
      customerId: booking.booking.customerId || undefined,
      guestEmail: booking.booking.guestEmail || undefined,
      providerName: booking.provider?.businessName || 'Provider',
      serviceName: booking.booking.serviceName,
      completionNotes: validatedData.notes,
      payoutDate: payoutInfo.scheduledAt,
      reviewLink: `/bookings/${params.bookingId}/review`
    });

    // Get updated booking
    const [updatedBooking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, params.bookingId))
      .limit(1);
    
    return NextResponse.json({
      success: true,
      message: "Booking marked as complete",
      booking: {
        id: updatedBooking.id,
        status: updatedBooking.status,
        completedAt: updatedBooking.completedAt,
        providerNotes: updatedBooking.providerNotes
      },
      payout: {
        amount: booking.booking.providerPayout,
        scheduledDate: payoutInfo.scheduledAt,
        status: payoutInfo.status,
        escrowPeriod: '7 days',
        message: "Payout will be processed after the escrow period"
      },
      nextSteps: {
        provider: "Payout will be processed in 7 days unless disputed",
        customer: "Please leave a review to help other customers"
      }
    });
    
  } catch (error) {
    console.error("Error completing booking:", error);
    
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
      { error: "Failed to complete booking" },
      { status: 500 }
    );
  }
}

// GET endpoint to check if booking can be completed
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
    const isProvider = booking.provider?.userId === userId;
    const isCustomer = booking.booking.customerId === userId;
    const currentState = booking.booking.status as BookingState;
    
    const canComplete = (isProvider || isCustomer) && 
                       (currentState === BookingState.IN_PROGRESS || 
                        currentState === BookingState.PAYMENT_SUCCEEDED);

    return NextResponse.json({
      canComplete,
      currentState,
      isProvider,
      isCustomer,
      booking: {
        id: booking.booking.id,
        status: booking.booking.status,
        serviceName: booking.booking.serviceName,
        bookingDate: booking.booking.bookingDate,
        startTime: booking.booking.startTime,
        endTime: booking.booking.endTime,
        totalAmount: booking.booking.totalAmount,
        providerPayout: booking.booking.providerPayout
      }
    });

  } catch (error) {
    console.error('Error checking completion status:', error);
    return NextResponse.json(
      { error: 'Failed to check completion status' },
      { status: 500 }
    );
  }
}