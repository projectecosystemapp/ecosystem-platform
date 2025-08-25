/**
 * Notification Service
 * 
 * Handles all notifications for the booking system including email, SMS, and in-app notifications.
 * Integrates with various notification providers and manages notification queues.
 */

import { db } from '@/db/db';
import { bookingRemindersTable } from '@/db/schema/enhanced-booking-schema';
import { eq } from 'drizzle-orm';

// Notification types
export enum NotificationType {
  // Booking notifications
  BOOKING_CREATED = 'booking_created',
  BOOKING_ACCEPTED = 'booking_accepted',
  BOOKING_REJECTED = 'booking_rejected',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_COMPLETED = 'booking_completed',
  
  // Payment notifications
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  REFUND_PROCESSED = 'refund_processed',
  
  // Payout notifications
  PAYOUT_COMPLETED = 'payout_completed',
  PAYOUT_FAILED = 'payout_failed',
  
  // Reminder notifications
  SERVICE_REMINDER = 'service_reminder',
  REVIEW_REMINDER = 'review_reminder',
  PAYMENT_REMINDER = 'payment_reminder'
}

// Notification priority
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Base notification interface
interface BaseNotification {
  type: NotificationType;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientId?: string;
  priority?: NotificationPriority;
  metadata?: Record<string, any>;
}

// Notification queue item
interface NotificationQueueItem extends BaseNotification {
  id?: string;
  bookingId?: string;
  createdAt: Date;
  scheduledFor?: Date;
  attempts?: number;
  lastAttemptAt?: Date;
  status?: 'pending' | 'sent' | 'failed';
}

export class NotificationService {
  private notificationQueue: NotificationQueueItem[] = [];
  
  /**
   * Queue a notification for processing
   */
  async queue(notification: Partial<NotificationQueueItem>): Promise<void> {
    const queueItem: NotificationQueueItem = {
      type: notification.type || NotificationType.BOOKING_CREATED,
      createdAt: notification.createdAt || new Date(),
      priority: notification.priority || NotificationPriority.NORMAL,
      status: 'pending',
      attempts: 0,
      ...notification
    };
    
    this.notificationQueue.push(queueItem);
    
    // Process immediately if high priority
    if (queueItem.priority === NotificationPriority.HIGH || 
        queueItem.priority === NotificationPriority.URGENT) {
      await this.processNotification(queueItem);
    }
  }
  
  /**
   * Send booking accepted notification
   */
  async sendBookingAcceptedNotification(data: {
    bookingId: string;
    customerId?: string;
    guestEmail?: string;
    providerName: string;
    estimatedArrivalTime?: string;
    specialInstructions?: string;
    bookingDate: Date;
    startTime: string;
    serviceName: string;
  }): Promise<void> {
    const email = data.guestEmail || await this.getCustomerEmail(data.customerId);
    
    await this.sendEmail({
      to: email,
      subject: `Booking Accepted - ${data.serviceName}`,
      template: 'booking-accepted',
      data: {
        providerName: data.providerName,
        serviceName: data.serviceName,
        bookingDate: data.bookingDate.toLocaleDateString(),
        startTime: data.startTime,
        estimatedArrivalTime: data.estimatedArrivalTime,
        specialInstructions: data.specialInstructions,
        paymentLink: `/bookings/${data.bookingId}/payment`
      }
    });
    
    console.log('Booking accepted notification sent:', data.bookingId);
  }
  
  /**
   * Send booking rejected notification
   */
  async sendBookingRejectedNotification(data: {
    bookingId: string;
    customerId?: string;
    guestEmail?: string;
    providerName: string;
    rejectionReason: string;
    suggestAlternative?: boolean;
    alternativeDates?: string[];
    additionalNotes?: string;
    refundInfo?: any;
    bookingDate: Date;
    startTime: string;
    serviceName: string;
  }): Promise<void> {
    const email = data.guestEmail || await this.getCustomerEmail(data.customerId);
    
    await this.sendEmail({
      to: email,
      subject: `Booking Update - ${data.serviceName}`,
      template: 'booking-rejected',
      data: {
        providerName: data.providerName,
        serviceName: data.serviceName,
        bookingDate: data.bookingDate.toLocaleDateString(),
        startTime: data.startTime,
        rejectionReason: data.rejectionReason,
        suggestAlternative: data.suggestAlternative,
        alternativeDates: data.alternativeDates,
        additionalNotes: data.additionalNotes,
        refundInfo: data.refundInfo,
        searchLink: '/providers/search'
      }
    });
    
    console.log('Booking rejected notification sent:', data.bookingId);
  }
  
