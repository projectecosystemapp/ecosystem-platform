import { manageSubscriptionStatusChange, updateStripeCustomer } from "@/actions/stripe-actions";
import { stripe } from "@/lib/stripe";
import { headers } from "next/headers";
import Stripe from "stripe";
import { updateProfile, updateProfileByStripeCustomerId } from "@/db/queries/profiles-queries";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

const relevantEvents = new Set([
  "checkout.session.completed", 
  "customer.subscription.updated", 
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  // Booking-related events
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.dispute.created",
  "transfer.created",
  "transfer.paid",
  "transfer.failed"
]);

// Default usage credits for Pro plan
const DEFAULT_USAGE_CREDITS = 250;

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get("Stripe-Signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret) {
      throw new Error("Webhook secret or signature missing");
    }

    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await handleSubscriptionChange(event);
          break;

        case "checkout.session.completed":
          await handleCheckoutSession(event);
          break;
          
        case "invoice.payment_succeeded":
          await handlePaymentSuccess(event);
          break;
          
        case "invoice.payment_failed":
          await handlePaymentFailed(event);
          break;

        // Booking payment events
        case "payment_intent.succeeded":
          await handleBookingPaymentSuccess(event);
          break;

        case "payment_intent.payment_failed":
          await handleBookingPaymentFailure(event);
          break;

        case "payment_intent.canceled":
          await handleBookingPaymentCancellation(event);
          break;

        case "charge.dispute.created":
          await handleBookingChargeDispute(event);
          break;

        case "transfer.created":
          await handleBookingTransferCreated(event);
          break;

        case "transfer.paid":
          await handleBookingTransferPaid(event);
          break;

        case "transfer.failed":
          await handleBookingTransferFailed(event);
          break;

        default:
          throw new Error("Unhandled relevant event!");
      }
    } catch (error) {
      console.error("Webhook handler failed:", error);
      return new Response("Webhook handler failed. View your nextjs function logs.", {
        status: 400
      });
    }
  }

  return new Response(JSON.stringify({ received: true }));
}

async function handleSubscriptionChange(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const productId = subscription.items.data[0].price.product as string;
  await manageSubscriptionStatusChange(subscription.id, subscription.customer as string, productId);
}

async function handleCheckoutSession(event: Stripe.Event) {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  if (checkoutSession.mode === "subscription") {
    const subscriptionId = checkoutSession.subscription as string;
    await updateStripeCustomer(checkoutSession.client_reference_id as string, subscriptionId, checkoutSession.customer as string);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["default_payment_method"]
    }) as any; // Type assertion needed due to Stripe SDK type mismatch

    const productId = subscription.items.data[0].price.product as string;
    await manageSubscriptionStatusChange(subscription.id, subscription.customer as string, productId);
    
    // Reset usage credits on new subscription
    if (checkoutSession.client_reference_id) {
      try {
        const billingCycleStart = new Date(subscription.current_period_start * 1000);
        const billingCycleEnd = new Date(subscription.current_period_end * 1000);
        
        await updateProfile(checkoutSession.client_reference_id, {
          usageCredits: DEFAULT_USAGE_CREDITS,
          usedCredits: 0,
          status: "active",
          billingCycleStart,
          billingCycleEnd
        });
        
        console.log(`Reset usage credits to ${DEFAULT_USAGE_CREDITS} for user ${checkoutSession.client_reference_id}`);
      } catch (error) {
        console.error(`Error updating usage credits: ${error}`);
      }
    }
  }
}

async function handlePaymentSuccess(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  
  const subscriptionId = (invoice as any).subscription as string | null;
  if (subscriptionId) {
    try {
      // Get the subscription to determine billing cycle dates
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any; // Type assertion needed due to Stripe SDK type mismatch
      
      const billingCycleStart = new Date(subscription.current_period_start * 1000);
      const billingCycleEnd = new Date(subscription.current_period_end * 1000);
      
      // Update profile directly by Stripe customer ID
      await updateProfileByStripeCustomerId(customerId, {
        usageCredits: DEFAULT_USAGE_CREDITS,
        usedCredits: 0,
        status: "active",
        billingCycleStart,
        billingCycleEnd
      });
      
      console.log(`Reset usage credits to ${DEFAULT_USAGE_CREDITS} for Stripe customer ${customerId}`);
    } catch (error) {
      console.error(`Error processing payment success: ${error}`);
    }
  }
}

async function handlePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;
  
  try {
    // Update profile directly by Stripe customer ID
    const updatedProfile = await updateProfileByStripeCustomerId(customerId, {
      status: "payment_failed"
    });
    
    if (updatedProfile) {
      console.log(`Marked payment as failed for user ${updatedProfile.userId}`);
    } else {
      console.error(`No profile found for Stripe customer: ${customerId}`);
    }
  } catch (error) {
    console.error(`Error processing payment failure: ${error}`);
  }
}

// Booking-related webhook handlers

/**
 * Handle successful booking payment confirmation
 */
