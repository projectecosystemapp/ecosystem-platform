/**
 * Email Logs Schema
 * 
 * Tracks all email communications for audit trail and compliance
 * Per Master PRD requirements for communication tracking
 */

import { pgTable, text, timestamp, varchar, boolean, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

/**
 * Email logs table
 * Stores record of all emails sent through the system
 */
export const emailLogsTable = pgTable("email_logs", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  // Message identification
  messageId: varchar("message_id", { length: 255 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  
  // Template and content
  template: varchar("template", { length: 100 }).notNull(),
  subject: text("subject").notNull(),
  
  // Recipients
  to: jsonb("to").notNull().$type<string | string[]>(),
  cc: jsonb("cc").$type<string | string[]>(),
  bcc: jsonb("bcc").$type<string | string[]>(),
  from: varchar("from", { length: 255 }).notNull(),
  replyTo: varchar("reply_to", { length: 255 }),
  
  // Status tracking
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  // Status values: pending, queued, sending, sent, failed, bounced, complained
  
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  bouncedAt: timestamp("bounced_at"),
  complainedAt: timestamp("complained_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  // Retry tracking
  attempts: integer("attempts").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  maxRetries: integer("max_retries").notNull().default(3),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 50 }),
  isRetryable: boolean("is_retryable").default(true),
  
  // Provider information
  provider: varchar("provider", { length: 50 }).notNull().default("resend"),
  providerMessageId: varchar("provider_message_id", { length: 255 }),
  providerResponse: jsonb("provider_response"),
  
  // Priority and scheduling
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  scheduledFor: timestamp("scheduled_for"),
  
  // Metadata and associations
  metadata: jsonb("metadata").$type<{
    bookingId?: string;
    userId?: string;
    providerId?: string;
    source?: string;
    campaign?: string;
    tags?: string[];
    [key: string]: any;
  }>(),
  
  // Template data (for debugging/resending)
  templateData: jsonb("template_data"),
  
  // Tracking
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes for common queries
  messageIdIdx: index("email_logs_message_id_idx").on(table.messageId),
  idempotencyKeyIdx: uniqueIndex("email_logs_idempotency_key_idx").on(table.idempotencyKey),
  statusIdx: index("email_logs_status_idx").on(table.status),
  templateIdx: index("email_logs_template_idx").on(table.template),
  sentAtIdx: index("email_logs_sent_at_idx").on(table.sentAt),
  createdAtIdx: index("email_logs_created_at_idx").on(table.createdAt),
  providerMessageIdIdx: index("email_logs_provider_message_id_idx").on(table.providerMessageId),
  
  // Composite indexes for filtering
  statusCreatedAtIdx: index("email_logs_status_created_at_idx").on(table.status, table.createdAt),
  templateStatusIdx: index("email_logs_template_status_idx").on(table.template, table.status),
  
  // Metadata indexes for associations
  bookingIdIdx: index("email_logs_booking_id_idx").on(table.metadata),
  userIdIdx: index("email_logs_user_id_idx").on(table.metadata),
  providerIdIdx: index("email_logs_provider_id_idx").on(table.metadata),
}));

/**
 * Email events table
 * Tracks webhook events from email providers (opens, clicks, bounces, etc.)
 */
