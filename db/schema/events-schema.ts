import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  decimal, 
  integer, 
  boolean, 
  jsonb,
  index
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { providersTable } from "./providers-schema";
import { bookingsTable } from "./bookings-schema";

// ===== EVENTS TABLE =====
export const eventsTable = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }),
  
  // Event details
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // workshop, class, meetup, concert, etc.
  category: text("category").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  
  // Timing
  startDateTime: timestamp("start_datetime").notNull(),
  endDateTime: timestamp("end_datetime").notNull(),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  recurringPattern: jsonb("recurring_pattern").$type<{
    frequency?: "daily" | "weekly" | "monthly";
    interval?: number;
    daysOfWeek?: number[];
    endDate?: string;
  }>(),
  
  // Location
  locationType: text("location_type", {
    enum: ["in_person", "virtual", "hybrid"]
  }).notNull(),
  venueId: uuid("venue_id"), // References spaces table if using a space
  virtualLink: text("virtual_link"),
  address: jsonb("address").$type<{
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  }>(),
  
  // Capacity & Pricing
  maxAttendees: integer("max_attendees"),
  currentAttendees: integer("current_attendees").default(0).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  earlyBirdPrice: decimal("early_bird_price", { precision: 10, scale: 2 }),
  earlyBirdDeadline: timestamp("early_bird_deadline"),
  
  // Media
  coverImageUrl: text("cover_image_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  
  // Status
  status: text("status", {
    enum: ["draft", "published", "cancelled", "completed"]
  }).default("draft").notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  instantBooking: boolean("instant_booking").default(true).notNull(),
  requiresApproval: boolean("requires_approval").default(false).notNull(),
  
  // Policies
  cancellationPolicy: text("cancellation_policy", {
    enum: ["flexible", "moderate", "strict"]
  }).default("flexible").notNull(),
  refundPolicy: jsonb("refund_policy").$type<{
    fullRefundHours?: number;
    partialRefundHours?: number;
    partialRefundPercent?: number;
  }>().default({ fullRefundHours: 24, partialRefundHours: 2, partialRefundPercent: 50 }),
  
  // SEO & Discovery
  slug: text("slug").unique().notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
  
  // Analytics
  viewCount: integer("view_count").default(0).notNull(),
  favoriteCount: integer("favorite_count").default(0).notNull(),
}, (table) => {
  return {
    startDateTimeIdx: index("idx_events_start_datetime").on(table.startDateTime),
    providerIdx: index("idx_events_provider").on(table.providerId),
    categoryIdx: index("idx_events_category").on(table.category),
    statusIdx: index("idx_events_status").on(table.status),
    slugIdx: index("idx_events_slug").on(table.slug),
  };
});

// ===== EVENT ATTENDEES TABLE =====
export const eventAttendeesTable = pgTable("event_attendees", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  
  // Attendee info
  customerId: text("customer_id").notNull(), // Clerk user ID
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  
  // Attendance
  numberOfGuests: integer("number_of_guests").default(1).notNull(),
  checkedIn: boolean("checked_in").default(false).notNull(),
  checkedInAt: timestamp("checked_in_at"),
  
  // Status
  status: text("status", {
    enum: ["confirmed", "waitlist", "cancelled", "no_show"]
  }).default("confirmed").notNull(),
  
  // Special requests
  dietaryRestrictions: text("dietary_restrictions"),
  specialRequests: text("special_requests"),
  
  // Metadata
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    eventIdx: index("idx_attendees_event").on(table.eventId),
    customerIdx: index("idx_attendees_customer").on(table.customerId),
    bookingIdx: index("idx_attendees_booking").on(table.bookingId),
  };
});

// ===== EVENT FAVORITES TABLE =====
export const eventFavoritesTable = pgTable("event_favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(), // Clerk user ID
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    eventUserIdx: index("idx_favorites_event_user").on(table.eventId, table.userId),
  };
});

// Type exports
export type Event = typeof eventsTable.$inferSelect;
export type NewEvent = typeof eventsTable.$inferInsert;

export type EventAttendee = typeof eventAttendeesTable.$inferSelect;
export type NewEventAttendee = typeof eventAttendeesTable.$inferInsert;

export type EventFavorite = typeof eventFavoritesTable.$inferSelect;
export type NewEventFavorite = typeof eventFavoritesTable.$inferInsert;

// Relations
export const eventsRelations = relations(eventsTable, ({ one, many }) => ({
  provider: one(providersTable, {
    fields: [eventsTable.providerId],
    references: [providersTable.id],
  }),
  attendees: many(eventAttendeesTable),
  bookings: many(bookingsTable),
  favorites: many(eventFavoritesTable),
}));

export const eventAttendeesRelations = relations(eventAttendeesTable, ({ one }) => ({
  event: one(eventsTable, {
    fields: [eventAttendeesTable.eventId],
    references: [eventsTable.id],
  }),
  booking: one(bookingsTable, {
    fields: [eventAttendeesTable.bookingId],
    references: [bookingsTable.id],
  }),
}));

export const eventFavoritesRelations = relations(eventFavoritesTable, ({ one }) => ({
  event: one(eventsTable, {
    fields: [eventFavoritesTable.eventId],
    references: [eventsTable.id],
  }),
}));