  /**
   * Send booking completed notification
   */
  async sendBookingCompletedNotification(data: {
    bookingId: string;
    customerId?: string;
    guestEmail?: string;
    providerName: string;
    serviceName: string;
    completionNotes?: string;
    payoutDate: Date;
    reviewLink: string;
  }): Promise<void> {
    const email = data.guestEmail || await this.getCustomerEmail(data.customerId);
    
    await this.sendEmail({
      to: email,
      subject: `Service Completed - ${data.serviceName}`,
      template: 'booking-completed',
      data: {
        providerName: data.providerName,
        serviceName: data.serviceName,
        completionNotes: data.completionNotes,
        reviewLink: data.reviewLink,
        supportLink: '/support'
      }
    });
    
    console.log('Booking completed notification sent:', data.bookingId);
  }
  
  /**
   * Send booking cancelled notification
   */
  async sendBookingCancelledNotification(data: {
    bookingId: string;
    customerId?: string;
    guestEmail?: string;
    providerId: string;
    providerName: string;
    cancelledBy: 'customer' | 'provider';
    reason: string;
    refundAmount?: number;
    refundPercentage?: number;
    bookingDate: Date;
    startTime: string;
    serviceName: string;
  }): Promise<void> {
    const customerEmail = data.guestEmail || await this.getCustomerEmail(data.customerId);
    const providerEmail = await this.getProviderEmail(data.providerId);
    
    // Send to customer
    if (customerEmail) {
      await this.sendEmail({
        to: customerEmail,
        subject: `Booking Cancelled - ${data.serviceName}`,
        template: 'booking-cancelled-customer',
        data: {
          serviceName: data.serviceName,
          bookingDate: data.bookingDate.toLocaleDateString(),
          startTime: data.startTime,
          cancelledBy: data.cancelledBy,
          reason: data.reason,
          refundAmount: data.refundAmount,
          refundPercentage: data.refundPercentage
        }
      });
    }
    
    // Send to provider
    if (providerEmail) {
      await this.sendEmail({
        to: providerEmail,
        subject: `Booking Cancelled - ${data.serviceName}`,
        template: 'booking-cancelled-provider',
        data: {
          serviceName: data.serviceName,
          bookingDate: data.bookingDate.toLocaleDateString(),
          startTime: data.startTime,
          cancelledBy: data.cancelledBy,
          reason: data.reason
        }
      });
    }
    
    console.log('Booking cancelled notifications sent:', data.bookingId);
  }
  
  /**
   * Send payout completed notification
   */
  async sendPayoutCompletedNotification(data: {
    providerId: string;
    providerEmail: string;
    amount: number;
    bookingId: string;
    serviceName: string;
    transferId: string;
    arrivalEstimate: string;
  }): Promise<void> {
    await this.sendEmail({
      to: data.providerEmail,
      subject: 'Payout Processed Successfully',
      template: 'payout-completed',
      data: {
        amount: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(data.amount),
        bookingId: data.bookingId,
        serviceName: data.serviceName,
        transferId: data.transferId,
        arrivalEstimate: data.arrivalEstimate,
        dashboardLink: '/provider/payouts'
      }
    });
    
    console.log('Payout completed notification sent:', data.providerId);
  }
  
  /**
   * Send payout failed notification
   */
  async sendPayoutFailedNotification(data: {
    payoutId: string;
    providerId: string;
    amount: number;
    reason: string;
    supportUrl: string;
  }): Promise<void> {
    const providerEmail = await this.getProviderEmail(data.providerId);
    
    if (providerEmail) {
      await this.sendEmail({
        to: providerEmail,
        subject: 'Payout Processing Issue',
        template: 'payout-failed',
        data: {
          amount: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(data.amount),
          reason: data.reason,
          supportUrl: data.supportUrl,
          payoutId: data.payoutId
        }
      });
    }
    
    console.log('Payout failed notification sent:', data.providerId);
  }
  
