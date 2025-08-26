-- Enhanced Booking System Migration
-- This migration implements the complete booking system architecture
-- including services table, guest bookings, availability cache, and payout scheduling

-- 1. Create dedicated services table (extract from providers JSONB)
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  
  -- Service details
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  
  -- Pricing
  base_price DECIMAL(10,2) NOT NULL,
  price_type TEXT NOT NULL DEFAULT 'fixed', -- fixed, hourly, custom
  minimum_duration INTEGER NOT NULL DEFAULT 30, -- minutes
  maximum_duration INTEGER, -- minutes, NULL = no limit
  
  -- Scheduling constraints
  buffer_time_before INTEGER DEFAULT 0, -- minutes
  buffer_time_after INTEGER DEFAULT 0, -- minutes
  advance_booking_hours INTEGER DEFAULT 24,
  cancellation_hours INTEGER DEFAULT 24,
  
  -- Service configuration
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  max_group_size INTEGER DEFAULT 1,
  
  -- Metadata
  tags JSONB DEFAULT '[]'::jsonb,
  requirements JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraints after table creation
ALTER TABLE services ADD CONSTRAINT fk_services_provider 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- Create indexes for services table
CREATE INDEX idx_services_provider_active ON services(provider_id, is_active) WHERE is_active = true;
CREATE INDEX idx_services_category ON services(category, subcategory);
CREATE INDEX idx_services_price_range ON services(base_price);
CREATE INDEX idx_services_updated ON services(updated_at DESC);

-- 2. Guest booking sessions for non-authenticated users
CREATE TABLE IF NOT EXISTS guest_booking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  
  -- Guest information
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  
  -- Session data
  booking_data JSONB DEFAULT '{}'::jsonb,
  payment_intent_id TEXT,
  
  -- Session lifecycle
  expires_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for guest sessions
CREATE INDEX idx_guest_sessions_token ON guest_booking_sessions(session_token) WHERE is_active = true;
CREATE INDEX idx_guest_sessions_email ON guest_booking_sessions(email);
CREATE INDEX idx_guest_sessions_expires ON guest_booking_sessions(expires_at);
CREATE INDEX idx_guest_sessions_active ON guest_booking_sessions(is_active, created_at DESC);

-- 3. Booking state transitions for audit trail
CREATE TABLE IF NOT EXISTS booking_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  
  -- State change
  from_status TEXT,
  to_status TEXT NOT NULL,
  
  -- Context
  triggered_by TEXT, -- user_id or 'system'
  trigger_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE booking_state_transitions ADD CONSTRAINT fk_transitions_booking 
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

-- Indexes for state transitions
CREATE INDEX idx_booking_transitions_booking ON booking_state_transitions(booking_id, created_at DESC);
CREATE INDEX idx_booking_transitions_status ON booking_state_transitions(to_status, created_at DESC);
CREATE INDEX idx_booking_transitions_triggered ON booking_state_transitions(triggered_by, created_at DESC);

-- 4. Automated payout schedules for escrow management
CREATE TABLE IF NOT EXISTS payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  
  -- Payout details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  platform_fee DECIMAL(10,2) NOT NULL,
  net_payout DECIMAL(10,2) NOT NULL,
  
  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL,
  processed_at TIMESTAMP,
  
  -- Stripe integration
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'scheduled', -- scheduled, processing, completed, failed, cancelled
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE payout_schedules ADD CONSTRAINT fk_payout_booking 
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE payout_schedules ADD CONSTRAINT fk_payout_provider 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;

-- Indexes for payout schedules
CREATE INDEX idx_payout_schedules_scheduled ON payout_schedules(scheduled_at, status) 
  WHERE status IN ('scheduled', 'processing');
CREATE INDEX idx_payout_schedules_provider ON payout_schedules(provider_id, status, created_at DESC);
CREATE INDEX idx_payout_schedules_booking ON payout_schedules(booking_id);
CREATE INDEX idx_payout_schedules_stripe ON payout_schedules(stripe_transfer_id) WHERE stripe_transfer_id IS NOT NULL;

