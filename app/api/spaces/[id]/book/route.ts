import { NextRequest, NextResponse } from "next/server";
import { checkSpaceAvailability, getSpaceById } from "@/db/queries/spaces-queries";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createSecureApiHandler, createApiResponse, createApiError, getValidatedBody } from "@/lib/security/api-handler";
import { db } from "@/db";
import { bookingsTable, customersTable, spacesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateFees } from "@/lib/fees";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

/**
 * Space Booking API
 * POST /api/spaces/[id]/book - Create a booking for a space
 */

// Booking schema
const bookingSchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  numberOfGuests: z.number().min(1),
  
  // Customer info (for guest checkout)
  guestInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
  }).optional(),
  
  // Optional message to provider
  message: z.string().max(500).optional(),
  
  // Special requests
  specialRequests: z.array(z.string()).optional(),
  
  // Agreement confirmations
  agreedToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions"
  }),
  agreedToCancellationPolicy: z.boolean().refine(val => val === true, {
    message: "You must agree to the cancellation policy"
  }),
  
  // Payment method (for returning customers)
  paymentMethodId: z.string().optional(),
  
  // Return URL for redirect after payment
  returnUrl: z.string().url().optional(),
}).refine(data => {
  if (data.endDate <= data.startDate) {
    throw new Error("End date must be after start date");
  }
  return true;
});

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST handler - Create space booking
 */
