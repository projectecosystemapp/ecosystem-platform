-- Remove variable commission rates and subscription system
-- Enforces constitution mandate: Fixed 10% platform fee + 10% guest surcharge

-- Remove commission-related columns from providers
ALTER TABLE providers DROP COLUMN IF EXISTS commission_rate;

-- Drop commission and category tables (variable rate system)
DROP TABLE IF EXISTS commission_rules CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;

-- Drop entire subscription system tables
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_usage CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS usage_credits CASCADE;
DROP TABLE IF EXISTS subscription_tiers CASCADE;
DROP TABLE IF EXISTS subscription_benefits CASCADE;
DROP TABLE IF EXISTS billing_cycles CASCADE;

-- Remove subscription-related columns from profiles
ALTER TABLE profiles 
  DROP COLUMN IF EXISTS subscription_id,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS usage_credits,
  DROP COLUMN IF EXISTS used_credits,
  DROP COLUMN IF EXISTS billing_cycle_start,
  DROP COLUMN IF EXISTS billing_cycle_end,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS monthly_credit_allowance;

-- Remove subscription-related columns from bookings if they exist
ALTER TABLE bookings
  DROP COLUMN IF EXISTS used_credits,
  DROP COLUMN IF EXISTS credit_discount_applied,
  DROP COLUMN IF EXISTS subscription_discount;

-- Remove any loyalty/credit system tables
DROP TABLE IF EXISTS loyalty_points CASCADE;
DROP TABLE IF EXISTS loyalty_tiers CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS credit_balances CASCADE;

-- Clean up any RBAC tables related to variable pricing
DROP TABLE IF EXISTS role_commission_overrides CASCADE;
DROP TABLE IF EXISTS tier_based_commissions CASCADE;

-- Add comment to document the fixed fee structure
COMMENT ON TABLE providers IS 'Provider profiles - all providers pay fixed 10% platform fee per constitution';
COMMENT ON TABLE bookings IS 'Bookings - platform takes 10% commission, guests pay additional 10% surcharge';