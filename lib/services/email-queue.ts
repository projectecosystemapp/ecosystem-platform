/**
 * Email Queue Service
 * 
 * Redis-backed email queue with idempotency, retry logic, and dead letter queue
 * Per Master PRD requirements for reliable email delivery
 */

import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { emailService } from './email-service';
import { db } from '@/db/db';
import { 
  emailLogsTable, 
  emailEventsTable, 
  EmailStatus, 
  EmailEventType 
} from '@/db/schema';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Queue configuration
const QUEUE_CONFIG = {
  EMAIL_QUEUE_KEY: 'email:queue',
  PROCESSING_QUEUE_KEY: 'email:processing',
  DEAD_LETTER_QUEUE_KEY: 'email:dlq',
  IDEMPOTENCY_KEY_PREFIX: 'email:idempotent:',
  RETRY_KEY_PREFIX: 'email:retry:',
  BATCH_SIZE: 10,
  MAX_RETRIES: 3,
  RETRY_DELAYS: [60000, 300000, 3600000], // 1 min, 5 min, 1 hour
  IDEMPOTENCY_TTL: 86400, // 24 hours in seconds
  PROCESSING_TIMEOUT: 30000, // 30 seconds
  DLQ_TTL: 604800, // 7 days in seconds
};

// Email message interface
export interface EmailMessage {
  id: string;
  to: string | string[];
  template: EmailTemplate;
  data: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  attempts: number;
  scheduledFor?: Date;
  createdAt: Date;
  metadata?: {
    bookingId?: string;
    userId?: string;
    providerId?: string;
    source?: string;
  };
}

// Email template types
export enum EmailTemplate {
  BOOKING_CONFIRMATION = 'booking_confirmation',
  PROVIDER_NOTIFICATION = 'provider_notification',
  PAYMENT_RECEIPT = 'payment_receipt',
  PAYOUT_NOTIFICATION = 'payout_notification',
  BOOKING_CANCELLATION = 'booking_cancellation',
  WELCOME_EMAIL = 'welcome_email',
  HOLD_EXPIRATION_WARNING = 'hold_expiration_warning',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  REFUND_CONFIRMATION = 'refund_confirmation',
  GUEST_MAGIC_LINK = 'guest_magic_link',
  PROVIDER_ACCEPTANCE = 'provider_acceptance',
  NO_SHOW_NOTIFICATION = 'no_show_notification',
  DISPUTE_NOTIFICATION = 'dispute_notification',
}

// Processing result interface
interface ProcessingResult {
  success: boolean;
  messageId: string;
  error?: string;
  retryable?: boolean;
  sentAt?: Date;
}

// Queue statistics interface
export interface QueueStats {
  pending: number;
  processing: number;
  deadLetter: number;
  processed24h: number;
  failed24h: number;
  avgProcessingTime?: number;
}

