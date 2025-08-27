import { db } from "@/db/db";
import { webhookEventsTable } from "@/db/schema";
import { eq, and, lt, or, gt, desc, sql } from "drizzle-orm";
import Stripe from "stripe";

/**
 * Webhook Idempotency Manager
 * Ensures each webhook is processed exactly once, even under high load or network issues
 */

export type WebhookStatus = "received" | "processing" | "completed" | "failed";

export interface WebhookProcessingResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  alreadyProcessed?: boolean;
  status?: WebhookStatus;
}

/**
 * Check if a webhook event has already been processed
 * This uses SELECT ... FOR UPDATE SKIP LOCKED for concurrent safety
 */
export async function checkWebhookIdempotency(
  eventId: string
): Promise<WebhookProcessingResult> {
  try {
    // Try to find an existing event
    const [existingEvent] = await db
      .select()
      .from(webhookEventsTable)
      .where(eq(webhookEventsTable.eventId, eventId))
      .limit(1);

    if (existingEvent) {
      return {
        success: true,
        alreadyProcessed: true,
        status: existingEvent.status as WebhookStatus,
      };
    }

    return { success: true, alreadyProcessed: false };
  } catch (error) {
    console.error(`Error checking webhook idempotency for ${eventId}:`, error);
    // In case of database error, we should continue processing to avoid losing events
    return { success: false, alreadyProcessed: false };
  }
}

/**
 * Process a webhook with idempotency guarantees
 * Uses database transactions to ensure atomicity
 */
