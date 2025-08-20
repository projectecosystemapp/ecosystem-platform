CREATE TABLE IF NOT EXISTS "provider_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_blocked_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"blocked_date" timestamp NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"customer_name" text NOT NULL,
	"customer_image" text,
	"testimonial_text" text NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"bio" text,
	"cover_image_url" text,
	"profile_image_url" text,
	"gallery_images" jsonb DEFAULT '[]'::jsonb,
	"location_city" text,
	"location_state" text,
	"location_country" text DEFAULT 'US',
	"hourly_rate" numeric(10, 2),
	"currency" text DEFAULT 'usd' NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb,
	"years_experience" integer,
	"completed_bookings" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(2, 1) DEFAULT '0.0',
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_connect_account_id" text,
	"stripe_onboarding_complete" boolean DEFAULT false NOT NULL,
	"commission_rate" numeric(3, 2) DEFAULT '0.15' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "providers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_name" text NOT NULL,
	"service_price" numeric(10, 2) NOT NULL,
	"service_duration" integer NOT NULL,
	"booking_date" timestamp NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_payment_intent_id" text,
	"total_amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"provider_payout" numeric(10, 2) NOT NULL,
	"customer_notes" text,
	"provider_notes" text,
	"cancellation_reason" text,
	"cancelled_by" uuid,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"stripe_charge_id" text,
	"stripe_transfer_id" text,
	"stripe_refund_id" text,
	"amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"provider_payout" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"provider_response" text,
	"provider_responded_at" timestamp,
	"is_verified_booking" boolean DEFAULT true NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);
