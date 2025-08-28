import { NextRequest, NextResponse } from "next/server";
import { registerEventAttendance, checkEventAvailability, getEventById } from "@/db/queries/events-queries";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody, ApiContext } from "@/lib/security/api-handler";
import { db } from "@/db/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";
import { calculateFees } from "@/lib/fees";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

/**
 * Event Attendance API
 * POST /api/events/[id]/attend - Register attendance for an event
 */

// Attendance registration schema
const attendanceSchema = z.object({
  numberOfGuests: z.number().min(1).max(10).default(1),
  dietaryRestrictions: z.string().optional(),
  specialRequests: z.string().optional(),
  useEarlyBird: z.boolean().optional(),
  paymentMethodId: z.string().optional(), // For instant booking
  returnUrl: z.string().url().optional(), // For redirect after payment
});

// Guest attendance schema (for unauthenticated users)
const guestAttendanceSchema = attendanceSchema.extend({
  guestEmail: z.string().email(),
  guestName: z.string().min(1).max(100),
  guestPhone: z.string().optional(),
});

/**
 * POST handler - Register attendance for an event
 */
async function handleAttendEvent(req: NextRequest, context: ApiContext) {
  try {
    const { id: eventId } = context.params || {};
    const { userId } = context;
    
    if (!eventId || !z.string().uuid().safeParse(eventId).success) {
      return createApiError("Invalid event ID", { status: 400 });
    }
    
    // Check if it's a guest booking
    const isGuestBooking = !userId;
    let body: any;
    
    if (isGuestBooking) {
      // Guest booking - validate guest schema
      body = getValidatedBody<z.infer<typeof guestAttendanceSchema>>(req);
      
      if (!body) {
        return createApiError("Invalid request body for guest booking", { status: 400 });
      }
    } else {
      // Authenticated booking
      body = getValidatedBody<z.infer<typeof attendanceSchema>>(req);
      
      if (!body) {
        return createApiError("Invalid request body", { status: 400 });
      }
    }
    
    // Check event availability
    const availability = await checkEventAvailability(eventId);
    
    if (!availability.available) {
      return createApiError(availability.reason || "Event not available", { 
        status: 400,
        code: "EVENT_NOT_AVAILABLE",
        details: { 
          waitlistAvailable: availability.waitlistAvailable 
        }
      });
    }
    
    // Check if there are enough spots
    const availableSpots = availability.availableSpots ?? 0;
    if (availableSpots > 0 && body.numberOfGuests > availableSpots) {
      return createApiError(`Only ${availableSpots} spots available`, { 
        status: 400,
        code: "INSUFFICIENT_SPOTS",
        details: { 
          requested: body.numberOfGuests,
          available: availableSpots 
        }
      });
    }
    
    // Get event details
    const event = await getEventById(eventId);
    if (!event) {
      return createApiError("Event not found", { status: 404 });
    }
    
    // Determine price
    let unitPrice = availability.price ?? 0;
    const canUseEarlyBird = availability.earlyBirdPrice !== null && body.useEarlyBird;
    if (canUseEarlyBird) {
      unitPrice = availability.earlyBirdPrice!;
    }
    
    // Ensure we have a valid price
    if (unitPrice <= 0) {
      return createApiError("Event pricing not configured", { status: 400 });
    }
    
    const totalAmount = unitPrice * body.numberOfGuests;
    
    // Calculate fees
    const fees = calculateFees(totalAmount, isGuestBooking);
    
    // Get user profile if authenticated
    let profile = null;
    let customerEmail = body.guestEmail;
    let customerName = body.guestName;
    let customerPhone = body.guestPhone;
    
    if (!isGuestBooking) {
      // Get current user info
      const user = await currentUser();
      if (!user) {
        return createApiError("User not found", { status: 401 });
      }
      
      [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);
      
      if (!profile) {
        return createApiError("User profile not found", { status: 404 });
      }
      
      customerEmail = profile.email || user.emailAddresses[0]?.emailAddress || "";
      customerName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username || "Customer";
      customerPhone = null; // Profile table doesn't store phone
    }
    
    // Create booking record
    const confirmationCode = `EVT-${Date.now().toString(36).toUpperCase()}`;
    
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        providerId: event.providerId,
        customerId: userId || "guest",
        serviceName: event.title,
        servicePrice: unitPrice.toFixed(2),
        serviceDuration: Math.ceil((new Date(event.endDateTime).getTime() - new Date(event.startDateTime).getTime()) / 60000), // Duration in minutes
        bookingDate: new Date(event.startDateTime),
        startTime: new Date(event.startDateTime).toTimeString().slice(0, 5),
        endTime: new Date(event.endDateTime).toTimeString().slice(0, 5),
        status: availability.requiresApproval ? "pending" : "confirmed",
        totalAmount: fees.totalAmount.toFixed(2),
        platformFee: fees.platformFee.toFixed(2),
        providerPayout: fees.providerPayout.toFixed(2),
        confirmationCode,
        isGuestBooking,
        guestEmail: isGuestBooking ? customerEmail : null,
        bookingType: "event",
        eventId: eventId,
        metadata: {
          numberOfGuests: body.numberOfGuests,
          dietaryRestrictions: body.dietaryRestrictions,
        },
        customerNotes: body.specialRequests,
      })
      .returning();
    
    // Handle payment for instant booking
    let paymentIntent = null;
    if (availability.instantBooking && !availability.requiresApproval) {
      try {
        // Create Stripe payment intent
        paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(fees.totalAmount * 100), // Convert to cents
          currency: "usd",
          metadata: {
            bookingId: booking.id,
            eventId: eventId,
            eventTitle: event.title,
            numberOfGuests: body.numberOfGuests.toString(),
            customerEmail,
            isGuestBooking: isGuestBooking.toString(),
          },
          description: `Event booking: ${event.title} for ${body.numberOfGuests} guest(s)`,
          receipt_email: customerEmail,
        });
        
        // Update booking with payment intent ID
        await db
          .update(bookingsTable)
          .set({ 
            stripePaymentIntentId: paymentIntent.id,
            status: "confirmed",
          })
          .where(eq(bookingsTable.id, booking.id));
      } catch (paymentError) {
        console.error("Error creating payment intent:", paymentError);
        
        // Delete the booking if payment setup fails
        await db
          .delete(bookingsTable)
          .where(eq(bookingsTable.id, booking.id));
        
        return createApiError("Failed to setup payment", { 
          status: 500,
          code: "PAYMENT_SETUP_FAILED"
        });
      }
    }
    
    // Register attendance in the event attendees table
    try {
      await registerEventAttendance(
        eventId,
        booking.id,
        {
          customerId: userId || "guest",
          customerEmail,
          customerName,
          customerPhone,
          numberOfGuests: body.numberOfGuests,
          dietaryRestrictions: body.dietaryRestrictions,
          specialRequests: body.specialRequests,
          status: availability.requiresApproval ? "waitlist" : "confirmed",
        }
      );
    } catch (attendanceError) {
      console.error("Error registering attendance:", attendanceError);
      // Don't fail the whole request, but log the error
    }
    
    // Prepare response
    const response: any = {
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        status: booking.status,
        eventId: eventId,
        eventTitle: event.title,
        eventDateTime: event.startDateTime,
        numberOfGuests: body.numberOfGuests,
        totalAmount: fees.totalAmount,
        requiresApproval: availability.requiresApproval,
        instantBooking: availability.instantBooking,
      },
      event: {
        id: event.id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        location: event.locationType === "virtual" 
          ? { type: "virtual", link: event.virtualLink }
          : { type: event.locationType, address: event.address },
      },
      provider: {
        id: event.provider.id,
        displayName: event.provider.displayName,
        profileImageUrl: event.provider.profileImageUrl,
      },
    };
    
    // Add payment info if instant booking
    if (paymentIntent) {
      response.payment = {
        clientSecret: paymentIntent.client_secret,
        amount: fees.totalAmount,
        currency: "usd",
        requiresAction: paymentIntent.status === "requires_action",
      };
    }
    
    return createApiResponse(
      response,
      { 
        status: 201,
        message: availability.requiresApproval 
          ? "Registration submitted for approval" 
          : "Successfully registered for event"
      }
    );
    
  } catch (error) {
    console.error("Error registering event attendance:", error);
    return createApiError("Failed to register for event", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// POST: Register for event (authenticated or guest)
export const POST = createSecureApiHandler(
  handleAttendEvent,
  {
    requireAuth: false, // Allow guest bookings
    validateBody: z.union([attendanceSchema, guestAttendanceSchema]),
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);