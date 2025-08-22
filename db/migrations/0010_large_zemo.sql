ALTER TABLE "providers" ALTER COLUMN "commission_rate" SET DEFAULT '0.10';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "is_guest_booking" boolean DEFAULT false NOT NULL;