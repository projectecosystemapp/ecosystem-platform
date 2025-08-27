DO $$ BEGIN
 CREATE TYPE "public"."billing_cycle" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'annual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'paused', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."loyalty_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum', 'diamond');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."points_transaction_type" AS ENUM('earned_booking', 'earned_referral', 'earned_bonus', 'earned_review', 'redeemed_discount', 'redeemed_service', 'expired', 'adjusted', 'transferred');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."referral_status" AS ENUM('pending', 'clicked', 'signed_up', 'completed', 'expired', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."demand_level" AS ENUM('very_low', 'low', 'normal', 'high', 'very_high', 'extreme');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."price_alert_type" AS ENUM('below_price', 'percentage_drop', 'availability', 'new_discount');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."pricing_rule_type" AS ENUM('time_based', 'demand_based', 'seasonal', 'advance_booking', 'loyalty', 'promotional', 'bundle', 'group');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."group_booking_status" AS ENUM('draft', 'collecting', 'pending_confirmation', 'confirmed', 'cancelled', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."participant_status" AS ENUM('invited', 'accepted', 'declined', 'pending_payment', 'paid', 'cancelled', 'refunded', 'waitlisted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."group_payment_method" AS ENUM('organizer_pays', 'split_equal', 'custom_split', 'pay_own', 'deposit_split', 'corporate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"canceled_at" timestamp,
	"cancelation_reason" text,
	"paused_at" timestamp,
	"pause_reason" text,
	"resume_at" timestamp,
	"services_used_this_period" integer DEFAULT 0,
	"total_services_used" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customer_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"auto_scheduled" boolean DEFAULT true,
	"billing_period_start" timestamp,
	"billing_period_end" timestamp,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"base_price_cents" integer NOT NULL,
	"setup_fee_cents" integer DEFAULT 0,
	"trial_days" integer DEFAULT 0,
	"services_per_cycle" integer DEFAULT 1,
	"service_duration_minutes" integer DEFAULT 60,
	"max_subscribers" integer,
	"current_subscribers" integer DEFAULT 0,
	"features" jsonb DEFAULT '[]',
	"benefits" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"is_public" boolean DEFAULT true,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"services_included" integer NOT NULL,
	"services_used" integer NOT NULL,
	"services_remaining" integer NOT NULL,
	"amount_billed_cents" integer,
	"stripe_invoice_id" text,
	"is_paid" boolean DEFAULT false,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_points_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_points_redeemed" integer DEFAULT 0 NOT NULL,
	"tier" "loyalty_tier" DEFAULT 'bronze' NOT NULL,
	"tier_progress_amount" integer DEFAULT 0,
	"tier_expires_at" timestamp,
	"next_tier_threshold" integer,
	"benefits_unlocked" jsonb DEFAULT '[]',
	"special_offers" jsonb DEFAULT '[]',
	"last_activity_at" timestamp,
	"last_earned_at" timestamp,
	"last_redeemed_at" timestamp,
	"is_active" boolean DEFAULT true,
	"is_suspended" boolean DEFAULT false,
	"suspension_reason" text,
	"preferences" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_accounts_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"rules" jsonb DEFAULT '{}',
	"points_multiplier" numeric(3, 2) DEFAULT '1.00',
	"bonus_points" integer DEFAULT 0,
	"target_tiers" jsonb DEFAULT '[]',
	"target_providers" jsonb DEFAULT '[]',
	"max_redemptions" integer,
	"max_per_customer" integer DEFAULT 1,
	"total_redemptions" integer DEFAULT 0,
	"total_points_awarded" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "loyalty_tier" NOT NULL,
	"min_spend" integer NOT NULL,
	"min_bookings" integer DEFAULT 0,
	"min_points" integer DEFAULT 0,
	"points_multiplier" numeric(3, 2) DEFAULT '1.00',
	"discount_percent" integer DEFAULT 0,
	"benefits" jsonb DEFAULT '[]',
	"priority_support" boolean DEFAULT false,
	"free_delivery" boolean DEFAULT false,
	"exclusive_access" boolean DEFAULT false,
	"birthday_bonus_points" integer DEFAULT 0,
	"display_name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"color" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_tiers_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "points_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" "points_transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"booking_id" uuid,
	"referral_id" uuid,
	"description" text,
	"metadata" jsonb DEFAULT '{}',
	"expires_at" timestamp,
	"expired_points" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "redemption_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"points_cost" integer NOT NULL,
	"discount_percent" integer,
	"discount_amount_cents" integer,
	"service_id" uuid,
	"min_booking_amount" integer,
	"valid_categories" jsonb DEFAULT '[]',
	"valid_providers" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"stock_limit" integer,
	"stock_remaining" integer,
	"expires_at" timestamp,
	"image_url" text,
	"terms" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" text NOT NULL,
	"referrer_reward_points" integer DEFAULT 500,
	"referrer_reward_issued" boolean DEFAULT false,
	"referred_email" text NOT NULL,
	"referred_user_id" text,
	"referred_reward_points" integer DEFAULT 250,
	"referred_reward_issued" boolean DEFAULT false,
	"referral_code" text NOT NULL,
	"referral_link" text,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"clicked_at" timestamp,
	"signed_up_at" timestamp,
	"first_booking_at" timestamp,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"campaign_code" text,
	"source" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referrals_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitor_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"competitor_name" text,
	"competitor_type" text,
	"service_name" text,
	"price_cents" integer NOT NULL,
	"price_unit" text,
	"booking_fee_cents" integer,
	"cancellation_fee_cents" integer,
	"data_source" text,
	"source_url" text,
	"confidence" numeric(3, 2),
	"is_verified" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"observed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demand_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"service_id" uuid,
	"date" date NOT NULL,
	"hour" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"bookings_count" integer DEFAULT 0,
	"searches_count" integer DEFAULT 0,
	"views_count" integer DEFAULT 0,
	"inquiries_count" integer DEFAULT 0,
	"available_slots" integer,
	"total_slots" integer,
	"utilization_rate" numeric(5, 4),
	"search_to_booking_rate" numeric(5, 4),
	"view_to_booking_rate" numeric(5, 4),
	"avg_price_cents" integer,
	"min_price_cents" integer,
	"max_price_cents" integer,
	"demand_level" "demand_level" DEFAULT 'normal',
	"demand_score" numeric(4, 2),
	"predicted_demand_score" numeric(4, 2),
	"competitor_avg_price_cents" integer,
	"market_share_estimate" numeric(5, 4),
	"weather_conditions" jsonb,
	"local_events" jsonb,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"service_id" uuid,
	"provider_id" uuid,
	"category" text,
	"alert_type" "price_alert_type" NOT NULL,
	"target_price_cents" integer,
	"percentage_drop" integer,
	"start_date" date,
	"end_date" date,
	"is_active" boolean DEFAULT true,
	"is_paused" boolean DEFAULT false,
	"last_triggered_at" timestamp,
	"trigger_count" integer DEFAULT 0,
	"max_triggers" integer,
	"cooldown_hours" integer DEFAULT 24,
	"notify_email" boolean DEFAULT true,
	"notify_push" boolean DEFAULT true,
	"notify_sms" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}',
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"old_price_cents" integer NOT NULL,
	"new_price_cents" integer NOT NULL,
	"change_percent" numeric(6, 2),
	"applied_rules" jsonb DEFAULT '[]',
	"final_modifier" numeric(4, 3),
	"booking_id" uuid,
	"demand_level" "demand_level",
	"change_reason" text,
	"changed_by" text,
	"effective_from" timestamp NOT NULL,
	"effective_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"service_id" uuid,
	"rule_type" "pricing_rule_type" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"conditions" jsonb DEFAULT '{}' NOT NULL,
	"price_modifier" numeric(4, 3) NOT NULL,
	"fixed_adjustment_cents" integer,
	"max_price_cents" integer,
	"min_price_cents" integer,
	"priority" integer DEFAULT 0,
	"is_stackable" boolean DEFAULT false,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"is_active" boolean DEFAULT true,
	"is_automatic" boolean DEFAULT true,
	"times_applied" integer DEFAULT 0,
	"total_revenue_impact_cents" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "surge_pricing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"event_name" text,
	"event_type" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"surge_multiplier" numeric(3, 2) NOT NULL,
	"demand_score" numeric(4, 2),
	"affected_services" jsonb DEFAULT '[]',
	"bookings_affected" integer DEFAULT 0,
	"additional_revenue_cents" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"was_auto_triggered" boolean DEFAULT false,
	"trigger_reason" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_booking_id" uuid NOT NULL,
	"activity_type" text NOT NULL,
	"actor_id" text,
	"actor_type" text,
	"description" text NOT NULL,
	"details" jsonb DEFAULT '{}',
	"participant_id" uuid,
	"is_public" boolean DEFAULT true,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"organizer_id" text NOT NULL,
	"organizer_name" text,
	"organizer_email" text NOT NULL,
	"organizer_phone" text,
	"group_name" text,
	"group_description" text,
	"event_type" text,
	"min_participants" integer DEFAULT 1,
	"max_participants" integer NOT NULL,
	"current_participants" integer DEFAULT 0,
	"confirmed_participants" integer DEFAULT 0,
	"payment_method" "group_payment_method" NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"per_person_amount_cents" integer,
	"deposit_amount_cents" integer,
	"collected_amount_cents" integer DEFAULT 0,
	"refunded_amount_cents" integer DEFAULT 0,
	"registration_deadline" timestamp,
	"payment_deadline" timestamp,
	"status" "group_booking_status" DEFAULT 'draft' NOT NULL,
	"allow_waitlist" boolean DEFAULT false,
	"allow_partial_payment" boolean DEFAULT false,
	"requires_approval" boolean DEFAULT false,
	"is_public" boolean DEFAULT false,
	"welcome_message" text,
	"instructions" text,
	"custom_fields" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"confirmed_at" timestamp,
	"cancelled_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_bookings_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_booking_id" uuid NOT NULL,
	"sender_id" text,
	"sender_type" text NOT NULL,
	"sender_name" text,
	"subject" text,
	"content" text NOT NULL,
	"message_type" text NOT NULL,
	"recipient_type" text NOT NULL,
	"specific_recipients" jsonb DEFAULT '[]',
	"sent_via_email" boolean DEFAULT false,
	"sent_via_sms" boolean DEFAULT false,
	"sent_via_app" boolean DEFAULT true,
	"delivered_count" integer DEFAULT 0,
	"read_count" integer DEFAULT 0,
	"attachments" jsonb DEFAULT '[]',
	"metadata" jsonb DEFAULT '{}',
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_booking_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"phone" text,
	"user_id" text,
	"amount_cents" integer NOT NULL,
	"paid_amount_cents" integer DEFAULT 0,
	"refunded_amount_cents" integer DEFAULT 0,
	"stripe_payment_intent_id" text,
	"stripe_refund_id" text,
	"status" "participant_status" DEFAULT 'invited' NOT NULL,
	"invitation_token" text,
	"invitation_sent_at" timestamp,
	"invitation_viewed_at" timestamp,
	"responded_at" timestamp,
	"decline_reason" text,
	"payment_due_date" timestamp,
	"paid_at" timestamp,
	"payment_reminders_sent" integer DEFAULT 0,
	"last_reminder_at" timestamp,
	"attendance_confirmed" boolean DEFAULT false,
	"checked_in_at" timestamp,
	"no_show" boolean DEFAULT false,
	"dietary_restrictions" text,
	"special_requests" text,
	"emergency_contact" jsonb,
	"custom_responses" jsonb DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "group_participants_invitation_token_unique" UNIQUE("invitation_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "split_payment_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_booking_id" uuid NOT NULL,
	"session_token" text NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"collected_amount_cents" integer DEFAULT 0,
	"remaining_amount_cents" integer NOT NULL,
	"total_participants" integer NOT NULL,
	"paid_participants" integer DEFAULT 0,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"payment_splits" jsonb DEFAULT '[]',
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "split_payment_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_customer_id_profiles_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_subscriptions" ADD CONSTRAINT "customer_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_bookings" ADD CONSTRAINT "subscription_bookings_subscription_id_customer_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_bookings" ADD CONSTRAINT "subscription_bookings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_usage" ADD CONSTRAINT "subscription_usage_subscription_id_customer_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."customer_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customer_id_profiles_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_account_id_loyalty_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_profiles_user_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_profiles_user_id_fk" FOREIGN KEY ("referred_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "demand_metrics" ADD CONSTRAINT "demand_metrics_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "demand_metrics" ADD CONSTRAINT "demand_metrics_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_customer_id_profiles_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_history" ADD CONSTRAINT "price_history_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "surge_pricing_events" ADD CONSTRAINT "surge_pricing_events_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_group_booking_id_group_bookings_id_fk" FOREIGN KEY ("group_booking_id") REFERENCES "public"."group_bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_participant_id_group_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."group_participants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_organizer_id_profiles_user_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_booking_id_group_bookings_id_fk" FOREIGN KEY ("group_booking_id") REFERENCES "public"."group_bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_sender_id_profiles_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_group_booking_id_group_bookings_id_fk" FOREIGN KEY ("group_booking_id") REFERENCES "public"."group_bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_participants" ADD CONSTRAINT "group_participants_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "split_payment_sessions" ADD CONSTRAINT "split_payment_sessions_group_booking_id_group_bookings_id_fk" FOREIGN KEY ("group_booking_id") REFERENCES "public"."group_bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
