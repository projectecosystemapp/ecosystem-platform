-- Fix user_id column types to match Clerk's string IDs
-- Converting UUID columns to TEXT for Clerk compatibility

-- First, drop the foreign key constraints that were added
ALTER TABLE providers DROP CONSTRAINT IF EXISTS fk_providers_user_id;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS fk_bookings_customer_id;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS fk_bookings_cancelled_by;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS fk_reviews_customer_id;

-- Update providers table
ALTER TABLE providers 
ALTER COLUMN user_id TYPE text USING user_id::text;

-- Update bookings table
ALTER TABLE bookings 
ALTER COLUMN customer_id TYPE text USING customer_id::text;

ALTER TABLE bookings 
ALTER COLUMN cancelled_by TYPE text USING cancelled_by::text;

-- Update reviews table
ALTER TABLE reviews 
ALTER COLUMN customer_id TYPE text USING customer_id::text;

-- Re-add the foreign key constraints with correct types
ALTER TABLE providers 
ADD CONSTRAINT fk_providers_user_id 
FOREIGN KEY (user_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;

ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_customer_id 
FOREIGN KEY (customer_id) 
REFERENCES profiles(user_id) 
ON DELETE RESTRICT;

ALTER TABLE bookings 
ADD CONSTRAINT fk_bookings_cancelled_by 
FOREIGN KEY (cancelled_by) 
REFERENCES profiles(user_id) 
ON DELETE SET NULL;

ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_customer_id 
FOREIGN KEY (customer_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;