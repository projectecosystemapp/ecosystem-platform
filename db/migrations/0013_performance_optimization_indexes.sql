-- Performance Optimization Migration
-- This migration adds critical indexes and foreign key constraints to improve query performance

-- ============================================
-- FOREIGN KEY CONSTRAINTS (Complete missing FKs)
-- ============================================

-- Profiles table foreign key
ALTER TABLE profiles 
  ADD CONSTRAINT fk_profiles_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Providers table foreign keys
ALTER TABLE providers 
  ADD CONSTRAINT fk_providers_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES profiles(user_id) 
  ON DELETE CASCADE;

-- Provider testimonials foreign key
ALTER TABLE provider_testimonials 
  ADD CONSTRAINT fk_testimonials_provider_id 
  FOREIGN KEY (provider_id) 
  REFERENCES providers(id) 
  ON DELETE CASCADE;

-- Provider availability foreign key
ALTER TABLE provider_availability 
  ADD CONSTRAINT fk_availability_provider_id 
  FOREIGN KEY (provider_id) 
  REFERENCES providers(id) 
  ON DELETE CASCADE;

-- Provider blocked slots foreign key
ALTER TABLE provider_blocked_slots 
  ADD CONSTRAINT fk_blocked_slots_provider_id 
  FOREIGN KEY (provider_id) 
  REFERENCES providers(id) 
  ON DELETE CASCADE;

-- Bookings table foreign keys
ALTER TABLE bookings 
  ADD CONSTRAINT fk_bookings_provider_id 
  FOREIGN KEY (provider_id) 
  REFERENCES providers(id) 
  ON DELETE RESTRICT,
  ADD CONSTRAINT fk_bookings_customer_id 
  FOREIGN KEY (customer_id) 
  REFERENCES profiles(user_id) 
  ON DELETE RESTRICT;

-- Transactions table foreign key
ALTER TABLE transactions 
  ADD CONSTRAINT fk_transactions_booking_id 
  FOREIGN KEY (booking_id) 
  REFERENCES bookings(id) 
  ON DELETE CASCADE;

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- 1. Provider Search Indexes
-- --------------------------------------------

-- Composite index for provider search with location and verification
CREATE INDEX idx_providers_search_location 
  ON providers (location_city, location_state, is_active, is_verified) 
  WHERE is_active = true;

-- Index for provider rating and booking count (for featured/popular queries)
CREATE INDEX idx_providers_rating_bookings 
  ON providers (average_rating DESC, completed_bookings DESC) 
  WHERE is_active = true AND is_verified = true;

-- Index for price range queries
CREATE INDEX idx_providers_hourly_rate 
  ON providers (hourly_rate) 
  WHERE is_active = true AND hourly_rate IS NOT NULL;

-- Unique index on slug for fast lookups
CREATE UNIQUE INDEX idx_providers_slug ON providers (slug);

-- Index for user_id lookups
CREATE INDEX idx_providers_user_id ON providers (user_id);

-- Full-text search index for provider discovery
CREATE INDEX idx_providers_fulltext 
  ON providers 
  USING gin(to_tsvector('english', 
    coalesce(display_name, '') || ' ' || 
    coalesce(tagline, '') || ' ' || 
    coalesce(bio, '')));

-- 2. Booking Query Indexes
-- --------------------------------------------

-- Composite index for booking conflict detection
CREATE INDEX idx_bookings_conflict_check 
  ON bookings (provider_id, booking_date, start_time, end_time) 
  WHERE status NOT IN ('cancelled', 'no_show');

-- Index for customer bookings lookup
CREATE INDEX idx_bookings_customer 
  ON bookings (customer_id, booking_date DESC, created_at DESC);

-- Index for provider bookings lookup
CREATE INDEX idx_bookings_provider 
  ON bookings (provider_id, booking_date DESC, created_at DESC);

-- Index for status-based queries
CREATE INDEX idx_bookings_status 
  ON bookings (status, booking_date) 
  WHERE status IN ('pending', 'confirmed');

-- Index for date range queries
CREATE INDEX idx_bookings_date_range 
  ON bookings (booking_date, start_time) 
  WHERE status != 'cancelled';

