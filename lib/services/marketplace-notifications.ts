/**
 * Marketplace Notifications
 * 
 * High-level notification helpers for all marketplace events
 * Provides easy-to-use functions for common notification scenarios
 */

import { notificationService } from './notification-service';
import { format, addDays } from 'date-fns';

/**
 * Subscription-related notifications
 */
export const subscriptionNotifications = {
  /**
   * Notify user about subscription confirmation
   */
  async confirmed(userId: string, data: {
    planName: string;
    providerName: string;
    renewalDate: Date;
    amount: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'subscription_confirmed',
      title: `Welcome to ${data.planName}!`,
      body: `Your subscription to ${data.planName} with ${data.providerName} has been confirmed.`,
      metadata: {
        planName: data.planName,
        providerName: data.providerName,
        renewalDate: data.renewalDate.toISOString(),
        amount: data.amount,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'subscription_confirmed',
      templateData: {
        customerName: 'Customer', // TODO: Get actual name
        planName: data.planName,
        providerName: data.providerName,
        renewalDate: format(data.renewalDate, 'MMMM d, yyyy'),
      },
    });
  },

  /**
   * Notify user about subscription renewal
   */
  async renewed(userId: string, data: {
    planName: string;
    nextRenewalDate: Date;
    amount: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'subscription_renewed',
      title: 'Subscription Renewed',
      body: `Your subscription to ${data.planName} has been successfully renewed.`,
      metadata: {
        planName: data.planName,
        nextRenewalDate: data.nextRenewalDate.toISOString(),
        amount: data.amount,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'subscription_renewed',
      templateData: {
        customerName: 'Customer',
        planName: data.planName,
        nextRenewalDate: format(data.nextRenewalDate, 'MMMM d, yyyy'),
        amount: data.amount.toFixed(2),
      },
    });
  },

  /**
   * Notify user about subscription expiring soon
   */
  async expiring(userId: string, data: {
    planName: string;
    expiryDate: Date;
    daysRemaining: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'subscription_expiring',
      title: `Subscription Expiring in ${data.daysRemaining} Days`,
      body: `Your subscription to ${data.planName} will expire on ${format(data.expiryDate, 'MMMM d, yyyy')}.`,
      metadata: {
        planName: data.planName,
        expiryDate: data.expiryDate.toISOString(),
        daysRemaining: data.daysRemaining,
      },
      channels: ['email', 'in_app'],
      priority: 'high',
      templateCode: 'subscription_expiring',
      templateData: {
        customerName: 'Customer',
        planName: data.planName,
        daysRemaining: data.daysRemaining,
        expiryDate: format(data.expiryDate, 'MMMM d, yyyy'),
      },
    });
  },
};

/**
 * Payment-related notifications
 */
export const paymentNotifications = {
  /**
   * Send payment receipt
   */
  async receipt(userId: string, data: {
    amount: number;
    serviceName: string;
    transactionId: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'payment_received',
      title: 'Payment Received',
      body: `We received your payment of $${data.amount.toFixed(2)} for ${data.serviceName}.`,
      metadata: {
        amount: data.amount,
        serviceName: data.serviceName,
        transactionId: data.transactionId,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'payment_receipt',
      templateData: {
        customerName: 'Customer',
        amount: data.amount.toFixed(2),
        serviceName: data.serviceName,
        transactionId: data.transactionId,
      },
    });
  },

  /**
   * Notify about payment failure
   */
  async failed(userId: string, data: {
    serviceName: string;
    errorMessage: string;
    retryUrl?: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'payment_failed',
      title: 'Payment Failed',
      body: `Your payment for ${data.serviceName} could not be processed.`,
      metadata: {
        serviceName: data.serviceName,
        errorMessage: data.errorMessage,
      },
      channels: ['email', 'in_app'],
      priority: 'high',
      actionUrl: data.retryUrl,
      actionText: 'Retry Payment',
      templateCode: 'payment_failed',
      templateData: {
        customerName: 'Customer',
        serviceName: data.serviceName,
        errorMessage: data.errorMessage,
      },
    });
  },

  /**
   * Notify about refund processed
   */
  async refunded(userId: string, data: {
    refundAmount: number;
    serviceName: string;
    refundId: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'payment_refunded',
      title: 'Refund Processed',
      body: `Your refund of $${data.refundAmount.toFixed(2)} for ${data.serviceName} has been processed.`,
      metadata: {
        refundAmount: data.refundAmount,
        serviceName: data.serviceName,
        refundId: data.refundId,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'payment_refunded',
      templateData: {
        customerName: 'Customer',
        refundAmount: data.refundAmount.toFixed(2),
        serviceName: data.serviceName,
        refundId: data.refundId,
      },
    });
  },
};

