// @ts-nocheck
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { processWebhookWithIdempotency } from "@/lib/webhook-idempotency";
import { logApiStart, logApiSuccess, logApiError, logger } from "@/lib/logger";
import { sendBookingConfirmation, sendProviderBookingNotification, sendCancellationNotification } from "@/lib/twilio/sms-service";
import { emailService } from "@/lib/services/email-service";

const relevantEvents = new Set([
  // Booking-related events
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.dispute.created",
  "transfer.created",
  "transfer.paid",
  "transfer.failed"
]);

/**
 * POST /api/stripe/webhooks
 * Handle Stripe webhook events
 * Note: Rate limiting should be applied at middleware level for webhooks
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = headers().get("Stripe-Signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      // Log to security monitoring as per SECURITY-AUDIT.md
      logger.error('Webhook signature validation failed - potential attack', {
        endpoint: '/api/stripe/webhooks',
        reason: 'missing_signature_or_secret'
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    logger.error('Webhook signature verification failed', {
      endpoint: '/api/stripe/webhooks',
      reason: 'invalid_signature'
    }, err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Skip non-relevant events early
  if (!relevantEvents.has(event.type)) {
    logger.debug('Skipping non-relevant webhook event', {
      endpoint: '/api/stripe/webhooks',
      eventType: event.type
    });
    return NextResponse.json({ received: true });
  }

  // Process the webhook with idempotency guarantees
  const result = await processWebhookWithIdempotency(event, async (event, tx) => {
    switch (event.type) {
      // Booking payment events
      case "payment_intent.succeeded":
        await handleBookingPaymentSuccess(event, tx);
        break;

      case "payment_intent.payment_failed":
        await handleBookingPaymentFailure(event, tx);
        break;

      case "payment_intent.canceled":
        await handleBookingPaymentCancellation(event, tx);
        break;

      case "charge.dispute.created":
        await handleBookingChargeDispute(event, tx);
        break;

      case "transfer.created":
        await handleBookingTransferCreated(event, tx);
        break;

      case "transfer.paid":
        await handleBookingTransferPaid(event, tx);
        break;

      case "transfer.failed":
        await handleBookingTransferFailed(event, tx);
        break;

      default:
        console.warn(`Unhandled event type: ${event.type}`);
    }
  });

  if (!result.success) {
    console.error(`Webhook ${event.id} processing failed:`, result.error);
    // Return 200 to acknowledge receipt even on failure
    // This prevents Stripe from retrying immediately
    // Our system will handle retries based on the stored failed events
    return NextResponse.json({ 
      received: true, 
      warning: "Event received but processing failed. Will retry." 
    });
  }

  return NextResponse.json({ received: true });
}

// Booking-related webhook handlers

/**
 * Handle successful booking payment confirmation
 */
async function handleBookingPaymentSuccess(event: Stripe.Event, tx?: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
    // This payment intent is not for a booking, skip
    return;
  }

  const database = tx || db;
  
  try {
    logApiStart(`stripe.webhooks.payment_intent.succeeded`, { bookingId });

    // Update booking status
    const [booking] = await database
      .update(bookingsTable)
      .set({
        status: 'PAYMENT_SUCCEEDED',
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    if (!booking) {
      logger.error('Booking not found for successful payment', { bookingId, paymentIntentId: paymentIntent.id });
      return;
    }

    // Create transaction record
    await database.insert(transactionsTable).values({
      bookingId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'succeeded',
      metadata: paymentIntent.metadata || {},
      createdAt: new Date(),
    });

    // Get provider for notifications
    const [provider] = await database
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId))
      .limit(1);

    // Send confirmation notifications
    if (booking.customerPhone) {
      await sendBookingConfirmation({
        to: booking.customerPhone,
        customerName: booking.customerName,
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        amount: (paymentIntent.amount / 100).toFixed(2),
      });
    }

    if (booking.customerEmail) {
      await emailService.sendBookingConfirmation({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        providerName: provider?.businessName || 'Provider',
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        totalAmount: paymentIntent.amount / 100,
        bookingId: booking.id,
        providerEmail: provider?.email,
        location: booking.location,
      });
    }

    // Send payment receipt
    if (booking.customerEmail) {
      await emailService.sendPaymentReceipt({
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        amount: paymentIntent.amount / 100,
        serviceName: booking.serviceName,
        providerName: provider?.businessName || 'Provider',
        paymentDate: new Date(),
        paymentIntentId: paymentIntent.id,
        bookingId: booking.id,
      });
    }

    // Notify provider
    if (provider?.phone) {
      await sendProviderBookingNotification({
        to: provider.phone,
        customerName: booking.customerName,
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        amount: ((paymentIntent.amount * 0.9) / 100).toFixed(2), // Provider gets 90%
      });
    }

    if (provider?.email) {
      await emailService.sendProviderBookingNotification({
        providerName: provider.businessName || 'Provider',
        providerEmail: provider.email,
        customerName: booking.customerName,
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        bookingId: booking.id,
        customerEmail: booking.customerEmail,
        customerNotes: booking.customerNotes,
      });
    }

    logApiSuccess(`stripe.webhooks.payment_intent.succeeded`, { bookingId });
  } catch (error) {
    logApiError(`stripe.webhooks.payment_intent.succeeded`, error, { bookingId });
    throw error;
  }
}

/**
 * Handle failed booking payment
 */
