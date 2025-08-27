import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  numeric, 
  integer,
  date,
  jsonb
} from "drizzle-orm/pg-core";

// Reconciliation runs table
export const reconciliationRunsTable = pgTable("reconciliation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runDate: date("run_date").notNull(),
  runType: text("run_type", { 
    enum: ["daily", "weekly", "monthly", "manual"] 
  }).default("daily").notNull(),
  status: text("status", { 
    enum: ["pending", "running", "completed", "failed"] 
  }).default("pending").notNull(),
  
  // Timing
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  
  // Statistics
  totalTransactions: integer("total_transactions").default(0),
  matchedTransactions: integer("matched_transactions").default(0),
  unmatchedTransactions: integer("unmatched_transactions").default(0),
  discrepanciesFound: integer("discrepancies_found").default(0),
  totalAmountReconciled: numeric("total_amount_reconciled", { precision: 10, scale: 2 }).default("0"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  // Metadata
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reconciliation items table
export const reconciliationItemsTable = pgTable("reconciliation_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  reconciliationRunId: uuid("reconciliation_run_id")
    .notNull()
    .references(() => reconciliationRunsTable.id, { onDelete: "cascade" }),
  transactionId: uuid("transaction_id"),
  
  // Stripe identifiers
  stripeChargeId: text("stripe_charge_id"),
  stripeTransferId: text("stripe_transfer_id"),
  stripeRefundId: text("stripe_refund_id"),
  stripePayoutId: text("stripe_payout_id"),
  
  // Item details
  itemType: text("item_type", { 
    enum: ["charge", "transfer", "refund", "payout"] 
  }).notNull(),
  databaseAmount: numeric("database_amount", { precision: 10, scale: 2 }),
  stripeAmount: numeric("stripe_amount", { precision: 10, scale: 2 }),
  discrepancyAmount: numeric("discrepancy_amount", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  
  // Status
  status: text("status", { 
    enum: ["matched", "missing_in_db", "missing_in_stripe", "amount_mismatch"] 
  }).notNull(),
  resolutionStatus: text("resolution_status", { 
    enum: ["pending", "resolved", "escalated", "ignored"] 
  }).default("pending"),
  
  // Resolution tracking
  resolutionNotes: text("resolution_notes"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports
export type ReconciliationRun = typeof reconciliationRunsTable.$inferSelect;
export type NewReconciliationRun = typeof reconciliationRunsTable.$inferInsert;
export type ReconciliationItem = typeof reconciliationItemsTable.$inferSelect;
export type NewReconciliationItem = typeof reconciliationItemsTable.$inferInsert;