/**
 * Loyalty program notifications
 */
export const loyaltyNotifications = {
  /**
   * Notify about points earned
   */
  async pointsEarned(userId: string, data: {
    points: number;
    activity: string;
    totalPoints: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'points_earned',
      title: `🎉 ${data.points} Points Earned!`,
      body: `You earned ${data.points} points from your recent ${data.activity}.`,
      metadata: {
        points: data.points,
        activity: data.activity,
        totalPoints: data.totalPoints,
      },
      channels: ['in_app'],
      priority: 'low',
      templateCode: 'points_earned',
      templateData: {
        points: data.points,
        activity: data.activity,
        totalPoints: data.totalPoints,
      },
    });
  },

  /**
   * Notify about points redeemed
   */
  async pointsRedeemed(userId: string, data: {
    points: number;
    reward: string;
    remainingPoints: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'points_redeemed',
      title: 'Points Redeemed',
      body: `You successfully redeemed ${data.points} points for ${data.reward}.`,
      metadata: {
        points: data.points,
        reward: data.reward,
        remainingPoints: data.remainingPoints,
      },
      channels: ['in_app'],
      priority: 'low',
      templateCode: 'points_redeemed',
      templateData: {
        points: data.points,
        reward: data.reward,
        remainingPoints: data.remainingPoints,
      },
    });
  },

  /**
   * Notify about points expiring
   */
  async pointsExpiring(userId: string, data: {
    points: number;
    expiryDate: Date;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'points_expiring',
      title: 'Points Expiring Soon',
      body: `You have ${data.points} points expiring on ${format(data.expiryDate, 'MMMM d, yyyy')}.`,
      metadata: {
        points: data.points,
        expiryDate: data.expiryDate.toISOString(),
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'points_expiring',
      templateData: {
        customerName: 'Customer',
        points: data.points,
        expiryDate: format(data.expiryDate, 'MMMM d, yyyy'),
      },
    });
  },

  /**
   * Notify about tier upgrade
   */
  async tierUpgraded(userId: string, data: {
    tierName: string;
    benefits: string[];
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'tier_upgraded',
      title: `Welcome to ${data.tierName} Tier!`,
      body: `Congratulations! You have been upgraded to ${data.tierName} tier.`,
      metadata: {
        tierName: data.tierName,
        benefits: data.benefits,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'tier_upgraded',
      templateData: {
        customerName: 'Customer',
        tierName: data.tierName,
        benefits: data.benefits.join(', '),
      },
    });
  },
};

/**
 * Group booking notifications
 */
