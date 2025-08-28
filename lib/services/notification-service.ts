/**
 * Notification Service
 * 
 * Comprehensive notification system supporting email, in-app, SMS, and push notifications
 * Handles all marketplace events with user preference management
 */

import { db } from '@/db/db';
import { 
  notificationsTable,
  notificationPreferencesTable,
  notificationTemplatesTable,
  notificationQueueTable,
  type NewNotification,
  type NotificationPreferences
} from '@/db/schema/notifications-schema';
import { priceAlertsTable } from '@/db/schema/pricing-schema';
import { profilesTable } from '@/db/schema';
import { emailService } from './email-service';
import { eq, and, or, gte, lte, isNull, desc, asc, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { format, addMinutes } from 'date-fns';

// Notification configuration
const NOTIFICATION_CONFIG = {
  batchSize: 100,
  retryDelayMinutes: 5,
  maxRetries: 3,
  defaultExpiryDays: 30,
  quietHoursRespected: true,
};

/**
 * Core notification service class
 */
export class NotificationService {
  /**
   * Send a notification to a user
   */
  async sendNotification({
    userId,
    type,
    title,
    body,
    metadata = {},
    priority = 'medium',
    channels = ['email', 'in_app'],
    actionUrl,
    actionText,
    imageUrl,
    templateCode,
    templateData = {},
  }: {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, any>;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    channels?: Array<'email' | 'in_app' | 'sms' | 'push'>;
    actionUrl?: string;
    actionText?: string;
    imageUrl?: string;
    templateCode?: string;
    templateData?: Record<string, any>;
  }) {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      if (!preferences) {
        // Create default preferences if none exist
        await this.createDefaultPreferences(userId);
      }

      // Get user info
      const user = await db
        .select({
          email: profilesTable.email,
          name: profilesTable.name,
        })
        .from(profilesTable)
        .where(eq(profilesTable.userId, userId))
        .limit(1);

      if (!user[0]) {
        throw new Error('User not found');
      }

      // Process template if provided
      let processedContent = { title, body, subject: title };
      if (templateCode) {
        processedContent = await this.processTemplate(templateCode, templateData);
      }

      // Create notifications for each enabled channel
      const notifications: NewNotification[] = [];
      
      for (const channel of channels) {
        if (this.isChannelEnabled(preferences, channel, type)) {
          // Check quiet hours
          if (this.isInQuietHours(preferences) && priority !== 'urgent') {
            // Schedule for after quiet hours
            const scheduledTime = this.getNextAvailableTime(preferences);
            await this.queueNotification({
              userId,
              type: type as any,
              channel: channel as any,
              priority: priority as any,
              title: processedContent.title,
              body: processedContent.body,
              subject: processedContent.subject,
              metadata,
              actionUrl,
              actionText,
              imageUrl,
              scheduledFor: scheduledTime,
            });
            continue;
          }

          const notification: NewNotification = {
            userId,
            type: type as any,
            channel: channel as any,
            priority: priority as any,
            title: processedContent.title,
            body: processedContent.body,
            subject: processedContent.subject,
            htmlContent: channel === 'email' ? this.generateEmailHtml(processedContent, metadata, actionUrl, actionText) : undefined,
            recipientEmail: channel === 'email' ? user[0].email : undefined,
            metadata,
            actionUrl,
            actionText,
            imageUrl,
            status: 'pending',
            expiresAt: new Date(Date.now() + NOTIFICATION_CONFIG.defaultExpiryDays * 24 * 60 * 60 * 1000),
          };

          notifications.push(notification);
        }
      }

      // Insert notifications
      const insertedNotifications = await db
        .insert(notificationsTable)
        .values(notifications)
        .returning();

      // Process notifications
      for (const notification of insertedNotifications) {
        await this.processNotification(notification.id);
      }

      return insertedNotifications;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Process a queued notification
   */
  private async processNotification(notificationId: string) {
    try {
      const [notification] = await db
        .select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notificationId))
        .limit(1);

      if (!notification) {
        throw new Error('Notification not found');
      }

      // Update status to sending
      await db
        .update(notificationsTable)
        .set({ 
          status: 'sending',
          updatedAt: new Date() 
        })
        .where(eq(notificationsTable.id, notificationId));

      let success = false;
      let errorMessage = null;

      switch (notification.channel) {
        case 'email':
          success = await this.sendEmailNotification(notification);
          break;
        case 'in_app':
          // In-app notifications are automatically "delivered" when created
          success = true;
          break;
        case 'sms':
          success = await this.sendSmsNotification(notification);
          break;
        case 'push':
          success = await this.sendPushNotification(notification);
          break;
      }

      // Update notification status
      await db
        .update(notificationsTable)
        .set({
          status: success ? 'sent' : 'failed',
          sentAt: success ? new Date() : undefined,
          failedAt: !success ? new Date() : undefined,
          errorMessage: errorMessage,
          retryCount: sql`${notificationsTable.retryCount} + 1`,
          nextRetryAt: !success && notification.retryCount < NOTIFICATION_CONFIG.maxRetries 
            ? new Date(Date.now() + NOTIFICATION_CONFIG.retryDelayMinutes * 60 * 1000)
            : undefined,
          updatedAt: new Date(),
        })
        .where(eq(notificationsTable.id, notificationId));

      return success;
    } catch (error) {
      console.error('Failed to process notification:', error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: any): Promise<boolean> {
    try {
      if (!notification.recipientEmail) {
        throw new Error('No recipient email');
      }

      const result = await emailService.send({
        to: notification.recipientEmail,
        subject: notification.subject || notification.title,
        html: notification.htmlContent || this.generateBasicEmailHtml(notification),
      });

      // Store provider message ID
      if (result.id) {
        await db
          .update(notificationsTable)
          .set({
            providerMessageId: result.id,
            provider: 'resend',
          })
          .where(eq(notificationsTable.id, notification.id));
      }

      return result.success;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  /**
   * Send SMS notification (placeholder - integrate with Twilio)
   */
  private async sendSmsNotification(notification: any): Promise<boolean> {
    try {
      // TODO: Integrate with Twilio or other SMS provider
      console.log('SMS notification would be sent:', notification);
      return false; // Return false until SMS is implemented
    } catch (error) {
      console.error('Failed to send SMS notification:', error);
      return false;
    }
  }

  /**
   * Send push notification (placeholder - integrate with Firebase)
   */
  private async sendPushNotification(notification: any): Promise<boolean> {
    try {
      // TODO: Integrate with Firebase Cloud Messaging
      console.log('Push notification would be sent:', notification);
      return false; // Return false until push is implemented
    } catch (error) {
      console.error('Failed to send push notification:', error);
      return false;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const [preferences] = await db
      .select()
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId))
      .limit(1);

    return preferences || null;
  }

  /**
   * Create default notification preferences for a user
   */
  async createDefaultPreferences(userId: string) {
    return await db
      .insert(notificationPreferencesTable)
      .values({
        userId,
        emailUnsubscribeToken: createId(),
      })
      .returning();
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, updates: Partial<NotificationPreferences>) {
    return await db
      .update(notificationPreferencesTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferencesTable.userId, userId))
      .returning();
  }

  /**
   * Check if a channel is enabled for a notification type
   */
  private isChannelEnabled(
    preferences: NotificationPreferences | null,
    channel: string,
    notificationType: string
  ): boolean {
    if (!preferences) return true; // Default to enabled if no preferences

    // Check channel-level preference
    const channelEnabled = {
      email: preferences.emailEnabled,
      in_app: preferences.inAppEnabled,
      sms: preferences.smsEnabled,
      push: preferences.pushEnabled,
    }[channel] ?? true;

    if (!channelEnabled) return false;

    // Check category-level preference
    const categoryMap: Record<string, keyof NotificationPreferences> = {
      payment_received: 'paymentNotifications',
      payment_failed: 'paymentNotifications',
      points_earned: 'loyaltyNotifications',
      points_redeemed: 'loyaltyNotifications',
      group_booking_invitation: 'groupBookingNotifications',
      price_drop_alert: 'priceAlertNotifications',
      referral_success: 'referralNotifications',
      booking_confirmed: 'bookingNotifications',
      review_request: 'reviewNotifications',
    };

    const categoryKey = categoryMap[notificationType];
    if (categoryKey && preferences[categoryKey] === false) {
      return false;
    }

    return true;
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences | null): boolean {
    if (!preferences?.quietHoursEnabled) return false;
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return false;

    const now = new Date();
    const currentHour = now.getUTCHours(); // Using UTC for simplicity

    const start = preferences.quietHoursStart;
    const end = preferences.quietHoursEnd;

    if (start <= end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Quiet hours span midnight
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Get next available time after quiet hours
   */
  private getNextAvailableTime(preferences: NotificationPreferences | null): Date {
    if (!preferences?.quietHoursEnabled || !preferences.quietHoursEnd) {
      return new Date();
    }

    const now = new Date();
    const currentHour = now.getUTCHours();
    const endHour = preferences.quietHoursEnd;

    if (currentHour < endHour) {
      // Set to end of quiet hours today
      const nextTime = new Date(now);
      nextTime.setUTCHours(endHour, 0, 0, 0);
      return nextTime;
    } else {
      // Set to end of quiet hours tomorrow
      const nextTime = new Date(now);
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setUTCHours(endHour, 0, 0, 0);
      return nextTime;
    }
  }

  /**
   * Queue a notification for later delivery
   */
  private async queueNotification(notification: Omit<NewNotification, 'id' | 'createdAt' | 'updatedAt'> & { scheduledFor?: Date }) {
    const inserted = await db
      .insert(notificationsTable)
      .values({
        ...notification,
        status: 'pending',
      })
      .returning();

    if (inserted[0]) {
      await db
        .insert(notificationQueueTable)
        .values({
          notificationId: inserted[0].id,
          priority: notification.priority || 'medium',
          scheduledFor: notification.scheduledFor || new Date(),
        });
    }

    return inserted[0];
  }

  /**
   * Process template with data
   */
  private async processTemplate(templateCode: string, data: Record<string, any>) {
    const [template] = await db
      .select()
      .from(notificationTemplatesTable)
      .where(and(
        eq(notificationTemplatesTable.code, templateCode),
        eq(notificationTemplatesTable.isActive, true)
      ))
      .limit(1);

    if (!template) {
      throw new Error(`Template ${templateCode} not found`);
    }

    // Simple template replacement
    let title = template.titleTemplate;
    let body = template.bodyTemplate;
    let subject = template.subjectTemplate || title;

    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return { title, body, subject };
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHtml(
    content: { title: string; body: string },
    metadata: Record<string, any>,
    actionUrl?: string,
    actionText?: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${content.title}</h1>
            </div>
            <div class="content">
              <p>${content.body}</p>
              ${actionUrl ? `
                <center>
                  <a href="${actionUrl}" class="button">${actionText || 'View Details'}</a>
                </center>
              ` : ''}
            </div>
            <div class="footer">
              <p>Ecosystem Marketplace - Your trusted marketplace</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/notifications/preferences">Manage notification preferences</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate basic email HTML for notifications without templates
   */
  private generateBasicEmailHtml(notification: any): string {
    return this.generateEmailHtml(
      { title: notification.title, body: notification.body },
      notification.metadata || {},
      notification.actionUrl,
      notification.actionText
    );
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return await db
      .update(notificationsTable)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, userId)
      ))
      .returning();
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return await db
      .update(notificationsTable)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.channel, 'in_app'),
        isNull(notificationsTable.readAt)
      ));
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.channel, 'in_app'),
        isNull(notificationsTable.readAt)
      ));

    return Number(result[0]?.count || 0);
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options: {
      channel?: 'email' | 'in_app' | 'sms' | 'push';
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { channel = 'in_app', unreadOnly = false, limit = 50, offset = 0 } = options;

    const conditions = [
      eq(notificationsTable.userId, userId),
      eq(notificationsTable.channel, channel as any),
    ];

    if (unreadOnly) {
      conditions.push(isNull(notificationsTable.readAt));
    }

    return await db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Delete old notifications
   */
  async deleteExpiredNotifications() {
    return await db
      .delete(notificationsTable)
      .where(or(
        lte(notificationsTable.expiresAt, new Date()),
        and(
          eq(notificationsTable.status, 'read'),
          lte(notificationsTable.readAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      ));
  }

  /**
   * Process notification queue
   */
  async processQueue() {
    const queueItems = await db
      .select()
      .from(notificationQueueTable)
      .where(and(
        eq(notificationQueueTable.status, 'pending'),
        lte(notificationQueueTable.scheduledFor, new Date())
      ))
      .orderBy(asc(notificationQueueTable.priority), asc(notificationQueueTable.scheduledFor))
      .limit(NOTIFICATION_CONFIG.batchSize);

    for (const item of queueItems) {
      if (item.notificationId) {
        await this.processNotification(item.notificationId);
      }
    }
  }

  /**
   * Create price alert
   */
  async createPriceAlert(
    userId: string,
    providerId: string,
    serviceId: string,
    targetPrice?: number,
    percentageDrop?: number
  ) {
    return await db
      .insert(priceAlertsTable)
      .values({
        userId,
        providerId: providerId as any,
        serviceId,
        targetPriceCents: targetPrice,
        percentageDropThreshold: percentageDrop,
      })
      .returning();
  }

  /**
   * Check and trigger price alerts
   */
  async checkPriceAlerts(providerId: string, serviceId: string, currentPrice: number) {
    const alerts = await db
      .select()
      .from(priceAlertsTable)
      .where(and(
        eq(priceAlertsTable.providerId, providerId as any),
        eq(priceAlertsTable.serviceId, serviceId),
        eq(priceAlertsTable.isActive, true)
      ));

    for (const alert of alerts) {
      let shouldTrigger = false;

      if (alert.targetPriceCents && currentPrice <= alert.targetPriceCents) {
        shouldTrigger = true;
      }

      // TODO: Check percentage drop based on price history

      if (shouldTrigger) {
        await this.sendNotification({
          userId: alert.userId,
          type: 'price_drop_alert',
          title: 'Price Drop Alert!',
          body: `The service you're watching is now available at $${(currentPrice / 100).toFixed(2)}`,
          metadata: {
            providerId,
            serviceId,
            currentPrice,
            targetPrice: alert.targetPriceCents,
          },
          priority: 'high',
        });

        // Update alert
        await db
          .update(priceAlertsTable)
          .set({
            lastTriggeredAt: new Date(),
            triggerCount: sql`${priceAlertsTable.triggerCount} + 1`,
          })
          .where(eq(priceAlertsTable.id, alert.id));
      }
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();