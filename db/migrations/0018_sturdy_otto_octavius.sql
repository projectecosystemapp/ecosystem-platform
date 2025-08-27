CREATE TABLE IF NOT EXISTS "email_blacklist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"reason" varchar(100) NOT NULL,
	"source" varchar(50),
	"metadata" jsonb,
	"added_by" varchar(255),
	"added_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"notes" text,
	CONSTRAINT "email_blacklist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"email_log_id" text NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"event_data" jsonb,
	"provider" varchar(50) NOT NULL,
	"provider_event_id" varchar(255),
	"webhook_id" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"device_type" varchar(50),
	"clicked_url" text,
	"bounce_type" varchar(50),
	"bounce_sub_type" varchar(50),
	"complaint_type" varchar(50),
	"event_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" varchar(255) NOT NULL,
	"idempotency_key" varchar(255),
	"template" varchar(100) NOT NULL,
	"subject" text NOT NULL,
	"to" jsonb NOT NULL,
	"cc" jsonb,
	"bcc" jsonb,
	"from" varchar(255) NOT NULL,
	"reply_to" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"bounced_at" timestamp,
	"complained_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"next_retry_at" timestamp,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"error_code" varchar(50),
	"is_retryable" boolean DEFAULT true,
	"provider" varchar(50) DEFAULT 'resend' NOT NULL,
	"provider_message_id" varchar(255),
	"provider_response" jsonb,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"scheduled_for" timestamp,
	"metadata" jsonb,
	"template_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"variables" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_version_id" text,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"level" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"color" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "availability_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"service_id" uuid,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_booked" boolean DEFAULT false,
	"booking_id" uuid,
	"locked_until" timestamp,
	"locked_by_session" text,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "availability_cache_provider_id_date_start_time_end_time_timezone_unique" UNIQUE("provider_id","date","start_time","end_time","timezone")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_performance_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"reminder_type" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"delivery_method" text DEFAULT 'email' NOT NULL,
	"recipient_type" text NOT NULL,
	"subject" text,
	"message" text,
	"template_id" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"sent_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "booking_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"triggered_by" text,
	"trigger_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_booking_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"booking_data" jsonb DEFAULT '{}'::jsonb,
	"payment_intent_id" text,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_booking_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"net_payout" numeric(10, 2) NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"processed_at" timestamp,
	"stripe_transfer_id" text,
	"stripe_payout_id" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"subcategory" text,
	"base_price" numeric(10, 2) NOT NULL,
	"price_type" text DEFAULT 'fixed' NOT NULL,
	"minimum_duration" integer DEFAULT 30 NOT NULL,
	"maximum_duration" integer,
	"buffer_time_before" integer DEFAULT 0,
	"buffer_time_after" integer DEFAULT 0,
	"advance_booking_hours" integer DEFAULT 24,
	"cancellation_hours" integer DEFAULT 24,
	"is_active" boolean DEFAULT true,
	"requires_approval" boolean DEFAULT false,
	"max_group_size" integer DEFAULT 1,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"requirements" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_run_id" uuid NOT NULL,
	"transaction_id" uuid,
	"stripe_charge_id" text,
	"stripe_transfer_id" text,
	"stripe_refund_id" text,
	"stripe_payout_id" text,
	"item_type" text NOT NULL,
	"database_amount" numeric(10, 2),
	"stripe_amount" numeric(10, 2),
	"discrepancy_amount" numeric(10, 2),
	"currency" text DEFAULT 'USD',
	"status" text NOT NULL,
	"resolution_status" text DEFAULT 'pending',
	"resolution_notes" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_date" date NOT NULL,
	"run_type" text DEFAULT 'daily' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"total_transactions" integer DEFAULT 0,
	"matched_transactions" integer DEFAULT 0,
	"unmatched_transactions" integer DEFAULT 0,
	"discrepancies_found" integer DEFAULT 0,
	"total_amount_reconciled" numeric(10, 2) DEFAULT '0',
	"error_message" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refund_amount" numeric(10, 2);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_log_id_email_logs_id_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_logs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_cache" ADD CONSTRAINT "availability_cache_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_cache" ADD CONSTRAINT "availability_cache_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "availability_cache" ADD CONSTRAINT "availability_cache_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_reminders" ADD CONSTRAINT "booking_reminders_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_state_transitions" ADD CONSTRAINT "booking_state_transitions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payout_schedules" ADD CONSTRAINT "payout_schedules_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payout_schedules" ADD CONSTRAINT "payout_schedules_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_reconciliation_run_id_reconciliation_runs_id_fk" FOREIGN KEY ("reconciliation_run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_blacklist_email_idx" ON "email_blacklist" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_blacklist_reason_idx" ON "email_blacklist" USING btree ("reason");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_blacklist_expires_at_idx" ON "email_blacklist" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_blacklist_added_at_idx" ON "email_blacklist" USING btree ("added_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_email_log_id_idx" ON "email_events" USING btree ("email_log_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_message_id_idx" ON "email_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_event_type_idx" ON "email_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_event_at_idx" ON "email_events" USING btree ("event_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_events_provider_event_id_idx" ON "email_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_email_log_event_type_idx" ON "email_events" USING btree ("email_log_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_message_id_idx" ON "email_logs" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_idempotency_key_idx" ON "email_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_template_idx" ON "email_logs" USING btree ("template");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_sent_at_idx" ON "email_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_created_at_idx" ON "email_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_provider_message_id_idx" ON "email_logs" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_status_created_at_idx" ON "email_logs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_template_status_idx" ON "email_logs" USING btree ("template","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_booking_id_idx" ON "email_logs" USING btree ("metadata");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_user_id_idx" ON "email_logs" USING btree ("metadata");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_provider_id_idx" ON "email_logs" USING btree ("metadata");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_name_idx" ON "email_templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_templates_category_idx" ON "email_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_templates_is_active_idx" ON "email_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_templates_created_at_idx" ON "email_templates" USING btree ("created_at");