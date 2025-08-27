-- Reconciliation tables for financial tracking and auditing
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  run_type VARCHAR(50) NOT NULL DEFAULT 'daily', -- daily, weekly, monthly, manual
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  
  -- Statistics
  total_transactions INTEGER DEFAULT 0,
  matched_transactions INTEGER DEFAULT 0,
  unmatched_transactions INTEGER DEFAULT 0,
  discrepancies_found INTEGER DEFAULT 0,
  total_amount_reconciled DECIMAL(10, 2) DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_runs_date ON reconciliation_runs(run_date);
CREATE INDEX idx_reconciliation_runs_status ON reconciliation_runs(status);

-- Individual reconciliation items
CREATE TABLE IF NOT EXISTS reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id),
  
  -- Stripe identifiers
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  stripe_refund_id VARCHAR(255),
  stripe_payout_id VARCHAR(255),
  
  -- Item details
  item_type VARCHAR(50) NOT NULL, -- charge, transfer, refund, payout
  database_amount DECIMAL(10, 2),
  stripe_amount DECIMAL(10, 2),
  discrepancy_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  
  -- Status
  status VARCHAR(50) NOT NULL, -- matched, missing_in_db, missing_in_stripe, amount_mismatch
  resolution_status VARCHAR(50) DEFAULT 'pending', -- pending, resolved, escalated, ignored
  
  -- Resolution tracking
  resolution_notes TEXT,
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reconciliation_items_run ON reconciliation_items(reconciliation_run_id);
CREATE INDEX idx_reconciliation_items_status ON reconciliation_items(status);
CREATE INDEX idx_reconciliation_items_resolution ON reconciliation_items(resolution_status);

-- Add missing columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;

-- Add missing columns to payout_schedules table
ALTER TABLE payout_schedules 
ADD COLUMN IF NOT EXISTS stripe_payout_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Create index for faster payout processing
CREATE INDEX IF NOT EXISTS idx_payout_schedules_scheduled ON payout_schedules(status, scheduled_at) 
WHERE status = 'scheduled';