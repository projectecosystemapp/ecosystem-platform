-- Additional Performance Indexes for Enhanced Data Pipeline Operations
-- This migration adds specialized indexes for the new data pipeline features

-- ============================================
-- ANALYTICS AND REPORTING INDEXES
-- ============================================

-- Index for booking trends analysis (time-series queries)
CREATE INDEX idx_bookings_analytics_time_series 
  ON bookings (DATE(booking_date), status, total_amount, platform_fee) 
  WHERE status = 'completed';

-- Index for provider performance analytics
CREATE INDEX idx_bookings_provider_performance 
  ON bookings (provider_id, status, booking_date DESC, total_amount) 
  WHERE status IN ('completed', 'cancelled');

-- Index for customer behavior analysis
CREATE INDEX idx_bookings_customer_analysis 
  ON bookings (customer_id, status, created_at DESC, service_name);

-- Index for service popularity tracking
CREATE INDEX idx_bookings_service_popularity 
  ON bookings (service_name, status, total_amount, booking_date) 
  WHERE status = 'completed';

-- Composite index for revenue calculations
CREATE INDEX idx_bookings_revenue_calc 
  ON bookings (status, booking_date, total_amount, platform_fee, provider_payout) 
  WHERE status = 'completed';

-- Index for booking time analysis (hour/day patterns)
CREATE INDEX idx_bookings_time_patterns 
  ON bookings (EXTRACT(HOUR FROM start_time::TIME), EXTRACT(DOW FROM booking_date), status);

-- ============================================
-- REAL-TIME AVAILABILITY INDEXES
-- ============================================

-- Optimized index for real-time availability checks
CREATE INDEX idx_availability_realtime_check 
  ON provider_availability (provider_id, day_of_week, start_time, end_time) 
  WHERE is_active = true;

-- Index for blocked slots optimization
CREATE INDEX idx_blocked_slots_realtime 
  ON provider_blocked_slots (provider_id, blocked_date, start_time, end_time);

-- Composite index for conflict detection optimization
CREATE INDEX idx_bookings_conflict_detection 
  ON bookings (provider_id, booking_date, start_time, end_time, status) 
  WHERE status NOT IN ('cancelled', 'no_show');

-- ============================================
-- DASHBOARD AND METRICS INDEXES
-- ============================================

-- Index for provider dashboard statistics
CREATE INDEX idx_providers_dashboard_stats 
  ON providers (id, is_active, completed_bookings, average_rating, created_at);

-- Index for recent activity tracking
CREATE INDEX idx_bookings_recent_activity 
  ON bookings (created_at DESC, updated_at DESC, status, provider_id, customer_id);

-- Index for provider utilization calculations
CREATE INDEX idx_bookings_utilization 
  ON bookings (provider_id, booking_date, status) 
  WHERE status IN ('confirmed', 'completed') 
    AND booking_date >= CURRENT_DATE - INTERVAL '30 days';

-- ============================================
-- SEARCH AND DISCOVERY OPTIMIZATION
-- ============================================

-- Enhanced location search index with distance optimization
CREATE INDEX idx_providers_location_enhanced 
  ON providers (location_city, location_state, is_active, is_verified, average_rating DESC) 
  WHERE is_active = true;

-- Service-based search optimization
CREATE INDEX idx_providers_services_search 
  ON providers USING gin(services) 
  WHERE is_active = true;

-- Price range optimization for search filters
CREATE INDEX idx_providers_price_search 
  ON providers (hourly_rate, is_active, is_verified, average_rating DESC) 
  WHERE is_active = true AND hourly_rate IS NOT NULL;

-- ============================================
-- CACHING OPTIMIZATION INDEXES
-- ============================================

-- Index for cache key generation and invalidation
CREATE INDEX idx_bookings_cache_invalidation 
  ON bookings (provider_id, DATE(booking_date), status, updated_at);

-- Index for trending provider calculations
CREATE INDEX idx_bookings_trending 
  ON bookings (provider_id, booking_date, status) 
  WHERE status = 'completed' 
    AND booking_date >= CURRENT_DATE - INTERVAL '7 days';

-- ============================================
-- MONITORING AND HEALTH CHECK INDEXES
-- ============================================

-- Index for system health monitoring
CREATE INDEX idx_bookings_health_check 
  ON bookings (status, created_at, booking_date) 
  WHERE created_at >= CURRENT_DATE - INTERVAL '1 day';

-- Index for data quality checks
CREATE INDEX idx_bookings_data_quality 
  ON bookings (status, stripe_payment_intent_id, total_amount, platform_fee) 
  WHERE status = 'completed';

-- Index for transaction reconciliation
CREATE INDEX idx_transactions_reconciliation 
  ON transactions (booking_id, status, amount, created_at);

-- ============================================
-- FOREIGN KEY PERFORMANCE INDEXES
-- ============================================

-- Optimize foreign key lookups for analytics
CREATE INDEX idx_reviews_analytics 
  ON reviews (provider_id, is_published, rating, created_at DESC);

-- Optimize testimonials lookup
CREATE INDEX idx_testimonials_lookup 
  ON provider_testimonials (provider_id, is_featured, created_at DESC);

