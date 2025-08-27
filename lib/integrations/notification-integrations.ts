/**
 * Notification System Integrations
 * 
 * Examples of how to integrate the notification system with marketplace events
 * Shows proper usage patterns and best practices
 */

import { 
  subscriptionNotifications,
  paymentNotifications,
  loyaltyNotifications,
  groupBookingNotifications,
  priceAlertNotifications,
  referralNotifications,
  bookingNotifications,
  reviewNotifications,
  specialOfferNotifications
} from '@/lib/services/marketplace-notifications';

/**
 * Integration with subscription lifecycle
 */
export class SubscriptionIntegration {
  /**
   * Handle subscription creation
   */
  static async onSubscriptionCreated(data: {
    userId: string;
    subscriptionId: string;
    planName: string;
    providerName: string;
    renewalDate: Date;
    amount: number;
  }) {
    try {
      // Send confirmation notification
      await subscriptionNotifications.confirmed(data.userId, {
        planName: data.planName,
        providerName: data.providerName,
        renewalDate: data.renewalDate,
        amount: data.amount,
      });

      // Award loyalty points for subscription
      await loyaltyNotifications.pointsEarned(data.userId, {
        points: Math.floor(data.amount / 100), // 1 point per dollar
        activity: 'subscription signup',
        totalPoints: Math.floor(data.amount / 100), // Assuming first subscription
      });

      console.log(`Subscription notifications sent for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to send subscription notifications:', error);
    }
  }

  /**
   * Handle subscription renewal
   */
  static async onSubscriptionRenewed(data: {
    userId: string;
    subscriptionId: string;
    planName: string;
    nextRenewalDate: Date;
    amount: number;
  }) {
    try {
      // Send renewal notification
      await subscriptionNotifications.renewed(data.userId, {
        planName: data.planName,
        nextRenewalDate: data.nextRenewalDate,
        amount: data.amount,
      });

      // Award renewal points
      await loyaltyNotifications.pointsEarned(data.userId, {
        points: Math.floor(data.amount / 200), // 0.5 points per dollar for renewals
        activity: 'subscription renewal',
        totalPoints: 0, // Would need to query actual total
      });

      console.log(`Subscription renewal notifications sent for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to send subscription renewal notifications:', error);
    }
  }

  /**
   * Check for expiring subscriptions (run daily)
   */
  static async checkExpiringSubscriptions() {
    // This would typically query the database for subscriptions expiring in 3, 7, 30 days
    // For demo purposes, showing the notification structure
    
    const expiringSubscriptions = [
      {
        userId: 'user_123',
        planName: 'Premium Fitness Plan',
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        daysRemaining: 3
      }
    ];

    for (const subscription of expiringSubscriptions) {
      try {
        await subscriptionNotifications.expiring(subscription.userId, {
          planName: subscription.planName,
          expiryDate: subscription.expiryDate,
          daysRemaining: subscription.daysRemaining,
        });
      } catch (error) {
        console.error(`Failed to send expiry notification for ${subscription.userId}:`, error);
      }
    }
  }
}

/**
 * Integration with payment processing
 */
export class PaymentIntegration {
  /**
   * Handle successful payment
   */
  static async onPaymentSucceeded(data: {
    userId: string;
    paymentIntentId: string;
    amount: number;
    serviceName: string;
    bookingId?: string;
  }) {
    try {
      // Send payment receipt
      await paymentNotifications.receipt(data.userId, {
        amount: data.amount / 100, // Convert from cents
        serviceName: data.serviceName,
        transactionId: data.paymentIntentId,
      });

      // Award points for payment
      const points = Math.floor(data.amount / 100); // 1 point per dollar
      await loyaltyNotifications.pointsEarned(data.userId, {
        points,
        activity: 'booking payment',
        totalPoints: 0, // Would query actual total
      });

      // Send booking confirmation if this is for a booking
      if (data.bookingId) {
        await bookingNotifications.confirmed(data.userId, {
          serviceName: data.serviceName,
          bookingDate: new Date(), // Would get actual booking date
          bookingTime: '2:00 PM - 3:00 PM', // Would get actual time
          bookingUrl: `/bookings/${data.bookingId}`,
        });
      }

      console.log(`Payment success notifications sent for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to send payment success notifications:', error);
    }
  }

  /**
   * Handle payment failure
   */
  static async onPaymentFailed(data: {
    userId: string;
    serviceName: string;
    errorMessage: string;
    retryUrl: string;
  }) {
    try {
      await paymentNotifications.failed(data.userId, {
        serviceName: data.serviceName,
        errorMessage: data.errorMessage,
        retryUrl: data.retryUrl,
      });

      console.log(`Payment failure notifications sent for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to send payment failure notifications:', error);
    }
  }

  /**
   * Handle refund processed
   */
  static async onRefundProcessed(data: {
    userId: string;
    refundAmount: number;
    serviceName: string;
    refundId: string;
  }) {
    try {
      await paymentNotifications.refunded(data.userId, {
        refundAmount: data.refundAmount / 100,
        serviceName: data.serviceName,
        refundId: data.refundId,
      });

      console.log(`Refund notifications sent for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to send refund notifications:', error);
    }
  }
}

/**
 * Integration with loyalty program
 */
export class LoyaltyIntegration {
  /**
   * Handle tier upgrade
   */
  static async onTierUpgraded(data: {
    userId: string;
    newTier: string;
    benefits: string[];
  }) {
    try {
      await loyaltyNotifications.tierUpgraded(data.userId, {
        tierName: data.newTier,
        benefits: data.benefits,
      });

      // Send special offer for new tier
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await specialOfferNotifications.tierOffer(data.userId, {
        tierName: data.newTier,
        offerDetails: `20% off your next booking as a welcome to ${data.newTier} tier`,
        expiryDate,
        offerUrl: '/marketplace?discount=TIER20',
      });

      console.log(`Tier upgrade notifications sent for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to send tier upgrade notifications:', error);
    }
  }

  /**
   * Check for expiring points (run weekly)
   */
  static async checkExpiringPoints() {
    // This would query the database for points expiring soon
    const expiringPoints = [
      {
        userId: 'user_123',
        points: 500,
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }
    ];

    for (const pointsData of expiringPoints) {
      try {
        await loyaltyNotifications.pointsExpiring(pointsData.userId, {
          points: pointsData.points,
          expiryDate: pointsData.expiryDate,
        });
      } catch (error) {
        console.error(`Failed to send points expiry notification for ${pointsData.userId}:`, error);
      }
    }
  }
}

/**
 * Integration with group bookings
 */
export class GroupBookingIntegration {
  /**
   * Handle group booking invitation
   */
  static async onInvitationSent(data: {
    inviteeUserId: string;
    organizerName: string;
    serviceName: string;
    bookingDate: Date;
    invitationId: string;
  }) {
    try {
      await groupBookingNotifications.invitation(data.inviteeUserId, {
        organizerName: data.organizerName,
        serviceName: data.serviceName,
        bookingDate: data.bookingDate,
        acceptUrl: `/group-bookings/${data.invitationId}/accept`,
      });

      console.log(`Group booking invitation sent to user ${data.inviteeUserId}`);
    } catch (error) {
      console.error('Failed to send group booking invitation:', error);
    }
  }

  /**
   * Handle group booking confirmation
   */
  static async onGroupBookingConfirmed(data: {
    participantUserIds: string[];
    serviceName: string;
    bookingDate: Date;
    participantCount: number;
  }) {
    try {
      // Notify all participants
      const notifications = data.participantUserIds.map(userId =>
        groupBookingNotifications.confirmed(userId, {
          serviceName: data.serviceName,
          bookingDate: data.bookingDate,
          participantCount: data.participantCount,
        })
      );

      await Promise.all(notifications);
      console.log(`Group booking confirmation sent to ${data.participantUserIds.length} participants`);
    } catch (error) {
      console.error('Failed to send group booking confirmations:', error);
    }
  }

  /**
   * Handle new member joining group
   */
  static async onMemberJoined(data: {
    organizerUserId: string;
    newMemberName: string;
    serviceName: string;
    spotsRemaining: number;
  }) {
    try {
      await groupBookingNotifications.memberJoined(data.organizerUserId, {
        memberName: data.newMemberName,
        serviceName: data.serviceName,
        spotsRemaining: data.spotsRemaining,
      });

      console.log(`Group member joined notification sent to organizer ${data.organizerUserId}`);
    } catch (error) {
      console.error('Failed to send group member joined notification:', error);
    }
  }
}

/**
 * Integration with price monitoring
 */
export class PriceMonitoringIntegration {
  /**
   * Check price changes and send alerts
   */
  static async checkPriceChanges(data: {
    providerId: string;
    serviceId: string;
    oldPrice: number;
    newPrice: number;
    serviceName: string;
    providerName: string;
  }) {
    try {
      // This would query the database for users with price alerts for this service
      const usersWithAlerts = [
        {
          userId: 'user_123',
          targetPrice: data.newPrice + 1000, // User wanted alert when price drops below this
        }
      ];

      for (const userAlert of usersWithAlerts) {
        if (data.newPrice <= userAlert.targetPrice) {
          await priceAlertNotifications.priceDrop(userAlert.userId, {
            serviceName: data.serviceName,
            providerName: data.providerName,
            newPrice: data.newPrice / 100,
            oldPrice: data.oldPrice / 100,
            bookingUrl: `/providers/${data.providerId}/services/${data.serviceId}`,
          });
        }
      }

      console.log(`Price alert notifications sent for service ${data.serviceId}`);
    } catch (error) {
      console.error('Failed to send price alert notifications:', error);
    }
  }

  /**
   * Send flash sale notifications
   */
  static async sendFlashSaleNotifications(data: {
    serviceName: string;
    providerName: string;
    discount: number;
    endTime: Date;
    targetUserIds: string[];
    bookingUrl: string;
  }) {
    try {
      const notifications = data.targetUserIds.map(userId =>
        priceAlertNotifications.flashSale(userId, {
          serviceName: data.serviceName,
          providerName: data.providerName,
          discount: data.discount,
          endTime: data.endTime,
          bookingUrl: data.bookingUrl,
        })
      );

      await Promise.all(notifications);
      console.log(`Flash sale notifications sent to ${data.targetUserIds.length} users`);
    } catch (error) {
      console.error('Failed to send flash sale notifications:', error);
    }
  }
}

/**
 * Integration with referral program
 */
export class ReferralIntegration {
  /**
   * Handle successful referral
   */
  static async onReferralCompleted(data: {
    referrerUserId: string;
    referredUserId: string;
    referredName: string;
    rewardAmount: string;
    rewardType: string;
  }) {
    try {
      // Notify referrer about success
      await referralNotifications.success(data.referrerUserId, {
        referredName: data.referredName,
        rewardAmount: data.rewardAmount,
        rewardType: data.rewardType,
      });

      // Award loyalty points to referrer
      const points = data.rewardType === 'points' ? parseInt(data.rewardAmount) : 100; // Default 100 points
      await loyaltyNotifications.pointsEarned(data.referrerUserId, {
        points,
        activity: 'successful referral',
        totalPoints: 0, // Would query actual total
      });

      console.log(`Referral success notifications sent to user ${data.referrerUserId}`);
    } catch (error) {
      console.error('Failed to send referral success notifications:', error);
    }
  }
}

/**
 * Integration with review system
 */
export class ReviewIntegration {
  /**
   * Request review after booking completion
   */
  static async requestReviewAfterBooking(data: {
    userId: string;
    bookingId: string;
    serviceName: string;
    providerName: string;
  }) {
    try {
      // Wait 1 hour after booking completion before requesting review
      setTimeout(async () => {
        await reviewNotifications.request(data.userId, {
          serviceName: data.serviceName,
          providerName: data.providerName,
          reviewUrl: `/bookings/${data.bookingId}/review`,
        });
      }, 60 * 60 * 1000); // 1 hour

      console.log(`Review request scheduled for user ${data.userId}`);
    } catch (error) {
      console.error('Failed to schedule review request:', error);
    }
  }
}

/**
 * Integration with booking reminders
 */
export class BookingReminderIntegration {
  /**
   * Send booking reminders
   */
  static async sendBookingReminders() {
    // This would query the database for bookings happening in the next 24 hours
    const upcomingBookings = [
      {
        userId: 'user_123',
        bookingId: 'booking_456',
        serviceName: 'Personal Training',
        providerName: 'John Doe',
        bookingTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      }
    ];

    for (const booking of upcomingBookings) {
      try {
        await bookingNotifications.reminder(booking.userId, {
          serviceName: booking.serviceName,
          providerName: booking.providerName,
          timeUntil: 'tomorrow',
          bookingUrl: `/bookings/${booking.bookingId}`,
        });
      } catch (error) {
        console.error(`Failed to send booking reminder for ${booking.bookingId}:`, error);
      }
    }
  }
}

/**
 * Utility functions for notification management
 */
export class NotificationUtils {
  /**
   * Send welcome series for new users
   */
  static async sendWelcomeSeries(userId: string, userType: 'customer' | 'provider') {
    try {
      // Send immediate welcome notification
      // (This would use the existing welcome email from email service)
      
      // Schedule follow-up notifications
      setTimeout(async () => {
        if (userType === 'customer') {
          await loyaltyNotifications.pointsEarned(userId, {
            points: 100,
            activity: 'welcome bonus',
            totalPoints: 100,
          });
        }
      }, 24 * 60 * 60 * 1000); // 24 hours later

      console.log(`Welcome series initiated for ${userType} ${userId}`);
    } catch (error) {
      console.error('Failed to send welcome series:', error);
    }
  }

  /**
   * Send digest notifications
   */
  static async sendDigests(type: 'daily' | 'weekly') {
    // This would query users who have digest notifications enabled
    const digestUsers = [
      { userId: 'user_123', preferences: { dailyDigest: true, weeklyDigest: true } }
    ];

    for (const user of digestUsers) {
      if ((type === 'daily' && user.preferences.dailyDigest) ||
          (type === 'weekly' && user.preferences.weeklyDigest)) {
        
        try {
          // Get user's recent notifications for digest
          // Send compiled digest email
          console.log(`${type} digest sent to user ${user.userId}`);
        } catch (error) {
          console.error(`Failed to send ${type} digest to ${user.userId}:`, error);
        }
      }
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications() {
    try {
      // This would use the cleanup function from notification queries
      console.log('Notification cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup notifications:', error);
    }
  }
}

// Export all integrations
export const notificationIntegrations = {
  SubscriptionIntegration,
  PaymentIntegration,
  LoyaltyIntegration,
  GroupBookingIntegration,
  PriceMonitoringIntegration,
  ReferralIntegration,
  ReviewIntegration,
  BookingReminderIntegration,
  NotificationUtils,
};