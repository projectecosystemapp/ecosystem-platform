/**
 * Webhook Audit Service
 * 
 * Provides audit logging and tracking for webhook events
 * Ensures idempotency and provides retry mechanisms
 */

import { db } from "@/db/db";
import { sql } from "drizzle-orm";

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
    await db.execute(sql`
      INSERT INTO webhook_events (
        event_id,
        event_type,
        status,
        payload,
        error_message,
        retry_count,
        processed_at
      ) VALUES (
        ${event.eventId},
        ${event.eventType},
        ${event.status},
        ${JSON.stringify(event.payload || {})}::jsonb,
        ${event.errorMessage || null},
        ${event.retryCount || 0},
        ${event.status === 'completed' || event.status === 'failed' ? new Date() : null}
      )
      ON CONFLICT (event_id) DO UPDATE SET
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        retry_count = webhook_events.retry_count + 1,
        processed_at = EXCLUDED.processed_at
    `);
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
    const result = await db.execute(sql`
      SELECT status FROM webhook_events 
      WHERE event_id = ${eventId} 
      AND status = 'completed'
      LIMIT 1
    `);
    
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
    const result = await db.execute(sql`
      SELECT retry_count FROM webhook_events 
      WHERE event_id = ${eventId}
      LIMIT 1
    `);
    
    return result.length > 0 ? (result[0].retry_count as number) : 0;
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
    await db.execute(sql`
      INSERT INTO disputes (
        booking_id,
        transaction_id,
        stripe_dispute_id,
        stripe_charge_id,
        amount,
        reason,
        status,
        evidence_due_by
      ) VALUES (
        ${dispute.bookingId || null},
        ${dispute.transactionId || null},
        ${dispute.stripeDisputeId},
        ${dispute.stripeChargeId},
        ${dispute.amount},
        ${dispute.reason},
        ${dispute.status},
        ${dispute.evidenceDueBy || null}
      )
      ON CONFLICT (stripe_dispute_id) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
    `);
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
    await db.execute(sql`
      UPDATE disputes SET
        status = ${status},
        outcome = ${outcome || null},
        funds_withdrawn = ${fundsWithdrawn || false},
        funds_reinstated = ${fundsReinstated || false},
        resolved_at = ${outcome ? new Date() : null},
        updated_at = NOW()
      WHERE stripe_dispute_id = ${stripeDisputeId}
    `);
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
    await db.execute(sql`
      INSERT INTO payouts (
        provider_id,
        stripe_payout_id,
        stripe_account_id,
        amount,
        arrival_date,
        method,
        status,
        failure_code,
        failure_message
      ) VALUES (
        ${payout.providerId || null},
        ${payout.stripePayoutId},
        ${payout.stripeAccountId},
        ${payout.amount},
        ${payout.arrivalDate || null},
        ${payout.method || 'standard'},
        ${payout.status},
        ${payout.failureCode || null},
        ${payout.failureMessage || null}
      )
      ON CONFLICT (stripe_payout_id) DO UPDATE SET
        status = EXCLUDED.status,
        failure_code = EXCLUDED.failure_code,
        failure_message = EXCLUDED.failure_message,
        paid_at = ${payout.status === 'paid' ? new Date() : null},
        failed_at = ${payout.status === 'failed' ? new Date() : null},
        updated_at = NOW()
    `);
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
    await db.execute(sql`
      INSERT INTO notification_logs (
        type,
        recipient_id,
        recipient_email,
        recipient_phone,
        channel,
        subject,
        body,
        template_name,
        template_data,
        status,
        error_message,
        provider,
        provider_message_id,
        sent_at,
        delivered_at,
        failed_at
      ) VALUES (
        ${notification.type},
        ${notification.recipientId || null},
        ${notification.recipientEmail || null},
        ${notification.recipientPhone || null},
        ${notification.channel},
        ${notification.subject || null},
        ${notification.body || null},
        ${notification.templateName || null},
        ${notification.templateData ? JSON.stringify(notification.templateData) : null}::jsonb,
        ${notification.status},
        ${notification.errorMessage || null},
        ${notification.provider || null},
        ${notification.providerMessageId || null},
        ${notification.status === 'sent' ? new Date() : null},
        ${notification.status === 'delivered' ? new Date() : null},
        ${notification.status === 'failed' ? new Date() : null}
      )
    `);
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
    
    // Use parameterized query with safe date calculation
    // Instead of string interpolation, calculate the date in JavaScript
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db.execute(sql`
      DELETE FROM webhook_events 
      WHERE created_at < ${cutoffDate}
      AND status IN ('completed', 'failed')
    `);
    
    return (result as any).affectedRows || (result as any).rowCount || 0;
  } catch (error) {
    console.error('[WEBHOOK_CLEANUP_ERROR]', error);
    return 0;
  }
}