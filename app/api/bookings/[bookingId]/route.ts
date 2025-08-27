// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getBookingById, updateBookingStatus } from "@/db/queries/bookings-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingStatus } from "@/db/schema/bookings-schema";
import { eq } from "drizzle-orm";

// Validation schema for updating booking status
const updateBookingSchema = z.object({
  status: z.enum([
    bookingStatus.PENDING,
    bookingStatus.CONFIRMED,
    bookingStatus.COMPLETED,
    bookingStatus.CANCELLED,
    bookingStatus.NO_SHOW,
  ]),
  stripePaymentIntentId: z.string().optional(),
  providerNotes: z.string().max(500).optional(),
});

// GET /api/bookings/[bookingId] - Get booking details
export async function GET(
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
    
    const booking = await getBookingById(params.bookingId);
    
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    
    // Check authorization - user must be either the customer or the provider
    const isCustomer = booking.customerId === userId;
    
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));
    
    const isProvider = provider?.userId === userId;
    
    if (!isCustomer && !isProvider) {
      return NextResponse.json(
        { error: "Unauthorized to view this booking" },
        { status: 403 }
      );
    }
    
    // Include provider info if customer is viewing
    const bookingData = {
      ...booking,
      provider: isCustomer ? {
        id: provider?.id,
        displayName: provider?.displayName,
        profileImageUrl: provider?.profileImageUrl,
        hourlyRate: provider?.hourlyRate,
      } : undefined,
    };
    
    return NextResponse.json({
      success: true,
      booking: bookingData,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}

// PATCH /api/bookings/[bookingId] - Update booking status
export async function PATCH(
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
    const validatedData = updateBookingSchema.parse(body);
    
    // Get the booking
    const booking = await getBookingById(params.bookingId);
    
    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    
    // Check authorization
    const isCustomer = booking.customerId === userId;
    
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId));
    
    const isProvider = provider?.userId === userId;
    
    // Different permissions for different status updates
    if (validatedData.status === bookingStatus.CONFIRMED) {
      // Only customer can confirm (after payment)
      if (!isCustomer) {
        return NextResponse.json(
          { error: "Only customer can confirm booking" },
          { status: 403 }
        );
      }
    } else if (
      validatedData.status === bookingStatus.COMPLETED ||
      validatedData.status === bookingStatus.NO_SHOW
    ) {
      // Only provider can mark as completed or no-show
      if (!isProvider) {
        return NextResponse.json(
          { error: "Only provider can mark booking as completed or no-show" },
          { status: 403 }
        );
      }
    } else if (validatedData.status === bookingStatus.CANCELLED) {
      // Both customer and provider can cancel
      if (!isCustomer && !isProvider) {
        return NextResponse.json(
          { error: "Unauthorized to cancel this booking" },
          { status: 403 }
        );
      }
    }
    
    // Update the booking
    const updatedBooking = await updateBookingStatus(
      params.bookingId,
      validatedData.status,
      {
        stripePaymentIntentId: validatedData.stripePaymentIntentId,
        providerNotes: validatedData.providerNotes,
        cancelledBy: validatedData.status === bookingStatus.CANCELLED ? userId : undefined,
      }
    );
    
    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: `Booking ${validatedData.status} successfully`,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    
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
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}