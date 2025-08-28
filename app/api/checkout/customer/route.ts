// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import { logApiStart, logApiSuccess, logApiError } from "@/lib/logger";
import { createPaymentIntentWithIdempotency } from "@/lib/stripe-enhanced";
import { calculateFees, dollarsToCents, MIN_TRANSACTION_CENTS } from "@/lib/payments/fee-calculator";
import { generateConfirmationCode } from "@/lib/utils";
import * as crypto from "crypto";

// Input validation schema for authenticated customer checkout
const customerCheckoutSchema = z.object({
  // Service details
  providerId: z.string().uuid("Invalid provider ID"),
  serviceId: z.string().uuid("Invalid service ID"),
  
  // Booking details
  bookingDate: z.string().datetime(), // ISO 8601 format
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
  
  // Optional notes
  customerNotes: z.string().max(500).optional(),
  
  // Metadata for tracking
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

// Response type
interface CustomerCheckoutResponse {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  bookingId?: string;
  confirmationCode?: string;
  fees?: {
    baseAmount: string;
    platformFee: string;
    totalAmount: string;
    providerPayout: string;
  };
  customerInfo?: {
    customerId: string;
    customerName: string;
    customerEmail: string;
  };
  error?: string;
}

// Format time validation
function validateTimeSlot(startTime: string, endTime: string): boolean {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return endMinutes > startMinutes;
}

export const POST = withRateLimitRedis(
  { type: "payment" }, // Stricter rate limiting for payment endpoints
  async (req: NextRequest): Promise<NextResponse<CustomerCheckoutResponse>> => {
    try {
      // Authenticate user with Clerk
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { 
            success: false,
            error: "Authentication required. Please log in to complete checkout." 
          },
          { status: 401 }
        );
      }
      
      // Parse and validate request body
      const body = await req.json();
      
      // Validate input
      const validationResult = customerCheckoutSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          { 
            success: false,
            error: validationResult.error.errors[0]?.message || "Invalid input" 
          },
          { status: 400 }
        );
      }
      
      const data = validationResult.data;
      
      // Validate time slot
      if (!validateTimeSlot(data.startTime, data.endTime)) {
        return NextResponse.json(
          { 
            success: false,
            error: "End time must be after start time" 
          },
          { status: 400 }
        );
      }
      
      // Fetch customer profile
      const [customer] = await db
        .select({
          id: profilesTable.id,
          userId: profilesTable.userId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          email: profilesTable.email,
          role: profilesTable.role,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);
      
      if (!customer) {
        return NextResponse.json(
          { 
            success: false,
            error: "Customer profile not found. Please complete your profile setup." 
          },
          { status: 404 }
        );
      }
      
      // Fetch provider with Stripe account info
      const [provider] = await db
        .select({
          id: providersTable.id,
          businessName: providersTable.businessName,
          stripeConnectAccountId: providersTable.stripeConnectAccountId,
          stripeOnboardingComplete: providersTable.stripeOnboardingComplete,
          // commissionRate removed - always 10% per constitution
          isActive: providersTable.isActive,
        })
        .from(providersTable)
        .where(eq(providersTable.id, data.providerId))
        .limit(1);
      
      if (!provider) {
        return NextResponse.json(
          { 
            success: false,
            error: "Provider not found" 
          },
          { status: 404 }
        );
      }
      
      // Check if provider is active and has completed Stripe onboarding
      if (!provider.isActive) {
        return NextResponse.json(
          { 
            success: false,
            error: "Provider is not currently accepting bookings" 
          },
          { status: 400 }
        );
      }
      
      if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
        return NextResponse.json(
          { 
            success: false,
            error: "Provider has not completed payment setup" 
          },
          { status: 400 }
        );
      }
      
      // Fetch service details
      const [service] = await db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          price: servicesTable.price,
          duration: servicesTable.duration,
          isActive: servicesTable.isActive,
        })
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.id, data.serviceId),
            eq(servicesTable.providerId, data.providerId)
          )
        )
        .limit(1);
      
      if (!service) {
        return NextResponse.json(
          { 
            success: false,
            error: "Service not found" 
          },
          { status: 404 }
        );
      }
      
      if (!service.isActive) {
        return NextResponse.json(
          { 
            success: false,
            error: "Service is not currently available" 
          },
          { status: 400 }
        );
      }
      
      // Calculate fees for authenticated customer (NO guest surcharge)
      const baseAmountCents = dollarsToCents(parseFloat(service.price));
      
      // Validate minimum transaction amount
      if (baseAmountCents < MIN_TRANSACTION_CENTS) {
        return NextResponse.json(
          { 
            success: false,
            error: `Minimum transaction amount is $${MIN_TRANSACTION_CENTS / 100}` 
          },
          { status: 400 }
        );
      }
      
      // Calculate all fees WITHOUT guest surcharge (isGuest: false)
      const fees = calculateFees({
        baseAmountCents,
        isGuest: false // Key difference: authenticated users don't pay guest surcharge
      });
      
      // Generate unique identifiers
      const confirmationCode = generateConfirmationCode();
      const bookingId = crypto.randomUUID();
      
      // Create Stripe payment intent with idempotency
      const paymentIntent = await createPaymentIntentWithIdempotency({
        amount: fees.customerTotalCents, // No guest surcharge for authenticated users
        currency: "usd",
        stripeConnectAccountId: provider.stripeConnectAccountId,
        platformFeeAmount: fees.platformFeeCents, // Only platform commission, no surcharge
        bookingId, // Used for idempotency
        metadata: {
          type: "customer_booking",
          bookingId,
          providerId: provider.id,
          serviceId: service.id,
          customerId: customer.id,
          customerEmail: customer.email,
          customerName: `${customer.firstName} ${customer.lastName}`,
          serviceName: service.name,
          isGuest: "false", // Key difference: this is not a guest booking
          confirmationCode,
          referrer: data.referrer || "direct",
          utmSource: data.utmSource || "",
          utmMedium: data.utmMedium || "",
          utmCampaign: data.utmCampaign || "",
        },
      });
      
      // Create booking record in database
      const [newBooking] = await db
        .insert(bookingsTable)
        .values({
          id: bookingId,
          providerId: provider.id,
          customerId: customer.id, // Actual customer ID, not hashed email
          serviceName: service.name,
          servicePrice: service.price,
          serviceDuration: service.duration,
          bookingDate: new Date(data.bookingDate),
          startTime: data.startTime,
          endTime: data.endTime,
          status: "pending",
          stripePaymentIntentId: paymentIntent.id,
          totalAmount: (fees.customerTotalCents / 100).toFixed(2), // No guest surcharge
          platformFee: (fees.platformFeeCents / 100).toFixed(2), // Only commission
          providerPayout: (fees.providerPayoutCents / 100).toFixed(2),
          customerNotes: data.customerNotes,
          confirmationCode,
          isGuestBooking: false, // Key difference: this is not a guest booking
          guestEmail: null, // No guest email for authenticated bookings
          bookingType: "service",
          serviceId: service.id,
          metadata: {
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerEmail: customer.email,
            referrer: data.referrer,
            utmSource: data.utmSource,
            utmMedium: data.utmMedium,
            utmCampaign: data.utmCampaign,
          },
        })
        .returning();
      
      // Create initial transaction record
      await db.insert(transactionsTable).values({
        bookingId: newBooking.id,
        stripeChargeId: paymentIntent.id,
        amount: (fees.customerTotalCents / 100).toFixed(2),
        platformFee: (fees.platformFeeCents / 100).toFixed(2), // Only commission
        providerPayout: (fees.providerPayoutCents / 100).toFixed(2),
        status: "pending",
      });
      
      // Log customer checkout for analytics (NO SENSITIVE DATA)
      const logger = logApiStart("/api/checkout/customer", "POST", customer.id);
      logApiSuccess(logger, "Customer checkout initiated", {
        bookingId: newBooking.id,
        providerId: provider.id,
        serviceId: service.id
        // NOTE: Removed sensitive data like email and amounts
      });
      
      // Return success response with payment details
      return NextResponse.json(
        {
          success: true,
          clientSecret: paymentIntent.client_secret!,
          paymentIntentId: paymentIntent.id,
          bookingId: newBooking.id,
          confirmationCode,
          fees: {
            baseAmount: fees.displayAmounts.baseAmount,
            platformFee: fees.displayAmounts.platformFee,
            totalAmount: fees.displayAmounts.customerTotal, // Same as base for authenticated
            providerPayout: fees.displayAmounts.providerPayout,
          },
          customerInfo: {
            customerId: customer.id,
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerEmail: customer.email,
          },
        },
        { status: 200 }
      );
      
    } catch (error) {
      const logger = logApiStart("/api/checkout/customer", "POST");
      logApiError(logger, "Customer checkout failed", error as Error);
      
      // Check for specific error types
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { 
            success: false,
            error: "Invalid input data" 
          },
          { status: 400 }
        );
      }
      
      // Check for Stripe errors
      if (error && typeof error === 'object' && 'type' in error) {
        const stripeError = error as any;
        if (stripeError.type === 'StripeCardError') {
          return NextResponse.json(
            { 
              success: false,
              error: "Card was declined" 
            },
            { status: 400 }
          );
        }
        if (stripeError.type === 'StripeInvalidRequestError') {
          return NextResponse.json(
            { 
              success: false,
              error: "Invalid payment request" 
            },
            { status: 400 }
          );
        }
      }
      
      // Generic error response
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to process checkout. Please try again." 
        },
        { status: 500 }
      );
    }
  }
);

// OPTIONS request for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}