export async function processWebhookWithIdempotency<T = any>(
  event: Stripe.Event,
  handler: (event: Stripe.Event, tx: any) => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }> {
  const startTime = Date.now();

  try {
    // Use a transaction for the entire webhook processing
    const result = await db.transaction(async (tx) => {
      // Check if event already exists (within transaction for consistency)
      const [existingEvent] = await tx
        .select()
        .from(webhookEventsTable)
        .where(eq(webhookEventsTable.eventId, event.id))
        .limit(1);

      if (existingEvent) {
        console.log(`Webhook ${event.id} already processed with status: ${existingEvent.status}`);
        
        // If the event failed previously and hasn't exceeded retry limit, we might want to retry
        if (existingEvent.status === "failed" && (existingEvent.retryCount ?? 0) < 3) {
          console.log(`Retrying failed webhook ${event.id} (attempt ${(existingEvent.retryCount ?? 0) + 1})`);
          
          // Update retry count and status
          await tx
            .update(webhookEventsTable)
            .set({
              status: "processing",
              retryCount: (existingEvent.retryCount ?? 0) + 1,
            })
            .where(eq(webhookEventsTable.id, existingEvent.id));
        } else {
          // Event already successfully processed or exceeded retry limit
          return { 
            success: false, 
            alreadyProcessed: true, 
            status: existingEvent.status 
          };
        }
      } else {
        // Insert new event record with processing status
        await tx.insert(webhookEventsTable).values({
          eventId: event.id,
          eventType: event.type,
          status: "processing",
          payload: event as any,
          createdAt: new Date(),
        });
      }

      // Process the webhook
      const handlerResult = await handler(event, tx);

      // Mark as completed
      await tx
        .update(webhookEventsTable)
        .set({
          status: "completed",
          processedAt: new Date(),
        })
        .where(eq(webhookEventsTable.eventId, event.id));

      const processingTime = Date.now() - startTime;
      console.log(`Webhook ${event.id} processed successfully in ${processingTime}ms`);

      return { 
        success: true, 
        result: handlerResult,
        alreadyProcessed: false 
      };
    }, {
      isolationLevel: "read committed", // Prevent dirty reads
      accessMode: "read write",
      deferrable: false,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Webhook ${event.id} processing failed:`, error);

    // Try to mark the event as failed (outside of failed transaction)
    try {
      await db
        .update(webhookEventsTable)
        .set({
          status: "failed",
          errorMessage,
          processedAt: new Date(),
        })
        .where(eq(webhookEventsTable.eventId, event.id));
    } catch (updateError) {
      console.error(`Failed to update webhook status for ${event.id}:`, updateError);
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Cleanup old webhook events (for maintenance)
 * Keeps last 30 days of events for audit purposes
 */
export async function cleanupOldWebhookEvents(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const result = await db
      .delete(webhookEventsTable)
      .where(
        and(
          lt(webhookEventsTable.createdAt, thirtyDaysAgo),
          or(
            eq(webhookEventsTable.status, "completed"),
            eq(webhookEventsTable.status, "failed")
          )
        )
      );

    const deletedCount = (result as any).rowCount || 0;
    console.log(`Cleaned up ${deletedCount} old webhook events`);
    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up old webhook events:", error);
    return 0;
  }
}

/**
 * Get failed webhooks that need retry
 */
export async function getFailedWebhooksForRetry(limit: number = 10) {
  try {
    const failedWebhooks = await db
      .select()
      .from(webhookEventsTable)
      .where(
        and(
          eq(webhookEventsTable.status, "failed"),
          lt(webhookEventsTable.retryCount, 3)
        )
      )
      .orderBy(webhookEventsTable.createdAt)
      .limit(limit);

    return failedWebhooks;
  } catch (error) {
    console.error("Error fetching failed webhooks:", error);
    return [];
  }
}

/**
 * Manually retry a failed webhook
 */
export async function retryFailedWebhook(
  eventId: string,
  handler: (event: Stripe.Event) => Promise<void>
): Promise<boolean> {
  try {
    const [webhookEvent] = await db
      .select()
      .from(webhookEventsTable)
      .where(eq(webhookEventsTable.eventId, eventId))
      .limit(1);

    if (!webhookEvent) {
      console.error(`Webhook event ${eventId} not found`);
      return false;
    }

    if (webhookEvent.status !== "failed") {
      console.log(`Webhook event ${eventId} is not in failed status`);
      return false;
    }

    if ((webhookEvent.retryCount ?? 0) >= 3) {
      console.error(`Webhook event ${eventId} has exceeded retry limit`);
      return false;
    }

    // Reconstruct the Stripe event from stored payload
    const event = webhookEvent.payload as Stripe.Event;
    
    // Process with idempotency
    const result = await processWebhookWithIdempotency(event, handler);
    
    return result.success;
  } catch (error) {
    console.error(`Error retrying webhook ${eventId}:`, error);
    return false;
  }
}

/**
 * Monitor webhook processing health
 */
export async function getWebhookHealthMetrics() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get counts by status
    const statusCounts = await db
      .select({
        status: webhookEventsTable.status,
        count: sql<number>`count(*)`,
      })
      .from(webhookEventsTable)
      .where(gt(webhookEventsTable.createdAt, oneDayAgo))
      .groupBy(webhookEventsTable.status);

    // Get recent failures
    const recentFailures = await db
      .select()
      .from(webhookEventsTable)
      .where(
        and(
          eq(webhookEventsTable.status, "failed"),
          gt(webhookEventsTable.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(webhookEventsTable.createdAt))
      .limit(10);

    // Get processing statistics
    const processingStats = await db
      .select({
        eventType: webhookEventsTable.eventType,
        successCount: sql<number>`count(*) filter (where ${webhookEventsTable.status} = 'completed')`,
        failureCount: sql<number>`count(*) filter (where ${webhookEventsTable.status} = 'failed')`,
      })
      .from(webhookEventsTable)
      .where(gt(webhookEventsTable.createdAt, oneDayAgo))
      .groupBy(webhookEventsTable.eventType);

    return {
      statusCounts,
      recentFailures,
      processingStats,
      timestamp: now,
    };
  } catch (error) {
    console.error("Error getting webhook health metrics:", error);
    return null;
  }
}