  /**
   * Process scheduled reminders
   */
  async processScheduledReminders(): Promise<number> {
    const now = new Date();
    let processedCount = 0;
    
    try {
      // Get due reminders
      const dueReminders = await db
        .select()
        .from(bookingRemindersTable)
        .where(
          eq(bookingRemindersTable.status, 'scheduled')
        )
        .limit(50);
      
      for (const reminder of dueReminders) {
        if (reminder.scheduledAt <= now) {
          await this.sendReminder(reminder);
          
          // Update reminder status
          await db
            .update(bookingRemindersTable)
            .set({
              status: 'sent',
              sentAt: new Date()
            })
            .where(eq(bookingRemindersTable.id, reminder.id));
          
          processedCount++;
        }
      }
      
      return processedCount;
      
    } catch (error) {
      console.error('Error processing reminders:', error);
      return processedCount;
    }
  }
  
  /**
   * Private helper methods
   */
  
  private async processNotification(notification: NotificationQueueItem): Promise<void> {
    try {
      // Process based on notification type
      switch (notification.type) {
        case NotificationType.BOOKING_CREATED:
        case NotificationType.BOOKING_ACCEPTED:
        case NotificationType.PAYMENT_CONFIRMED:
          // Send immediate notifications
          if (notification.recipientEmail) {
            await this.sendEmail({
              to: notification.recipientEmail,
              subject: this.getNotificationSubject(notification.type),
              template: notification.type,
              data: notification.metadata
            });
          }
          break;
          
        default:
          console.log('Processing notification:', notification.type);
      }
      
      // Mark as sent
      notification.status = 'sent';
      
    } catch (error) {
      console.error('Failed to process notification:', error);
      notification.status = 'failed';
      notification.attempts = (notification.attempts || 0) + 1;
      notification.lastAttemptAt = new Date();
    }
  }
  
  private async sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }): Promise<void> {
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    console.log('Sending email:', {
      to: params.to,
      subject: params.subject,
      template: params.template
    });
    
    // For now, just log the email
    // In production, this would call the actual email service
  }
  
  private async sendSMS(params: {
    to: string;
    message: string;
  }): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log('Sending SMS:', {
      to: params.to,
      message: params.message
    });
  }
  
  private async sendReminder(reminder: any): Promise<void> {
    // Send reminder based on type and delivery method
    console.log('Sending reminder:', reminder);
    
    // TODO: Implement actual reminder sending logic
  }
  
  private async getCustomerEmail(customerId?: string): Promise<string> {
    // TODO: Fetch customer email from database
    return customerId ? `customer-${customerId}@example.com` : '';
  }
  
  private async getProviderEmail(providerId: string): Promise<string> {
    // TODO: Fetch provider email from database
    return `provider-${providerId}@example.com`;
  }
  
  private getNotificationSubject(type: NotificationType): string {
    const subjects: Record<NotificationType, string> = {
      [NotificationType.BOOKING_CREATED]: 'New Booking Request',
      [NotificationType.BOOKING_ACCEPTED]: 'Booking Accepted',
      [NotificationType.BOOKING_REJECTED]: 'Booking Update',
      [NotificationType.BOOKING_CANCELLED]: 'Booking Cancelled',
      [NotificationType.BOOKING_COMPLETED]: 'Service Completed',
      [NotificationType.PAYMENT_CONFIRMED]: 'Payment Confirmed',
      [NotificationType.PAYMENT_FAILED]: 'Payment Failed',
      [NotificationType.REFUND_PROCESSED]: 'Refund Processed',
      [NotificationType.PAYOUT_COMPLETED]: 'Payout Completed',
      [NotificationType.PAYOUT_FAILED]: 'Payout Failed',
      [NotificationType.SERVICE_REMINDER]: 'Upcoming Service Reminder',
      [NotificationType.REVIEW_REMINDER]: 'Leave a Review',
      [NotificationType.PAYMENT_REMINDER]: 'Complete Your Payment'
    };
    
    return subjects[type] || 'Notification';
  }
  
  /**
   * Process notification queue
   */
  async processQueue(): Promise<void> {
    const pendingNotifications = this.notificationQueue.filter(n => n.status === 'pending');
    
    for (const notification of pendingNotifications) {
      await this.processNotification(notification);
    }
    
    // Clean up processed notifications
    this.notificationQueue = this.notificationQueue.filter(n => n.status === 'pending');
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

// Export types
export type { NotificationQueueItem, BaseNotification };