async function handleCreateBooking(req: NextRequest, context: any, { params }: RouteParams) {
  try {
    const { userId } = context;
    const { id: spaceId } = params;
    
    if (!spaceId) {
      return createApiError("Space ID is required", { status: 400 });
    }
    
    const body = getValidatedBody<z.infer<typeof bookingSchema>>(req);
    
    if (!body) {
      return createApiError("Invalid request body", { status: 400 });
    }
    
    // Get space details
    const space = await getSpaceById(spaceId);
    
    if (!space) {
      return createApiError("Space not found", { 
        status: 404,
        code: "SPACE_NOT_FOUND"
      });
    }
    
    if (!space.isActive) {
      return createApiError("Space is not available for booking", { 
        status: 400,
        code: "SPACE_INACTIVE"
      });
    }
    
    // Check capacity
    if (body.numberOfGuests > space.capacity) {
      return createApiError(`Space capacity is ${space.capacity}, but you need space for ${body.numberOfGuests} guests`, { 
        status: 400,
        code: "EXCEEDS_CAPACITY"
      });
    }
    
    // Check availability
    const availability = await checkSpaceAvailability(
      spaceId,
      body.startDate,
      body.endDate
    );
    
    if (!availability.available) {
      return createApiError(availability.reason || "Space is not available for the selected dates", { 
        status: 400,
        code: "NOT_AVAILABLE"
      });
    }
    
    // Determine if this is a guest checkout
    const isGuest = !userId;
    let customerId: string | null = null;
    let customerEmail: string;
    let customerName: string;
    let customerPhone: string | null = null;
    
    if (isGuest) {
      // Guest checkout
      if (!body.guestInfo) {
        return createApiError("Guest information is required for guest checkout", { status: 400 });
      }
      
      customerEmail = body.guestInfo.email;
      customerName = `${body.guestInfo.firstName} ${body.guestInfo.lastName}`;
      customerPhone = body.guestInfo.phone;
      
      // Create or get guest customer record
      const existingCustomer = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.email, customerEmail))
        .limit(1);
      
      if (existingCustomer.length > 0) {
        customerId = existingCustomer[0].id;
      } else {
        const [newCustomer] = await db
          .insert(customersTable)
          .values({
            email: customerEmail,
            name: customerName,
            phone: customerPhone,
            isGuest: true,
          })
          .returning();
        customerId = newCustomer.id;
      }
    } else {
      // Authenticated user checkout
      const user = await currentUser();
      if (!user) {
        return createApiError("User not found", { status: 401 });
      }
      
      customerEmail = user.emailAddresses[0].emailAddress;
      customerName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.username || "Customer";
      
      // Get or create customer record
      const existingCustomer = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.userId, userId))
        .limit(1);
      
      if (existingCustomer.length > 0) {
        customerId = existingCustomer[0].id;
      } else {
        const [newCustomer] = await db
          .insert(customersTable)
          .values({
            userId,
            email: customerEmail,
            name: customerName,
            isGuest: false,
          })
          .returning();
        customerId = newCustomer.id;
      }
    }
    
    // Calculate fees
    const baseAmount = availability.price || 0;
    const cleaningFee = availability.cleaningFee || 0;
    const securityDeposit = availability.securityDeposit || 0;
    const subtotal = baseAmount + cleaningFee;
    
    const fees = calculateFees(subtotal, isGuest);
    
    // Create booking record
    const bookingStatus = space.requiresApproval ? "PENDING_PROVIDER" : "ACCEPTED";
    
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        customerId,
        customerEmail,
        customerName,
        customerPhone,
        providerId: space.providerId,
        serviceId: spaceId,
        bookingType: "space",
        bookingStartDateTime: body.startDate,
        bookingEndDateTime: body.endDate,
        numberOfGuests: body.numberOfGuests,
        status: bookingStatus,
        baseAmount: baseAmount.toString(),
        platformFee: fees.platformFee.toString(),
        providerEarnings: fees.providerAmount.toString(),
        totalAmount: fees.customerTotal.toString(),
        additionalFees: {
          cleaningFee,
          securityDeposit,
          guestSurcharge: isGuest ? fees.guestSurcharge : 0,
        },
        specialRequests: body.specialRequests,
        customerMessage: body.message,
        metadata: {
          spaceType: space.spaceType,
          instantBooking: space.instantBooking,
          priceType: availability.priceType,
          agreedToTerms: body.agreedToTerms,
          agreedToCancellationPolicy: body.agreedToCancellationPolicy,
        },
      })
      .returning();
    
    // If instant booking and accepted, create payment intent
    let paymentIntent = null;
    let clientSecret = null;
    
    if (!space.requiresApproval || space.instantBooking) {
      // Create Stripe payment intent
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(fees.customerTotal * 100), // Convert to cents
        currency: "usd",
        metadata: {
          bookingId: booking.id,
          spaceId,
          customerId: customerId || "",
          isGuest: isGuest.toString(),
        },
        description: `Booking for ${space.name} - ${customerName}`,
        receipt_email: customerEmail,
      };
      
      // Add security deposit as a separate hold if needed
      if (securityDeposit > 0) {
        paymentIntentData.metadata!.securityDeposit = securityDeposit.toString();
      }
      
      paymentIntent = await stripe.paymentIntents.create(paymentIntentData);
      clientSecret = paymentIntent.client_secret;
      
      // Update booking with payment intent ID
      await db
        .update(bookingsTable)
        .set({
          stripePaymentIntentId: paymentIntent.id,
          status: "PAYMENT_PENDING",
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, booking.id));
    }
    
    return createApiResponse(
      {
        booking: {
          id: booking.id,
          status: booking.status,
          spaceId,
          spaceName: space.name,
          startDate: body.startDate,
          endDate: body.endDate,
          numberOfGuests: body.numberOfGuests,
          baseAmount,
          cleaningFee,
          securityDeposit,
          platformFee: fees.platformFee,
          guestSurcharge: isGuest ? fees.guestSurcharge : 0,
          totalAmount: fees.customerTotal,
          requiresApproval: space.requiresApproval,
          instantBooking: space.instantBooking,
          cancellationPolicy: space.cancellationPolicy,
        },
        payment: clientSecret ? {
          clientSecret,
          paymentIntentId: paymentIntent!.id,
        } : null,
        message: space.requiresApproval && !space.instantBooking
          ? "Booking request submitted. You'll be notified once the provider responds."
          : "Booking confirmed. Please complete payment to secure your reservation.",
      },
      { status: 201 }
    );
    
  } catch (error) {
    console.error("Error creating space booking:", error);
    return createApiError("Failed to create booking", { 
      status: 500,
      details: error instanceof Error ? error.message : undefined
    });
  }
}

// POST: Create space booking (optional auth for guest checkout)
export const POST = createSecureApiHandler(
  handleCreateBooking,
  {
    requireAuth: false, // Allow guest bookings
    validateBody: bookingSchema,
    rateLimit: { requests: 10, window: '1m' },
    auditLog: true,
    allowedMethods: ['POST'],
  }
);

// Health check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}