-- Create idempotency_keys table for preventing duplicate Stripe operations
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    operation TEXT NOT NULL, -- payment_intent, refund, transfer, etc.
    resource_id TEXT, -- Stripe resource ID after successful operation
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    response TEXT, -- JSON string of the response
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for efficient lookups
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_keys_operation ON idempotency_keys(operation);

-- Add payout tracking columns to transactions table if they don't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payout_scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payout_released_at TIMESTAMP;

-- Add index for payout scheduling
CREATE INDEX IF NOT EXISTS idx_transactions_payout_scheduled 
ON transactions(payout_scheduled_at) 
WHERE status = 'pending' AND payout_scheduled_at IS NOT NULL;

-- Add refund tracking columns to bookings table if they don't exist
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- Create a function to automatically clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM idempotency_keys 
    WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- This is commented out by default as it requires the pg_cron extension
-- Uncomment if you have pg_cron installed:
/*
SELECT cron.schedule(
    'cleanup-idempotency-keys',
    '0 */6 * * *', -- Run every 6 hours
    'SELECT cleanup_expired_idempotency_keys();'
);
*/

-- Add comment documentation
COMMENT ON TABLE idempotency_keys IS 'Stores idempotency keys for Stripe operations to prevent duplicate charges';
COMMENT ON COLUMN idempotency_keys.key IS 'SHA256 hash used as idempotency key for Stripe API calls';
COMMENT ON COLUMN idempotency_keys.operation IS 'Type of Stripe operation (payment_intent, refund, transfer, etc.)';
COMMENT ON COLUMN idempotency_keys.resource_id IS 'Stripe resource ID returned after successful operation';
COMMENT ON COLUMN idempotency_keys.response IS 'JSON response from Stripe API stored for replay';
COMMENT ON COLUMN idempotency_keys.expires_at IS 'Expiration time for the idempotency key';

-- Create audit trigger for payment operations
CREATE OR REPLACE FUNCTION audit_payment_operation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log important payment operations for audit trail
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'transactions' THEN
        INSERT INTO audit_logs (
            table_name,
            operation,
            record_id,
            changes,
            performed_by,
            performed_at
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            NEW.id,
            jsonb_build_object(
                'booking_id', NEW.booking_id,
                'amount', NEW.amount,
                'status', NEW.status,
                'stripe_charge_id', NEW.stripe_charge_id,
                'stripe_transfer_id', NEW.stripe_transfer_id,
                'stripe_refund_id', NEW.stripe_refund_id
            ),
            current_user,
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id UUID,
    changes JSONB,
    performed_by TEXT,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Apply audit trigger to transactions table
DROP TRIGGER IF EXISTS audit_transactions_trigger ON transactions;
CREATE TRIGGER audit_transactions_trigger
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION audit_payment_operation();