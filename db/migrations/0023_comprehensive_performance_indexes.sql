-- Comprehensive Performance Optimization Indexes
-- This migration adds missing critical indexes for optimal query performance

-- Provider search optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_search_optimized 
ON providers(is_active, is_verified, average_rating DESC, total_reviews DESC)
WHERE is_active = true;

-- Provider location-based search with pricing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_location_price 
ON providers(location_city, location_state, hourly_rate)
WHERE is_active = true;

-- Provider services search optimization (for JSON column)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_services_gin
ON providers USING GIN (services)
WHERE is_active = true;

-- Booking status transitions optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_status_transitions
ON bookings(status, created_at DESC)
INCLUDE (provider_id, customer_id, booking_date);

-- Customer booking history optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_customer_history
ON bookings(customer_id, created_at DESC)
WHERE status IN ('completed', 'confirmed', 'cancelled');

-- Provider earnings calculation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_provider_earnings
ON bookings(provider_id, status, created_at)
WHERE status = 'completed'
INCLUDE (total_amount, provider_earnings);

-- Message threads optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation
ON messages(conversation_id, created_at DESC)
INCLUDE (sender_id, recipient_id, is_read);

-- Availability lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_provider_availability_lookup
ON provider_availability(provider_id, day_of_week, is_active)
WHERE is_active = true
INCLUDE (start_time, end_time);

-- Reviews calculation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_provider_calculation
ON reviews(provider_id, is_published, created_at DESC)
WHERE is_published = true
INCLUDE (rating);

-- Event participation optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_participation
ON events(is_active, event_date, max_attendees)
WHERE is_active = true;

-- Space booking optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spaces_booking_lookup
ON spaces(is_active, availability_type, hourly_rate)
WHERE is_active = true;

-- Loyalty points optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_loyalty_accounts_balance
ON loyalty_accounts(user_id, is_active, current_points DESC)
WHERE is_active = true;

-- Webhook events processing optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_processing
ON webhook_events(status, created_at)
WHERE status IN ('pending', 'processing');

-- Payment status tracking optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_tracking
ON payments(booking_id, status, created_at DESC)
INCLUDE (amount, currency, stripe_payment_intent_id);

-- Guest sessions cleanup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guest_sessions_expiry
ON guest_booking_sessions(expires_at, is_active)
WHERE is_active = true;

-- Provider blocked slots optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_provider_blocked_slots_lookup
ON provider_blocked_slots(provider_id, start_datetime, end_datetime)
WHERE is_active = true;

-- Notification delivery optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_delivery
ON notifications(user_id, status, created_at DESC)
WHERE status IN ('pending', 'delivered');

-- Audit log query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_search
ON audit_log(table_name, record_id, created_at DESC)
INCLUDE (operation, user_id);

-- Location cache optimization for geocoding
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_location_cache_lookup
ON location_cache(address_hash, created_at DESC)
WHERE is_valid = true;

-- Email logs processing optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_processing
ON email_logs(status, created_at DESC)
WHERE status IN ('pending', 'sent', 'failed');

-- Pricing rules optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pricing_rules_lookup
ON pricing_rules(is_active, effective_from, effective_to)
WHERE is_active = true;

-- Things (marketplace items) search optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_things_search
ON things(is_active, category, price)
WHERE is_active = true;

-- Profile completion tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_completion
ON profiles(user_id, is_complete, updated_at DESC);

-- Provider availability cache optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_cache_provider_date
ON availability_cache(provider_id, date, is_available)
WHERE is_available = true AND locked_until IS NULL;

-- Update table statistics after index creation
ANALYZE providers;
ANALYZE bookings;
ANALYZE messages;
ANALYZE provider_availability;
ANALYZE reviews;
ANALYZE events;
ANALYZE spaces;
ANALYZE things;
ANALYZE loyalty_accounts;
ANALYZE webhook_events;
ANALYZE payments;
ANALYZE notifications;
ANALYZE audit_log;
ANALYZE location_cache;
ANALYZE email_logs;
ANALYZE pricing_rules;
ANALYZE profiles;
ANALYZE availability_cache;
ANALYZE provider_blocked_slots;
ANALYZE guest_booking_sessions;

-- Create partial indexes for performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_slow_queries
ON pg_stat_statements(mean_exec_time DESC, calls DESC)
WHERE mean_exec_time > 100; -- Queries taking more than 100ms