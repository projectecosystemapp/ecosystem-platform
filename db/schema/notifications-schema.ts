/**
 * Notifications Schema
 * 
 * Comprehensive notification system for marketplace events
 * Supporting email, in-app, SMS, and push notifications
 */

import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  integer
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles-schema";
import { createId } from "@paralleldrive/cuid2";

// Notification types enum
export const notificationTypeEnum = pgEnum("notification_type", [
  // Subscription notifications
  "subscription_confirmed",
  "subscription_renewed",
  "subscription_cancelled",
  "subscription_expiring",
  "subscription_failed",
  
  // Payment notifications  
  "payment_received",
  "payment_failed",
  "payment_refunded",
  "payout_processed",
  
  // Loyalty notifications
  "points_earned",
  "points_redeemed",
  "points_expiring",
  "tier_upgraded",
  "tier_downgraded",
  "special_offer",
  
  // Group booking notifications
  "group_booking_invitation",
  "group_booking_confirmed",
  "group_booking_cancelled",
  "group_member_joined",
  "group_member_left",
  
  // Price notifications
  "price_drop_alert",
  "flash_sale",
  "limited_availability",
  
  // Referral notifications
  "referral_success",
  "referral_reward_earned",
  "referral_expired",
  
  // Booking notifications
  "booking_confirmed",
  "booking_reminder",
  "booking_cancelled",
  "booking_modified",
  "provider_accepted",
  "provider_rejected",
  
  // Review notifications
  "review_request",
  "review_response",
  
  // System notifications
  "welcome",
  "account_update",
  "security_alert",
  "maintenance",
  "announcement"
]);

// Notification channel enum
export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "in_app",
  "sms",
  "push"
]);

// Notification priority enum  
export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "medium", 
  "high",
  "urgent"
]);

// Notification status enum
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sending",
  "sent",
  "delivered",
  "read",
  "failed",
  "bounced",
  "cancelled"
]);

/**
 * Notification Preferences Table
 * User preferences for notification types and channels
 */
export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  
  // Channel preferences
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  pushEnabled: boolean("push_enabled").default(false).notNull(),
  
  // Category preferences
  subscriptionNotifications: boolean("subscription_notifications").default(true).notNull(),
  paymentNotifications: boolean("payment_notifications").default(true).notNull(),
  loyaltyNotifications: boolean("loyalty_notifications").default(true).notNull(),
  groupBookingNotifications: boolean("group_booking_notifications").default(true).notNull(),
  priceAlertNotifications: boolean("price_alert_notifications").default(true).notNull(),
  referralNotifications: boolean("referral_notifications").default(true).notNull(),
  bookingNotifications: boolean("booking_notifications").default(true).notNull(),
  reviewNotifications: boolean("review_notifications").default(true).notNull(),
  marketingNotifications: boolean("marketing_notifications").default(false).notNull(),
  
  // Frequency controls
  dailyDigest: boolean("daily_digest").default(false).notNull(),
  weeklyDigest: boolean("weekly_digest").default(false).notNull(),
  instantNotifications: boolean("instant_notifications").default(true).notNull(),
  
  // Quiet hours (stored as UTC hours)
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
  quietHoursStart: integer("quiet_hours_start"), // 0-23
  quietHoursEnd: integer("quiet_hours_end"), // 0-23
  timezone: text("timezone").default("UTC"),
  
  // Contact preferences
  preferredEmail: text("preferred_email"),
  preferredPhone: text("preferred_phone"),
  
  // Unsubscribe tokens
  emailUnsubscribeToken: text("email_unsubscribe_token").unique(),
  
  // Metadata
  metadata: jsonb("metadata").default('{}').$type<{
    language?: string;
    deviceTokens?: string[];
    [key: string]: any;
  }>(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("notification_preferences_user_id_idx").on(table.userId),
  unsubscribeTokenIdx: index("notification_preferences_unsubscribe_token_idx").on(table.emailUnsubscribeToken),
}));

/**
 * Notifications Table
 * Stores all notifications across all channels
 */
