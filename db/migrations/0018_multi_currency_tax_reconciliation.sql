-- Migration for Multi-Currency Support, Tax Handling, and Reconciliation
-- =====================================================================

-- 1. Multi-Currency Support
-- -------------------------

-- Add currency fields to transactions table
ALTER TABLE "transactions" 
ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL,
ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(10, 6) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS "original_amount" numeric(10, 2),
ADD COLUMN IF NOT EXISTS "original_currency" text;

-- Add currency to bookings table
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'USD' NOT NULL;

-- Add currency to payout_schedules table  
ALTER TABLE "payout_schedules"
ADD COLUMN IF NOT EXISTS "original_currency" text,
ADD COLUMN IF NOT EXISTS "exchange_rate" numeric(10, 6) DEFAULT 1.0;

-- Add currency preferences to providers
ALTER TABLE "providers"
ADD COLUMN IF NOT EXISTS "preferred_currency" text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS "supported_currencies" jsonb DEFAULT '["USD"]'::jsonb;

-- 2. Tax Handling
-- ---------------

-- Create tax_rates table
CREATE TABLE IF NOT EXISTS "tax_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "country" text NOT NULL,
  "state" text,
  "city" text,
  "postal_code" text,
  "tax_type" text NOT NULL, -- 'sales_tax', 'vat', 'gst', 'service_tax'
  "rate" numeric(5, 4) NOT NULL, -- e.g., 0.0875 for 8.75%
  "applies_to" text[], -- ['service', 'platform_fee', 'all']
  "effective_date" timestamp NOT NULL,
  "end_date" timestamp,
  "is_active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "unique_active_tax_rate" UNIQUE("country", "state", "city", "postal_code", "tax_type", "is_active")
);

-- Create tax_calculations table
CREATE TABLE IF NOT EXISTS "tax_calculations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE cascade,
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE cascade,
  "tax_rate_id" uuid REFERENCES "tax_rates"("id") ON DELETE restrict,
  "taxable_amount" numeric(10, 2) NOT NULL,
  "tax_amount" numeric(10, 2) NOT NULL,
  "tax_type" text NOT NULL,
  "jurisdiction" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Add tax fields to transactions
ALTER TABLE "transactions"
ADD COLUMN IF NOT EXISTS "tax_amount" numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tax_details" jsonb DEFAULT '{}'::jsonb;

-- Add tax fields to bookings
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "tax_amount" numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tax_breakdown" jsonb DEFAULT '{}'::jsonb;

-- 3. Reconciliation System
-- ------------------------

-- Create reconciliation_runs table
CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_date" date NOT NULL,
  "run_type" text NOT NULL, -- 'daily', 'weekly', 'monthly', 'manual'
  "status" text DEFAULT 'pending' NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  "total_transactions" integer DEFAULT 0,
  "matched_transactions" integer DEFAULT 0,
  "unmatched_transactions" integer DEFAULT 0,
  "discrepancies_found" integer DEFAULT 0,
  "total_amount_reconciled" numeric(12, 2) DEFAULT 0,
  "start_time" timestamp,
  "end_time" timestamp,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "unique_daily_reconciliation" UNIQUE("run_date", "run_type")
);

-- Create reconciliation_items table
CREATE TABLE IF NOT EXISTS "reconciliation_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reconciliation_run_id" uuid REFERENCES "reconciliation_runs"("id") ON DELETE cascade,
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE set null,
  "stripe_charge_id" text,
  "stripe_transfer_id" text,
  "stripe_payout_id" text,
  "item_type" text NOT NULL, -- 'charge', 'transfer', 'payout', 'refund', 'fee'
  "database_amount" numeric(10, 2),
  "stripe_amount" numeric(10, 2),
  "discrepancy_amount" numeric(10, 2),
  "currency" text DEFAULT 'USD',
  "status" text NOT NULL, -- 'matched', 'unmatched', 'discrepancy', 'missing_in_db', 'missing_in_stripe'
  "resolution_status" text, -- 'pending', 'resolved', 'escalated', 'ignored'
  "resolution_notes" text,
  "resolved_by" text,
  "resolved_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 4. Dispute Management
-- ---------------------

-- Create disputes table
CREATE TABLE IF NOT EXISTS "disputes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE restrict,
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE restrict,
  "stripe_dispute_id" text UNIQUE NOT NULL,
  "amount" numeric(10, 2) NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "reason" text NOT NULL, -- Stripe dispute reason
  "status" text NOT NULL, -- 'warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost'
  "evidence_due_by" timestamp,
  "evidence_submitted_at" timestamp,
  "evidence" jsonb DEFAULT '{}'::jsonb,
  "outcome" jsonb DEFAULT '{}'::jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create dispute_evidence table
