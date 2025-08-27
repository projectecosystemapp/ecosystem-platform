import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  integer,
  boolean,
  jsonb,
  pgEnum
} from "drizzle-orm/pg-core";
import { customerSubscriptionsTable } from "./subscriptions-schema";
import { bookingsTable } from "./bookings-schema";
import { profilesTable } from "./profiles-schema";

// Usage action types
export const usageActionEnum = pgEnum("usage_action", [
  "service_used",
  "service_credited",
  "service_refunded",
  "manual_adjustment",
  "period_reset",
  "overage_charge"
]);

// Subscription usage records - Detailed tracking of each usage event
export const subscriptionUsageRecordsTable = pgTable("subscription_usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => customerSubscriptionsTable.id, { onDelete: "cascade" }),
  
  // Action details
  action: usageActionEnum("action").notNull(),
  quantity: integer("quantity").notNull(), // Positive for credits, negative for usage
  
  // Related entities
  bookingId: uuid("booking_id")
    .references(() => bookingsTable.id, { onDelete: "set null" }),
  adjustedBy: text("adjusted_by")
    .references(() => profilesTable.userId, { onDelete: "set null" }),
  
  // Period tracking
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Balance tracking
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  
  // Overage handling
  isOverage: boolean("is_overage").default(false),
  overageChargeCents: integer("overage_charge_cents"),
  stripeChargeId: text("stripe_charge_id"),
  
  // Details
  description: text("description"),
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Usage summaries by period - Aggregated view for reporting
export const subscriptionUsageSummariesTable = pgTable("subscription_usage_summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => customerSubscriptionsTable.id, { onDelete: "cascade" }),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Allowances
  includedServices: integer("included_services").notNull(),
  bonusServices: integer("bonus_services").default(0),
  totalAllowance: integer("total_allowance").notNull(),
  
  // Usage
  servicesUsed: integer("services_used").notNull(),
  servicesRemaining: integer("services_remaining").notNull(),
  overageServices: integer("overage_services").default(0),
  
  // Financial
  overageChargesCents: integer("overage_charges_cents").default(0),
  creditsApplied: integer("credits_applied").default(0),
  
  // Status
  isPeriodComplete: boolean("is_period_complete").default(false),
  nextResetDate: timestamp("next_reset_date"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type SubscriptionUsageRecord = typeof subscriptionUsageRecordsTable.$inferSelect;
export type NewSubscriptionUsageRecord = typeof subscriptionUsageRecordsTable.$inferInsert;
export type SubscriptionUsageSummary = typeof subscriptionUsageSummariesTable.$inferSelect;
export type NewSubscriptionUsageSummary = typeof subscriptionUsageSummariesTable.$inferInsert;