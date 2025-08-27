DO $$ BEGIN
 CREATE TYPE "public"."usage_action" AS ENUM('service_used', 'service_credited', 'service_refunded', 'manual_adjustment', 'period_reset', 'overage_charge');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_channel" AS ENUM('email', 'in_app', 'sms', 'push');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sending', 'sent', 'delivered', 'read', 'failed', 'bounced', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_type" AS ENUM('subscription_confirmed', 'subscription_renewed', 'subscription_cancelled', 'subscription_expiring', 'subscription_failed', 'payment_received', 'payment_failed', 'payment_refunded', 'payout_processed', 'points_earned', 'points_redeemed', 'points_expiring', 'tier_upgraded', 'tier_downgraded', 'special_offer', 'group_booking_invitation', 'group_booking_confirmed', 'group_booking_cancelled', 'group_member_joined', 'group_member_left', 'price_drop_alert', 'flash_sale', 'limited_availability', 'referral_success', 'referral_reward_earned', 'referral_expired', 'booking_confirmed', 'booking_reminder', 'booking_cancelled', 'booking_modified', 'provider_accepted', 'provider_rejected', 'review_request', 'review_response', 'welcome', 'account_update', 'security_alert', 'maintenance', 'announcement');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"action" "usage_action" NOT NULL,
	"quantity" integer NOT NULL,
	"booking_id" uuid,
	"adjusted_by" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"is_overage" boolean DEFAULT false,
	"overage_charge_cents" integer,
	"stripe_charge_id" text,
	"description" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_usage_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"included_services" integer NOT NULL,
	"bonus_services" integer DEFAULT 0,
	"total_allowance" integer NOT NULL,
	"services_used" integer NOT NULL,
	"services_remaining" integer NOT NULL,
	"overage_services" integer DEFAULT 0,
	"overage_charges_cents" integer DEFAULT 0,
	"credits_applied" integer DEFAULT 0,
	"is_period_complete" boolean DEFAULT false,
	"next_reset_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"user_id" text,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"stripe_refund_id" text,
	"stripe_customer_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"platform_fee_cents" integer DEFAULT 0,
	"provider_payout_cents" integer DEFAULT 0,
	"refunded_amount_cents" integer DEFAULT 0,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"last4" text,
	"brand" text,
	"metadata" jsonb DEFAULT '{}',
	"error_code" text,
	"error_message" text,
	"processed_at" timestamp,
	"failed_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"subscription_notifications" boolean DEFAULT true NOT NULL,
	"payment_notifications" boolean DEFAULT true NOT NULL,
	"loyalty_notifications" boolean DEFAULT true NOT NULL,
	"group_booking_notifications" boolean DEFAULT true NOT NULL,
	"price_alert_notifications" boolean DEFAULT true NOT NULL,
	"referral_notifications" boolean DEFAULT true NOT NULL,
	"booking_notifications" boolean DEFAULT true NOT NULL,
	"review_notifications" boolean DEFAULT true NOT NULL,
	"marketing_notifications" boolean DEFAULT false NOT NULL,
	"daily_digest" boolean DEFAULT false NOT NULL,
	"weekly_digest" boolean DEFAULT false NOT NULL,
	"instant_notifications" boolean DEFAULT true NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" integer,
	"quiet_hours_end" integer,
	"timezone" text DEFAULT 'UTC',
	"preferred_email" text,
	"preferred_phone" text,
	"email_unsubscribe_token" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "notification_preferences_email_unsubscribe_token_unique" UNIQUE("email_unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"scheduled_for" timestamp,
	"processed_at" timestamp,
	"next_retry_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"subject_template" text,
	"title_template" text NOT NULL,
	"body_template" text NOT NULL,
	"html_template" text,
	"variables" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipient_email" text,
	"recipient_phone" text,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"priority" "notification_priority" DEFAULT 'medium' NOT NULL,
	"subject" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"html_content" text,
	"action_url" text,
	"action_text" text,
	"image_url" text,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"error_code" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"next_retry_at" timestamp,
	"batch_id" text,
	"group_key" text,
	"provider" text,
	"provider_message_id" text,
	"provider_response" jsonb,
	"metadata" jsonb DEFAULT '{}',
	"template_id" text,
	"template_version" integer,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "is_group_booking" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_subscription_id_customer_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_usage_records" ADD CONSTRAINT "subscription_usage_records_adjusted_by_profiles_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_usage_summaries" ADD CONSTRAINT "subscription_usage_summaries_subscription_id_customer_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_preferences_unsubscribe_token_idx" ON "notification_preferences" USING btree ("email_unsubscribe_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_queue_notification_id_idx" ON "notification_queue" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_queue_status_idx" ON "notification_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_queue_scheduled_for_idx" ON "notification_queue" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_queue_priority_idx" ON "notification_queue" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_code_idx" ON "notification_templates" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_templates_type_idx" ON "notification_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_templates_channel_idx" ON "notification_templates" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_templates_is_active_idx" ON "notification_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_channel_idx" ON "notifications" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_batch_id_idx" ON "notifications" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_group_key_idx" ON "notifications" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_status_idx" ON "notifications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_type_idx" ON "notifications" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_channel_idx" ON "notifications" USING btree ("user_id","channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");