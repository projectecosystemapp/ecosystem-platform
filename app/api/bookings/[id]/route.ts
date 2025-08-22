import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { 
  updateBookingSchema, 
  validateBookingRequest,
  formatValidationErrors
} from "@/lib/validations/booking-schemas";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { stripe } from "@/lib/stripe";

/**
 * GET /api/bookings/[id] - Get specific booking details
 */
export const GET = withRateLimit(
  RATE_LIMIT_CONFIGS.api,
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      const bookingId = params.id;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(bookingId)) {
        return NextResponse.json(
          { error: "Invalid booking ID format" },
          { status: 400 }
        );
      }

      // Fetch booking with provider and transaction details
      const bookingQuery = await db
        .select({
          // Booking fields
          id: bookingsTable.id,
          providerId: bookingsTable.providerId,
          customerId: bookingsTable.customerId,
          serviceName: bookingsTable.serviceName,
          servicePrice: bookingsTable.servicePrice,
          serviceDuration: bookingsTable.serviceDuration,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status,
          stripePaymentIntentId: bookingsTable.stripePaymentIntentId,
          totalAmount: bookingsTable.totalAmount,
          platformFee: bookingsTable.platformFee,
          providerPayout: bookingsTable.providerPayout,
          customerNotes: bookingsTable.customerNotes,
          providerNotes: bookingsTable.providerNotes,
          cancellationReason: bookingsTable.cancellationReason,
          cancelledBy: bookingsTable.cancelledBy,
          cancelledAt: bookingsTable.cancelledAt,
          createdAt: bookingsTable.createdAt,
          updatedAt: bookingsTable.updatedAt,
          completedAt: bookingsTable.completedAt,
          
          // Provider info
          providerName: providersTable.displayName,
          providerSlug: providersTable.slug,
          providerImage: providersTable.profileImageUrl,
          providerLocation: providersTable.locationCity,
          providerRating: providersTable.averageRating,
          providerReviews: providersTable.totalReviews
        })
        .from(bookingsTable)
        .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);

      if (bookingQuery.length === 0) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const booking = bookingQuery[0];

      // Check if user has access to this booking (customer or provider)
      const hasAccess = booking.customerId === userId || 
                       (await checkProviderAccess(userId, booking.providerId));

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Get transaction details if they exist
      const transactions = await db
        .select({
          id: transactionsTable.id,
          stripeChargeId: transactionsTable.stripeChargeId,
          stripeTransferId: transactionsTable.stripeTransferId,
          stripeRefundId: transactionsTable.stripeRefundId,
          amount: transactionsTable.amount,
          platformFee: transactionsTable.platformFee,
          providerPayout: transactionsTable.providerPayout,
          status: transactionsTable.status,
          processedAt: transactionsTable.processedAt,
          createdAt: transactionsTable.createdAt
        })
        .from(transactionsTable)
        .where(eq(transactionsTable.bookingId, bookingId));

      // Get payment intent details from Stripe if needed
      let paymentDetails = null;
      if (booking.stripePaymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            booking.stripePaymentIntentId
          );
          
          paymentDetails = {
            id: paymentIntent.id,
            status: paymentIntent.status,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            paymentMethod: paymentIntent.payment_method,
            lastPaymentError: paymentIntent.last_payment_error?.message
          };
        } catch (error) {
          console.error("Error fetching payment intent:", error);
          // Continue without payment details rather than failing
        }
      }

      return NextResponse.json({
        booking: {
          ...booking,
          provider: {
            id: booking.providerId,
            name: booking.providerName,
            slug: booking.providerSlug,
            image: booking.providerImage,
            location: booking.providerLocation,
            rating: booking.providerRating,
            totalReviews: booking.providerReviews
          }
        },
        transactions,
        paymentDetails
      });

    } catch (error) {
      console.error("Error fetching booking:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to fetch booking", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

/**
 * PATCH /api/bookings/[id] - Update booking status and details
 */
export const PATCH = withRateLimit(
  RATE_LIMIT_CONFIGS.api,
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      const bookingId = params.id;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(bookingId)) {
        return NextResponse.json(
          { error: "Invalid booking ID format" },
          { status: 400 }
        );
      }

      // Parse and validate request body
      const body = await req.json();
      const validation = validateBookingRequest(updateBookingSchema, body);
      
      if (!validation.success) {
        return NextResponse.json(
          formatValidationErrors(validation.errors),
          { status: 400 }
        );
      }

      const updateData = validation.data;

      // Fetch existing booking
      const existingBooking = await db
        .select({
          id: bookingsTable.id,
          customerId: bookingsTable.customerId,
          providerId: bookingsTable.providerId,
          status: bookingsTable.status,
          stripePaymentIntentId: bookingsTable.stripePaymentIntentId,
          totalAmount: bookingsTable.totalAmount
        })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);

      if (existingBooking.length === 0) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const booking = existingBooking[0];

      // Check access permissions
      const hasAccess = booking.customerId === userId || 
                       (await checkProviderAccess(userId, booking.providerId));

      if (!hasAccess) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Validate status transitions
      if (updateData.status) {
        const validTransitions = getValidStatusTransitions(booking.status);
        if (!validTransitions.includes(updateData.status)) {
          return NextResponse.json(
            { 
              error: "Invalid status transition",
              current: booking.status,
              attempted: updateData.status,
              valid: validTransitions
            },
            { status: 400 }
          );
        }
      }

      // Prepare update object
      const updateObject: any = {
        updatedAt: new Date()
      };

      if (updateData.status) {
        updateObject.status = updateData.status;
        
        // Set completion timestamp if completing
        if (updateData.status === "completed") {
          updateObject.completedAt = new Date();
        }
        
        // Set cancellation details if cancelling
        if (updateData.status === "cancelled") {
          updateObject.cancelledAt = new Date();
          updateObject.cancelledBy = userId;
          updateObject.cancellationReason = updateData.cancellationReason;
        }
      }

      if (updateData.providerNotes !== undefined) {
        updateObject.providerNotes = updateData.providerNotes;
      }

      // Update the booking
      const [updatedBooking] = await db
        .update(bookingsTable)
        .set(updateObject)
        .where(eq(bookingsTable.id, bookingId))
        .returning();

      return NextResponse.json({
        booking: updatedBooking,
        message: "Booking updated successfully"
      });

    } catch (error) {
      console.error("Error updating booking:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to update booking", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/bookings/[id] - Cancel booking with refund logic
 */
export const DELETE = withRateLimit(
  RATE_LIMIT_CONFIGS.api,
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    try {
      const { userId } = auth();

      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" }, 
          { status: 401 }
        );
      }

      const bookingId = params.id;

      // Parse cancellation reason from query params
      const url = new URL(req.url);
      const reason = url.searchParams.get('reason') || 'requested_by_customer';

      // Fetch booking details
      const existingBooking = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, bookingId))
        .limit(1);

      if (existingBooking.length === 0) {
        return NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        );
      }

      const booking = existingBooking[0];

      // Check access permissions (only customer can cancel)
      if (booking.customerId !== userId) {
        return NextResponse.json(
          { error: "Only the customer can cancel this booking" },
          { status: 403 }
        );
      }

      // Check if booking can be cancelled
      if (!["pending", "confirmed"].includes(booking.status)) {
        return NextResponse.json(
          { error: "Booking cannot be cancelled in its current state" },
          { status: 400 }
        );
      }

      // Calculate refund amount based on cancellation timing
      const bookingDateTime = new Date(`${booking.bookingDate}T${booking.startTime}`);
      const now = new Date();
      const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      let refundPercentage = 1.0; // Full refund by default
      
      if (hoursUntilBooking < 24) {
        refundPercentage = 0.5; // 50% refund if less than 24 hours
      }
      if (hoursUntilBooking < 2) {
        refundPercentage = 0; // No refund if less than 2 hours
      }

      const refundAmount = Math.round(
        parseFloat(booking.totalAmount) * refundPercentage
      );

      // Process refund through Stripe if payment was made
      let refundId = null;
      if (booking.stripePaymentIntentId && refundAmount > 0) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: booking.stripePaymentIntentId,
            amount: refundAmount,
            reason: 'requested_by_customer',
            metadata: {
              bookingId: booking.id,
              originalAmount: booking.totalAmount,
              refundPercentage: refundPercentage.toString()
            }
          });
          
          refundId = refund.id;
        } catch (stripeError) {
          console.error("Stripe refund failed:", stripeError);
          return NextResponse.json(
            { error: "Failed to process refund" },
            { status: 500 }
          );
        }
      }

      // Update booking status
      const [cancelledBooking] = await db
        .update(bookingsTable)
        .set({
          status: "cancelled",
          cancellationReason: reason,
          cancelledBy: userId,
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(bookingsTable.id, bookingId))
        .returning();

      // Update transaction record if refund was processed
      if (refundId) {
        await db
          .update(transactionsTable)
          .set({
            stripeRefundId: refundId,
            status: "refunded"
          })
          .where(eq(transactionsTable.bookingId, bookingId));
      }

      return NextResponse.json({
        booking: cancelledBooking,
        refund: {
          amount: refundAmount,
          percentage: refundPercentage,
          refundId,
          hoursUntilBooking
        },
        message: "Booking cancelled successfully"
      });

    } catch (error) {
      console.error("Error cancelling booking:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to cancel booking", details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  }
);

/**
 * Helper function to check if user is a provider
 */
async function checkProviderAccess(userId: string, providerId: string): Promise<boolean> {
  const provider = await db
    .select({ id: providersTable.id })
    .from(providersTable)
    .where(
      and(
        eq(providersTable.id, providerId),
        eq(providersTable.userId, userId)
      )
    )
    .limit(1);
  
  return provider.length > 0;
}

/**
 * Get valid status transitions for booking status state machine
 */
function getValidStatusTransitions(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["in_progress", "cancelled", "no_show"],
    in_progress: ["completed", "cancelled"],
    completed: [], // Terminal state
    cancelled: [], // Terminal state
    no_show: []    // Terminal state
  };
  
  return transitions[currentStatus] || [];
}