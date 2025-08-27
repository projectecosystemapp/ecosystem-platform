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
  uniqueIndex
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles-schema";
import { bookingsTable } from "./bookings-schema";
import { providersTable } from "./providers-schema";

// Enums
export const loyaltyTierEnum = pgEnum("loyalty_tier", [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond"
]);

export const pointsTransactionTypeEnum = pgEnum("points_transaction_type", [
  "earned_booking",
  "earned_referral",
  "earned_bonus",
  "earned_review",
  "redeemed_discount",
  "redeemed_service",
  "expired",
  "adjusted",
  "transferred"
]);

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "clicked",
  "signed_up",
  "completed",
  "expired",
  "cancelled"
]);

// Loyalty Accounts - Customer loyalty program membership
export const loyaltyAccountsTable = pgTable("loyalty_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id")
    .notNull()
    .unique()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  
  // Points balance
  pointsBalance: integer("points_balance").default(0).notNull(),
  lifetimePointsEarned: integer("lifetime_points_earned").default(0).notNull(),
  lifetimePointsRedeemed: integer("lifetime_points_redeemed").default(0).notNull(),
  
  // Tier status
  tier: loyaltyTierEnum("tier").default("bronze").notNull(),
  tierProgressAmount: integer("tier_progress_amount").default(0), // Amount spent toward next tier
  tierExpiresAt: timestamp("tier_expires_at"), // When tier drops if no activity
  nextTierThreshold: integer("next_tier_threshold"), // Amount needed for next tier
  
  // Benefits tracking
  benefitsUnlocked: jsonb("benefits_unlocked").default('[]'), // Array of benefit codes
  specialOffers: jsonb("special_offers").default('[]'), // Personalized offers
  
  // Activity tracking
  lastActivityAt: timestamp("last_activity_at"),
  lastEarnedAt: timestamp("last_earned_at"),
  lastRedeemedAt: timestamp("last_redeemed_at"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isSuspended: boolean("is_suspended").default(false),
  suspensionReason: text("suspension_reason"),
  
  // Metadata
  preferences: jsonb("preferences").default('{}'), // {email_notifications: true, auto_redeem: false}
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Points Transactions - All point movements
export const pointsTransactionsTable = pgTable("points_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => loyaltyAccountsTable.id, { onDelete: "cascade" }),
  
  // Transaction details
  type: pointsTransactionTypeEnum("type").notNull(),
  points: integer("points").notNull(), // Positive for earned, negative for redeemed
  
  // Balance tracking
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  
  // Related entities
  bookingId: uuid("booking_id")
    .references(() => bookingsTable.id, { onDelete: "set null" }),
  referralId: uuid("referral_id")
    .references(() => referralsTable.id, { onDelete: "set null" }),
  
  // Description and metadata
  description: text("description"),
  metadata: jsonb("metadata").default('{}'),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  expiredPoints: integer("expired_points").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Referrals - Track referral program
export const referralsTable = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Referrer (who sent the referral)
  referrerId: text("referrer_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  referrerRewardPoints: integer("referrer_reward_points").default(500),
  referrerRewardIssued: boolean("referrer_reward_issued").default(false),
  
  // Referred (who was referred)
  referredEmail: text("referred_email").notNull(),
  referredUserId: text("referred_user_id")
    .references(() => profilesTable.userId, { onDelete: "set null" }),
  referredRewardPoints: integer("referred_reward_points").default(250),
  referredRewardIssued: boolean("referred_reward_issued").default(false),
  
  // Tracking
  referralCode: text("referral_code").unique().notNull(),
  referralLink: text("referral_link"),
  
  // Status
  status: referralStatusEnum("status").default("pending").notNull(),
  
  // Milestones
  clickedAt: timestamp("clicked_at"),
  signedUpAt: timestamp("signed_up_at"),
  firstBookingAt: timestamp("first_booking_at"),
  completedAt: timestamp("completed_at"),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  // Campaign tracking
  campaignCode: text("campaign_code"),
  source: text("source"), // email, social, app
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Loyalty Tiers Configuration - Define tier requirements and benefits
export const loyaltyTiersTable = pgTable("loyalty_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: loyaltyTierEnum("tier").unique().notNull(),
  
  // Requirements
  minSpend: integer("min_spend").notNull(), // Minimum annual spend in cents
  minBookings: integer("min_bookings").default(0), // Minimum bookings per year
  minPoints: integer("min_points").default(0), // Minimum points earned
  
  // Benefits
  pointsMultiplier: decimal("points_multiplier", { precision: 3, scale: 2 }).default("1.00"), // 1.5x = 50% more points
  discountPercent: integer("discount_percent").default(0), // Automatic discount on bookings
  benefits: jsonb("benefits").default('[]'), // Array of benefit descriptions
  
  // Perks
  prioritySupport: boolean("priority_support").default(false),
  freeDelivery: boolean("free_delivery").default(false),
  exclusiveAccess: boolean("exclusive_access").default(false),
  birthdayBonus: integer("birthday_bonus_points").default(0),
  
  // Visual
  displayName: text("display_name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  color: text("color"), // Hex color for UI
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Loyalty Campaigns - Special promotions and bonus point events
export const loyaltyCampaignsTable = pgTable("loyalty_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Campaign details
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // double_points, bonus_points, tier_upgrade
  
  // Timing
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Rules
  rules: jsonb("rules").default('{}'), // {min_spend: 5000, categories: ['spa', 'fitness']}
  pointsMultiplier: decimal("points_multiplier", { precision: 3, scale: 2 }).default("1.00"),
  bonusPoints: integer("bonus_points").default(0),
  
  // Targeting
  targetTiers: jsonb("target_tiers").default('[]'), // Which tiers are eligible
  targetProviders: jsonb("target_providers").default('[]'), // Specific provider IDs
  maxRedemptions: integer("max_redemptions"), // Total campaign limit
  maxPerCustomer: integer("max_per_customer").default(1),
  
  // Tracking
  totalRedemptions: integer("total_redemptions").default(0),
  totalPointsAwarded: integer("total_points_awarded").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Points Redemption Options - What customers can redeem points for
export const redemptionOptionsTable = pgTable("redemption_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Option details
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // discount, free_service, gift_card, donation
  
  // Cost
  pointsCost: integer("points_cost").notNull(),
  
  // Value
  discountPercent: integer("discount_percent"), // For discount type
  discountAmountCents: integer("discount_amount_cents"), // For fixed discount
  serviceId: uuid("service_id"), // For free service
  
  // Restrictions
  minBookingAmount: integer("min_booking_amount"), // Minimum booking value to use
  validCategories: jsonb("valid_categories").default('[]'), // Which service categories
  validProviders: jsonb("valid_providers").default('[]'), // Specific providers
  
  // Availability
  isActive: boolean("is_active").default(true),
  stockLimit: integer("stock_limit"), // For limited offers
  stockRemaining: integer("stock_remaining"),
  expiresAt: timestamp("expires_at"),
  
  // Metadata
  imageUrl: text("image_url"),
  terms: text("terms"),
  metadata: jsonb("metadata").default('{}'),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Indexes are defined within the table definitions using unique() and index() methods
// No separate index exports needed as they're handled inline

// Type exports
export type LoyaltyAccount = typeof loyaltyAccountsTable.$inferSelect;
export type NewLoyaltyAccount = typeof loyaltyAccountsTable.$inferInsert;
export type PointsTransaction = typeof pointsTransactionsTable.$inferSelect;
export type NewPointsTransaction = typeof pointsTransactionsTable.$inferInsert;
export type Referral = typeof referralsTable.$inferSelect;
export type NewReferral = typeof referralsTable.$inferInsert;
export type LoyaltyTier = typeof loyaltyTiersTable.$inferSelect;
export type NewLoyaltyTier = typeof loyaltyTiersTable.$inferInsert;
export type LoyaltyCampaign = typeof loyaltyCampaignsTable.$inferSelect;
export type NewLoyaltyCampaign = typeof loyaltyCampaignsTable.$inferInsert;
export type RedemptionOption = typeof redemptionOptionsTable.$inferSelect;
export type NewRedemptionOption = typeof redemptionOptionsTable.$inferInsert;