-- Index for upcoming bookings (dashboard queries)
CREATE INDEX idx_bookings_upcoming 
  ON bookings (booking_date, start_time) 
  WHERE status = 'confirmed' AND booking_date >= CURRENT_DATE;

-- 3. Availability Indexes
-- --------------------------------------------

-- Index for provider availability lookup
CREATE INDEX idx_availability_provider_day 
  ON provider_availability (provider_id, day_of_week) 
  WHERE is_active = true;

-- Index for blocked slots date range queries
CREATE INDEX idx_blocked_slots_date 
  ON provider_blocked_slots (provider_id, blocked_date);

-- 4. Transaction Indexes
-- --------------------------------------------

-- Index for transaction lookups by booking
CREATE INDEX idx_transactions_booking 
  ON transactions (booking_id, created_at DESC);

-- Index for pending transactions
CREATE INDEX idx_transactions_pending 
  ON transactions (status, created_at) 
  WHERE status = 'pending';

-- 5. Profile Indexes
-- --------------------------------------------

-- Index for Stripe customer lookups
CREATE INDEX idx_profiles_stripe_customer 
  ON profiles (stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- Index for membership queries
CREATE INDEX idx_profiles_membership 
  ON profiles (membership, status) 
  WHERE status = 'active';

-- Index for credit renewal tracking
CREATE INDEX idx_profiles_credit_renewal 
  ON profiles (next_credit_renewal) 
  WHERE membership = 'pro' AND status = 'active';

-- 6. Partial Indexes for Active Records
-- --------------------------------------------

-- Partial index for active providers with Stripe
CREATE INDEX idx_providers_stripe_active 
  ON providers (stripe_connect_account_id) 
  WHERE is_active = true AND stripe_onboarding_complete = true;

-- Partial index for featured testimonials
CREATE INDEX idx_testimonials_featured 
  ON provider_testimonials (provider_id, created_at DESC) 
  WHERE is_featured = true;

-- ============================================
-- STATISTICS UPDATE
-- ============================================

-- Update table statistics for better query planning
ANALYZE profiles;
ANALYZE providers;
ANALYZE provider_availability;
ANALYZE provider_blocked_slots;
ANALYZE bookings;
ANALYZE transactions;
ANALYZE provider_testimonials;

-- ============================================
-- QUERY PERFORMANCE VIEWS (For Monitoring)
-- ============================================

-- Create a view for monitoring slow queries
CREATE OR REPLACE VIEW v_booking_performance_stats AS
SELECT 
  b.id,
  b.provider_id,
  b.customer_id,
  b.booking_date,
  b.status,
  p.display_name as provider_name,
  p.average_rating,
  p.completed_bookings
FROM bookings b
JOIN providers p ON b.provider_id = p.id
WHERE b.booking_date >= CURRENT_DATE - INTERVAL '30 days';

-- Create a materialized view for provider statistics (refresh daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_provider_stats AS
SELECT 
  p.id,
  p.slug,
  p.display_name,
  p.average_rating,
  p.completed_bookings,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'completed' AND b.booking_date >= CURRENT_DATE - INTERVAL '30 days') as bookings_last_30_days,
  COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'confirmed' AND b.booking_date >= CURRENT_DATE) as upcoming_bookings,
  AVG(b.total_amount::numeric) FILTER (WHERE b.status = 'completed') as avg_booking_value
FROM providers p
LEFT JOIN bookings b ON p.id = b.provider_id
WHERE p.is_active = true
GROUP BY p.id, p.slug, p.display_name, p.average_rating, p.completed_bookings;

-- Create index on materialized view
CREATE UNIQUE INDEX idx_mv_provider_stats_id ON mv_provider_stats (id);
CREATE INDEX idx_mv_provider_stats_rating ON mv_provider_stats (average_rating DESC, completed_bookings DESC);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON INDEX idx_providers_search_location IS 'Optimizes location-based provider searches';
COMMENT ON INDEX idx_providers_fulltext IS 'Enables fast full-text search on provider profiles';
COMMENT ON INDEX idx_bookings_conflict_check IS 'Speeds up booking conflict detection during creation';
COMMENT ON INDEX idx_bookings_upcoming IS 'Optimizes dashboard queries for upcoming bookings';
COMMENT ON MATERIALIZED VIEW mv_provider_stats IS 'Cached provider statistics, refresh daily via cron job';
