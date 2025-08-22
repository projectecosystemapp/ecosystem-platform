import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getBookingById, completeBooking } from "@/db/queries/bookings-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingStatus } from "@/db/schema/bookings-schema";
import { eq } from "drizzle-orm";

// Validation schema for completing a booking
const completeBookingSchema = z.object({
  notes: z.string().max(500).optional(),
});

// POST /api/bookings/[bookingId]/complete - Mark booking as complete
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
    const validatedData = completeBookingSchema.parse(body);
    
    // Get the booking
    const booking = await getBookingById(params.bookingId);
    
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    
    // Only provider can mark as complete
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));
    
    if (provider?.userId !== userId) {
      return NextResponse.json(
        { error: "Only the provider can mark booking as complete" },
        { status: 403 }
      );
    }
    
    // Check if booking can be completed
    if (booking.status !== bookingStatus.CONFIRMED) {
      return NextResponse.json(
        { error: `Cannot complete booking with status: ${booking.status}` },
        { status: 400 }
      );
    }
    
    // Complete the booking
    const completedBooking = await completeBooking(
      params.bookingId,
      userId,
      validatedData.notes
    );
    
    // TODO: Trigger payout to provider via Stripe Connect
    
    return NextResponse.json({
      success: true,
      booking: completedBooking,
      message: "Booking marked as complete. Payout will be processed within 24 hours.",
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