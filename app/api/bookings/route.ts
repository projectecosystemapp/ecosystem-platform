import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Local booking stub API
 * Temporary endpoint for testing booking flow without payment processing
 * Will be replaced with Stripe Connect integration
 */

// POST /api/bookings - Create a booking (stub)
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { providerId, serviceId, date, startTime, endTime, notes } = body;

    // Basic validation
    if (!providerId || !date || !startTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create a mock booking ID
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Mock booking object
    const booking = {
      id: bookingId,
      customerId: userId,
      providerId,
      serviceId,
      date,
      startTime,
      endTime: endTime || startTime,
      status: "requested",
      totalAmount: 0, // No payment in stub
      notes,
      createdAt: new Date().toISOString(),
    };

    // Log the booking (in production, save to database)
    console.log("Created stub booking:", booking);

    // Return success response
    return NextResponse.json({
      success: true,
      booking,
      message: "Booking request created successfully (test mode - no payment processed)",
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}

// GET /api/bookings - List bookings for current user
export async function GET(req: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return mock bookings for testing
    const mockBookings = [
      {
        id: "booking_example_1",
        customerId: userId,
        providerId: "provider_1",
        serviceId: "service_1",
        date: "2024-01-15",
        startTime: "10:00",
        endTime: "11:00",
        status: "confirmed",
        totalAmount: 100,
        createdAt: "2024-01-10T10:00:00Z",
      },
    ];

    return NextResponse.json({
      bookings: mockBookings,
      message: "Test data - no real bookings in stub mode",
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 }
    );
  }
}