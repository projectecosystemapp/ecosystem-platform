ALTER TABLE "profiles" ALTER COLUMN "payment_provider" SET DEFAULT 'stripe';--> statement-breakpoint
ALTER TABLE "pending_profiles" ALTER COLUMN "payment_provider" SET DEFAULT 'stripe';--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "customer_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "cancelled_by" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "customer_id" SET DATA TYPE text;