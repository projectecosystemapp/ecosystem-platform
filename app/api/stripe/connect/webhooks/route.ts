import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { transactionsTable } from "@/db/schema/bookings-schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const relevantEvents = new Set([
  "account.updated",
  "payment_intent.succeeded", 
  "payment_intent.payment_failed",
  "transfer.created",
  "transfer.updated",
  "payout.created",
  "payout.updated"
]);

export async function POST(req: NextRequest) {
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
    // Log detailed error server-side for debugging
    console.error(`Connect Webhook Error:`, {
      message: err.message,
      stack: err.stack,
      signature: sig ? 'present' : 'missing',
      webhookSecret: webhookSecret ? 'configured' : 'missing'
    });
    // Return generic error to prevent information leakage
    return new NextResponse("Invalid webhook request", { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case "account.updated":
          await handleAccountUpdated(event);
          break;

        case "payment_intent.succeeded":
          await handlePaymentSuccess(event);
          break;
          
        case "payment_intent.payment_failed":
          await handlePaymentFailed(event);
          break;

        case "transfer.created":
        case "transfer.updated":
          await handleTransferUpdate(event);
          break;

        case "payout.created":
        case "payout.updated":
          await handlePayoutUpdate(event);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      // Log detailed error for internal monitoring
      console.error("Connect webhook handler failed:", {
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return generic response to maintain security
      return new NextResponse("Webhook processing error", { status: 500 });
    }
  }

  return new NextResponse(JSON.stringify({ received: true }));
}

async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;
  
  try {
    // Check if account onboarding is complete
    const onboardingComplete = account.details_submitted && 
                              account.charges_enabled && 
                              account.payouts_enabled;

    // Update provider record
    await db
      .update(providersTable)
      .set({
        stripeOnboardingComplete: onboardingComplete,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.stripeConnectAccountId, account.id));

    console.log(`Updated provider onboarding status for account ${account.id}: ${onboardingComplete}`);
  } catch (error) {
    console.error(`Error updating account ${account.id}:`, error);
  }
}

async function handlePaymentSuccess(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  try {
    if (paymentIntent.metadata?.bookingId) {
      // Update booking status to confirmed
      await db
        .update(bookingsTable)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.stripePaymentIntentId, paymentIntent.id));

      // Create transaction record
      await db.insert(transactionsTable).values({
        bookingId: paymentIntent.metadata.bookingId,
        stripeChargeId: paymentIntent.latest_charge as string,
        amount: (paymentIntent.amount / 100).toString(),
        platformFee: ((paymentIntent.application_fee_amount || 0) / 100).toString(),
        providerPayout: ((paymentIntent.amount - (paymentIntent.application_fee_amount || 0)) / 100).toString(),
        status: "completed",
        processedAt: new Date(),
      });

      console.log(`Payment succeeded for booking ${paymentIntent.metadata.bookingId}`);
    }
  } catch (error) {
    console.error(`Error handling payment success for PI ${paymentIntent.id}:`, error);
  }
}

async function handlePaymentFailed(event: Stripe.Event) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  
  try {
    if (paymentIntent.metadata?.bookingId) {
      // Update booking status to failed
      await db
        .update(bookingsTable)
        .set({
          status: "pending", // Keep as pending so customer can retry
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.stripePaymentIntentId, paymentIntent.id));

      console.log(`Payment failed for booking ${paymentIntent.metadata.bookingId}`);
    }
  } catch (error) {
    console.error(`Error handling payment failure for PI ${paymentIntent.id}:`, error);
  }
}

async function handleTransferUpdate(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  
  try {
    if (transfer.metadata?.bookingId) {
      // Update transaction with transfer ID
      await db
        .update(transactionsTable)
        .set({
          stripeTransferId: transfer.id,
        })
        .where(eq(transactionsTable.bookingId, transfer.metadata.bookingId));

      console.log(`Transfer updated for booking ${transfer.metadata.bookingId}`);
    }
  } catch (error) {
    console.error(`Error handling transfer update for ${transfer.id}:`, error);
  }
}

async function handlePayoutUpdate(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout;
  
  console.log(`Payout ${event.type} for account ${payout.metadata?.providerId || 'unknown'}: ${payout.id}`);
}