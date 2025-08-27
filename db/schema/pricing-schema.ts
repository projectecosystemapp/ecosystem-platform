import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  integer,
  boolean,
  jsonb,
  decimal,
  pgEnum,
  date,
  time,
  uniqueIndex
} from "drizzle-orm/pg-core";
import { providersTable } from "./providers-schema";
import { servicesTable } from "./enhanced-booking-schema";
import { profilesTable } from "./profiles-schema";

// Enums
export const pricingRuleTypeEnum = pgEnum("pricing_rule_type", [
  "time_based",      // Peak hours, weekends
  "demand_based",    // Surge pricing
  "seasonal",        // Holidays, special events
  "advance_booking", // Early bird, last minute
  "loyalty",         // Tier-based discounts
  "promotional",     // Limited time offers
  "bundle",          // Package deals
  "group"           // Group discounts
]);

export const demandLevelEnum = pgEnum("demand_level", [
  "very_low",
  "low",
  "normal",
  "high",
  "very_high",
  "extreme"
]);

export const priceAlertTypeEnum = pgEnum("price_alert_type", [
  "below_price",
  "percentage_drop",
  "availability",
  "new_discount"
]);

// Dynamic Pricing Rules - Provider-defined pricing strategies
export const pricingRulesTable = pgTable("pricing_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id")
    .references(() => servicesTable.id, { onDelete: "cascade" }),
  
  // Rule definition
  ruleType: pricingRuleTypeEnum("rule_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Conditions (JSON for flexibility)
  conditions: jsonb("conditions").default('{}').notNull(),
  /* Example conditions:
    time_based: {
      days_of_week: [0, 6], // Weekend
      hours: [[18, 20]], // 6-8 PM
      timezone: "America/Los_Angeles"
    }
    demand_based: {
      demand_threshold: "high",
      min_bookings: 5,
      time_window_hours: 2
    }
    seasonal: {
      dates: ["2024-12-25", "2024-01-01"],
      date_ranges: [["2024-12-20", "2024-12-26"]]
    }
    advance_booking: {
      min_hours: 48, // 48 hours in advance
      max_hours: 168 // Up to 7 days
    }
  */
  
  // Price modification
  priceModifier: decimal("price_modifier", { precision: 4, scale: 3 }).notNull(), // 1.500 = 50% increase
  fixedAdjustmentCents: integer("fixed_adjustment_cents"), // Alternative to percentage
  
  // Caps and limits
  maxPriceCents: integer("max_price_cents"), // Never exceed this price
  minPriceCents: integer("min_price_cents"), // Never go below this price
  
  // Priority and conflicts
  priority: integer("priority").default(0), // Higher priority rules apply first
  isStackable: boolean("is_stackable").default(false), // Can combine with other rules
  
  // Validity period
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isAutomatic: boolean("is_automatic").default(true), // Apply automatically vs manual
  
  // Performance tracking
  timesApplied: integer("times_applied").default(0),
  totalRevenueImpactCents: integer("total_revenue_impact_cents").default(0),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Demand Metrics - Track and predict demand
export const demandMetricsTable = pgTable("demand_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id")
    .references(() => servicesTable.id, { onDelete: "cascade" }),
  
  // Time window
  date: date("date").notNull(),
  hour: integer("hour").notNull(), // 0-23
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
  
  // Demand indicators
  bookingsCount: integer("bookings_count").default(0),
  searchesCount: integer("searches_count").default(0),
  viewsCount: integer("views_count").default(0),
  inquiriesCount: integer("inquiries_count").default(0),
  
  // Capacity
  availableSlots: integer("available_slots"),
  totalSlots: integer("total_slots"),
  utilizationRate: decimal("utilization_rate", { precision: 5, scale: 4 }), // 0.0000 - 1.0000
  
  // Conversion metrics
  searchToBookingRate: decimal("search_to_booking_rate", { precision: 5, scale: 4 }),
  viewToBookingRate: decimal("view_to_booking_rate", { precision: 5, scale: 4 }),
  
  // Pricing metrics
  avgPriceCents: integer("avg_price_cents"),
  minPriceCents: integer("min_price_cents"),
  maxPriceCents: integer("max_price_cents"),
  
  // Demand score
  demandLevel: demandLevelEnum("demand_level").default("normal"),
  demandScore: decimal("demand_score", { precision: 4, scale: 2 }), // 0.00 - 10.00
  predictedDemandScore: decimal("predicted_demand_score", { precision: 4, scale: 2 }),
  
  // Competition
  competitorAvgPriceCents: integer("competitor_avg_price_cents"),
  marketShareEstimate: decimal("market_share_estimate", { precision: 5, scale: 4 }),
  
  // Metadata
  weatherConditions: jsonb("weather_conditions"), // {temp: 72, condition: "sunny"}
  localEvents: jsonb("local_events"), // [{name: "Festival", impact: "high"}]
  
  // Timestamps
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Price Alerts - Customer notifications for price changes
export const priceAlertsTable = pgTable("price_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  
  // Alert target
  serviceId: uuid("service_id")
    .references(() => servicesTable.id, { onDelete: "cascade" }),
  providerId: uuid("provider_id")
    .references(() => providersTable.id, { onDelete: "cascade" }),
  category: text("category"), // Alert for entire category
  
  // Alert conditions
  alertType: priceAlertTypeEnum("alert_type").notNull(),
  targetPriceCents: integer("target_price_cents"), // For below_price
  percentageDrop: integer("percentage_drop"), // For percentage_drop
  
  // Date range (optional)
  startDate: date("start_date"),
  endDate: date("end_date"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isPaused: boolean("is_paused").default(false),
  
  // Triggering
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0),
  maxTriggers: integer("max_triggers"), // Stop after N alerts
  cooldownHours: integer("cooldown_hours").default(24), // Don't alert again for X hours
  
  // Notification preferences
  notifyEmail: boolean("notify_email").default(true),
  notifyPush: boolean("notify_push").default(true),
  notifySms: boolean("notify_sms").default(false),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Surge Pricing Events - Track when surge pricing is active
export const surgePricingEventsTable = pgTable("surge_pricing_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }),
  
  // Event details
  eventName: text("event_name"),
  eventType: text("event_type"), // automatic, manual, holiday
  
  // Timing
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  
  // Surge details
  surgeMultiplier: decimal("surge_multiplier", { precision: 3, scale: 2 }).notNull(), // 1.50 = 50% increase
  demandScore: decimal("demand_score", { precision: 4, scale: 2 }),
  
  // Affected services
  affectedServices: jsonb("affected_services").default('[]'), // Array of service IDs
  
  // Impact
  bookingsAffected: integer("bookings_affected").default(0),
  additionalRevenueCents: integer("additional_revenue_cents").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  wasAutoTriggered: boolean("was_auto_triggered").default(false),
  
  // Metadata
  triggerReason: text("trigger_reason"),
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Price History - Track all price changes
export const priceHistoryTable = pgTable("price_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => servicesTable.id, { onDelete: "cascade" }),
  
  // Price change
  oldPriceCents: integer("old_price_cents").notNull(),
  newPriceCents: integer("new_price_cents").notNull(),
  changePercent: decimal("change_percent", { precision: 6, scale: 2 }), // -50.00 to 999.99
  
  // Applied rules
  appliedRules: jsonb("applied_rules").default('[]'), // Array of rule IDs and modifiers
  finalModifier: decimal("final_modifier", { precision: 4, scale: 3 }), // Combined modifier
  
  // Context
  bookingId: uuid("booking_id"), // If price was for specific booking
  demandLevel: demandLevelEnum("demand_level"),
  
  // Reason
  changeReason: text("change_reason"),
  changedBy: text("changed_by"), // system, provider_id, admin_id
  
  // Timestamps
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveUntil: timestamp("effective_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Competitor Pricing - Track competitor prices for intelligence
export const competitorPricingTable = pgTable("competitor_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Location and category
  location: text("location").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  
  // Competitor info
  competitorName: text("competitor_name"),
  competitorType: text("competitor_type"), // individual, company, platform
  
  // Pricing
  serviceName: text("service_name"),
  priceCents: integer("price_cents").notNull(),
  priceUnit: text("price_unit"), // hour, session, project
  
  // Additional fees
  bookingFeeCents: integer("booking_fee_cents"),
  cancellationFeeCents: integer("cancellation_fee_cents"),
  
  // Source
  dataSource: text("data_source"), // manual, scraped, api
  sourceUrl: text("source_url"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00 - 1.00
  
  // Status
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  observedAt: timestamp("observed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Indexes are defined within the table definitions using unique() and index() methods
// No separate index exports needed as they're handled inline

// Type exports
export type PricingRule = typeof pricingRulesTable.$inferSelect;
export type NewPricingRule = typeof pricingRulesTable.$inferInsert;
export type DemandMetric = typeof demandMetricsTable.$inferSelect;
export type NewDemandMetric = typeof demandMetricsTable.$inferInsert;
export type PriceAlert = typeof priceAlertsTable.$inferSelect;
export type NewPriceAlert = typeof priceAlertsTable.$inferInsert;
export type SurgePricingEvent = typeof surgePricingEventsTable.$inferSelect;
export type NewSurgePricingEvent = typeof surgePricingEventsTable.$inferInsert;
export type PriceHistory = typeof priceHistoryTable.$inferSelect;
export type NewPriceHistory = typeof priceHistoryTable.$inferInsert;
export type CompetitorPricing = typeof competitorPricingTable.$inferSelect;
export type NewCompetitorPricing = typeof competitorPricingTable.$inferInsert;