-- 5. Pre-computed availability cache for performance
CREATE TABLE IF NOT EXISTS availability_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  service_id UUID,
  
  -- Time slot definition
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Availability status
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_booked BOOLEAN DEFAULT false,
  booking_id UUID,
  
  -- Locking for concurrent booking prevention
  locked_until TIMESTAMP,
  locked_by_session TEXT,
  
  -- Cache metadata
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  
  -- Ensure no duplicate slots
  UNIQUE(provider_id, date, start_time, end_time, timezone)
);

-- Add foreign key constraints
ALTER TABLE availability_cache ADD CONSTRAINT fk_availability_provider 
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;
ALTER TABLE availability_cache ADD CONSTRAINT fk_availability_service 
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
ALTER TABLE availability_cache ADD CONSTRAINT fk_availability_booking 
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

-- Indexes for availability cache
CREATE INDEX idx_availability_cache_lookup ON availability_cache(provider_id, date, is_available) 
  WHERE is_available = true AND (locked_until IS NULL OR locked_until < NOW());
CREATE INDEX idx_availability_cache_expires ON availability_cache(expires_at);
CREATE INDEX idx_availability_cache_service ON availability_cache(service_id, date) WHERE is_available = true;
CREATE INDEX idx_availability_cache_locks ON availability_cache(locked_until) WHERE locked_until IS NOT NULL;

-- 6. Booking reminders and notifications
CREATE TABLE IF NOT EXISTS booking_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  
  -- Reminder configuration
  reminder_type TEXT NOT NULL, -- confirmation, reminder_24h, reminder_2h, follow_up
  scheduled_at TIMESTAMP NOT NULL,
  
  -- Delivery method
  delivery_method TEXT NOT NULL DEFAULT 'email', -- email, sms, push
  recipient_type TEXT NOT NULL, -- customer, provider, both
  
  -- Content
  subject TEXT,
  message TEXT,
  template_id TEXT,
  
  -- Status
  status TEXT DEFAULT 'scheduled', -- scheduled, sent, failed, cancelled
  sent_at TIMESTAMP,
  failure_reason TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint
ALTER TABLE booking_reminders ADD CONSTRAINT fk_reminders_booking 
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

-- Indexes for booking reminders
CREATE INDEX idx_booking_reminders_scheduled ON booking_reminders(scheduled_at, status) 
  WHERE status = 'scheduled';
CREATE INDEX idx_booking_reminders_booking ON booking_reminders(booking_id);
CREATE INDEX idx_booking_reminders_type ON booking_reminders(reminder_type, scheduled_at);

-- 7. Enhance existing bookings table
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS service_id UUID,
  ADD COLUMN IF NOT EXISTS guest_session_id UUID,
  ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_code TEXT,
  ADD COLUMN IF NOT EXISTS booking_hash TEXT,
  ADD COLUMN IF NOT EXISTS external_calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Add foreign key constraints to bookings
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_service 
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_guest_session 
  FOREIGN KEY (guest_session_id) REFERENCES guest_booking_sessions(id) ON DELETE SET NULL;

-- Create unique constraints
ALTER TABLE bookings ADD CONSTRAINT unique_confirmation_code 
  UNIQUE (confirmation_code);
ALTER TABLE bookings ADD CONSTRAINT unique_booking_hash 
  UNIQUE (booking_hash);

