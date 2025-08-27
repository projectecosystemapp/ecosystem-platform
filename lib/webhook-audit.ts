/**
 * Webhook Audit Service
 * 
 * Provides audit logging and tracking for webhook events
 * Ensures idempotency and provides retry mechanisms
 */

import { db } from "@/db/db";
import { eq, and, lt, inArray } from "drizzle-orm";
import { 
  webhookEventsTable, 
  disputesTable, 
  payoutsTable, 
  notificationLogsTable 
} from "@/db/schema";

export interface WebhookEvent {
  eventId: string;
  eventType: string;
  status: 'received' | 'processing' | 'completed' | 'failed';
  payload?: any;
  errorMessage?: string;
  retryCount?: number;
}

/**
 * Log a webhook event to the database
 */
export async function logWebhookEventToDB(event: WebhookEvent): Promise<void> {
  try {
    await db.insert(webhookEventsTable)
      .values({
        eventId: event.eventId,
        eventType: event.eventType,
        status: event.status,
        payload: event.payload || {},
        errorMessage: event.errorMessage || null,
        retryCount: event.retryCount || 0,
        processedAt: (event.status === 'completed' || event.status === 'failed') ? new Date() : null
      })
      .onConflictDoUpdate({
        target: webhookEventsTable.eventId,
        set: {
          status: event.status,
          errorMessage: event.errorMessage || null,
          processedAt: (event.status === 'completed' || event.status === 'failed') ? new Date() : null
        }
      });
  } catch (error) {
    // Don't throw - audit logging should not break webhook processing
    console.error('[WEBHOOK_AUDIT_ERROR]', error);
  }
}

/**
 * Check if a webhook event has already been processed
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const result = await db.select({ status: webhookEventsTable.status })
      .from(webhookEventsTable)
      .where(
        and(
          eq(webhookEventsTable.eventId, eventId),
          eq(webhookEventsTable.status, 'completed')
        )
      )
      .limit(1);
    
    return result.length > 0;
  } catch (error) {
    console.error('[WEBHOOK_AUDIT_CHECK_ERROR]', error);
    return false; // Assume not processed on error to allow processing
  }
}

/**
 * Get retry count for an event
 */
export async function getEventRetryCount(eventId: string): Promise<number> {
  try {
    const result = await db.select({ retryCount: webhookEventsTable.retryCount })
      .from(webhookEventsTable)
      .where(eq(webhookEventsTable.eventId, eventId))
      .limit(1);
    
    return result.length > 0 ? (result[0].retryCount || 0) : 0;
  } catch (error) {
    console.error('[WEBHOOK_RETRY_COUNT_ERROR]', error);
    return 0;
  }
}

/**
 * Log a dispute to the database
 */
export async function logDispute(dispute: {
  bookingId?: string;
  transactionId?: string;
  stripeDisputeId: string;
  stripeChargeId: string;
  amount: number;
  reason: string;
  status: string;
  evidenceDueBy?: Date;
}): Promise<void> {
  try {
    await db.insert(disputesTable)
      .values({
        bookingId: dispute.bookingId || null,
        transactionId: dispute.transactionId || null,
        stripeDisputeId: dispute.stripeDisputeId,
        stripeChargeId: dispute.stripeChargeId,
        amount: dispute.amount.toString(),
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueBy: dispute.evidenceDueBy || null
      })
      .onConflictDoUpdate({
        target: disputesTable.stripeDisputeId,
        set: {
          status: dispute.status,
          updatedAt: new Date()
        }
      });
  } catch (error) {
    console.error('[DISPUTE_LOG_ERROR]', error);
    throw error; // Disputes are critical - should fail the webhook
  }
}

/**
 * Update dispute status
 */
export async function updateDisputeStatus(
  stripeDisputeId: string,
  status: string,
  outcome?: string,
  fundsWithdrawn?: boolean,
  fundsReinstated?: boolean
): Promise<void> {
  try {
    await db.update(disputesTable)
      .set({
        status,
        outcome: outcome || null,
        fundsWithdrawn: fundsWithdrawn || false,
        fundsReinstated: fundsReinstated || false,
        resolvedAt: outcome ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(disputesTable.stripeDisputeId, stripeDisputeId));
  } catch (error) {
    console.error('[DISPUTE_UPDATE_ERROR]', error);
    throw error;
  }
}

/**
 * Log a payout event
 */
export async function logPayout(payout: {
  providerId?: string;
  stripePayoutId: string;
  stripeAccountId: string;
  amount: number;
  arrivalDate?: Date;
  method?: string;
  status: string;
  failureCode?: string;
  failureMessage?: string;
}): Promise<void> {
  try {
    await db.insert(payoutsTable)
      .values({
        providerId: payout.providerId,
        stripePayoutId: payout.stripePayoutId,
        stripeAccountId: payout.stripeAccountId,
        amount: payout.amount.toString(),
        arrivalDate: payout.arrivalDate ? payout.arrivalDate.toISOString().split('T')[0] : null,
        method: payout.method || 'standard',
        status: payout.status,
        failureCode: payout.failureCode || null,
        failureMessage: payout.failureMessage || null
      })
      .onConflictDoUpdate({
        target: payoutsTable.stripePayoutId,
        set: {
          status: payout.status,
          failureCode: payout.failureCode || null,
          failureMessage: payout.failureMessage || null,
          paidAt: payout.status === 'paid' ? new Date() : null,
          failedAt: payout.status === 'failed' ? new Date() : null,
          updatedAt: new Date()
        }
      });
  } catch (error) {
    console.error('[PAYOUT_LOG_ERROR]', error);
    // Don't throw - payout logging is not critical
  }
}

/**
 * Log a notification
 */
export async function logNotification(notification: {
  type: string;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  subject?: string;
  body?: string;
  templateName?: string;
  templateData?: any;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  errorMessage?: string;
  provider?: string;
  providerMessageId?: string;
}): Promise<void> {
  try {
    await db.insert(notificationLogsTable)
      .values({
        type: notification.type,
        recipientId: notification.recipientId || null,
        recipientEmail: notification.recipientEmail || null,
        recipientPhone: notification.recipientPhone || null,
        channel: notification.channel,
        subject: notification.subject || null,
        body: notification.body || null,
        templateName: notification.templateName || null,
        templateData: notification.templateData || null,
        status: notification.status,
        errorMessage: notification.errorMessage || null,
        provider: notification.provider || null,
        providerMessageId: notification.providerMessageId || null,
        sentAt: notification.status === 'sent' ? new Date() : null,
        deliveredAt: notification.status === 'delivered' ? new Date() : null,
        failedAt: notification.status === 'failed' ? new Date() : null
      });
  } catch (error) {
    console.error('[NOTIFICATION_LOG_ERROR]', error);
    // Don't throw - notification logging should not break processing
  }
}

/**
 * Clean up old webhook events (for maintenance)
 */
export async function cleanupOldWebhookEvents(daysToKeep: number = 30): Promise<number> {
  try {
    // Validate input to prevent injection
    if (!Number.isInteger(daysToKeep) || daysToKeep < 0 || daysToKeep > 365) {
      throw new Error('Invalid daysToKeep parameter: must be integer between 0 and 365');
    }
    
    // Calculate the cutoff date in JavaScript
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db.delete(webhookEventsTable)
      .where(
        and(
          lt(webhookEventsTable.createdAt, cutoffDate),
          inArray(webhookEventsTable.status, ['completed', 'failed'])
        )
      );
    
    return result.length || 0;
  } catch (error) {
    console.error('[WEBHOOK_CLEANUP_ERROR]', error);
    return 0;
  }
}