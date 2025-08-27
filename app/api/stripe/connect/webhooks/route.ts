// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { transactionsTable } from "@/db/schema/bookings-schema";
import { eq, and, sql } from "drizzle-orm";
import { sendNotification } from "@/lib/notifications";
import { 
  logWebhookEventToDB, 
  isEventProcessed, 
  logDispute, 
  updateDisputeStatus,
  logPayout 
} from "@/lib/webhook-audit";
import Stripe from "stripe";

// Enhanced event set with all critical payment events
const relevantEvents = new Set([
  // Account events
  "account.updated",
  
  // Payment events
  "payment_intent.succeeded", 
  "payment_intent.payment_failed",
  
  // Charge events
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  
  // Transfer events
  "transfer.created",
  "transfer.updated",
  "transfer.reversed",
  
  // Payout events
  "payout.created",
  "payout.updated",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  
  // Application fee events
  "application_fee.refunded"
]);

// Helper function to log webhook events for audit trail
async function logWebhookEvent(
  eventId: string, 
  eventType: string, 
  status: 'received' | 'processing' | 'completed' | 'failed',
  error?: string,
  payload?: any
) {
  // Log to console for immediate visibility
  console.log('[WEBHOOK_AUDIT]', JSON.stringify({
    eventId,
    eventType,
    status,
    timestamp: new Date(),
    error
  }));
  
  // Log to database for persistence
  await logWebhookEventToDB({
    eventId,
    eventType,
    status,
    payload,
    errorMessage: error
  });
}


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

  // Check for duplicate event processing (idempotency)
  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    console.log(`[WEBHOOK] Duplicate event ${event.id} already processed`);
    return new NextResponse(JSON.stringify({ received: true, duplicate: true }));
  }

  // Log event received
  await logWebhookEvent(event.id, event.type, 'received', undefined, event.data.object);

  if (relevantEvents.has(event.type)) {
    try {
      // Log event processing
      await logWebhookEvent(event.id, event.type, 'processing');
      
      switch (event.type) {
        // Account events
        case "account.updated":
          await handleAccountUpdated(event);
          break;

        // Payment events
        case "payment_intent.succeeded":
          await handlePaymentSuccess(event);
          break;
          
        case "payment_intent.payment_failed":
          await handlePaymentFailed(event);
          break;

        // Charge events
        case "charge.refunded":
          await handleChargeRefunded(event);
          break;
          
        case "charge.dispute.created":
          await handleDisputeCreated(event);
          break;
          
        case "charge.dispute.funds_withdrawn":
          await handleDisputeFundsWithdrawn(event);
          break;
          
        case "charge.dispute.funds_reinstated":
          await handleDisputeFundsReinstated(event);
          break;

        // Transfer events
        case "transfer.created":
        case "transfer.updated":
          await handleTransferUpdate(event);
          break;
          
        case "transfer.reversed":
          await handleTransferReversed(event);
          break;

        // Payout events
        case "payout.created":
        case "payout.updated":
          await handlePayoutUpdate(event);
          break;
          
        case "payout.paid":
          await handlePayoutPaid(event);
          break;
          
        case "payout.failed":
          await handlePayoutFailed(event);
          break;
          
        case "payout.canceled":
          await handlePayoutCanceled(event);
          break;

        // Application fee events
        case "application_fee.refunded":
          await handleApplicationFeeRefunded(event);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      // Log successful completion
      await logWebhookEvent(event.id, event.type, 'completed');
    } catch (error) {
      // Log detailed error for internal monitoring
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Connect webhook handler failed:", {
        eventType: event.type,
        eventId: event.id,
        error: errorMessage
      });
      
      // Log event failure
      await logWebhookEvent(event.id, event.type, 'failed', errorMessage);
      
      // Implement retry logic for critical events
      if (shouldRetryEvent(event.type)) {
        // Return 500 to trigger Stripe's retry mechanism
        return new NextResponse("Webhook processing error - will retry", { status: 500 });
      }
      
      // For non-critical events, acknowledge receipt but log the error
      return new NextResponse(JSON.stringify({ received: true, error: true }));
    }
  }

  return new NextResponse(JSON.stringify({ received: true }));
}

