ALTER TABLE "providers" ADD COLUMN "full_address" text;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_type" text DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "space_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;