export const groupBookingNotifications = {
  /**
   * Send group booking invitation
   */
  async invitation(userId: string, data: {
    organizerName: string;
    serviceName: string;
    bookingDate: Date;
    acceptUrl: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'group_booking_invitation',
      title: 'Group Booking Invitation',
      body: `${data.organizerName} has invited you to join a group booking for ${data.serviceName}.`,
      metadata: {
        organizerName: data.organizerName,
        serviceName: data.serviceName,
        bookingDate: data.bookingDate.toISOString(),
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      actionUrl: data.acceptUrl,
      actionText: 'Accept Invitation',
      templateCode: 'group_booking_invitation',
      templateData: {
        inviteeName: 'Guest',
        organizerName: data.organizerName,
        serviceName: data.serviceName,
        bookingDate: format(data.bookingDate, 'MMMM d, yyyy'),
      },
    });
  },

  /**
   * Notify about group booking confirmation
   */
  async confirmed(userId: string, data: {
    serviceName: string;
    bookingDate: Date;
    participantCount: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'group_booking_confirmed',
      title: 'Group Booking Confirmed',
      body: `Your group booking for ${data.serviceName} has been confirmed.`,
      metadata: {
        serviceName: data.serviceName,
        bookingDate: data.bookingDate.toISOString(),
        participantCount: data.participantCount,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'group_booking_confirmed',
      templateData: {
        serviceName: data.serviceName,
        bookingDate: format(data.bookingDate, 'MMMM d, yyyy'),
        participantCount: data.participantCount,
      },
    });
  },

  /**
   * Notify about new group member joining
   */
  async memberJoined(userId: string, data: {
    memberName: string;
    serviceName: string;
    spotsRemaining: number;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'group_member_joined',
      title: 'New Group Member',
      body: `${data.memberName} has joined your group booking for ${data.serviceName}.`,
      metadata: {
        memberName: data.memberName,
        serviceName: data.serviceName,
        spotsRemaining: data.spotsRemaining,
      },
      channels: ['in_app'],
      priority: 'low',
      templateCode: 'group_member_joined',
      templateData: {
        memberName: data.memberName,
        serviceName: data.serviceName,
        spotsRemaining: data.spotsRemaining,
      },
    });
  },
};

/**
 * Price alert notifications
 */
export const priceAlertNotifications = {
  /**
   * Notify about price drop
   */
  async priceDrop(userId: string, data: {
    serviceName: string;
    providerName: string;
    newPrice: number;
    oldPrice: number;
    bookingUrl: string;
  }) {
    const savings = data.oldPrice - data.newPrice;
    const percentage = Math.round((savings / data.oldPrice) * 100);

    await notificationService.sendNotification({
      userId,
      type: 'price_drop_alert',
      title: 'Price Drop Alert!',
      body: `${data.serviceName} is now ${percentage}% off! Save $${savings.toFixed(2)}`,
      metadata: {
        serviceName: data.serviceName,
        providerName: data.providerName,
        newPrice: data.newPrice,
        oldPrice: data.oldPrice,
        savings,
        percentage,
      },
      channels: ['email', 'in_app'],
      priority: 'high',
      actionUrl: data.bookingUrl,
      actionText: 'Book Now',
      templateCode: 'price_drop_alert',
      templateData: {
        serviceName: data.serviceName,
        providerName: data.providerName,
        newPrice: data.newPrice.toFixed(2),
        oldPrice: data.oldPrice.toFixed(2),
      },
    });
  },

  /**
   * Notify about flash sale
   */
  async flashSale(userId: string, data: {
    serviceName: string;
    providerName: string;
    discount: number;
    endTime: Date;
    bookingUrl: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'flash_sale',
      title: 'Flash Sale - Limited Time!',
      body: `Get ${data.discount}% off ${data.serviceName}! Sale ends ${format(data.endTime, 'h:mm a')}.`,
      metadata: {
        serviceName: data.serviceName,
        providerName: data.providerName,
        discount: data.discount,
        endTime: data.endTime.toISOString(),
      },
      channels: ['email', 'in_app'],
      priority: 'urgent',
      actionUrl: data.bookingUrl,
      actionText: 'Get Deal',
      templateCode: 'flash_sale',
      templateData: {
        serviceName: data.serviceName,
        providerName: data.providerName,
        discount: data.discount,
        endTime: format(data.endTime, 'h:mm a'),
      },
    });
  },
};

/**
 * Referral notifications
 */
export const referralNotifications = {
  /**
   * Notify about successful referral
   */
  async success(userId: string, data: {
    referredName: string;
    rewardAmount: string;
    rewardType: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'referral_success',
      title: 'Referral Successful!',
      body: `${data.referredName} completed their first booking. You earned ${data.rewardAmount} ${data.rewardType}!`,
      metadata: {
        referredName: data.referredName,
        rewardAmount: data.rewardAmount,
        rewardType: data.rewardType,
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      templateCode: 'referral_success',
      templateData: {
        referrerName: 'Friend',
        referredName: data.referredName,
        rewardAmount: data.rewardAmount,
        rewardType: data.rewardType,
      },
    });
  },

  /**
   * Notify about referral reward earned
   */
  async rewardEarned(userId: string, data: {
    rewardAmount: string;
    rewardType: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'referral_reward_earned',
      title: 'Referral Reward Earned',
      body: `You earned ${data.rewardAmount} ${data.rewardType} from your referral!`,
      metadata: {
        rewardAmount: data.rewardAmount,
        rewardType: data.rewardType,
      },
      channels: ['in_app'],
      priority: 'low',
      templateCode: 'referral_reward_earned',
      templateData: {
        rewardAmount: data.rewardAmount,
        rewardType: data.rewardType,
      },
    });
  },
};

