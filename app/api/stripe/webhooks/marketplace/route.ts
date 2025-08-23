import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Stripe from "stripe";
import { withRateLimit } from "@/lib/rate-limit";

const relevantEvents = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "transfer.created",
  "transfer.failed",
  "application_fee.created",
  "application_fee.refunded",
]);

/**
 * POST /api/stripe/webhooks/marketplace
 * Handle Stripe marketplace webhook events
 * Rate limited: 100 requests per minute from Stripe IPs
 */
export const POST = withRateLimit('webhook', async (req: NextRequest) => {
  const body = await req.text();
  const sig = headers().get("Stripe-Signature") as string;
  const webhookSecret = process.env.STRIPE_MARKETPLACE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      throw new Error("Webhook secret or signature missing");
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event);
        break;

      case "transfer.created":
        await handleTransferCreated(event);
        break;

      // Note: Stripe doesn't have transfer.failed event - handle failures in transfer.updated
      case "transfer.updated":
        await handleTransferFailed(event);
        break;

      case "application_fee.created":
        await handleApplicationFeeCreated(event);
        break;

      case "application_fee.refunded":
        await handleApplicationFeeRefunded(event);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
});

async function handlePaymentIntentSucceeded(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  if (!paymentIntent.metadata?.bookingId) {
    console.log("No bookingId in payment intent metadata");
    return;
  }

  const bookingId = paymentIntent.metadata.bookingId;

  await db.transaction(async (tx) => {
    // Update booking status to confirmed
    const [booking] = await tx
      .update(bookingsTable)
      .set({
        status: "confirmed",
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Check if transaction record already exists
    const [existingTransaction] = await tx
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.bookingId, bookingId))
      .limit(1);

    const chargeId = paymentIntent.latest_charge as string;

    if (existingTransaction) {
      // Update existing transaction
      await tx
        .update(transactionsTable)
        .set({
          stripeChargeId: chargeId,
          status: "pending", // Pending until transfer to provider
          processedAt: new Date(),
        })
        .where(eq(transactionsTable.id, existingTransaction.id));
    } else {
      // Create new transaction record
      await tx.insert(transactionsTable).values({
        bookingId: booking.id,
        stripeChargeId: chargeId,
        amount: booking.totalAmount,
        platformFee: booking.platformFee,
        providerPayout: booking.providerPayout,
        status: "pending", // Pending until transfer to provider
        processedAt: new Date(),
      });
    }

    console.log(`Payment succeeded for booking ${bookingId}`);

    // TODO: Send confirmation emails/notifications
    await sendBookingConfirmation(booking);
  });
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  if (!paymentIntent.metadata?.bookingId) {
    return;
  }

  const bookingId = paymentIntent.metadata.bookingId;

  // Update booking status
  await db
    .update(bookingsTable)
    .set({
      status: "cancelled",
      cancellationReason: `Payment failed: ${paymentIntent.last_payment_error?.message}`,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, bookingId));

  console.log(`Payment failed for booking ${bookingId}`);
}

async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  
  if (!charge.metadata?.bookingId) {
    return;
  }

  const bookingId = charge.metadata.bookingId;
  const refundAmount = (charge.amount_refunded / 100).toFixed(2);

  await db.transaction(async (tx) => {
    // Update booking with refund info
    await tx
      .update(bookingsTable)
      .set({
        status: charge.refunded ? "refunded" : "confirmed",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    // Update transaction record
    await tx
      .update(transactionsTable)
      .set({
        stripeRefundId: charge.refunds?.data[0]?.id,
        status: charge.refunded ? "refunded" : "completed",
      })
      .where(eq(transactionsTable.bookingId, bookingId));
  });

  console.log(`Refund processed for booking ${bookingId}: $${refundAmount}`);
}

async function handleTransferCreated(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  
  if (!transfer.metadata?.bookingId) {
    return;
  }

  const bookingId = transfer.metadata.bookingId;

  // Update transaction record with transfer ID
  await db
    .update(transactionsTable)
    .set({
      stripeTransferId: transfer.id,
      status: "completed",
      processedAt: new Date(),
    })
    .where(eq(transactionsTable.bookingId, bookingId));

  console.log(`Transfer created for booking ${bookingId}: ${transfer.id}`);
}

async function handleTransferFailed(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  
  if (!transfer.metadata?.bookingId) {
    return;
  }

  const bookingId = transfer.metadata.bookingId;

  // Update transaction status
  await db
    .update(transactionsTable)
    .set({
      status: "failed",
    })
    .where(eq(transactionsTable.bookingId, bookingId));

  console.error(`Transfer failed for booking ${bookingId}`);
  
  // TODO: Alert admin about failed transfer
}

async function handleApplicationFeeCreated(event: Stripe.Event) {
  const applicationFee = event.data.object as Stripe.ApplicationFee;
  
  // Log platform fee collection
  console.log(`Platform fee collected: $${(applicationFee.amount / 100).toFixed(2)}`);
  
  // TODO: Record platform revenue for financial reporting
}

async function handleApplicationFeeRefunded(event: Stripe.Event) {
  const applicationFee = event.data.object as Stripe.ApplicationFee;
  
  // Log platform fee refund
  console.log(`Platform fee refunded: $${(applicationFee.amount / 100).toFixed(2)}`);
  
  // TODO: Update platform revenue records
}

// Helper function to send booking confirmation
async function sendBookingConfirmation(booking: any) {
  // TODO: Implement your notification system
  console.log("Sending booking confirmation for:", booking.id);
  
  // Example:
  // - Send email to customer with booking details
  // - Send email to provider about new booking
  // - Create in-app notifications
  // - Send SMS if enabled
}

// Endpoint to verify webhook configuration
export async function GET(req: NextRequest) {
  return NextResponse.json({
    configured: !!process.env.STRIPE_MARKETPLACE_WEBHOOK_SECRET,
    endpoint: "/api/stripe/webhooks/marketplace",
    events: Array.from(relevantEvents),
  });
}