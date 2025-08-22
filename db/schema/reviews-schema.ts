import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { bookingsTable } from "./bookings-schema";
import { providersTable } from "./providers-schema";
import { profilesTable } from "./profiles-schema";

// Reviews table for customer reviews after booking completion
export const reviewsTable = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookingsTable.id, { onDelete: "cascade" }), // CASCADE: Delete review when booking is deleted
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }), // CASCADE: Delete reviews when provider is deleted
  customerId: text("customer_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }), // CASCADE: Delete reviews when customer is deleted
  
  // Rating and review
  rating: integer("rating").notNull(), // 1-5 stars
  reviewText: text("review_text"),
  
  // Provider can respond
  providerResponse: text("provider_response"),
  providerRespondedAt: timestamp("provider_responded_at"),
  
  // Verification and moderation
  isVerifiedBooking: boolean("is_verified_booking").default(true).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  isFlagged: boolean("is_flagged").default(false).notNull(),
  flagReason: text("flag_reason"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type exports for TypeScript
export type Review = typeof reviewsTable.$inferSelect;
export type NewReview = typeof reviewsTable.$inferInsert;