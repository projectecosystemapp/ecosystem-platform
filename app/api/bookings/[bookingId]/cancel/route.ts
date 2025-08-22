import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getBookingById, cancelBooking } from "@/db/queries/bookings-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingStatus } from "@/db/schema/bookings-schema";
import { eq } from "drizzle-orm";

// Validation schema for cancelling a booking
const cancelBookingSchema = z.object({
  reason: z.string().min(1).max(500),
});

// POST /api/bookings/[bookingId]/cancel - Cancel a booking
export async function POST(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const validatedData = cancelBookingSchema.parse(body);
    
    // Get the booking
    const booking = await getBookingById(params.bookingId);
    
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    
    // Check authorization - both customer and provider can cancel
    const isCustomer = booking.customerId === userId;
    
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));
    
    const isProvider = provider?.userId === userId;
    
    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Unauthorized to cancel this booking" },
        { status: 403 }
      );
    }
    
    // Check if booking can be cancelled
    if (
      booking.status === bookingStatus.COMPLETED ||
      booking.status === bookingStatus.CANCELLED
    ) {
      return NextResponse.json(
        { error: `Cannot cancel booking with status: ${booking.status}` },
        { status: 400 }
      );
    }
    
    // Calculate cancellation window
    const hoursUntilBooking = Math.floor(
      (booking.bookingDate.getTime() - Date.now()) / (1000 * 60 * 60)
    );
    
    // Warn about late cancellation fee
    let message = "Booking cancelled successfully";
    if (hoursUntilBooking < 24 && booking.status === bookingStatus.CONFIRMED) {
      message = "Booking cancelled. A late cancellation fee (25%) may apply.";
    }
    
    // Cancel the booking
    const cancelledBooking = await cancelBooking(
      params.bookingId,
      validatedData.reason,
      userId
    );
    
    return NextResponse.json({
      success: true,
      booking: cancelledBooking,
      message,
      lateCancellation: hoursUntilBooking < 24,
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