CREATE TABLE IF NOT EXISTS "dispute_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dispute_id" uuid REFERENCES "disputes"("id") ON DELETE cascade,
  "evidence_type" text NOT NULL, -- 'receipt', 'customer_communication', 'service_documentation', 'refund_policy', 'shipping_documentation', 'other'
  "file_url" text,
  "description" text,
  "submitted_to_stripe" boolean DEFAULT false,
  "submitted_at" timestamp,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 5. Provider Financial Metrics
-- -----------------------------

-- Create provider_financial_summary table
CREATE TABLE IF NOT EXISTS "provider_financial_summary" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid REFERENCES "providers"("id") ON DELETE cascade,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "period_type" text NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly'
  "total_revenue" numeric(12, 2) DEFAULT 0,
  "total_fees" numeric(12, 2) DEFAULT 0,
  "net_earnings" numeric(12, 2) DEFAULT 0,
  "total_bookings" integer DEFAULT 0,
  "completed_bookings" integer DEFAULT 0,
  "cancelled_bookings" integer DEFAULT 0,
  "refunded_amount" numeric(12, 2) DEFAULT 0,
  "average_booking_value" numeric(10, 2) DEFAULT 0,
  "tax_collected" numeric(10, 2) DEFAULT 0,
  "currency" text DEFAULT 'USD',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "calculated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "unique_provider_period" UNIQUE("provider_id", "period_start", "period_end", "period_type")
);

-- Create provider_payout_history table
CREATE TABLE IF NOT EXISTS "provider_payout_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" uuid REFERENCES "providers"("id") ON DELETE cascade,
  "payout_schedule_id" uuid REFERENCES "payout_schedules"("id") ON DELETE set null,
  "stripe_payout_id" text,
  "amount" numeric(10, 2) NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "status" text NOT NULL, -- 'pending', 'in_transit', 'paid', 'failed', 'canceled'
  "arrival_date" timestamp,
  "method" text, -- 'standard', 'instant'
  "description" text,
  "failure_code" text,
  "failure_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 6. Indexes for Performance
-- --------------------------

CREATE INDEX IF NOT EXISTS "idx_transactions_currency" ON "transactions" ("currency");
CREATE INDEX IF NOT EXISTS "idx_tax_rates_location" ON "tax_rates" ("country", "state", "city", "is_active");
CREATE INDEX IF NOT EXISTS "idx_tax_calculations_booking" ON "tax_calculations" ("booking_id");
CREATE INDEX IF NOT EXISTS "idx_reconciliation_runs_date" ON "reconciliation_runs" ("run_date", "status");
CREATE INDEX IF NOT EXISTS "idx_reconciliation_items_status" ON "reconciliation_items" ("status", "resolution_status");
CREATE INDEX IF NOT EXISTS "idx_disputes_status" ON "disputes" ("status", "evidence_due_by");
CREATE INDEX IF NOT EXISTS "idx_provider_financial_summary" ON "provider_financial_summary" ("provider_id", "period_type", "period_start");
CREATE INDEX IF NOT EXISTS "idx_provider_payout_history" ON "provider_payout_history" ("provider_id", "status", "created_at");

-- 7. Triggers for Updated Timestamps
-- ----------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tax_rates_updated_at
BEFORE UPDATE ON "tax_rates"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_disputes_updated_at  
BEFORE UPDATE ON "disputes"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- 8. Views for Reporting
-- ----------------------

-- Provider earnings view
CREATE OR REPLACE VIEW "provider_earnings_view" AS
SELECT 
  p.id as provider_id,
  p.business_name,
  DATE_TRUNC('month', t.created_at) as month,
  COUNT(DISTINCT t.booking_id) as total_bookings,
  SUM(t.provider_payout) as gross_earnings,
  SUM(t.platform_fee) as platform_fees_paid,
  SUM(COALESCE(t.tax_amount, 0)) as tax_collected,
  SUM(COALESCE(t.refund_amount, 0)) as refunds,
  t.currency,
  COUNT(DISTINCT CASE WHEN d.id IS NOT NULL THEN t.id END) as disputed_transactions
FROM providers p
LEFT JOIN bookings b ON p.id = b.provider_id
LEFT JOIN transactions t ON b.id = t.booking_id
LEFT JOIN disputes d ON t.id = d.transaction_id
WHERE t.status = 'completed'
GROUP BY p.id, p.business_name, DATE_TRUNC('month', t.created_at), t.currency;

-- Reconciliation summary view
CREATE OR REPLACE VIEW "reconciliation_summary_view" AS
SELECT
  run_date,
  run_type,
  status,
  total_transactions,
  matched_transactions,
  ROUND((matched_transactions::numeric / NULLIF(total_transactions, 0)) * 100, 2) as match_rate,
  discrepancies_found,
  total_amount_reconciled,
  end_time - start_time as processing_time
FROM reconciliation_runs
ORDER BY run_date DESC;