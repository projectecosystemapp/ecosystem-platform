-- Migration: Add webhook audit and dispute tracking tables
-- Description: Tables to track webhook events, disputes, and notification logs

-- Webhook events audit table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  payload JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP,
  
  -- Index for querying by event type and status
  INDEX idx_webhook_events_type_status (event_type, status),
  INDEX idx_webhook_events_created_at (created_at DESC)
);

-- Disputes table for tracking chargebacks
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  transaction_id UUID REFERENCES transactions(id),
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  
  -- Dispute details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  
  -- Evidence and deadlines
  evidence_due_by TIMESTAMP,
  evidence_submitted_at TIMESTAMP,
  evidence_details JSONB,
  
  -- Outcome
  outcome TEXT,
  funds_withdrawn BOOLEAN DEFAULT FALSE,
  funds_reinstated BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  resolved_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_disputes_booking_id (booking_id),
  INDEX idx_disputes_status (status),
  INDEX idx_disputes_evidence_due (evidence_due_by)
);

-- Notification log table
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Notification details
  type TEXT NOT NULL,
  recipient_id TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  
  -- Content
  subject TEXT,
  body TEXT,
  template_name TEXT,
  template_data JSONB,
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  error_message TEXT,
  
  -- Provider information
  provider TEXT, -- e.g., 'sendgrid', 'twilio', 'firebase'
  provider_message_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_notification_logs_recipient (recipient_id),
  INDEX idx_notification_logs_type_status (type, status),
  INDEX idx_notification_logs_created_at (created_at DESC)
);

-- Payout tracking table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id),
  
  -- Stripe details
  stripe_payout_id TEXT NOT NULL UNIQUE,
  stripe_account_id TEXT NOT NULL,
  
  -- Payout details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  arrival_date DATE,
  method TEXT, -- 'standard' or 'instant'
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  failure_code TEXT,
  failure_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_payouts_provider_id (provider_id),
  INDEX idx_payouts_status (status),
  INDEX idx_payouts_arrival_date (arrival_date)
);

-- Add indexes to existing tables if they don't exist
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_charge_id ON transactions(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_payment_intent_id ON bookings(stripe_payment_intent_id);

-- Add trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to new tables
CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE webhook_events IS 'Audit log for all Stripe webhook events';
COMMENT ON TABLE disputes IS 'Track payment disputes and chargebacks';
COMMENT ON TABLE notification_logs IS 'Log of all notifications sent through the platform';
COMMENT ON TABLE payouts IS 'Track provider payouts and their status';