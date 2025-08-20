-- Add foreign key constraints that were omitted to avoid circular dependencies

-- Providers table
ALTER TABLE "providers" 
ADD CONSTRAINT "providers_user_id_profiles_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE;

-- Provider testimonials table
ALTER TABLE "provider_testimonials" 
ADD CONSTRAINT "provider_testimonials_provider_id_providers_id_fk" 
FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;

-- Provider availability table
ALTER TABLE "provider_availability" 
ADD CONSTRAINT "provider_availability_provider_id_providers_id_fk" 
FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;

-- Provider blocked slots table
ALTER TABLE "provider_blocked_slots" 
ADD CONSTRAINT "provider_blocked_slots_provider_id_providers_id_fk" 
FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;

-- Bookings table
ALTER TABLE "bookings" 
ADD CONSTRAINT "bookings_provider_id_providers_id_fk" 
FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT;

ALTER TABLE "bookings" 
ADD CONSTRAINT "bookings_customer_id_profiles_id_fk" 
FOREIGN KEY ("customer_id") REFERENCES "profiles"("id") ON DELETE RESTRICT;

ALTER TABLE "bookings" 
ADD CONSTRAINT "bookings_cancelled_by_profiles_id_fk" 
FOREIGN KEY ("cancelled_by") REFERENCES "profiles"("id") ON DELETE SET NULL;

-- Transactions table
ALTER TABLE "transactions" 
ADD CONSTRAINT "transactions_booking_id_bookings_id_fk" 
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;

-- Reviews table
ALTER TABLE "reviews" 
ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" 
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE;

ALTER TABLE "reviews" 
ADD CONSTRAINT "reviews_provider_id_providers_id_fk" 
FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;

ALTER TABLE "reviews" 
ADD CONSTRAINT "reviews_customer_id_profiles_id_fk" 
FOREIGN KEY ("customer_id") REFERENCES "profiles"("id") ON DELETE CASCADE;