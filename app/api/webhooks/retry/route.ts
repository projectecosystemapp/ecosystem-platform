// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getFailedWebhooksForRetry, retryFailedWebhook } from "@/lib/webhook-idempotency";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

/**
 * POST /api/webhooks/retry
 * Retry failed webhook events
 * This endpoint should be called periodically (e.g., via a cron job) to retry failed webhooks
 * 
 * Security: This endpoint should be protected with authentication or a secret key
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authorization (implement your auth logic here)
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.WEBHOOK_RETRY_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get failed webhooks to retry (max 10 at a time)
    const failedWebhooks = await getFailedWebhooksForRetry(10);
    
    if (failedWebhooks.length === 0) {
      return NextResponse.json({
        message: "No failed webhooks to retry",
        retried: 0
      });
    }

    const results = {
      total: failedWebhooks.length,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };

    // Retry each failed webhook
    for (const webhook of failedWebhooks) {
      try {
        const event = webhook.payload as Stripe.Event;
        
        // Import the appropriate handler based on webhook type
        let handler: (event: Stripe.Event) => Promise<void>;
        
        // Determine which handler to use based on the webhook endpoint
        // This is a simplified version - you might need to track which endpoint received the webhook
        if (event.type.includes("account.") || event.type.includes("capability.") || event.type.includes("payout.")) {
          // Connect webhook handler
          handler = async (event) => {
            const { processWebhookWithIdempotency } = await import("@/lib/webhook-idempotency");
            // You would need to import and call the specific handler functions here
            console.log("Retrying Connect webhook:", event.id);
          };
        } else if (event.type.includes("payment_intent.") || event.type.includes("charge.") || event.type.includes("transfer.")) {
          // Marketplace webhook handler
          handler = async (event) => {
            const { processWebhookWithIdempotency } = await import("@/lib/webhook-idempotency");
            // You would need to import and call the specific handler functions here
            console.log("Retrying Marketplace webhook:", event.id);
          };
        } else {
          // Main webhook handler
          handler = async (event) => {
            const { processWebhookWithIdempotency } = await import("@/lib/webhook-idempotency");
            // You would need to import and call the specific handler functions here
            console.log("Retrying Main webhook:", event.id);
          };
        }

        const success = await retryFailedWebhook(webhook.eventId, handler);
        
        if (success) {
          results.successful++;
          results.details.push({
            eventId: webhook.eventId,
            eventType: webhook.eventType,
            status: "success"
          });
        } else {
          results.failed++;
          results.details.push({
            eventId: webhook.eventId,
            eventType: webhook.eventType,
            status: "failed",
            error: "Retry failed"
          });
        }
      } catch (error) {
        results.failed++;
        results.details.push({
          eventId: webhook.eventId,
          eventType: webhook.eventType,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error in webhook retry endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/retry
 * Get status of failed webhooks
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.WEBHOOK_RETRY_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const failedWebhooks = await getFailedWebhooksForRetry(100);
    
    return NextResponse.json({
      count: failedWebhooks.length,
      webhooks: failedWebhooks.map(w => ({
        eventId: w.eventId,
        eventType: w.eventType,
        status: w.status,
        errorMessage: w.errorMessage,
        retryCount: w.retryCount,
        createdAt: w.createdAt,
        processedAt: w.processedAt
      }))
    });
  } catch (error) {
    console.error("Error fetching failed webhooks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}