// Determine if an event should be retried on failure
function shouldRetryEvent(eventType: string): boolean {
  const criticalEvents = [
    "payment_intent.succeeded",
    "charge.refunded",
    "payout.failed",
    "charge.dispute.created"
  ];
  return criticalEvents.includes(eventType);
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

      // Check if transaction exists
      const existingTx = await db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.bookingId, paymentIntent.metadata.bookingId))
        .limit(1);

      if (existingTx.length > 0) {
        // Update existing transaction
        await db
          .update(transactionsTable)
          .set({
            status: "failed",
            processedAt: new Date(),
          })
          .where(eq(transactionsTable.bookingId, paymentIntent.metadata.bookingId));
      } else {
        // Create new transaction record with failure
        await db.insert(transactionsTable).values({
          bookingId: paymentIntent.metadata.bookingId,
          stripeChargeId: paymentIntent.latest_charge as string || null,
          amount: (paymentIntent.amount / 100).toString(),
          platformFee: ((paymentIntent.application_fee_amount || 0) / 100).toString(),
          providerPayout: "0",
          status: "failed",
          processedAt: new Date(),
        });
      }

      // Send notification to customer and provider
      await sendNotification('payment_failed', {
        bookingId: paymentIntent.metadata.bookingId,
        amount: paymentIntent.amount / 100,
        error: paymentIntent.last_payment_error?.message,
        customerEmail: paymentIntent.receipt_email,
      });

      console.log(`Payment failed for booking ${paymentIntent.metadata.bookingId}`);
    }
  } catch (error) {
    console.error(`Error handling payment failure for PI ${paymentIntent.id}:`, error);
    throw error; // Re-throw to trigger retry
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

// Handler for charge.refunded
async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;
  
  try {
    // Find the transaction by charge ID
    const transaction = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.stripeChargeId, charge.id))
      .limit(1);

    if (transaction.length > 0) {
      const tx = transaction[0];
      
      // Update transaction status to refunded
      await db
        .update(transactionsTable)
        .set({
          status: "refunded",
          stripeRefundId: charge.refunds?.data[0]?.id || null,
        })
        .where(eq(transactionsTable.id, tx.id));

      // Update booking status to cancelled
      await db
        .update(bookingsTable)
        .set({
          status: "cancelled",
          cancellationReason: "Payment refunded",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookingsTable.id, tx.bookingId));

      // Send refund notification
      await sendNotification('refund_processed', {
        bookingId: tx.bookingId,
        refundAmount: charge.amount_refunded / 100,
        customerEmail: charge.receipt_email,
      });

      console.log(`Refund processed for charge ${charge.id}, booking ${tx.bookingId}`);
    }
  } catch (error) {
    console.error(`Error handling refund for charge ${charge.id}:`, error);
    throw error;
  }
}

// Handler for charge.dispute.created
async function handleDisputeCreated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  
  try {
    // Find the transaction by charge ID
    const transaction = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.stripeChargeId, dispute.charge as string))
      .limit(1);

    if (transaction.length > 0) {
      const tx = transaction[0];
      
      // Get booking and provider details
      const booking = await db
        .select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, tx.bookingId))
        .limit(1);

      if (booking.length > 0) {
        // Log dispute to database
        await logDispute({
          bookingId: tx.bookingId,
          transactionId: tx.id,
          stripeDisputeId: dispute.id,
          stripeChargeId: dispute.charge as string,
          amount: dispute.amount / 100,
          reason: dispute.reason,
          status: dispute.status,
          evidenceDueBy: dispute.evidence_details?.due_by 
            ? new Date(dispute.evidence_details.due_by * 1000) 
            : undefined,
        });

        // Send urgent notification about chargeback
        await sendNotification('chargeback_alert', {
          bookingId: tx.bookingId,
          disputeId: dispute.id,
          amount: dispute.amount / 100,
          reason: dispute.reason,
          providerId: booking[0].providerId,
          dueBy: dispute.evidence_details?.due_by 
            ? new Date(dispute.evidence_details.due_by * 1000)
            : new Date(),
        });

        // Log the dispute in the booking notes
        await db
          .update(bookingsTable)
          .set({
            providerNotes: sql`COALESCE(provider_notes, '') || '\n[DISPUTE] Chargeback initiated: ' || ${dispute.reason}`,
            updatedAt: new Date(),
          })
          .where(eq(bookingsTable.id, tx.bookingId));
      }

      console.log(`Dispute created for charge ${dispute.charge}, amount: ${dispute.amount / 100}`);
    }
  } catch (error) {
    console.error(`Error handling dispute for ${dispute.id}:`, error);
    throw error;
  }
}

// Handler for charge.dispute.funds_withdrawn
async function handleDisputeFundsWithdrawn(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  
  try {
    // Update dispute status in database
    await updateDisputeStatus(
      dispute.id,
      'funds_withdrawn',
      undefined,
      true, // fundsWithdrawn
      false // fundsReinstated
    );
    
    console.log(`Dispute funds withdrawn: ${dispute.id}, amount: ${dispute.amount / 100}`);
    
    await sendNotification('dispute_funds_withdrawn', {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      charge: dispute.charge,
    });
  } catch (error) {
    console.error(`Error handling dispute funds withdrawal:`, error);
  }
}

// Handler for charge.dispute.funds_reinstated
async function handleDisputeFundsReinstated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  
  try {
    // Update dispute status in database
    await updateDisputeStatus(
      dispute.id,
      'won',
      'won', // outcome
      false, // fundsWithdrawn
      true // fundsReinstated
    );
    
    console.log(`Dispute funds reinstated: ${dispute.id}, amount: ${dispute.amount / 100}`);
    
    await sendNotification('dispute_resolved', {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      charge: dispute.charge,
      status: 'won',
    });
  } catch (error) {
    console.error(`Error handling dispute funds reinstatement:`, error);
  }
}

