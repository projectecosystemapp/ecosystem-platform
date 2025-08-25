import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { withRateLimit } from "@/lib/rate-limit";
import { processWebhookWithIdempotency } from "@/lib/webhook-idempotency";

// Stripe webhook endpoint secret for Connect events
const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!;

/**
 * POST /api/stripe/webhooks/connect
 * Handle Stripe Connect webhook events
 * Rate limited: 100 requests per minute from Stripe IPs
 */
export const POST = withRateLimit('webhook', async (request: NextRequest) => {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Process the webhook with idempotency guarantees
    const result = await processWebhookWithIdempotency(event, async (event, tx) => {
      switch (event.type) {
        case "account.updated": {
          const account = event.data.object as Stripe.Account;
          await handleAccountUpdated(account, tx);
          break;
        }

        case "account.application.authorized": {
          const account = event.data.object as Stripe.Account;
          await handleAccountAuthorized(account, tx);
          break;
        }

        case "account.application.deauthorized": {
          const account = event.data.object as Stripe.Account;
          await handleAccountDeauthorized(account, tx);
          break;
        }

        case "capability.updated": {
          const capability = event.data.object as Stripe.Capability;
          await handleCapabilityUpdated(capability, tx);
          break;
        }

        case "account.external_account.created":
        case "account.external_account.updated": {
          const externalAccount = event.data.object as Stripe.BankAccount | Stripe.Card;
          console.log(`External account event for account: ${event.account}`);
          // Log for monitoring but no action needed
          break;
        }

        case "person.created":
        case "person.updated":
        case "person.deleted": {
          const person = event.data.object as Stripe.Person;
          console.log(`Person event for account: ${event.account}`, person.id);
          // Log for monitoring but no action needed
          break;
        }

        case "payout.created":
        case "payout.updated":
        case "payout.paid":
        case "payout.failed": {
          const payout = event.data.object as Stripe.Payout;
          await handlePayoutEvent(event.type, payout, event.account!, tx);
          break;
        }

        case "transfer.created":
        case "transfer.updated": {
          const transfer = event.data.object as Stripe.Transfer;
          console.log(`Transfer ${event.type} for amount: ${transfer.amount}`);
          // These are logged for reconciliation
          break;
        }

        default:
          console.log(`Unhandled Connect webhook event type: ${event.type}`);
      }
    });

    if (!result.success) {
      console.error(`Connect webhook ${event.id} processing failed:`, result.error);
      // Return 200 to acknowledge receipt even on failure
      return NextResponse.json({ 
        received: true, 
        warning: "Event received but processing failed. Will retry." 
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Connect webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
});

/**
 * Handle account.updated events
 */
async function handleAccountUpdated(account: Stripe.Account, tx?: any) {
  const database = tx || db;
  try {
    // Check if onboarding is complete
    const onboardingComplete = 
      account.charges_enabled && 
      account.payouts_enabled &&
      account.details_submitted;

    // Find provider by Stripe account ID
    const [provider] = await database
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, account.id))
      .limit(1);

    if (!provider) {
      console.warn(`No provider found for Stripe account: ${account.id}`);
      return;
    }

    // Update provider's onboarding status
    await database
      .update(providersTable)
      .set({
        stripeOnboardingComplete: onboardingComplete,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, provider.id));

    console.log(`Updated provider ${provider.id} onboarding status:`, {
      onboardingComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });

    // Check for any requirements that need attention
    if (account.requirements?.currently_due?.length) {
      console.warn(`Provider ${provider.id} has requirements due:`, account.requirements.currently_due);
      // In production, you might want to send an email notification here
    }

    // Check if account needs attention
    if (account.requirements?.disabled_reason) {
      console.error(`Provider ${provider.id} account disabled:`, account.requirements.disabled_reason);
      // In production, notify the provider and support team
    }
  } catch (error) {
    console.error("Error handling account.updated:", error);
    throw error;
  }
}

/**
 * Handle account.application.authorized events
 */
async function handleAccountAuthorized(account: Stripe.Account, tx?: any) {
  const database = tx || db;
  try {
    console.log(`Account authorized: ${account.id}`);
    
    // Find provider
    const [provider] = await database
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, account.id))
      .limit(1);

    if (!provider) {
      console.warn(`No provider found for authorized account: ${account.id}`);
      return;
    }

    // Mark as active
    await database
      .update(providersTable)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, provider.id));

    console.log(`Provider ${provider.id} account authorized and activated`);
  } catch (error) {
    console.error("Error handling account.application.authorized:", error);
    throw error;
  }
}