class EmailQueueService {
  /**
   * Enqueue an email message with idempotency
   */
  async enqueue(
    template: EmailTemplate,
    to: string | string[],
    data: Record<string, any>,
    options: {
      priority?: 'high' | 'normal' | 'low';
      scheduledFor?: Date;
      idempotencyKey?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ messageId: string; queued: boolean; duplicate: boolean }> {
    const messageId = options.idempotencyKey || uuidv4();
    
    // Check for duplicate using idempotency key
    if (options.idempotencyKey) {
      const isDuplicate = await this.checkIdempotency(options.idempotencyKey);
      if (isDuplicate) {
        console.log(`Email with idempotency key ${options.idempotencyKey} already processed`);
        return { messageId, queued: false, duplicate: true };
      }
    }

    // Create email message
    const message: EmailMessage = {
      id: messageId,
      to,
      template,
      data,
      priority: options.priority || 'normal',
      attempts: 0,
      scheduledFor: options.scheduledFor,
      createdAt: new Date(),
      metadata: options.metadata,
    };

    // Add to appropriate queue based on priority
    const queueKey = this.getQueueKey(message.priority);
    
    // If scheduled for future, add to scheduled set
    if (options.scheduledFor && options.scheduledFor > new Date()) {
      await redis.zadd(
        `${queueKey}:scheduled`,
        { score: options.scheduledFor.getTime(), member: JSON.stringify(message) }
      );
    } else {
      // Add to immediate queue
      await redis.lpush(queueKey, JSON.stringify(message));
    }

    // Mark as processed for idempotency
    if (options.idempotencyKey) {
      await this.markAsProcessed(options.idempotencyKey);
    }

    // Create email log entry for audit trail
    await this.createEmailLog(message);

    // Log the enqueue event
    await this.logEmailEvent(messageId, 'enqueued', { template, to });

    return { messageId, queued: true, duplicate: false };
  }

  /**
   * Process emails from the queue
   */
  async processQueue(limit: number = QUEUE_CONFIG.BATCH_SIZE): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const priorities = ['high', 'normal', 'low'];

    for (const priority of priorities) {
      const queueKey = this.getQueueKey(priority as any);
      const remaining = limit - results.length;
      
      if (remaining <= 0) break;

      // Move scheduled emails to main queue if due
      await this.moveScheduledToQueue(queueKey);

      // Process messages
      const messages = await this.fetchMessages(queueKey, remaining);
      
      for (const message of messages) {
        const result = await this.processSingleMessage(message);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Process a single email message
   */
  private async processSingleMessage(message: EmailMessage): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Mark as processing
      await redis.hset(
        QUEUE_CONFIG.PROCESSING_QUEUE_KEY,
        {
          [message.id]: JSON.stringify({ ...message, processingStarted: new Date() })
        }
      );

      // Send the email based on template
      await this.sendEmailByTemplate(message);

      // Mark as successful
      await redis.hdel(QUEUE_CONFIG.PROCESSING_QUEUE_KEY, message.id);
      
      const sentAt = new Date();
      
      // Update email log status
      await this.updateEmailLogStatus(message.id, EmailStatus.SENT, {
        sentAt,
        attempts: message.attempts + 1,
      });
      
      // Log success
      await this.logEmailEvent(message.id, 'sent', {
        processingTime: Date.now() - startTime,
        attempts: message.attempts + 1,
      });

      return {
        success: true,
        messageId: message.id,
        sentAt: new Date(),
      };

    } catch (error) {
      return await this.handleProcessingError(message, error);
    }
  }

  /**
   * Send email based on template type
   */
  private async sendEmailByTemplate(message: EmailMessage): Promise<void> {
    const { template, to, data } = message;

    switch (template) {
      case EmailTemplate.BOOKING_CONFIRMATION:
        await emailService.sendBookingConfirmation(data as any);
        break;
      
      case EmailTemplate.PROVIDER_NOTIFICATION:
        await emailService.sendProviderBookingNotification(data as any);
        break;
      
      case EmailTemplate.PAYMENT_RECEIPT:
        await emailService.sendPaymentReceipt(data as any);
        break;
      
      case EmailTemplate.PAYOUT_NOTIFICATION:
        await emailService.sendPayoutNotification(data as any);
        break;
      
      case EmailTemplate.BOOKING_CANCELLATION:
        await emailService.sendBookingCancellation(
          Array.isArray(to) ? to[0] : to,
          data.customerName,
          data.providerName,
          data.serviceName,
          data.bookingDate,
          data.refundAmount
        );
        break;
      
      case EmailTemplate.WELCOME_EMAIL:
        await emailService.sendWelcomeEmail(
          Array.isArray(to) ? to[0] : to,
          data.name,
          data.isProvider
        );
        break;
      
      case EmailTemplate.HOLD_EXPIRATION_WARNING:
        await emailService.sendHoldExpirationWarning(
          Array.isArray(to) ? to[0] : to,
          data.customerName,
          data.serviceName,
          data.providerName,
          data.expiresAt
        );
        break;
      
      case EmailTemplate.APPOINTMENT_REMINDER:
        await emailService.sendAppointmentReminder(
          Array.isArray(to) ? to[0] : to,
          data.customerName,
          data.providerName,
          data.serviceName,
          data.bookingDate,
          data.startTime,
          data.endTime,
          data.location,
          data.hoursUntil
        );
        break;
      
      case EmailTemplate.REFUND_CONFIRMATION:
        await emailService.sendRefundConfirmation(
          Array.isArray(to) ? to[0] : to,
          data.customerName,
          data.refundAmount,
          data.refundType,
          data.serviceName,
          data.providerName,
          data.reason,
          data.refundId
        );
        break;
      
      case EmailTemplate.GUEST_MAGIC_LINK:
        await emailService.sendGuestMagicLink(
          Array.isArray(to) ? to[0] : to,
          data.magicLink,
          data.bookingDetails
        );
        break;
      
      case EmailTemplate.PROVIDER_ACCEPTANCE:
        await emailService.sendProviderAcceptanceNotification(
          Array.isArray(to) ? to[0] : to,
          data.customerName,
          data.providerName,
          data.serviceName,
          data.bookingDate,
          data.startTime,
          data.bookingId
        );
        break;
      
      case EmailTemplate.NO_SHOW_NOTIFICATION:
        await emailService.sendNoShowNotification(
          Array.isArray(to) ? to[0] : to,
          data.name,
          data.isProvider,
          data.serviceName,
          data.bookingDate,
          data.otherPartyName
        );
        break;
      
      case EmailTemplate.DISPUTE_NOTIFICATION:
        await emailService.sendDisputeNotification(
          Array.isArray(to) ? to[0] : to,
          data.name,
          data.disputeInitiator,
          data.serviceName,
          data.bookingDate,
          data.disputeReason,
          data.disputeId
        );
        break;
      
      default:
        throw new Error(`Unknown email template: ${template}`);
    }
  }

  /**
   * Handle processing errors with retry logic
   */
  private async handleProcessingError(
    message: EmailMessage,
    error: any
  ): Promise<ProcessingResult> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRetryable = this.isRetryableError(error);
    
    message.attempts++;

    if (isRetryable && message.attempts < QUEUE_CONFIG.MAX_RETRIES) {
      // Schedule retry with exponential backoff
      const delay = QUEUE_CONFIG.RETRY_DELAYS[message.attempts - 1];
      const retryTime = new Date(Date.now() + delay);
      
      await redis.zadd(
        `${this.getQueueKey(message.priority)}:scheduled`,
        { score: retryTime.getTime(), member: JSON.stringify(message) }
      );

      await redis.hdel(QUEUE_CONFIG.PROCESSING_QUEUE_KEY, message.id);

      // Update email log status for retry
      await this.updateEmailLogStatus(message.id, EmailStatus.PENDING, {
        attempts: message.attempts,
        errorMessage,
      });

      await this.logEmailEvent(message.id, 'retry_scheduled', {
        attempt: message.attempts,
        retryAt: retryTime,
        error: errorMessage,
      });

      return {
        success: false,
        messageId: message.id,
        error: errorMessage,
        retryable: true,
      };
    } else {
      // Update email log status as failed
      await this.updateEmailLogStatus(message.id, EmailStatus.FAILED, {
        failedAt: new Date(),
        attempts: message.attempts,
        errorMessage,
      });

      // Move to dead letter queue
      await this.moveToDeadLetterQueue(message, errorMessage);
      await redis.hdel(QUEUE_CONFIG.PROCESSING_QUEUE_KEY, message.id);

      return {
        success: false,
        messageId: message.id,
        error: errorMessage,
        retryable: false,
      };
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('ECONNRESET')) return true;
      if (error.message.includes('ETIMEDOUT')) return true;
      if (error.message.includes('ECONNREFUSED')) return true;
      
      // Rate limiting
      if (error.message.includes('rate_limit')) return true;
      if (error.message.includes('429')) return true;
      
      // Temporary failures
      if (error.message.includes('temporarily_unavailable')) return true;
      if (error.message.includes('503')) return true;
    }
    
