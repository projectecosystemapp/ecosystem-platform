import { pgTable, text, uuid, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { providersTable } from "./providers-schema";
import { profilesTable } from "./profiles-schema";

// Booking status enum
export const bookingStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

// Main bookings table
export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "restrict" }), // RESTRICT: Prevent deleting provider with bookings
  customerId: text("customer_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "restrict" }), // RESTRICT: Prevent deleting customer with bookings
  
  // Service details
  serviceName: text("service_name").notNull(),
  servicePrice: numeric("service_price", { precision: 10, scale: 2 }).notNull(),
  serviceDuration: integer("service_duration").notNull(), // in minutes
  
  // Booking time
  bookingDate: timestamp("booking_date").notNull(),
  startTime: text("start_time").notNull(), // Format: "14:00"
  endTime: text("end_time").notNull(), // Format: "15:00"
  
  // Status
  status: text("status", { enum: Object.values(bookingStatus) as [string, ...string[]] })
    .default(bookingStatus.PENDING)
    .notNull(),
  
  // Payment information
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(),
  providerPayout: numeric("provider_payout", { precision: 10, scale: 2 }).notNull(),
  
  // Additional info
  customerNotes: text("customer_notes"),
  providerNotes: text("provider_notes"),
  cancellationReason: text("cancellation_reason"),
  cancelledBy: text("cancelled_by")
    .references(() => profilesTable.userId, { onDelete: "set null" }), // SET NULL: Allow null if cancelling user is deleted
  
  // Group booking flag
  isGroupBooking: boolean("is_group_booking").default(false),
  cancelledAt: timestamp("cancelled_at"),
  
  // Booking confirmation
  confirmationCode: text("confirmation_code"),
  
  // Guest booking fields
  isGuestBooking: boolean("is_guest_booking").default(false).notNull(),
  guestEmail: text("guest_email"), // Email for guest bookings (nullable for authenticated bookings)
  
  // Universal booking type
  bookingType: text("booking_type", { 
    enum: ["service", "event", "space"] 
  }).default("service").notNull(),
  
  // References to other entities (nullable based on booking type)
  eventId: uuid("event_id"), // For event bookings
  spaceId: uuid("space_id"), // For space bookings
  serviceId: uuid("service_id"), // For service bookings
  
  // Additional metadata for different booking types
  metadata: jsonb("metadata").$type<{
    // Event specific
    numberOfGuests?: number;
    dietaryRestrictions?: string;
    
    // Space specific
    purpose?: string;
    setupRequirements?: string;
    
    // Service specific
    location?: string;
    urgency?: string;
    
    // Marketplace purchase specific
    thingId?: string;
    thingTitle?: string;
    deliveryMethod?: string;
    shippingAddress?: any;
    pickupSchedule?: any;
    buyerNotes?: string;
    itemPrice?: number;
    shippingCost?: number;
    purchaseType?: string;
  }>().default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Transactions table for tracking payments and payouts
export const transactionsTable = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }), // CASCADE: Delete transactions when booking is deleted
  
  // Stripe IDs
  stripeChargeId: text("stripe_charge_id"),
  stripeTransferId: text("stripe_transfer_id"),
  stripeRefundId: text("stripe_refund_id"),
  
  // Amounts
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(),
  providerPayout: numeric("provider_payout", { precision: 10, scale: 2 }).notNull(),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }),
  
  // Status
  status: text("status", { 
    enum: ["pending", "completed", "refunded", "failed"] as const 
  }).default("pending").notNull(),
  
  // Timestamps
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for TypeScript
export type Booking = typeof bookingsTable.$inferSelect;
export type NewBooking = typeof bookingsTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;