/**
 * Booking notifications
 */
export const bookingNotifications = {
  /**
   * Notify about booking confirmation
   */
  async confirmed(userId: string, data: {
    serviceName: string;
    bookingDate: Date;
    bookingTime: string;
    bookingUrl: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'booking_confirmed',
      title: 'Booking Confirmed',
      body: `Your booking for ${data.serviceName} on ${format(data.bookingDate, 'MMMM d, yyyy')} has been confirmed.`,
      metadata: {
        serviceName: data.serviceName,
        bookingDate: data.bookingDate.toISOString(),
        bookingTime: data.bookingTime,
      },
      channels: ['in_app'],
      priority: 'medium',
      actionUrl: data.bookingUrl,
      actionText: 'View Booking',
      templateCode: 'booking_confirmed_inapp',
      templateData: {
        serviceName: data.serviceName,
        bookingDate: format(data.bookingDate, 'MMMM d, yyyy'),
        bookingTime: data.bookingTime,
      },
    });
  },

  /**
   * Send appointment reminder
   */
  async reminder(userId: string, data: {
    serviceName: string;
    providerName: string;
    timeUntil: string;
    bookingUrl: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'booking_reminder',
      title: `Reminder: ${data.serviceName} ${data.timeUntil}`,
      body: `Don't forget your appointment for ${data.serviceName} with ${data.providerName} ${data.timeUntil}.`,
      metadata: {
        serviceName: data.serviceName,
        providerName: data.providerName,
        timeUntil: data.timeUntil,
      },
      channels: ['in_app'],
      priority: 'medium',
      actionUrl: data.bookingUrl,
      actionText: 'View Details',
      templateCode: 'booking_reminder_inapp',
      templateData: {
        serviceName: data.serviceName,
        providerName: data.providerName,
        timeUntil: data.timeUntil,
      },
    });
  },
};

/**
 * Review notifications
 */
export const reviewNotifications = {
  /**
   * Request a review
   */
  async request(userId: string, data: {
    serviceName: string;
    providerName: string;
    reviewUrl: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'review_request',
      title: 'Share Your Experience',
      body: `How was your experience with ${data.providerName}? Please take a moment to leave a review.`,
      metadata: {
        serviceName: data.serviceName,
        providerName: data.providerName,
      },
      channels: ['email'],
      priority: 'low',
      actionUrl: data.reviewUrl,
      actionText: 'Write Review',
      templateCode: 'review_request',
      templateData: {
        customerName: 'Customer',
        serviceName: data.serviceName,
        providerName: data.providerName,
      },
    });
  },
};

/**
 * Special offer notifications
 */
export const specialOfferNotifications = {
  /**
   * Send special offer to tier members
   */
  async tierOffer(userId: string, data: {
    tierName: string;
    offerDetails: string;
    expiryDate: Date;
    offerUrl: string;
  }) {
    await notificationService.sendNotification({
      userId,
      type: 'special_offer',
      title: 'Exclusive Offer for You!',
      body: `As a valued ${data.tierName} member, enjoy ${data.offerDetails}.`,
      metadata: {
        tierName: data.tierName,
        offerDetails: data.offerDetails,
        expiryDate: data.expiryDate.toISOString(),
      },
      channels: ['email', 'in_app'],
      priority: 'medium',
      actionUrl: data.offerUrl,
      actionText: 'Claim Offer',
      templateCode: 'special_offer',
      templateData: {
        customerName: 'Customer',
        tierName: data.tierName,
        offerDetails: data.offerDetails,
        expiryDate: format(data.expiryDate, 'MMMM d, yyyy'),
      },
    });
  },
};