export const notificationsTable = pgTable("notifications", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  // Recipient
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  
  // Notification details
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  priority: notificationPriorityEnum("priority").default("medium").notNull(),
  
  // Content
  subject: text("subject"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  htmlContent: text("html_content"),
  
  // Actions and links
  actionUrl: text("action_url"),
  actionText: text("action_text"),
  imageUrl: text("image_url"),
  
  // Status tracking
  status: notificationStatusEnum("status").default("pending").notNull(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  failedAt: timestamp("failed_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Grouping and batching
  batchId: text("batch_id"),
  groupKey: text("group_key"), // For grouping related notifications
  
  // Provider tracking
  provider: text("provider"), // resend, twilio, firebase, etc.
  providerMessageId: text("provider_message_id"),
  providerResponse: jsonb("provider_response"),
  
  // Metadata
  metadata: jsonb("metadata").default('{}').$type<{
    bookingId?: string;
    subscriptionId?: string;
    loyaltyAccountId?: string;
    groupBookingId?: string;
    referralId?: string;
    pointsEarned?: number;
    pointsRedeemed?: number;
    amountRefunded?: number;
    tierName?: string;
    offerDetails?: any;
    [key: string]: any;
  }>(),
  
  // Template reference
  templateId: text("template_id"),
  templateVersion: integer("template_version"),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Indexes
  userIdIdx: index("notifications_user_id_idx").on(table.userId),
  typeIdx: index("notifications_type_idx").on(table.type),
  channelIdx: index("notifications_channel_idx").on(table.channel),
  statusIdx: index("notifications_status_idx").on(table.status),
  createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  batchIdIdx: index("notifications_batch_id_idx").on(table.batchId),
  groupKeyIdx: index("notifications_group_key_idx").on(table.groupKey),
  
  // Composite indexes
  userStatusIdx: index("notifications_user_status_idx").on(table.userId, table.status),
  userTypeIdx: index("notifications_user_type_idx").on(table.userId, table.type),
  userChannelIdx: index("notifications_user_channel_idx").on(table.userId, table.channel),
  userReadIdx: index("notifications_user_read_idx").on(table.userId, table.readAt),
}));

/**
 * Notification Templates Table
 * Reusable templates for different notification types
 */
export const notificationTemplatesTable = pgTable("notification_templates", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  // Template identification
  code: text("code").notNull().unique(), // e.g., "subscription_confirmed"
  name: text("name").notNull(),
  description: text("description"),
  
  // Template type
  type: notificationTypeEnum("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  
  // Content templates
  subjectTemplate: text("subject_template"),
  titleTemplate: text("title_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  htmlTemplate: text("html_template"),
  
  // Variables schema
  variables: jsonb("variables").$type<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: any;
    description?: string;
  }[]>().default('[]'),
  
  // Settings
  isActive: boolean("is_active").default(true).notNull(),
  isSystem: boolean("is_system").default(false).notNull(), // System templates can't be modified
  priority: notificationPriorityEnum("priority").default("medium").notNull(),
  
  // Version control
  version: integer("version").default(1).notNull(),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  codeIdx: uniqueIndex("notification_templates_code_idx").on(table.code),
  typeIdx: index("notification_templates_type_idx").on(table.type),
  channelIdx: index("notification_templates_channel_idx").on(table.channel),
  isActiveIdx: index("notification_templates_is_active_idx").on(table.isActive),
}));

/**
 * Notification Queue Table
 * Queue for processing notifications
 */
export const notificationQueueTable = pgTable("notification_queue", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  // Queue details
  notificationId: text("notification_id")
    .references(() => notificationsTable.id, { onDelete: "cascade" }),
  priority: notificationPriorityEnum("priority").default("medium").notNull(),
  
  // Processing
  status: text("status").default("pending").notNull(), // pending, processing, completed, failed
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  processedAt: timestamp("processed_at"),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Error tracking
  lastError: text("last_error"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  notificationIdIdx: index("notification_queue_notification_id_idx").on(table.notificationId),
  statusIdx: index("notification_queue_status_idx").on(table.status),
  scheduledForIdx: index("notification_queue_scheduled_for_idx").on(table.scheduledFor),
  priorityIdx: index("notification_queue_priority_idx").on(table.priority),
}));

/**
 * Price Alerts Table
 * User-defined price drop alerts
 */
export const notificationPriceAlertsTable = pgTable("price_alerts", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  providerId: uuid("provider_id")
    .references(() => import("./providers-schema").providersTable.id),
  serviceId: text("service_id"),
  
  // Alert criteria
  targetPriceCents: integer("target_price_cents"),
  percentageDropThreshold: integer("percentage_drop_threshold"), // e.g., 20 for 20% drop
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("price_alerts_user_id_idx").on(table.userId),
  providerIdIdx: index("price_alerts_provider_id_idx").on(table.providerId),
  isActiveIdx: index("price_alerts_is_active_idx").on(table.isActive),
  expiresAtIdx: index("price_alerts_expires_at_idx").on(table.expiresAt),
}));

// Type exports
export type NotificationPreferences = typeof notificationPreferencesTable.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferencesTable.$inferInsert;
export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;
export type NotificationTemplate = typeof notificationTemplatesTable.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplatesTable.$inferInsert;
export type NotificationQueue = typeof notificationQueueTable.$inferSelect;
export type NewNotificationQueue = typeof notificationQueueTable.$inferInsert;
export type NotificationPriceAlert = typeof notificationPriceAlertsTable.$inferSelect;
export type NewNotificationPriceAlert = typeof notificationPriceAlertsTable.$inferInsert;