import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createBooking } from "@/db/queries/bookings-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingStatus, type NewBooking } from "@/db/schema/bookings-schema";
import { eq } from "drizzle-orm";
import { withRateLimit } from "@/lib/rate-limit";

// Validation schema for creating a booking
const createBookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceName: z.string().min(1).max(255),
  servicePrice: z.number().positive(),
  serviceDuration: z.number().min(15).max(480), // 15 minutes to 8 hours
  bookingDate: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:mm format
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  customerNotes: z.string().max(500).optional(),
  isGuestBooking: z.boolean().optional(),
  guestEmail: z.string().email().optional(), // Required if isGuestBooking is true
  guestPhone: z.string().optional(),
});

/**
 * POST /api/bookings/create
 * Create a new booking
 * Rate limited: 10 requests per minute per user/IP
 */
export const POST = withRateLimit('booking', async (request: NextRequest) => {
  try {
    const { userId } = auth();
    const body = await request.json();
    
    // Validate request body
    const validatedData = createBookingSchema.parse(body);
    
    // Check if it's a guest booking
    if (validatedData.isGuestBooking && !validatedData.guestEmail) {
      return NextResponse.json(
        { error: "Guest email is required for guest bookings" },
        { status: 400 }
      );
    }
    
    // For authenticated users, require authentication
    if (!validatedData.isGuestBooking && !userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Get provider details to calculate fees
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, validatedData.providerId));
    
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }
    
    if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Provider is not ready to accept bookings" },
        { status: 400 }
      );
    }
    
    // Calculate fees based on whether it's a guest booking
    const baseAmount = validatedData.servicePrice;
    const platformFeeRate = 0.10; // 10% base platform fee
    const guestSurchargeRate = validatedData.isGuestBooking ? 0.10 : 0; // Additional 10% for guests
    
    // Provider always receives 90% of the service price
    const providerPayout = baseAmount * (1 - platformFeeRate);
    
    // Guest pays extra 10% on top of service price
    const totalAmount = validatedData.isGuestBooking 
      ? baseAmount * (1 + guestSurchargeRate) 
      : baseAmount;
    
    // Platform fee includes base fee + guest surcharge
    const platformFee = totalAmount - providerPayout;
    
    // Generate confirmation code
    const confirmationCode = `BK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Prepare booking data
    const bookingData: NewBooking = {
      providerId: validatedData.providerId,
      customerId: userId || `guest_${validatedData.guestEmail}`, // Use email as ID for guests
      serviceName: validatedData.serviceName,
      servicePrice: baseAmount.toString(),
      serviceDuration: validatedData.serviceDuration,
      bookingDate: new Date(validatedData.bookingDate),
      startTime: validatedData.startTime,
      endTime: validatedData.endTime,
      status: bookingStatus.PENDING,
      totalAmount: totalAmount.toString(),
      platformFee: platformFee.toString(),
      providerPayout: providerPayout.toString(),
      customerNotes: validatedData.customerNotes,
      confirmationCode: confirmationCode,
      isGuestBooking: validatedData.isGuestBooking || false,
    };
    
    // Create the booking
    const newBooking = await createBooking(bookingData);
    
    // Return the created booking with confirmation code
    return NextResponse.json({
      success: true,
      booking: {
        id: newBooking.id,
        confirmationCode: newBooking.confirmationCode,
        providerId: newBooking.providerId,
        serviceName: newBooking.serviceName,
        bookingDate: newBooking.bookingDate,
        startTime: newBooking.startTime,
        endTime: newBooking.endTime,
        totalAmount: newBooking.totalAmount,
        status: newBooking.status,
      },
      message: "Booking created successfully",
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      // Handle specific booking errors
      if (error.message.includes("already booked")) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 } // Conflict
        );
      }
      
      if (error.message.includes("not available")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
});