async function handleBookingPaymentSuccess(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
    // This payment intent is not for a booking, skip
    return;
  }

  try {
    // Update booking status to confirmed
    const [updatedBooking] = await db
      .update(bookingsTable)
      .set({
        status: "confirmed",
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, bookingId))
      .returning();

    if (!updatedBooking) {
      console.error(`Booking not found: ${bookingId}`);
      return;
    }

    // Update transaction status
    await db
      .update(transactionsTable)
      .set({
        status: "completed",
        stripeChargeId: paymentIntent.latest_charge as string,
        processedAt: new Date()
      })
      .where(eq(transactionsTable.bookingId, bookingId));

    console.log(`Booking payment confirmed: ${bookingId}`);

    // TODO: Send confirmation email to customer and provider
    // TODO: Create calendar events
    // TODO: Send push notifications

  } catch (error) {
    console.error(`Error handling booking payment success for ${bookingId}:`, error);
  }
}

/**
 * Handle booking payment failure
 */
async function handleBookingPaymentFailure(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
    return;
  }

  try {
    // Update booking status to cancelled due to payment failure
    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancellationReason: "payment_failed",
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, bookingId));

    // Update transaction status
    await db
      .update(transactionsTable)
      .set({
        status: "failed",
        processedAt: new Date()
      })
      .where(eq(transactionsTable.bookingId, bookingId));

    console.log(`Booking payment failed: ${bookingId}`);

    // TODO: Send payment failure notification to customer
    // TODO: Release time slot for rebooking

  } catch (error) {
    console.error(`Error handling booking payment failure for ${bookingId}:`, error);
  }
}

/**
 * Handle booking payment cancellation
 */
async function handleBookingPaymentCancellation(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const bookingId = paymentIntent.metadata?.bookingId;

  if (!bookingId || paymentIntent.metadata?.type !== "booking_payment") {
    return;
  }

  try {
    // Update booking status to cancelled
    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancellationReason: "payment_cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, bookingId));

    // Update transaction status
    await db
      .update(transactionsTable)
      .set({
        status: "failed",
        processedAt: new Date()
      })
      .where(eq(transactionsTable.bookingId, bookingId));

    console.log(`Booking payment cancelled: ${bookingId}`);

  } catch (error) {
    console.error(`Error handling booking payment cancellation for ${bookingId}:`, error);
  }
}

/**
 * Handle charge dispute (chargeback)
 */
async function handleBookingChargeDispute(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = dispute.charge as string;

  try {
    // Find the booking associated with this charge
    const transaction = await db
      .select({
        bookingId: transactionsTable.bookingId
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.stripeChargeId, chargeId))
      .limit(1);

    if (transaction.length === 0) {
      console.error(`No transaction found for charge ${chargeId}`);
      return;
    }

    const bookingId = transaction[0].bookingId;

    // Update booking with dispute information
    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancellationReason: "disputed",
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(bookingsTable.id, bookingId));

    console.log(`Dispute created for booking ${bookingId}`);

    // TODO: Notify provider about dispute
    // TODO: Freeze provider payouts if needed
    // TODO: Escalate to support team

  } catch (error) {
    console.error(`Error handling charge dispute for charge ${chargeId}:`, error);
  }
}

/**
 * Handle transfer creation (payout to provider)
 */
async function handleBookingTransferCreated(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  const bookingId = transfer.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  try {
    // Update transaction with transfer ID
    await db
      .update(transactionsTable)
      .set({
        stripeTransferId: transfer.id
      })
      .where(eq(transactionsTable.bookingId, bookingId));

    console.log(`Transfer created for booking ${bookingId}: ${transfer.id}`);

  } catch (error) {
    console.error(`Error handling transfer creation for booking ${bookingId}:`, error);
  }
}

/**
 * Handle successful transfer (payout completed)
 */
async function handleBookingTransferPaid(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  const bookingId = transfer.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  try {
    // Update transaction status
    await db
      .update(transactionsTable)
      .set({
        status: "completed",
        processedAt: new Date()
      })
      .where(eq(transactionsTable.stripeTransferId, transfer.id));

    console.log(`Transfer paid for booking ${bookingId}: ${transfer.id}`);

    // TODO: Notify provider about successful payout

  } catch (error) {
    console.error(`Error handling transfer payment for booking ${bookingId}:`, error);
  }
}

/**
 * Handle failed transfer (payout failed)
 */
async function handleBookingTransferFailed(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  const bookingId = transfer.metadata?.bookingId;

  if (!bookingId) {
    return;
  }

  try {
    // Update transaction status
    await db
      .update(transactionsTable)
      .set({
        status: "failed",
        processedAt: new Date()
      })
      .where(eq(transactionsTable.stripeTransferId, transfer.id));

    console.log(`Transfer failed for booking ${bookingId}: ${transfer.id}`);

    // TODO: Notify provider about failed payout
    // TODO: Retry transfer or escalate to support

  } catch (error) {
    console.error(`Error handling transfer failure for booking ${bookingId}:`, error);
  }
}
