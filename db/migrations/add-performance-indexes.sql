-- Add critical performance indexes for Series A production readiness
-- These indexes will significantly improve query performance for common operations

-- ============================================
-- PROVIDERS TABLE INDEXES
-- ============================================

-- Index for provider search by location (city/state)
CREATE INDEX IF NOT EXISTS idx_providers_location 
ON providers(location_city, location_state) 
WHERE is_active = true;

-- Index for provider search by verified status
CREATE INDEX IF NOT EXISTS idx_providers_verified 
ON providers(is_verified, average_rating DESC) 
WHERE is_active = true;

-- Index for slug lookups (URL-based provider pages)
CREATE INDEX IF NOT EXISTS idx_providers_slug 
ON providers(slug) 
WHERE is_active = true;

-- Index for Stripe Connect lookups
CREATE INDEX IF NOT EXISTS idx_providers_stripe_account 
ON providers(stripe_connect_account_id) 
WHERE stripe_connect_account_id IS NOT NULL;

-- Index for user_id lookups (finding provider by user)
CREATE INDEX IF NOT EXISTS idx_providers_user_id 
ON providers(user_id);

-- Composite index for featured providers query
CREATE INDEX IF NOT EXISTS idx_providers_featured 
ON providers(is_verified, average_rating DESC, completed_bookings DESC) 
WHERE is_active = true AND stripe_onboarding_complete = true;

-- ============================================
-- BOOKINGS TABLE INDEXES
-- ============================================

-- Index for provider's upcoming bookings
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date 
ON bookings(provider_id, booking_date, status) 
WHERE status IN ('pending', 'confirmed');

-- Index for customer's booking history
CREATE INDEX IF NOT EXISTS idx_bookings_customer 
ON bookings(customer_id, created_at DESC);

-- Index for date-based queries (availability checks)
CREATE INDEX IF NOT EXISTS idx_bookings_date_time 
ON bookings(booking_date, start_time, end_time) 
WHERE status IN ('pending', 'confirmed');

-- Index for guest bookings analytics
CREATE INDEX IF NOT EXISTS idx_bookings_guest 
ON bookings(is_guest_booking, created_at DESC) 
WHERE is_guest_booking = true;

-- Index for payment tracking
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent 
ON bookings(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON bookings(status, created_at DESC);

-- ============================================
-- TRANSACTIONS TABLE INDEXES
-- ============================================

-- Index for booking-related transactions
CREATE INDEX IF NOT EXISTS idx_transactions_booking 
ON transactions(booking_id, created_at DESC);

-- Index for Stripe charge lookups
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_charge 
ON transactions(stripe_charge_id) 
WHERE stripe_charge_id IS NOT NULL;

-- Index for pending transactions (for processing)
CREATE INDEX IF NOT EXISTS idx_transactions_pending 
ON transactions(status, created_at) 
WHERE status = 'pending';

-- ============================================
-- PROVIDER AVAILABILITY INDEXES
-- ============================================

-- Index for provider availability lookups
CREATE INDEX IF NOT EXISTS idx_provider_availability_provider 
ON provider_availability(provider_id, day_of_week) 
WHERE is_active = true;

-- ============================================
-- PROVIDER BLOCKED SLOTS INDEXES
-- ============================================

-- Index for checking blocked dates
CREATE INDEX IF NOT EXISTS idx_provider_blocked_slots_date 
ON provider_blocked_slots(provider_id, blocked_date);

-- ============================================
-- PROVIDER TESTIMONIALS INDEXES
-- ============================================

-- Index for featured testimonials
CREATE INDEX IF NOT EXISTS idx_provider_testimonials_featured 
ON provider_testimonials(provider_id, is_featured) 
WHERE is_featured = true;

-- ============================================
-- REVIEWS TABLE INDEXES (if exists)
-- ============================================

-- Check if reviews table exists and add indexes
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') THEN
        -- Index for provider reviews
        CREATE INDEX IF NOT EXISTS idx_reviews_provider 
        ON reviews(provider_id, created_at DESC);
        
        -- Index for booking reviews
        CREATE INDEX IF NOT EXISTS idx_reviews_booking 
        ON reviews(booking_id) 
        WHERE booking_id IS NOT NULL;
        
        -- Index for calculating average ratings
        CREATE INDEX IF NOT EXISTS idx_reviews_rating 
        ON reviews(provider_id, rating) 
        WHERE rating IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Create a function to analyze index usage (for monitoring)
CREATE OR REPLACE FUNCTION analyze_index_usage()
RETURNS TABLE(
    schemaname text,
    tablename text,
    indexname text,
    index_size text,
    index_scans bigint,
    index_efficiency numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname::text,
        s.tablename::text,
        s.indexname::text,
        pg_size_pretty(pg_relation_size(s.indexrelid))::text as index_size,
        s.idx_scan as index_scans,
        CASE 
            WHEN s.idx_scan = 0 THEN 0
            ELSE ROUND((100.0 * s.idx_scan / NULLIF(s.idx_scan + s.seq_scan, 0))::numeric, 2)
        END as index_efficiency
    FROM pg_stat_user_indexes s
    JOIN pg_index i ON s.indexrelid = i.indexrelid
    WHERE s.schemaname = 'public'
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- QUERY PERFORMANCE VIEWS
-- ============================================

-- Create a view for monitoring slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- Queries taking more than 100ms on average
ORDER BY mean_time DESC
LIMIT 50;

-- ============================================
-- MAINTENANCE COMMANDS
-- ============================================

-- Update table statistics for query planner
ANALYZE providers;
ANALYZE bookings;
ANALYZE transactions;
ANALYZE provider_availability;
ANALYZE provider_blocked_slots;
ANALYZE provider_testimonials;

-- Note: Run these commands periodically in production:
-- VACUUM ANALYZE; -- Clean up and update statistics
-- REINDEX DATABASE your_database_name; -- Rebuild indexes if fragmented

-- ============================================
-- INDEX EFFECTIVENESS REPORT
-- ============================================

-- Comment: After deployment, run this query to verify index usage:
-- SELECT * FROM analyze_index_usage() WHERE index_efficiency < 50;
-- This will show indexes that might not be pulling their weight

-- Comment: Monitor query performance with:
-- SELECT * FROM slow_queries;
-- This will show the slowest queries in your system