// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { 
  createBookingSchema,
  validateBookingRequest,
  formatValidationErrors,
  calculateBookingAmounts
} from "@/lib/validations/booking-schemas";
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { createMarketplacePaymentIntent } from "@/lib/stripe";
import { z } from "zod";
import { calculatePlatformFees } from "@/lib/config/platform-fees";
import { Sanitize } from "@/lib/security/sanitization";

// Guest information schema
const guestInfoSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(20)
});

// Extended booking schema for guest checkout
const guestBookingSchema = createBookingSchema;

/**
 * POST /api/bookings/guest - Create a booking for both authenticated and guest users
 * Handles the 20% platform fee for guests vs 10% for authenticated users
 */
export const POST = withRateLimit(
  RATE_LIMIT_CONFIGS.payment,
  async (req: NextRequest) => {
    try {
      // Check if user is authenticated
      const { userId } = auth();
      const isAuthenticated = !!userId;

      // Parse and validate request body
      const body = await req.json();
      
      // If not authenticated, guest info is required
      if (!isAuthenticated && !body.guestInfo) {
        return NextResponse.json(
          { error: "Guest information is required for guest checkout" },
          { status: 400 }
        );
      }
      
      // Sanitize guest info if present
      if (!isAuthenticated && body.guestInfo) {
        const sanitizedGuestInfo = Sanitize.guestInfo(body.guestInfo);
        if (!sanitizedGuestInfo) {
          return NextResponse.json(
            { error: "Invalid guest information provided" },
            { status: 400 }
          );
        }
        body.guestInfo = sanitizedGuestInfo;
      }

      const validation = validateBookingRequest(guestBookingSchema, body);
      
      if (!validation.success) {
        return NextResponse.json(
          formatValidationErrors(validation.errors),
          { status: 400 }
        );
      }

      const bookingData = validation.data as any;

      // Verify provider exists and get Stripe Connect account
      const provider = await db
        .select({
          id: providersTable.id,
          displayName: providersTable.displayName,
          stripeConnectAccountId: providersTable.stripeConnectAccountId,
          stripeOnboardingComplete: providersTable.stripeOnboardingComplete,
          isActive: providersTable.isActive
        })
        .from(providersTable)
        .where(eq(providersTable.id, (bookingData as any).providerId))
        .limit(1);

      if (provider.length === 0) {
        return NextResponse.json(
          { error: "Provider not found" },
          { status: 404 }
        );
      }

      const providerInfo = provider[0];

      // Validate provider is active and has completed Stripe onboarding
      if (!providerInfo.isActive) {
        return NextResponse.json(
          { error: "Provider is not currently accepting bookings" },
          { status: 400 }
        );
      }

      if (!providerInfo.stripeOnboardingComplete || !providerInfo.stripeConnectAccountId) {
        return NextResponse.json(
          { error: "Provider has not completed payment setup" },
          { status: 400 }
        );
      }

      // Calculate amounts with platform fees
      const isGuest = !isAuthenticated;
      const servicePrice = (bookingData as any).servicePrice || 10000; // Default $100 in cents
      
      // Check for booking conflicts
      const conflictingBookings = await db
        .select({
          id: bookingsTable.id,
          bookingDate: bookingsTable.bookingDate,
          startTime: bookingsTable.startTime,
          endTime: bookingsTable.endTime,
          status: bookingsTable.status
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.providerId, (bookingData as any).providerId),
            eq(bookingsTable.bookingDate, new Date((bookingData as any).bookingDate)),
            inArray(bookingsTable.status, ["pending", "confirmed", "in_progress"])
          )
        );

      // Helper function to convert time string to minutes
      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
      };
      
      // Validate no time conflicts
      const hasConflict = conflictingBookings.some(booking => {
        const bookingStart = timeToMinutes(booking.startTime);
        const bookingEnd = timeToMinutes(booking.endTime);
        const requestedStart = timeToMinutes((bookingData as any).startTime);
        const requestedEnd = timeToMinutes((bookingData as any).endTime);

        return requestedStart < bookingEnd && requestedEnd > bookingStart;
      });

      if (hasConflict) {
        return NextResponse.json(
          { error: "Time slot is already booked" },
          { status: 409 }
        );
      }

      // Calculate booking amounts using centralized fee configuration
      const feeCalculation = calculatePlatformFees(
        (bookingData as any).servicePrice * 100, // Convert to cents
        !isAuthenticated // isGuest
      );
      
      const amounts = {
        totalAmount: feeCalculation.customerTotal,
        platformFee: feeCalculation.totalPlatformRevenue,
        providerPayout: feeCalculation.providerPayout
      };

      // Prepare customer identifier
      const customerId = isAuthenticated ? userId : `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Sanitize customer notes and guest info
      const customerNotes = Sanitize.text((bookingData as any).customerNotes || "");
      let enhancedCustomerNotes = customerNotes;
      
      if (!isAuthenticated && (bookingData as any).guestInfo) {
        const guestInfo = (bookingData as any).guestInfo;
        // Use already sanitized guest info
        enhancedCustomerNotes = `${customerNotes}\n\nGuest Info:\nName: ${guestInfo.firstName} ${guestInfo.lastName}\nEmail: ${guestInfo.email}\nPhone: ${guestInfo.phone}`;
      }

      // Create booking record
      const [newBooking] = await db
        .insert(bookingsTable)
        .values({
          providerId: Sanitize.uuid((bookingData as any).providerId),
          customerId: customerId,
          serviceName: Sanitize.text((bookingData as any).serviceName),
          servicePrice: ((bookingData as any).servicePrice || 0).toString(),
          serviceDuration: (bookingData as any).serviceDuration,
          bookingDate: new Date((bookingData as any).bookingDate),
          startTime: (bookingData as any).startTime,
          endTime: (bookingData as any).endTime,
          status: "pending",
          totalAmount: amounts.totalAmount.toString(),
          platformFee: amounts.platformFee.toString(),
          providerPayout: amounts.providerPayout.toString(),
          customerNotes: enhancedCustomerNotes,
          // Add a flag to identify guest bookings
          isGuestBooking: !isAuthenticated
        })
        .returning();

      // Create Stripe payment intent with metadata for guest tracking
      try {
        // Build metadata object with proper type handling
        const metadata: Record<string, string> = {
          bookingId: newBooking.id,
          providerId: (bookingData as any).providerId,
          customerId: customerId,
          type: "booking_payment",
          isGuest: (!isAuthenticated).toString()
        };

        // Add sanitized guest info to metadata only if present
        if (!isAuthenticated && (bookingData as any).guestInfo) {
          const guestInfo = (bookingData as any).guestInfo;
          if (guestInfo.email) {
            metadata.guestEmail = guestInfo.email; // Already sanitized
          }
          if (guestInfo.firstName && guestInfo.lastName) {
            metadata.guestName = `${guestInfo.firstName} ${guestInfo.lastName}`; // Already sanitized
          }
        }

        const paymentIntent = await createMarketplacePaymentIntent({
          amount: amounts.totalAmount,
          currency: "usd",
          customerId: customerId,
          stripeConnectAccountId: providerInfo.stripeConnectAccountId,
          platformFeeAmount: amounts.platformFee,
          metadata
        });

        // Update booking with payment intent ID
        await db
          .update(bookingsTable)
          .set({
            stripePaymentIntentId: paymentIntent.id,
            updatedAt: new Date()
          })
          .where(eq(bookingsTable.id, newBooking.id));

        // Create transaction record
        await db
          .insert(transactionsTable)
          .values({
            bookingId: newBooking.id,
            amount: amounts.totalAmount.toString(),
            platformFee: amounts.platformFee.toString(),
            providerPayout: amounts.providerPayout.toString(),
            status: "pending"
          });

        return NextResponse.json({
          booking: {
            ...newBooking,
            provider: {
              id: providerInfo.id,
              name: providerInfo.displayName
            },
            isGuest: !isAuthenticated
          },
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            amount: amounts.totalAmount,
            platformFee: amounts.platformFee
          },
          feeBreakdown: {
            servicePrice: (bookingData as any).servicePrice,
            basePlatformFee: feeCalculation.platformCommission / 100,
            guestSurcharge: feeCalculation.guestSurcharge / 100,
            totalPlatformFee: feeCalculation.totalPlatformRevenue / 100,
            providerPayout: feeCalculation.providerPayout / 100,
            totalAmount: feeCalculation.customerTotal / 100,
            isGuest: !isAuthenticated
          }
        }, { status: 201 });

      } catch (paymentError) {
        console.error("Payment intent creation failed:", paymentError);
        
        // Rollback booking if payment setup fails
        await db
          .delete(bookingsTable)
          .where(eq(bookingsTable.id, newBooking.id));

        return NextResponse.json(
          { error: "Failed to process payment setup" },
          { status: 500 }
        );
      }

    } catch (error) {
      console.error("Error creating booking:", error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: "Failed to create booking", details: error.message },
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
 * Helper function to convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}