-- ============================================
-- SPECIALIZED QUERY OPTIMIZATION
-- ============================================

-- Index for booking conflict prevention (with row-level locking optimization)
CREATE UNIQUE INDEX idx_bookings_conflict_prevention 
  ON bookings (provider_id, booking_date, start_time) 
  WHERE status NOT IN ('cancelled', 'no_show');

-- Index for provider onboarding status tracking
CREATE INDEX idx_providers_onboarding 
  ON providers (stripe_onboarding_complete, is_verified, is_active, created_at);

-- Index for membership and credit tracking
CREATE INDEX idx_profiles_membership_credits 
  ON profiles (membership, status, credits_remaining, next_credit_renewal);

-- ============================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ============================================

-- Partial index for active bookings only
CREATE INDEX idx_bookings_active_only 
  ON bookings (provider_id, customer_id, booking_date, start_time) 
  WHERE status IN ('pending', 'confirmed');

-- Partial index for completed transactions
CREATE INDEX idx_transactions_completed 
  ON transactions (booking_id, amount, platform_fee, processed_at) 
  WHERE status = 'completed';

-- Partial index for verified providers
CREATE INDEX idx_providers_verified_active 
  ON providers (average_rating DESC, completed_bookings DESC, created_at) 
  WHERE is_verified = true AND is_active = true;

-- ============================================
-- EXPRESSION INDEXES FOR CALCULATED FIELDS
-- ============================================

-- Index for booking duration calculations
CREATE INDEX idx_bookings_duration 
  ON bookings ((EXTRACT(EPOCH FROM (end_time::TIME - start_time::TIME))/60)) 
  WHERE status IN ('confirmed', 'completed');

-- Index for platform fee percentage calculations
CREATE INDEX idx_bookings_fee_percentage 
  ON bookings ((platform_fee * 100.0 / NULLIF(total_amount, 0))) 
  WHERE status = 'completed' AND total_amount > 0;

-- ============================================
-- COVERING INDEXES FOR READ-HEAVY QUERIES
-- ============================================

-- Covering index for provider search results
CREATE INDEX idx_providers_search_covering 
  ON providers (is_active, is_verified, location_city, location_state) 
  INCLUDE (id, display_name, slug, tagline, hourly_rate, average_rating, completed_bookings, profile_image_url);

-- Covering index for booking history queries
CREATE INDEX idx_bookings_history_covering 
  ON bookings (customer_id, booking_date DESC) 
  INCLUDE (id, provider_id, service_name, total_amount, status, start_time, end_time);

-- ============================================
-- CLEANUP ORPHANED INDEX CANDIDATES
-- ============================================

-- These indexes would help identify orphaned records for cleanup
CREATE INDEX idx_orphaned_bookings_check 
  ON bookings (provider_id) 
  WHERE provider_id NOT IN (SELECT id FROM providers);

CREATE INDEX idx_orphaned_transactions_check 
  ON transactions (booking_id) 
  WHERE booking_id NOT IN (SELECT id FROM bookings);

-- ============================================
-- UPDATE STATISTICS
-- ============================================

-- Update table statistics for better query planning
ANALYZE bookings;
ANALYZE transactions;
ANALYZE providers;
ANALYZE provider_availability;
ANALYZE provider_blocked_slots;
ANALYZE reviews;
ANALYZE provider_testimonials;
ANALYZE profiles;

-- ============================================
-- MAINTENANCE VIEWS FOR INDEX MONITORING
-- ============================================

-- Create a view to monitor index usage
CREATE OR REPLACE VIEW v_index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan,
  CASE 
    WHEN idx_scan = 0 THEN 'UNUSED'
    WHEN idx_scan < 10 THEN 'LOW_USAGE'
    WHEN idx_scan < 100 THEN 'MEDIUM_USAGE'
    ELSE 'HIGH_USAGE'
  END as usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Create a view to monitor table scan ratios
CREATE OR REPLACE VIEW v_table_scan_ratios AS
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE 
    WHEN (seq_scan + idx_scan) = 0 THEN 0
    ELSE (seq_scan::float / (seq_scan + idx_scan)::float) * 100
  END as seq_scan_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan_ratio DESC;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON INDEX idx_bookings_analytics_time_series IS 'Optimizes time-series analytics queries for booking trends';
COMMENT ON INDEX idx_bookings_provider_performance IS 'Speeds up provider performance dashboard calculations';
COMMENT ON INDEX idx_availability_realtime_check IS 'Optimizes real-time availability checks for booking flow';
COMMENT ON INDEX idx_bookings_conflict_detection IS 'Prevents booking conflicts with optimized overlap detection';
COMMENT ON INDEX idx_providers_search_covering IS 'Covering index for provider search to avoid table lookups';
COMMENT ON INDEX idx_bookings_conflict_prevention IS 'Unique constraint to prevent double-booking at database level';

-- ============================================
-- INDEX MAINTENANCE SCHEDULE
-- ============================================

-- Note: In production, these should be automated via pg_cron or external scheduler
-- REINDEX INDEX CONCURRENTLY idx_bookings_analytics_time_series; -- Run weekly
-- REINDEX INDEX CONCURRENTLY idx_providers_search_covering; -- Run weekly  
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_provider_stats; -- Run daily