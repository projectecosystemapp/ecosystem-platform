import { pgTable, text, uuid, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Webhook Events Table
 * Tracks all incoming webhook events for idempotency and audit purposes
 */
export const webhookEventsTable = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // Stripe event details
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  
  // Processing status
  status: text("status").notNull().$type<"received" | "processing" | "completed" | "failed">().default("received"),
  
  // Event data
  payload: jsonb("payload"),
  
  // Error tracking
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
}, (table) => {
  return {
    // Index for querying by event type and status
    eventTypeStatusIdx: index("idx_webhook_events_type_status").on(table.eventType, table.status),
    // Index for querying recent events
    createdAtIdx: index("idx_webhook_events_created_at").on(table.createdAt),
    // Unique index on eventId for fast duplicate checking
    eventIdIdx: uniqueIndex("idx_webhook_events_event_id").on(table.eventId),
  };
});

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type NewWebhookEvent = typeof webhookEventsTable.$inferInsert;