// Handler for transfer.reversed
async function handleTransferReversed(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;
  
  try {
    if (transfer.metadata?.bookingId) {
      // Update transaction to reflect reversal
      await db
        .update(transactionsTable)
        .set({
          status: "failed",
          stripeTransferId: transfer.id,
        })
        .where(eq(transactionsTable.bookingId, transfer.metadata.bookingId));

      // Notify provider of transfer reversal
      await sendNotification('transfer_reversed', {
        bookingId: transfer.metadata.bookingId,
        amount: transfer.amount / 100,
        reason: transfer.metadata?.reversal_reason,
      });

      console.log(`Transfer reversed for booking ${transfer.metadata.bookingId}`);
    }
  } catch (error) {
    console.error(`Error handling transfer reversal:`, error);
  }
}

// Handler for payout.paid
async function handlePayoutPaid(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout;
  
  try {
    // Find provider by Stripe account ID
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, payout.destination as string))
      .limit(1);

    const providerId = provider.length > 0 ? provider[0].id : undefined;

    // Log payout to database
    await logPayout({
      providerId,
      stripePayoutId: payout.id,
      stripeAccountId: payout.destination as string,
      amount: payout.amount / 100,
      arrivalDate: new Date(payout.arrival_date * 1000),
      method: payout.method === 'instant' ? 'instant' : 'standard',
      status: 'paid',
    });

    if (provider.length > 0) {
      // Send payout confirmation
      await sendNotification('payout_successful', {
        providerId: provider[0].id,
        amount: payout.amount / 100,
        arrivalDate: new Date(payout.arrival_date * 1000),
        payoutId: payout.id,
      });

      console.log(`Payout confirmed for provider ${provider[0].id}: ${payout.amount / 100}`);
    }
  } catch (error) {
    console.error(`Error handling payout confirmation:`, error);
  }
}

// Handler for payout.failed
async function handlePayoutFailed(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout;
  
  try {
    // Find provider by Stripe account ID
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, payout.destination as string))
      .limit(1);

    const providerId = provider.length > 0 ? provider[0].id : undefined;

    // Log failed payout to database
    await logPayout({
      providerId,
      stripePayoutId: payout.id,
      stripeAccountId: payout.destination as string,
      amount: payout.amount / 100,
      method: payout.method === 'instant' ? 'instant' : 'standard',
      status: 'failed',
      failureCode: payout.failure_code || undefined,
      failureMessage: payout.failure_message || undefined,
    });

    if (provider.length > 0) {
      // Send urgent notification about failed payout
      await sendNotification('payout_failed', {
        providerId: provider[0].id,
        amount: payout.amount / 100,
        failureCode: payout.failure_code || undefined,
        failureMessage: payout.failure_message || undefined,
        payoutId: payout.id,
      });

      // Update provider account status if needed
      if (payout.failure_code === 'account_closed' || payout.failure_code === 'account_frozen') {
        await db
          .update(providersTable)
          .set({
            stripeOnboardingComplete: false,
            updatedAt: new Date(),
          })
          .where(eq(providersTable.id, provider[0].id));
      }

      console.log(`Payout failed for provider ${provider[0].id}: ${payout.failure_message}`);
    }
  } catch (error) {
    console.error(`Error handling payout failure:`, error);
    throw error; // Re-throw to trigger retry
  }
}

// Handler for payout.canceled
async function handlePayoutCanceled(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout;
  
  try {
    // Find provider by Stripe account ID
    const provider = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, payout.destination as string))
      .limit(1);

    const providerId = provider.length > 0 ? provider[0].id : undefined;

    // Log canceled payout to database
    await logPayout({
      providerId,
      stripePayoutId: payout.id,
      stripeAccountId: payout.destination as string,
      amount: payout.amount / 100,
      method: payout.method === 'instant' ? 'instant' : 'standard',
      status: 'canceled',
    });

    if (provider.length > 0) {
      await sendNotification('payout_canceled', {
        providerId: provider[0].id,
        amount: payout.amount / 100,
        payoutId: payout.id,
      });

      console.log(`Payout canceled for provider ${provider[0].id}`);
    }
  } catch (error) {
    console.error(`Error handling payout cancellation:`, error);
  }
}

// Handler for application_fee.refunded
async function handleApplicationFeeRefunded(event: Stripe.Event) {
  const applicationFee = event.data.object as Stripe.ApplicationFee;
  
  try {
    // Find the transaction by charge ID
    const transaction = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.stripeChargeId, applicationFee.charge as string))
      .limit(1);

    if (transaction.length > 0) {
      const tx = transaction[0];
      
      // Update platform fee to reflect refund
      const refundedFee = applicationFee.amount_refunded / 100;
      await db
        .update(transactionsTable)
        .set({
          platformFee: refundedFee.toString(),
          providerPayout: ((parseFloat(tx.amount) - refundedFee)).toString(),
        })
        .where(eq(transactionsTable.id, tx.id));

      console.log(`Application fee refunded for charge ${applicationFee.charge}: ${refundedFee}`);
    }
  } catch (error) {
    console.error(`Error handling application fee refund:`, error);
  }
}