export const emailEventsTable = pgTable("email_events", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  // Link to email log
  emailLogId: text("email_log_id").notNull().references(() => emailLogsTable.id),
  messageId: varchar("message_id", { length: 255 }).notNull(),
  
  // Event details
  eventType: varchar("event_type", { length: 50 }).notNull(),
  // Event types: delivered, opened, clicked, bounced, complained, unsubscribed
  
  eventData: jsonb("event_data"),
  
  // Provider information
  provider: varchar("provider", { length: 50 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 255 }),
  webhookId: varchar("webhook_id", { length: 255 }),
  
  // Client information
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  deviceType: varchar("device_type", { length: 50 }),
  
  // For click events
  clickedUrl: text("clicked_url"),
  
  // For bounce/complaint events
  bounceType: varchar("bounce_type", { length: 50 }),
  bounceSubType: varchar("bounce_sub_type", { length: 50 }),
  complaintType: varchar("complaint_type", { length: 50 }),
  
  // Timestamps
  eventAt: timestamp("event_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  // Indexes
  emailLogIdIdx: index("email_events_email_log_id_idx").on(table.emailLogId),
  messageIdIdx: index("email_events_message_id_idx").on(table.messageId),
  eventTypeIdx: index("email_events_event_type_idx").on(table.eventType),
  eventAtIdx: index("email_events_event_at_idx").on(table.eventAt),
  providerEventIdIdx: uniqueIndex("email_events_provider_event_id_idx").on(table.providerEventId),
  
  // Composite indexes
  emailLogEventTypeIdx: index("email_events_email_log_event_type_idx").on(table.emailLogId, table.eventType),
}));

/**
 * Email templates table
 * Stores custom email templates that can be managed by admins
 */
export const emailTemplatesTable = pgTable("email_templates", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  // Template identification
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  
  // Template content
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content"),
  
  // Variables and schema
  variables: jsonb("variables").$type<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: any;
    description?: string;
  }[]>(),
  
  // Settings
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false), // System templates can't be deleted
  
  // Version control
  version: integer("version").notNull().default(1),
  previousVersionId: text("previous_version_id"),
  
  // Metadata
  createdBy: varchar("created_by", { length: 255 }),
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Indexes
  nameIdx: uniqueIndex("email_templates_name_idx").on(table.name),
  categoryIdx: index("email_templates_category_idx").on(table.category),
  isActiveIdx: index("email_templates_is_active_idx").on(table.isActive),
  createdAtIdx: index("email_templates_created_at_idx").on(table.createdAt),
}));

/**
 * Email blacklist table
 * Stores emails that should not receive communications
 */
export const emailBlacklistTable = pgTable("email_blacklist", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  
  email: varchar("email", { length: 255 }).notNull().unique(),
  reason: varchar("reason", { length: 100 }).notNull(),
  // Reasons: bounced, complained, unsubscribed, manual, invalid
  
  source: varchar("source", { length: 50 }),
  // Sources: webhook, manual, import, user_action
  
  metadata: jsonb("metadata"),
  
  addedBy: varchar("added_by", { length: 255 }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  
  // Temporary blacklist support
  expiresAt: timestamp("expires_at"),
  
  notes: text("notes"),
}, (table) => ({
  // Indexes
  emailIdx: uniqueIndex("email_blacklist_email_idx").on(table.email),
  reasonIdx: index("email_blacklist_reason_idx").on(table.reason),
  expiresAtIdx: index("email_blacklist_expires_at_idx").on(table.expiresAt),
  addedAtIdx: index("email_blacklist_added_at_idx").on(table.addedAt),
}));

/**
 * Type exports for use in application code
 */
export type EmailLog = typeof emailLogsTable.$inferSelect;
export type NewEmailLog = typeof emailLogsTable.$inferInsert;
export type EmailEvent = typeof emailEventsTable.$inferSelect;
export type NewEmailEvent = typeof emailEventsTable.$inferInsert;
export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
export type NewEmailTemplate = typeof emailTemplatesTable.$inferInsert;
export type EmailBlacklist = typeof emailBlacklistTable.$inferSelect;
export type NewEmailBlacklist = typeof emailBlacklistTable.$inferInsert;

// Email status enum
export enum EmailStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
}

// Email event type enum
export enum EmailEventType {
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  UNSUBSCRIBED = 'unsubscribed',
}

// Email priority enum
export enum EmailPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

// Blacklist reason enum
export enum BlacklistReason {
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  UNSUBSCRIBED = 'unsubscribed',
  MANUAL = 'manual',
  INVALID = 'invalid',
}