/**
 * Notification Templates
 * 
 * Pre-defined templates for all notification types
 * These can be seeded into the database for use by the notification service
 */

export const notificationTemplates = [
  // Subscription Notifications
  {
    code: 'subscription_confirmed',
    name: 'Subscription Confirmed',
    type: 'subscription_confirmed',
    channel: 'email',
    subjectTemplate: 'Subscription Confirmed: {{planName}}',
    titleTemplate: 'Welcome to {{planName}}!',
    bodyTemplate: 'Hi {{customerName}}, your subscription to {{planName}} with {{providerName}} has been confirmed. Your subscription will renew on {{renewalDate}}.',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'planName', type: 'string', required: true },
      { name: 'providerName', type: 'string', required: true },
      { name: 'renewalDate', type: 'string', required: true },
    ],
  },
  {
    code: 'subscription_renewed',
    name: 'Subscription Renewed',
    type: 'subscription_renewed',
    channel: 'email',
    subjectTemplate: 'Subscription Renewed: {{planName}}',
    titleTemplate: 'Your Subscription Has Been Renewed',
    bodyTemplate: 'Hi {{customerName}}, your subscription to {{planName}} has been successfully renewed. Your next renewal date is {{nextRenewalDate}}. Amount charged: ${{amount}}.',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'planName', type: 'string', required: true },
      { name: 'nextRenewalDate', type: 'string', required: true },
      { name: 'amount', type: 'string', required: true },
    ],
  },
  {
    code: 'subscription_expiring',
    name: 'Subscription Expiring Soon',
    type: 'subscription_expiring',
    channel: 'email',
    subjectTemplate: 'Your Subscription is Expiring Soon',
    titleTemplate: 'Subscription Expiring in {{daysRemaining}} Days',
    bodyTemplate: 'Hi {{customerName}}, your subscription to {{planName}} will expire on {{expiryDate}}. Renew now to continue enjoying uninterrupted service.',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'planName', type: 'string', required: true },
      { name: 'daysRemaining', type: 'number', required: true },
      { name: 'expiryDate', type: 'string', required: true },
    ],
  },

  // Payment Notifications
  {
    code: 'payment_receipt',
    name: 'Payment Receipt',
    type: 'payment_received',
    channel: 'email',
    subjectTemplate: 'Payment Receipt - ${{amount}}',
    titleTemplate: 'Payment Received',
    bodyTemplate: 'Hi {{customerName}}, we have received your payment of ${{amount}} for {{serviceName}}. Transaction ID: {{transactionId}}',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'amount', type: 'string', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'transactionId', type: 'string', required: true },
    ],
  },
  {
    code: 'payment_failed',
    name: 'Payment Failed',
    type: 'payment_failed',
    channel: 'email',
    subjectTemplate: 'Payment Failed - Action Required',
    titleTemplate: 'Payment Failed',
    bodyTemplate: 'Hi {{customerName}}, your payment for {{serviceName}} could not be processed. Please update your payment method to avoid service interruption. Error: {{errorMessage}}',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'errorMessage', type: 'string', required: true },
    ],
  },
  {
    code: 'payment_refunded',
    name: 'Refund Processed',
    type: 'payment_refunded',
    channel: 'email',
    subjectTemplate: 'Refund Processed - ${{refundAmount}}',
    titleTemplate: 'Refund Processed',
    bodyTemplate: 'Hi {{customerName}}, your refund of ${{refundAmount}} for {{serviceName}} has been processed. The funds will appear in your account within 5-10 business days. Refund ID: {{refundId}}',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'refundAmount', type: 'string', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'refundId', type: 'string', required: true },
    ],
  },

  // Loyalty Notifications
  {
    code: 'points_earned',
    name: 'Points Earned',
    type: 'points_earned',
    channel: 'in_app',
    subjectTemplate: 'You earned {{points}} points!',
    titleTemplate: '🎉 {{points}} Points Earned!',
    bodyTemplate: 'Great news! You earned {{points}} points from your recent {{activity}}. Your total balance is now {{totalPoints}} points.',
    variables: [
      { name: 'points', type: 'number', required: true },
      { name: 'activity', type: 'string', required: true },
      { name: 'totalPoints', type: 'number', required: true },
    ],
  },
  {
    code: 'points_redeemed',
    name: 'Points Redeemed',
    type: 'points_redeemed',
    channel: 'in_app',
    subjectTemplate: 'Points Redeemed Successfully',
    titleTemplate: 'Points Redeemed',
    bodyTemplate: 'You successfully redeemed {{points}} points for {{reward}}. Your remaining balance is {{remainingPoints}} points.',
    variables: [
      { name: 'points', type: 'number', required: true },
      { name: 'reward', type: 'string', required: true },
      { name: 'remainingPoints', type: 'number', required: true },
    ],
  },
  {
    code: 'points_expiring',
    name: 'Points Expiring Soon',
    type: 'points_expiring',
    channel: 'email',
    subjectTemplate: '⚠️ {{points}} Points Expiring Soon',
    titleTemplate: 'Points Expiring Soon',
    bodyTemplate: 'Hi {{customerName}}, you have {{points}} points expiring on {{expiryDate}}. Use them before they expire!',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'points', type: 'number', required: true },
      { name: 'expiryDate', type: 'string', required: true },
    ],
  },
  {
    code: 'tier_upgraded',
    name: 'Tier Upgraded',
    type: 'tier_upgraded',
    channel: 'email',
    subjectTemplate: '🎊 Congratulations! You are now {{tierName}}',
    titleTemplate: 'Welcome to {{tierName}} Tier!',
    bodyTemplate: 'Congratulations {{customerName}}! You have been upgraded to {{tierName}} tier. Enjoy these new benefits: {{benefits}}',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'tierName', type: 'string', required: true },
      { name: 'benefits', type: 'string', required: true },
    ],
  },

  // Group Booking Notifications
  {
    code: 'group_booking_invitation',
    name: 'Group Booking Invitation',
    type: 'group_booking_invitation',
    channel: 'email',
    subjectTemplate: '{{organizerName}} invited you to a group booking',
    titleTemplate: 'Group Booking Invitation',
    bodyTemplate: 'Hi {{inviteeName}}, {{organizerName}} has invited you to join a group booking for {{serviceName}} on {{bookingDate}}. Click here to accept the invitation.',
    variables: [
      { name: 'inviteeName', type: 'string', required: true },
      { name: 'organizerName', type: 'string', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'bookingDate', type: 'string', required: true },
    ],
  },
  {
    code: 'group_booking_confirmed',
    name: 'Group Booking Confirmed',
    type: 'group_booking_confirmed',
    channel: 'email',
    subjectTemplate: 'Group Booking Confirmed: {{serviceName}}',
    titleTemplate: 'Group Booking Confirmed',
    bodyTemplate: 'Your group booking for {{serviceName}} on {{bookingDate}} has been confirmed. Total participants: {{participantCount}}.',
    variables: [
      { name: 'serviceName', type: 'string', required: true },
      { name: 'bookingDate', type: 'string', required: true },
      { name: 'participantCount', type: 'number', required: true },
    ],
  },
  {
    code: 'group_member_joined',
    name: 'Group Member Joined',
    type: 'group_member_joined',
    channel: 'in_app',
    subjectTemplate: '{{memberName}} joined your group booking',
    titleTemplate: 'New Group Member',
    bodyTemplate: '{{memberName}} has joined your group booking for {{serviceName}}. {{spotsRemaining}} spots remaining.',
    variables: [
      { name: 'memberName', type: 'string', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'spotsRemaining', type: 'number', required: true },
    ],
  },

  // Price Alert Notifications
  {
    code: 'price_drop_alert',
    name: 'Price Drop Alert',
    type: 'price_drop_alert',
    channel: 'email',
    subjectTemplate: '💰 Price Drop: {{serviceName}} now {{newPrice}}',
    titleTemplate: 'Price Drop Alert!',
    bodyTemplate: 'Great news! {{serviceName}} from {{providerName}} is now available at {{newPrice}} (was {{oldPrice}}). Book now before the price goes back up!',
    variables: [
      { name: 'serviceName', type: 'string', required: true },
      { name: 'providerName', type: 'string', required: true },
      { name: 'newPrice', type: 'string', required: true },
      { name: 'oldPrice', type: 'string', required: true },
    ],
  },
  {
    code: 'flash_sale',
    name: 'Flash Sale',
    type: 'flash_sale',
    channel: 'email',
    subjectTemplate: '⚡ Flash Sale: {{discount}}% off {{serviceName}}',
    titleTemplate: 'Flash Sale - Limited Time!',
    bodyTemplate: 'Hurry! Get {{discount}}% off {{serviceName}} from {{providerName}}. Sale ends {{endTime}}.',
    variables: [
      { name: 'discount', type: 'number', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'providerName', type: 'string', required: true },
      { name: 'endTime', type: 'string', required: true },
    ],
  },

  // Referral Notifications
  {
    code: 'referral_success',
    name: 'Referral Success',
    type: 'referral_success',
    channel: 'email',
    subjectTemplate: '🎉 Your referral earned you {{rewardAmount}}!',
    titleTemplate: 'Referral Successful!',
    bodyTemplate: 'Congratulations {{referrerName}}! {{referredName}} has completed their first booking. You earned {{rewardAmount}} {{rewardType}}!',
    variables: [
      { name: 'referrerName', type: 'string', required: true },
      { name: 'referredName', type: 'string', required: true },
      { name: 'rewardAmount', type: 'string', required: true },
      { name: 'rewardType', type: 'string', required: true },
    ],
  },
  {
    code: 'referral_reward_earned',
    name: 'Referral Reward Earned',
    type: 'referral_reward_earned',
    channel: 'in_app',
    subjectTemplate: 'You earned a referral reward!',
    titleTemplate: 'Referral Reward Earned',
    bodyTemplate: 'You earned {{rewardAmount}} {{rewardType}} from your referral! Keep sharing to earn more rewards.',
    variables: [
      { name: 'rewardAmount', type: 'string', required: true },
      { name: 'rewardType', type: 'string', required: true },
    ],
  },

  // Booking Notifications (In-App versions)
  {
    code: 'booking_confirmed_inapp',
    name: 'Booking Confirmed (In-App)',
    type: 'booking_confirmed',
    channel: 'in_app',
    subjectTemplate: 'Booking Confirmed',
    titleTemplate: 'Booking Confirmed',
    bodyTemplate: 'Your booking for {{serviceName}} on {{bookingDate}} at {{bookingTime}} has been confirmed.',
    variables: [
      { name: 'serviceName', type: 'string', required: true },
      { name: 'bookingDate', type: 'string', required: true },
      { name: 'bookingTime', type: 'string', required: true },
    ],
  },
  {
    code: 'booking_reminder_inapp',
    name: 'Booking Reminder (In-App)',
    type: 'booking_reminder',
    channel: 'in_app',
    subjectTemplate: 'Appointment Reminder',
    titleTemplate: 'Reminder: {{serviceName}} {{timeUntil}}',
    bodyTemplate: 'Don\'t forget your appointment for {{serviceName}} with {{providerName}} {{timeUntil}}.',
    variables: [
      { name: 'serviceName', type: 'string', required: true },
      { name: 'providerName', type: 'string', required: true },
      { name: 'timeUntil', type: 'string', required: true },
    ],
  },
  {
    code: 'review_request',
    name: 'Review Request',
    type: 'review_request',
    channel: 'email',
    subjectTemplate: 'How was your experience with {{providerName}}?',
    titleTemplate: 'Share Your Experience',
    bodyTemplate: 'Hi {{customerName}}, we hope you enjoyed your {{serviceName}} with {{providerName}}. Please take a moment to share your experience.',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'serviceName', type: 'string', required: true },
      { name: 'providerName', type: 'string', required: true },
    ],
  },

  // Special Offer Notification
  {
    code: 'special_offer',
    name: 'Special Offer',
    type: 'special_offer',
    channel: 'email',
    subjectTemplate: '🎁 Special Offer Just for You!',
    titleTemplate: 'Exclusive Offer for {{tierName}} Members',
    bodyTemplate: 'Hi {{customerName}}, as a valued {{tierName}} member, enjoy {{offerDetails}}. Valid until {{expiryDate}}.',
    variables: [
      { name: 'customerName', type: 'string', required: true },
      { name: 'tierName', type: 'string', required: true },
      { name: 'offerDetails', type: 'string', required: true },
      { name: 'expiryDate', type: 'string', required: true },
    ],
  },
];

/**
 * Seed notification templates to database
 */
export async function seedNotificationTemplates(db: any, notificationTemplatesTable: any) {
  const templates = notificationTemplates.map(template => ({
    ...template,
    isActive: true,
    isSystem: true,
    priority: template.type.includes('failed') || template.type.includes('expiring') ? 'high' : 'medium',
  }));

  try {
    await db.insert(notificationTemplatesTable).values(templates);
    console.log(`Seeded ${templates.length} notification templates`);
  } catch (error) {
    console.error('Error seeding notification templates:', error);
  }
}