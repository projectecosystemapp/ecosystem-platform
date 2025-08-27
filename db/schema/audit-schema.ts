/**
 * Audit Schema
 * 
 * Tables for tracking webhook events, disputes, payouts, and notifications
 */

import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  integer,
  jsonb,
  index,
  uniqueIndex,
  boolean,
  decimal,
  date
} from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings-schema";
import { providersTable } from "./providers-schema";

/**
 * Disputes Table
 * Tracks payment disputes and chargebacks
 */
export const disputesTable = pgTable("disputes", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // References
  bookingId: uuid("booking_id").references(() => bookingsTable.id),
  transactionId: uuid("transaction_id"), // Reference to transactions table if exists
  
  // Stripe details
  stripeDisputeId: text("stripe_dispute_id").notNull().unique(),
  stripeChargeId: text("stripe_charge_id").notNull(),
  
  // Dispute details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  
  // Evidence and deadlines
  evidenceDueBy: timestamp("evidence_due_by"),
  evidenceSubmittedAt: timestamp("evidence_submitted_at"),
  evidenceDetails: jsonb("evidence_details"),
  
  // Outcome
  outcome: text("outcome"),
  fundsWithdrawn: boolean("funds_withdrawn").default(false),
  fundsReinstated: boolean("funds_reinstated").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => ({
  bookingIdIdx: index("idx_disputes_booking_id").on(table.bookingId),
  statusIdx: index("idx_disputes_status").on(table.status),
  evidenceDueIdx: index("idx_disputes_evidence_due").on(table.evidenceDueBy),
  stripeDisputeIdIdx: uniqueIndex("idx_disputes_stripe_dispute_id").on(table.stripeDisputeId),
}));

/**
 * Payouts Table
 * Tracks provider payouts and their status
 */
export const payoutsTable = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Provider reference
  providerId: uuid("provider_id").references(() => providersTable.id),
  
  // Stripe details
  stripePayoutId: text("stripe_payout_id").notNull().unique(),
  stripeAccountId: text("stripe_account_id").notNull(),
  
  // Payout details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  arrivalDate: date("arrival_date"),
  method: text("method"), // 'standard' or 'instant'
  
  // Status
  status: text("status").notNull(),
  failureCode: text("failure_code"),
  failureMessage: text("failure_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  failedAt: timestamp("failed_at"),
}, (table) => ({
  providerIdIdx: index("idx_payouts_provider_id").on(table.providerId),
  statusIdx: index("idx_payouts_status").on(table.status),
  arrivalDateIdx: index("idx_payouts_arrival_date").on(table.arrivalDate),
  stripePayoutIdIdx: uniqueIndex("idx_payouts_stripe_payout_id").on(table.stripePayoutId),
}));

/**
 * Notification Logs Table
 * Log of all notifications sent through the platform
 */
export const notificationLogsTable = pgTable("notification_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Notification details
  type: text("type").notNull(),
  recipientId: text("recipient_id"),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  channel: text("channel").notNull(),
  
  // Content
  subject: text("subject"),
  body: text("body"),
  templateName: text("template_name"),
  templateData: jsonb("template_data"),
  
  // Status tracking
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  
  // Provider information
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  failedAt: timestamp("failed_at"),
}, (table) => ({
  recipientIdx: index("idx_notification_logs_recipient").on(table.recipientId),
  typeStatusIdx: index("idx_notification_logs_type_status").on(table.type, table.status),
  createdAtIdx: index("idx_notification_logs_created_at").on(table.createdAt),
}));

// Type exports
export type Dispute = typeof disputesTable.$inferSelect;
export type NewDispute = typeof disputesTable.$inferInsert;
export type Payout = typeof payoutsTable.$inferSelect;
export type NewPayout = typeof payoutsTable.$inferInsert;
export type NotificationLog = typeof notificationLogsTable.$inferSelect;
export type NewNotificationLog = typeof notificationLogsTable.$inferInsert;