-- Enhanced booking indexes
CREATE INDEX idx_bookings_provider_date_status ON bookings(provider_id, booking_date, status);
CREATE INDEX idx_bookings_customer_created ON bookings(customer_id, created_at DESC);
CREATE INDEX idx_bookings_confirmation ON bookings(confirmation_code) WHERE confirmation_code IS NOT NULL;
CREATE INDEX idx_bookings_guest_session ON bookings(guest_session_id) WHERE guest_session_id IS NOT NULL;
CREATE INDEX idx_bookings_service ON bookings(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX idx_bookings_approval ON bookings(requires_approval, approved_at) WHERE requires_approval = true;

-- 8. Booking conflict prevention constraint
-- This prevents overlapping bookings for the same provider
ALTER TABLE bookings ADD CONSTRAINT prevent_booking_conflicts 
  EXCLUDE USING gist (
    provider_id WITH =,
    daterange(booking_date::date, booking_date::date, '[]') WITH &&,
    timerange(start_time::time, end_time::time, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show'));

-- 9. Create materialized view for provider statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS provider_booking_stats AS
SELECT 
  p.id as provider_id,
  p.user_id,
  COUNT(b.id) as total_bookings,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
  COUNT(CASE WHEN b.status = 'cancelled' THEN 1 END) as cancelled_bookings,
  COUNT(CASE WHEN b.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_bookings,
  COALESCE(AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END), 0) as avg_booking_value,
  COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.provider_payout END), 0) as total_earnings,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(r.id) as total_reviews,
  MAX(b.created_at) as last_booking_date
FROM providers p
LEFT JOIN bookings b ON p.id = b.provider_id
LEFT JOIN reviews r ON b.id = r.booking_id
GROUP BY p.id, p.user_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_provider_booking_stats_provider 
  ON provider_booking_stats(provider_id);

-- 10. Functions for booking system

-- Function to generate confirmation codes
CREATE OR REPLACE FUNCTION generate_confirmation_code() RETURNS TEXT AS $$
BEGIN
  RETURN upper(substr(md5(random()::text), 1, 6));
END;
$$ LANGUAGE plpgsql;

-- Function to generate booking hashes
CREATE OR REPLACE FUNCTION generate_booking_hash() RETURNS TEXT AS $$
BEGIN
  RETURN substr(md5(random()::text || clock_timestamp()::text), 1, 12);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set confirmation codes and hashes
CREATE OR REPLACE FUNCTION set_booking_codes() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confirmation_code IS NULL THEN
    NEW.confirmation_code := generate_confirmation_code();
  END IF;
  
  IF NEW.booking_hash IS NULL THEN
    NEW.booking_hash := generate_booking_hash();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic code generation
CREATE TRIGGER trigger_set_booking_codes
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_codes();

-- Function to update booking status and create transition record
CREATE OR REPLACE FUNCTION update_booking_status(
  booking_id_param UUID,
  new_status TEXT,
  triggered_by_param TEXT DEFAULT 'system',
  reason_param TEXT DEFAULT NULL,
  metadata_param JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
DECLARE
  old_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO old_status FROM bookings WHERE id = booking_id_param;
  
  -- Update booking status
  UPDATE bookings 
  SET status = new_status, updated_at = NOW()
  WHERE id = booking_id_param;
  
  -- Create transition record
  INSERT INTO booking_state_transitions (
    booking_id,
    from_status,
    to_status,
    triggered_by,
    trigger_reason,
    metadata
  ) VALUES (
    booking_id_param,
    old_status,
    new_status,
    triggered_by_param,
    reason_param,
    metadata_param
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired availability cache
CREATE OR REPLACE FUNCTION cleanup_expired_availability_cache() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM availability_cache 
  WHERE expires_at < NOW() OR (locked_until IS NOT NULL AND locked_until < NOW());
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired guest sessions
CREATE OR REPLACE FUNCTION cleanup_expired_guest_sessions() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE guest_booking_sessions 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Insert default data for existing providers
-- Migrate existing services from providers JSONB to services table
INSERT INTO services (provider_id, name, description, category, base_price, minimum_duration)
SELECT 
  p.id,
  COALESCE(service->>'name', 'Standard Service') as name,
  service->>'description' as description,
  'general' as category,
  COALESCE((service->>'price')::decimal, p.hourly_rate, 100.00) as base_price,
  COALESCE((service->>'duration')::integer, 60) as minimum_duration
FROM providers p,
LATERAL jsonb_array_elements(COALESCE(p.services, '[]'::jsonb)) as service
WHERE p.services IS NOT NULL AND jsonb_array_length(p.services) > 0;

-- For providers without services in JSONB, create a default service
INSERT INTO services (provider_id, name, description, category, base_price, minimum_duration)
SELECT 
  id,
  'Standard Service',
  'Professional service provided by ' || display_name,
  'general',
  COALESCE(hourly_rate, 100.00),
  60
FROM providers 
WHERE id NOT IN (SELECT DISTINCT provider_id FROM services)
  AND (services IS NULL OR jsonb_array_length(services) = 0);

-- 12. Create indexes for optimal query performance
-- Composite indexes for common booking queries
CREATE INDEX idx_bookings_provider_date_time ON bookings(provider_id, booking_date, start_time) 
  WHERE status NOT IN ('cancelled', 'no_show');

CREATE INDEX idx_bookings_customer_upcoming ON bookings(customer_id, booking_date) 
  WHERE status IN ('pending', 'confirmed') AND booking_date >= CURRENT_DATE;

CREATE INDEX idx_bookings_provider_upcoming ON bookings(provider_id, booking_date) 
  WHERE status IN ('pending', 'confirmed') AND booking_date >= CURRENT_DATE;

-- Partial indexes for efficient lookups
CREATE INDEX idx_services_active_provider ON services(provider_id, category) 
  WHERE is_active = true;

CREATE INDEX idx_guest_sessions_recent ON guest_booking_sessions(email, created_at DESC) 
  WHERE is_active = true AND created_at >= NOW() - INTERVAL '24 hours';

-- GiST indexes for timezone and geometric operations
CREATE INDEX idx_bookings_daterange ON bookings USING gist(
  daterange(booking_date::date, booking_date::date, '[]')
) WHERE status NOT IN ('cancelled', 'no_show');

-- 13. Add comments for documentation
COMMENT ON TABLE services IS 'Individual services offered by providers, extracted from providers JSONB for better performance and querying';
COMMENT ON TABLE guest_booking_sessions IS 'Temporary sessions for non-authenticated users to complete bookings';
COMMENT ON TABLE booking_state_transitions IS 'Audit trail for all booking status changes with context';
COMMENT ON TABLE payout_schedules IS 'Automated payout scheduling for escrow management and provider payments';
COMMENT ON TABLE availability_cache IS 'Pre-computed availability slots for improved booking performance';
COMMENT ON TABLE booking_reminders IS 'Scheduled notifications and reminders for bookings';

COMMENT ON COLUMN bookings.confirmation_code IS 'Short alphanumeric code for customer reference';
COMMENT ON COLUMN bookings.booking_hash IS 'URL-safe hash for booking access without authentication';
COMMENT ON COLUMN bookings.timezone IS 'Timezone for the booking (usually customer or provider timezone)';

-- 14. Set up row-level security policies (if using RLS)
-- Enable RLS on sensitive tables
ALTER TABLE guest_booking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_schedules ENABLE ROW LEVEL SECURITY;

-- Create policies for guest sessions
CREATE POLICY "Guest sessions are accessible by session token" ON guest_booking_sessions
  FOR ALL USING (session_token = current_setting('app.session_token', true));

-- Create policies for booking transitions (read-only for users)
CREATE POLICY "Users can view their booking transitions" ON booking_state_transitions
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM bookings 
      WHERE customer_id = auth.uid()::text OR provider_id IN (
        SELECT id FROM providers WHERE user_id = auth.uid()::text
      )
    )
  );

-- Create policies for payout schedules (providers can view their own)
CREATE POLICY "Providers can view their payout schedules" ON payout_schedules
  FOR SELECT USING (
    provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()::text)
  );

-- 15. Performance monitoring setup
-- Create a simple performance monitoring table
CREATE TABLE IF NOT EXISTS booking_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_booking_performance_operation ON booking_performance_log(operation, created_at DESC);
CREATE INDEX idx_booking_performance_duration ON booking_performance_log(duration_ms DESC);

-- Cleanup old performance logs (keep only last 30 days)
CREATE OR REPLACE FUNCTION cleanup_performance_logs() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM booking_performance_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a cleanup job function that can be called by cron
CREATE OR REPLACE FUNCTION run_booking_system_cleanup() RETURNS TABLE(
  expired_cache INTEGER,
  expired_sessions INTEGER,
  old_logs INTEGER
) AS $$
BEGIN
  RETURN QUERY SELECT 
    cleanup_expired_availability_cache(),
    cleanup_expired_guest_sessions(),
    cleanup_performance_logs();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION run_booking_system_cleanup() IS 'Cleanup function to be run periodically to maintain database performance';

-- Final step: Refresh materialized view
REFRESH MATERIALIZED VIEW provider_booking_stats;