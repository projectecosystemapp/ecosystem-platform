-- Migration: Add guest booking support
-- Date: 2025-01-22
-- Description: Adds support for guest bookings with 10% surcharge on top of service price

-- Add is_guest_booking flag to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS is_guest_booking BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for guest bookings for analytics
CREATE INDEX IF NOT EXISTS idx_bookings_is_guest_booking ON bookings(is_guest_booking);

-- Add index for platform fee analysis
CREATE INDEX IF NOT EXISTS idx_bookings_platform_fee ON bookings(platform_fee);

-- Update existing bookings to have is_guest_booking = false (all were authenticated)
UPDATE bookings SET is_guest_booking = FALSE WHERE is_guest_booking IS NULL;

-- Add comment to document the fee structure
COMMENT ON COLUMN bookings.platform_fee IS 'Platform fee amount: 10% base + 10% surcharge for guest users (providers always receive service price - 10%)';
COMMENT ON COLUMN bookings.is_guest_booking IS 'Flag indicating if booking was made by a guest (non-authenticated) user who pays 10% surcharge';