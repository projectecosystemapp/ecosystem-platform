// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";
import { withRateLimit } from "@/lib/rate-limit";

// Platform fee configuration
const PLATFORM_FEE_PERCENT = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT) || 10; // 10% base fee
const GUEST_SURCHARGE_PERCENT = Number(process.env.NEXT_PUBLIC_GUEST_SURCHARGE_PERCENT) || 10; // Additional 10% for guests

// Validation schemas
const createPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive().int(), // Amount in cents
  currency: z.string().default("usd"),
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  isGuestCheckout: z.boolean().default(false),
  customerEmail: z.string().email().optional(),
  idempotencyKey: z.string().optional(),
});

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string(),
  bookingId: z.string().uuid(),
});

const refundPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive().int().optional(), // Optional for partial refunds
  reason: z.string().optional(),
  reverseTransfer: z.boolean().default(true),
  idempotencyKey: z.string().optional(),
});

/**
 * Calculate platform fees and provider payout
 */
function calculateFees(serviceAmount: number, isGuest: boolean) {
  // Base platform fee (10% of service amount)
  const basePlatformFee = Math.round(serviceAmount * (PLATFORM_FEE_PERCENT / 100));
  
  // Guest surcharge (additional 10% of service amount)
  const guestSurcharge = isGuest ? Math.round(serviceAmount * (GUEST_SURCHARGE_PERCENT / 100)) : 0;
  
  // Total platform fee
  const totalPlatformFee = basePlatformFee + guestSurcharge;
  
  // Provider always receives service amount minus base platform fee
  const providerPayout = serviceAmount - basePlatformFee;
  
  // Total amount customer pays
  const totalAmount = serviceAmount + guestSurcharge;
  
  return {
    serviceAmount,
    basePlatformFee,
    guestSurcharge,
    totalPlatformFee,
    providerPayout,
    totalAmount,
  };
}

/**
 * POST /api/stripe/payment
 * Create a payment intent with platform fees
 * Rate limited: 5 requests per minute per IP/user
 */
export const POST = withRateLimit('payment', async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { 
      bookingId, 
      amount, 
      currency, 
      description, 
      metadata = {}, 
      isGuestCheckout,
      customerEmail,
      idempotencyKey,
    } = createPaymentSchema.parse(body);

    // Get booking details
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Verify ownership if not guest
    if (!isGuestCheckout && userId && booking.customerId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this booking" },
        { status: 403 }
      );
    }

    // Get provider details
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Check if provider has completed Stripe onboarding
    if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Provider has not completed payment setup" },
        { status: 400 }
      );
    }

    // Calculate fees
    const fees = calculateFees(amount, isGuestCheckout);

    // Create payment intent with application fee
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: fees.totalAmount,
      currency,
      description: description || `Booking for ${booking.serviceName}`,
      metadata: {
        ...metadata,
        bookingId,
        providerId: provider.id,
        customerId: booking.customerId,
        isGuestCheckout: String(isGuestCheckout),
        serviceAmount: String(fees.serviceAmount),
        platformFee: String(fees.totalPlatformFee),
        providerPayout: String(fees.providerPayout),
      },
      // Application fee goes to platform
      application_fee_amount: fees.totalPlatformFee,
      // Transfer remaining amount to connected account
      transfer_data: {
        destination: provider.stripeConnectAccountId,
      },
      // Capture method
      capture_method: "automatic",
      // Statement descriptor
      statement_descriptor_suffix: "ECOSYSTEM",
    };

    // Add customer email for guests
    if (isGuestCheckout && customerEmail) {
      paymentIntentParams.receipt_email = customerEmail;
    }

    // Add idempotency key if provided
    const requestOptions: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    // Create the payment intent
    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      requestOptions
    );

    // Create transaction record
    await db.insert(transactionsTable).values({
      bookingId,
      stripeChargeId: paymentIntent.id,
      amount: fees.totalAmount.toString(),
      platformFee: fees.totalPlatformFee.toString(),
      providerPayout: fees.providerPayout.toString(),
      status: "pending",
    });

    // Update booking with payment intent ID and amounts
    await db
      .update(bookingsTable)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        totalAmount: String(fees.totalAmount),
        platformFee: String(fees.totalPlatformFee),
        providerPayout: String(fees.providerPayout),
        isGuestBooking: isGuestCheckout,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      fees: {
        serviceAmount: fees.serviceAmount,
        platformFee: fees.totalPlatformFee,
        guestSurcharge: fees.guestSurcharge,
        providerPayout: fees.providerPayout,
        totalAmount: fees.totalAmount,
      },
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/stripe/payment
 * Confirm a payment and update booking status
 * Rate limited: 10 requests per minute per IP/user
 */
export const PUT = withRateLimit('booking', async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { paymentIntentId, bookingId } = confirmPaymentSchema.parse(body);

    // Get booking
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Verify payment intent matches
    if (booking.stripePaymentIntentId !== paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent mismatch" },
        { status: 400 }
      );
    }

    // Get payment intent status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Update transaction status
    await db
      .update(transactionsTable)
      .set({
        status: paymentIntent.status === "succeeded" ? "completed" : "pending",
        processedAt: paymentIntent.status === "succeeded" ? new Date() : null,
      })
      .where(eq(transactionsTable.stripeChargeId, paymentIntentId));

    // Update booking status if payment succeeded
    if (paymentIntent.status === "succeeded") {
      await db
        .update(bookingsTable)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, bookingId));
    }

    // Get the charge details for transfer information
    let transferId: string | null = null;
    if (paymentIntent.latest_charge) {
      const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string, {
        expand: ["transfer"],
      });
      transferId = charge.transfer ? (charge.transfer as Stripe.Transfer).id : null;
    }

    return NextResponse.json({
      success: true,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      transferId,
      confirmedAt: paymentIntent.status === "succeeded" 
        ? new Date(paymentIntent.created * 1000).toISOString() 
        : null,
    });
  } catch (error) {
    console.error("Error confirming payment:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/stripe/payment
 * Refund a payment
 * Rate limited: 5 requests per minute per IP/user
 */
export const DELETE = withRateLimit('payment', async (request: NextRequest) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      bookingId, 
      amount, 
      reason, 
      reverseTransfer,
      idempotencyKey,
    } = refundPaymentSchema.parse(body);

    // Get booking
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (!booking.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "No payment found for this booking" },
        { status: 400 }
      );
    }

    // Get the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(
      booking.stripePaymentIntentId
    );

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment has not been completed" },
        { status: 400 }
      );
    }

    // Create refund params
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: booking.stripePaymentIntentId,
      reason: reason as Stripe.RefundCreateParams.Reason || "requested_by_customer",
      metadata: {
        bookingId,
        refundedBy: userId,
        refundedAt: new Date().toISOString(),
      },
    };

    // Add amount if partial refund
    if (amount) {
      refundParams.amount = amount;
    }

    // Handle transfer reversal
    if (reverseTransfer) {
      refundParams.reverse_transfer = true;
    }

    // Add idempotency key if provided
    const requestOptions: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    // Create the refund
    const refund = await stripe.refunds.create(refundParams, requestOptions);

    // Update transaction record
    await db
      .update(transactionsTable)
      .set({
        stripeRefundId: refund.id,
        status: "refunded",
      })
      .where(eq(transactionsTable.bookingId, bookingId));

    // Update booking status
    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancellationReason: reason || "Customer requested refund",
        cancelledBy: userId,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason,
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
});