    return false;
  }

  /**
   * Move message to dead letter queue
   */
  private async moveToDeadLetterQueue(message: EmailMessage, error: string): Promise<void> {
    const dlqEntry = {
      ...message,
      failedAt: new Date(),
      failureReason: error,
      finalAttempts: message.attempts,
    };

    await redis.lpush(QUEUE_CONFIG.DEAD_LETTER_QUEUE_KEY, JSON.stringify(dlqEntry));
    
    // Set expiry on DLQ entries
    await redis.expire(QUEUE_CONFIG.DEAD_LETTER_QUEUE_KEY, QUEUE_CONFIG.DLQ_TTL);

    await this.logEmailEvent(message.id, 'moved_to_dlq', {
      attempts: message.attempts,
      error,
    });
  }

  /**
   * Retry messages from dead letter queue
   */
  async retryDeadLetterQueue(limit: number = 10): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    const messages = await redis.lrange(QUEUE_CONFIG.DEAD_LETTER_QUEUE_KEY, 0, limit - 1);

    for (const messageStr of messages) {
      const message = JSON.parse(messageStr) as EmailMessage;
      
      // Reset attempts and re-queue
      message.attempts = 0;
      await redis.lpush(this.getQueueKey(message.priority), JSON.stringify(message));
      
      // Remove from DLQ
      await redis.lrem(QUEUE_CONFIG.DEAD_LETTER_QUEUE_KEY, 1, messageStr);

      await this.logEmailEvent(message.id, 'dlq_retry', {});

      results.push({
        success: true,
        messageId: message.id,
      });
    }

    return results;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    const [pending, processing, deadLetter] = await Promise.all([
      this.countPendingMessages(),
      redis.hlen(QUEUE_CONFIG.PROCESSING_QUEUE_KEY),
      redis.llen(QUEUE_CONFIG.DEAD_LETTER_QUEUE_KEY),
    ]);

    // Get 24h stats from logs (would need to implement log aggregation)
    const processed24h = 0; // Placeholder
    const failed24h = 0; // Placeholder

    return {
      pending,
      processing,
      deadLetter,
      processed24h,
      failed24h,
    };
  }

  /**
   * Clear stuck processing messages
   */
  async clearStuckProcessing(): Promise<number> {
    const processing = await redis.hgetall(QUEUE_CONFIG.PROCESSING_QUEUE_KEY);
    let cleared = 0;

    for (const [id, messageStr] of Object.entries(processing || {})) {
      const message = JSON.parse(messageStr as string) as EmailMessage & { processingStarted: Date };
      const processingTime = Date.now() - new Date(message.processingStarted).getTime();

      if (processingTime > QUEUE_CONFIG.PROCESSING_TIMEOUT) {
        // Re-queue the message
        await redis.lpush(this.getQueueKey(message.priority), JSON.stringify(message));
        await redis.hdel(QUEUE_CONFIG.PROCESSING_QUEUE_KEY, id);
        cleared++;

        await this.logEmailEvent(id, 'processing_timeout_cleared', {
          processingTime,
        });
      }
    }

    return cleared;
  }

  /**
   * Helper methods
   */

  private async checkIdempotency(key: string): Promise<boolean> {
    const exists = await redis.exists(`${QUEUE_CONFIG.IDEMPOTENCY_KEY_PREFIX}${key}`);
    return exists === 1;
  }

  private async markAsProcessed(key: string): Promise<void> {
    await redis.setex(
      `${QUEUE_CONFIG.IDEMPOTENCY_KEY_PREFIX}${key}`,
      QUEUE_CONFIG.IDEMPOTENCY_TTL,
      '1'
    );
  }

  private getQueueKey(priority: 'high' | 'normal' | 'low'): string {
    return `${QUEUE_CONFIG.EMAIL_QUEUE_KEY}:${priority}`;
  }

  private async fetchMessages(queueKey: string, limit: number): Promise<EmailMessage[]> {
    const messages: EmailMessage[] = [];
    
    for (let i = 0; i < limit; i++) {
      const messageStr = await redis.rpop(queueKey);
      if (!messageStr) break;
      
      try {
        messages.push(JSON.parse(messageStr) as EmailMessage);
      } catch (error) {
        console.error('Failed to parse email message:', error);
      }
    }

    return messages;
  }

  private async moveScheduledToQueue(queueKey: string): Promise<void> {
    const scheduledKey = `${queueKey}:scheduled`;
    const now = Date.now();

    // Get all scheduled messages due for processing
    const due = await redis.zrange(scheduledKey, 0, now, { byScore: true });

    for (const messageStr of due) {
      await redis.lpush(queueKey, messageStr);
      await redis.zrem(scheduledKey, messageStr);
    }
  }

  private async countPendingMessages(): Promise<number> {
    const priorities = ['high', 'normal', 'low'];
    let total = 0;

    for (const priority of priorities) {
      const queueKey = this.getQueueKey(priority as any);
      const [immediate, scheduled] = await Promise.all([
        redis.llen(queueKey),
        redis.zcard(`${queueKey}:scheduled`),
      ]);
      total += immediate + scheduled;
    }

    return total;
  }

  /**
   * Create email log entry when email is first enqueued
   */
  private async createEmailLog(message: EmailMessage): Promise<void> {
    try {
      await db.insert(emailLogsTable).values({
        id: message.id,
        messageId: message.id,
        template: message.template,
        subject: `Template: ${message.template}`, // Template subject, would be populated by actual email
        to: Array.isArray(message.to) ? message.to : [message.to],
        from: 'noreply@ecosystem.app', // Would come from email config
        status: EmailStatus.QUEUED,
        priority: message.priority,
        scheduledFor: message.scheduledFor,
        metadata: message.metadata,
        templateData: message.data,
      });
    } catch (error) {
      // Don't fail email processing if logging fails
      console.error('Failed to create email log:', error);
    }
  }

  /**
   * Update email log status
   */
  private async updateEmailLogStatus(
    messageId: string, 
    status: EmailStatus, 
    additionalData?: Partial<{
      sentAt: Date;
      failedAt: Date;
      attempts: number;
      errorMessage: string;
      providerMessageId: string;
    }>
  ): Promise<void> {
    try {
      await db.update(emailLogsTable)
        .set({
          status,
          updatedAt: new Date(),
          ...additionalData,
        })
        .where(eq(emailLogsTable.id, messageId));
    } catch (error) {
      console.error('Failed to update email log:', error);
    }
  }

  private async logEmailEvent(
    messageId: string,
    event: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Write to database for proper audit trail
      await db.insert(emailEventsTable).values({
        emailLogId: messageId, // Assuming messageId corresponds to email log ID
        messageId,
        eventType: event,
        eventData: metadata,
        provider: 'resend',
        eventAt: new Date(),
      });

      // Also log to console for development
      console.log(`Email event: ${event}`, {
        messageId,
        timestamp: new Date(),
        ...metadata,
      });
    } catch (error) {
      // Don't fail email processing if logging fails
      console.error('Failed to log email event:', error);
      console.log(`Email event (fallback): ${event}`, {
        messageId,
        timestamp: new Date(),
        ...metadata,
      });
    }
  }
}

// Singleton instance
export const emailQueue = new EmailQueueService();

// Export convenience functions
export async function sendEmailQueued(
  template: EmailTemplate,
  to: string | string[],
  data: Record<string, any>,
  options?: {
    priority?: 'high' | 'normal' | 'low';
    scheduledFor?: Date;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }
): Promise<{ messageId: string; queued: boolean }> {
  const result = await emailQueue.enqueue(template, to, data, options);
  return { messageId: result.messageId, queued: result.queued };
}

// Cron job function to process queue (would be called by a Next.js API route with cron)
export async function processEmailQueue(): Promise<void> {
  try {
    // Clear stuck messages first
    const cleared = await emailQueue.clearStuckProcessing();
    if (cleared > 0) {
      console.log(`Cleared ${cleared} stuck processing messages`);
    }

    // Process the queue
    const results = await emailQueue.processQueue();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (results.length > 0) {
      console.log(`Processed ${results.length} emails: ${successful} successful, ${failed} failed`);
    }
  } catch (error) {
    console.error('Error processing email queue:', error);
  }
}