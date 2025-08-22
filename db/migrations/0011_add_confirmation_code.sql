-- Add confirmation_code column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmation_code TEXT;

-- Create index for faster lookups by confirmation code
CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_code ON bookings(confirmation_code);