/**
 * Handle account.application.deauthorized events
 */
async function handleAccountDeauthorized(account: Stripe.Account, tx?: any) {
  const database = tx || db;
  try {
    console.log(`Account deauthorized: ${account.id}`);
    
    // Find provider
    const [provider] = await database
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, account.id))
      .limit(1);

    if (!provider) {
      console.warn(`No provider found for deauthorized account: ${account.id}`);
      return;
    }

    // Mark as inactive and clear Stripe account
    await database
      .update(providersTable)
      .set({
        stripeConnectAccountId: null,
        stripeOnboardingComplete: false,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, provider.id));

    console.log(`Provider ${provider.id} account deauthorized and deactivated`);
    // In production, notify the provider and support team
  } catch (error) {
    console.error("Error handling account.application.deauthorized:", error);
    throw error;
  }
}

/**
 * Handle capability.updated events
 */
async function handleCapabilityUpdated(capability: Stripe.Capability, tx?: any) {
  const database = tx || db;
  try {
    console.log(`Capability updated for account ${capability.account}:`, {
      id: capability.id,
      status: capability.status,
      requested: capability.requested,
    });

    // Find provider
    const [provider] = await database
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, capability.account as string))
      .limit(1);

    if (!provider) {
      console.warn(`No provider found for capability update: ${capability.account}`);
      return;
    }

    // Check if critical capabilities are disabled
    if (capability.id === "card_payments" || capability.id === "transfers") {
      if (capability.status !== "active") {
        console.error(`Critical capability ${capability.id} is ${capability.status} for provider ${provider.id}`);
        
        // Update provider status if capability is not active
        // Status can be: "active" | "pending" | "unrequested"
        await db
          .update(providersTable)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(providersTable.id, provider.id));
        
        // In production, notify the provider immediately
      }
    }

    // Log requirements if any
    if (capability.requirements?.currently_due?.length) {
      console.warn(`Capability ${capability.id} has requirements for provider ${provider.id}:`, 
        capability.requirements.currently_due);
    }
  } catch (error) {
    console.error("Error handling capability.updated:", error);
    throw error;
  }
}

/**
 * Handle payout events
 */
async function handlePayoutEvent(
  eventType: string,
  payout: Stripe.Payout,
  accountId: string,
  tx?: any
) {
  const database = tx || db;
  try {
    console.log(`Payout ${eventType}:`, {
      accountId,
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
    });

    // Find provider
    const [provider] = await database
      .select()
      .from(providersTable)
      .where(eq(providersTable.stripeConnectAccountId, accountId))
      .limit(1);

    if (!provider) {
      console.warn(`No provider found for payout: ${accountId}`);
      return;
    }

    // Handle failed payouts
    if (eventType === "payout.failed") {
      console.error(`Payout failed for provider ${provider.id}:`, {
        payoutId: payout.id,
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message,
      });
      
      // In production:
      // 1. Notify the provider about the failed payout
      // 2. Create a support ticket
      // 3. Log for financial reconciliation
    }

    // Handle successful payouts
    if (eventType === "payout.paid") {
      console.log(`Payout completed for provider ${provider.id}:`, {
        payoutId: payout.id,
        amount: payout.amount / 100, // Convert from cents
        currency: payout.currency,
      });
      
      // In production:
      // 1. Update payout records in database
      // 2. Send confirmation to provider
      // 3. Update financial reports
    }
  } catch (error) {
    console.error("Error handling payout event:", error);
    throw error;
  }
}

// Disable body parsing for webhook routes
export const runtime = "nodejs";
export const preferredRegion = "auto";