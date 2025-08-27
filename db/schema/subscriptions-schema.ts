import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  integer,
  boolean,
  jsonb,
  decimal,
  pgEnum
} from "drizzle-orm/pg-core";
import { providersTable } from "./providers-schema";
import { profilesTable } from "./profiles-schema";
import { bookingsTable } from "./bookings-schema";

// Enums
export const billingCycleEnum = pgEnum("billing_cycle", [
  "weekly",
  "biweekly", 
  "monthly",
  "quarterly",
  "annual"
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
  "completed"
]);

// Subscription Plans - Provider-created recurring service packages
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }),
  
  // Plan details
  name: text("name").notNull(),
  description: text("description"),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  
  // Pricing
  basePriceCents: integer("base_price_cents").notNull(),
  setupFeeCents: integer("setup_fee_cents").default(0),
  trialDays: integer("trial_days").default(0),
  
  // Service details
  servicesPerCycle: integer("services_per_cycle").default(1),
  serviceDurationMinutes: integer("service_duration_minutes").default(60),
  
  // Capacity management
  maxSubscribers: integer("max_subscribers"),
  currentSubscribers: integer("current_subscribers").default(0),
  
  // Features and benefits
  features: jsonb("features").default('[]'), // Array of feature strings
  benefits: jsonb("benefits").default('{}'), // {priority_booking: true, discount_percent: 10}
  
  // Status
  isActive: boolean("is_active").default(true),
  isPublic: boolean("is_public").default(true), // Whether visible to customers
  
  // Metadata
  stripeProductId: text("stripe_product_id"),
  stripePriceId: text("stripe_price_id"),
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customer Subscriptions - Active subscriptions
export const customerSubscriptionsTable = pgTable("customer_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => subscriptionPlansTable.id, { onDelete: "restrict" }),
  
  // Stripe integration
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  
  // Status
  status: subscriptionStatusEnum("status").notNull().default("active"),
  
  // Billing periods
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEnd: timestamp("trial_end"),
  
  // Cancellation
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at"),
  cancelationReason: text("cancelation_reason"),
  
  // Pause functionality
  pausedAt: timestamp("paused_at"),
  pauseReason: text("pause_reason"),
  resumeAt: timestamp("resume_at"),
  
  // Usage tracking
  servicesUsedThisPeriod: integer("services_used_this_period").default(0),
  totalServicesUsed: integer("total_services_used").default(0),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Subscription Bookings - Links subscriptions to actual bookings
export const subscriptionBookingsTable = pgTable("subscription_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => customerSubscriptionsTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for").notNull(),
  autoScheduled: boolean("auto_scheduled").default(true),
  
  // Period tracking
  billingPeriodStart: timestamp("billing_period_start"),
  billingPeriodEnd: timestamp("billing_period_end"),
  
  // Status
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Subscription Usage History - Track usage over time
export const subscriptionUsageTable = pgTable("subscription_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => customerSubscriptionsTable.id, { onDelete: "cascade" }),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Usage
  servicesIncluded: integer("services_included").notNull(),
  servicesUsed: integer("services_used").notNull(),
  servicesRemaining: integer("services_remaining").notNull(),
  
  // Billing
  amountBilledCents: integer("amount_billed_cents"),
  stripeInvoiceId: text("stripe_invoice_id"),
  
  // Status
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlansTable.$inferInsert;
export type CustomerSubscription = typeof customerSubscriptionsTable.$inferSelect;
export type NewCustomerSubscription = typeof customerSubscriptionsTable.$inferInsert;
export type SubscriptionBooking = typeof subscriptionBookingsTable.$inferSelect;
export type NewSubscriptionBooking = typeof subscriptionBookingsTable.$inferInsert;
export type SubscriptionUsage = typeof subscriptionUsageTable.$inferSelect;
export type NewSubscriptionUsage = typeof subscriptionUsageTable.$inferInsert;