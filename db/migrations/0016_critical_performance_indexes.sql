-- Critical Performance Indexes for Bookings
-- These indexes optimize common query patterns and prevent full table scans

-- Index for provider's bookings by date (provider dashboard, availability checks)
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date 
ON bookings(provider_id, booking_date)
WHERE status NOT IN ('cancelled', 'rejected');

-- Index for customer's bookings by status (customer history, active bookings)
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status 
ON bookings(customer_id, status)
INCLUDE (booking_date, start_time);

-- Index for location-based provider search
CREATE INDEX IF NOT EXISTS idx_providers_location 
ON providers(location_city, location_state)
WHERE is_active = true;

-- Composite index for service search by provider and category
CREATE INDEX IF NOT EXISTS idx_services_provider_category
ON services(provider_id, category)
WHERE is_active = true;

-- Index for reviews by provider (calculating ratings)
CREATE INDEX IF NOT EXISTS idx_reviews_provider_rating
ON reviews(provider_id, rating)
WHERE is_published = true;

-- Index for categories hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_categories_parent
ON categories(parent_id, sort_order)
WHERE is_active = true;

-- Index for availability cache lookups
CREATE INDEX IF NOT EXISTS idx_availability_cache_lookup
ON availability_cache(provider_id, date, start_time)
WHERE is_available = true AND locked_until IS NULL;

-- Index for booking state transitions audit trail
CREATE INDEX IF NOT EXISTS idx_booking_state_transitions_booking
ON booking_state_transitions(booking_id, created_at DESC);

-- Index for payout processing
CREATE INDEX IF NOT EXISTS idx_payout_schedules_pending
ON payout_schedules(scheduled_at, status)
WHERE status = 'scheduled';

-- Index for guest booking sessions cleanup
CREATE INDEX IF NOT EXISTS idx_guest_sessions_cleanup
ON guest_booking_sessions(expires_at)
WHERE is_active = true AND completed_at IS NULL;

-- Index for booking reminders processing
CREATE INDEX IF NOT EXISTS idx_booking_reminders_scheduled
ON booking_reminders(scheduled_at, status)
WHERE status = 'scheduled';

-- Partial index for featured providers
CREATE INDEX IF NOT EXISTS idx_providers_featured
ON providers(average_rating DESC, total_reviews DESC)
WHERE is_active = true AND is_verified = true;

-- Index for transaction reconciliation
CREATE INDEX IF NOT EXISTS idx_transactions_stripe
ON transactions(stripe_charge_id, stripe_transfer_id)
WHERE status IN ('pending', 'completed');

-- Index for booking performance monitoring
CREATE INDEX IF NOT EXISTS idx_booking_performance_log_timestamp
ON booking_performance_log(created_at DESC, operation);

-- Analyze tables to update statistics after index creation
ANALYZE bookings;
ANALYZE providers;
ANALYZE services;
ANALYZE reviews;
ANALYZE categories;
ANALYZE transactions;
ANALYZE availability_cache;
ANALYZE booking_state_transitions;
ANALYZE payout_schedules;