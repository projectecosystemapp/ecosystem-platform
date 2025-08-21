-- Add foreign key constraints for marketplace tables
-- This migration adds referential integrity to ensure data consistency

-- Providers table foreign keys
ALTER TABLE providers 
ADD CONSTRAINT fk_providers_user_id 
FOREIGN KEY (user_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;

-- Provider testimonials foreign keys
ALTER TABLE provider_testimonials 
ADD CONSTRAINT fk_testimonials_provider_id 
FOREIGN KEY (provider_id) 
REFERENCES providers(id) 
ON DELETE CASCADE;

-- Provider availability foreign keys
ALTER TABLE provider_availability 
ADD CONSTRAINT fk_availability_provider_id 
FOREIGN KEY (provider_id) 
REFERENCES providers(id) 
ON DELETE CASCADE;

-- Provider blocked slots foreign keys
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
ON DELETE RESTRICT;  -- Prevent deletion of providers with bookings

ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_customer_id 
FOREIGN KEY (customer_id) 
REFERENCES profiles(user_id) 
ON DELETE RESTRICT;  -- Prevent deletion of customers with bookings

ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_cancelled_by 
FOREIGN KEY (cancelled_by) 
REFERENCES profiles(user_id) 
ON DELETE SET NULL;  -- Allow null if cancelling user is deleted

-- Transactions table foreign keys
ALTER TABLE transactions 
ADD CONSTRAINT fk_transactions_booking_id 
FOREIGN KEY (booking_id) 
REFERENCES bookings(id) 
ON DELETE CASCADE;  -- Delete transactions when booking is deleted

-- Reviews table foreign keys
ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_booking_id 
FOREIGN KEY (booking_id) 
REFERENCES bookings(id) 
ON DELETE CASCADE;  -- Delete review when booking is deleted

ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_provider_id 
FOREIGN KEY (provider_id) 
REFERENCES providers(id) 
ON DELETE CASCADE;  -- Delete reviews when provider is deleted

ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_customer_id 
FOREIGN KEY (customer_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;  -- Delete reviews when customer is deleted

-- Create indexes for foreign key columns to improve query performance
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_provider_id ON provider_testimonials(provider_id);
CREATE INDEX IF NOT EXISTS idx_availability_provider_id ON provider_availability(provider_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_provider_id ON provider_blocked_slots(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id ON reviews(customer_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_provider_status ON bookings(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_status ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_provider_day ON provider_availability(provider_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_provider_date ON provider_blocked_slots(provider_id, blocked_date);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_published ON reviews(provider_id, is_published);

-- Add check constraints for data validation
ALTER TABLE provider_availability 
ADD CONSTRAINT chk_day_of_week 
CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE reviews 
ADD CONSTRAINT chk_rating 
CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE providers 
ADD CONSTRAINT chk_commission_rate 
CHECK (commission_rate >= 0 AND commission_rate <= 1);

ALTER TABLE bookings 
ADD CONSTRAINT chk_booking_times 
CHECK (start_time < end_time);

-- Add unique constraints to prevent duplicate data
ALTER TABLE provider_availability 
ADD CONSTRAINT unq_provider_day_time 
UNIQUE (provider_id, day_of_week, start_time, end_time);

-- Add comment documentation for complex relationships
COMMENT ON CONSTRAINT fk_bookings_provider_id ON bookings IS 'Prevents deletion of providers with existing bookings to maintain transaction history';
COMMENT ON CONSTRAINT fk_bookings_customer_id ON bookings IS 'Prevents deletion of customers with existing bookings to maintain transaction history';
COMMENT ON INDEX idx_bookings_provider_status IS 'Optimizes queries for provider dashboard showing bookings by status';
COMMENT ON INDEX idx_reviews_provider_published IS 'Optimizes queries for displaying published reviews on provider profiles';