async function handleBookingPaymentFailure(event: Stripe.Event, tx?: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
    return;
  }

  const database = tx || db;

  try {
    logApiStart(`stripe.webhooks.payment_intent.failed`, { bookingId });

    // Update booking status
    await database
      .update(bookingsTable)
      .set({
        status: 'PAYMENT_FAILED',
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    // Create transaction record
    await database.insert(transactionsTable).values({
      bookingId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      failureReason: paymentIntent.last_payment_error?.message || 'Unknown error',
      metadata: paymentIntent.metadata || {},
      createdAt: new Date(),
    });

    logApiSuccess(`stripe.webhooks.payment_intent.failed`, { bookingId });
  } catch (error) {
    logApiError(`stripe.webhooks.payment_intent.failed`, error, { bookingId });
    throw error;
  }
}

/**
 * Handle canceled booking payment
 */
async function handleBookingPaymentCancellation(event: Stripe.Event, tx?: any) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
    return;
  }

  const database = tx || db;

  try {
    logApiStart(`stripe.webhooks.payment_intent.canceled`, { bookingId });

    // Update booking status
    const [booking] = await database
      .update(bookingsTable)
      .set({
        status: 'CANCELLED',
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    // Create transaction record
    await database.insert(transactionsTable).values({
      bookingId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'canceled',
      metadata: paymentIntent.metadata || {},
      createdAt: new Date(),
    });

    // Send cancellation notifications
    if (booking?.customerPhone) {
      await sendCancellationNotification({
        to: booking.customerPhone,
        customerName: booking.customerName,
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
      });
    }

    if (booking?.customerEmail && provider?.businessName) {
      await emailService.sendBookingCancellation(
        booking.customerEmail,
        booking.customerName,
        provider.businessName,
        booking.serviceName,
        booking.bookingDate
      );
    }

    logApiSuccess(`stripe.webhooks.payment_intent.canceled`, { bookingId });
  } catch (error) {
    logApiError(`stripe.webhooks.payment_intent.canceled`, error, { bookingId });
    throw error;
  }
}

/**
 * Handle charge dispute for a booking
 */
async function handleBookingChargeDispute(event: Stripe.Event, tx?: any) {
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId = dispute.payment_intent as string;

  if (!paymentIntentId) {
    return;
  }

  const database = tx || db;

  try {
    logApiStart(`stripe.webhooks.charge.dispute.created`, { paymentIntentId });

    // Find the booking associated with this payment intent
    const [booking] = await database
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.paymentIntentId, paymentIntentId))
      .limit(1);

    if (booking) {
      // Mark the booking as disputed
      await database
        .update(bookingsTable)
        .set({
          status: 'DISPUTED',
          notes: `Dispute created: ${dispute.reason || 'No reason provided'}`,
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, booking.id));

      logger.warn('Charge dispute created for booking', {
        bookingId: booking.id,
        disputeId: dispute.id,
        reason: dispute.reason,
        amount: dispute.amount,
      });
    }

    logApiSuccess(`stripe.webhooks.charge.dispute.created`, { paymentIntentId });
  } catch (error) {
    logApiError(`stripe.webhooks.charge.dispute.created`, error, { paymentIntentId });
    throw error;
  }
}

/**
 * Handle transfer creation (payout to provider)
 */
async function handleBookingTransferCreated(event: Stripe.Event, tx?: any) {
  const transfer = event.data.object as Stripe.Transfer;
  const bookingId = transfer.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  const database = tx || db;

  try {
    logApiStart(`stripe.webhooks.transfer.created`, { bookingId, transferId: transfer.id });

    // Record the transfer creation
    await database.insert(transactionsTable).values({
      bookingId,
      stripeTransferId: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency,
      status: 'pending',
      type: 'transfer',
      metadata: transfer.metadata || {},
      createdAt: new Date(),
    });

    logApiSuccess(`stripe.webhooks.transfer.created`, { bookingId, transferId: transfer.id });
  } catch (error) {
    logApiError(`stripe.webhooks.transfer.created`, error, { bookingId, transferId: transfer.id });
    throw error;
  }
}

/**
 * Handle successful transfer (provider payout completed)
 */
async function handleBookingTransferPaid(event: Stripe.Event, tx?: any) {
  const transfer = event.data.object as Stripe.Transfer;
  const bookingId = transfer.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  const database = tx || db;

  try {
    logApiStart(`stripe.webhooks.transfer.paid`, { bookingId, transferId: transfer.id });

    // Update the transfer status
    await database
      .update(transactionsTable)
      .set({
        status: 'succeeded',
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.stripeTransferId, transfer.id));

    // Mark booking as completed if payment was successful
    await database
      .update(bookingsTable)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    logApiSuccess(`stripe.webhooks.transfer.paid`, { bookingId, transferId: transfer.id });
  } catch (error) {
    logApiError(`stripe.webhooks.transfer.paid`, error, { bookingId, transferId: transfer.id });
    throw error;
  }
}

/**
 * Handle failed transfer
 */
async function handleBookingTransferFailed(event: Stripe.Event, tx?: any) {
  const transfer = event.data.object as Stripe.Transfer;
  const bookingId = transfer.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  const database = tx || db;

  try {
    logApiStart(`stripe.webhooks.transfer.failed`, { bookingId, transferId: transfer.id });

    // Update the transfer status
    await database
      .update(transactionsTable)
      .set({
        status: 'failed',
        failureReason: 'Transfer to provider failed',
        updatedAt: new Date(),
      })
      .where(eq(transactionsTable.stripeTransferId, transfer.id));

    // Log the failure for manual review
    logger.error('Transfer to provider failed', {
      bookingId,
      transferId: transfer.id,
      destination: transfer.destination,
      amount: transfer.amount,
    });

    logApiSuccess(`stripe.webhooks.transfer.failed`, { bookingId, transferId: transfer.id });
  } catch (error) {
    logApiError(`stripe.webhooks.transfer.failed`, error, { bookingId, transferId: transfer.id });
    throw error;
  }
}