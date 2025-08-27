import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  integer,
  jsonb,
  pgEnum
} from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings-schema";
import { profilesTable } from "./profiles-schema";

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded"
]);

// Payments table - Track all payment transactions
export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Booking reference
  bookingId: uuid("booking_id")
    .references(() => bookingsTable.id, { onDelete: "restrict" }),
  
  // User reference (nullable for guest payments)
  userId: text("user_id")
    .references(() => profilesTable.userId, { onDelete: "set null" }),
  
  // Stripe IDs
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeChargeId: text("stripe_charge_id"),
  stripeRefundId: text("stripe_refund_id"),
  stripeCustomerId: text("stripe_customer_id"),
  
  // Amounts (in cents)
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("usd").notNull(),
  platformFeeCents: integer("platform_fee_cents").default(0),
  providerPayoutCents: integer("provider_payout_cents").default(0),
  refundedAmountCents: integer("refunded_amount_cents").default(0),
  
  // Status
  status: paymentStatusEnum("status").default("pending").notNull(),
  
  // Payment method details
  paymentMethod: text("payment_method"), // card, bank_transfer, etc.
  last4: text("last4"), // Last 4 digits of card
  brand: text("brand"), // Card brand (visa, mastercard, etc.)
  
  // Metadata
  metadata: jsonb("metadata").default('{}'),
  
  // Error tracking
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Timestamps
  processedAt: timestamp("processed_at"),
  failedAt: timestamp("failed_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports
export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;