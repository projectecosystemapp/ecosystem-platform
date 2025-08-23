import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  decimal, 
  integer, 
  boolean, 
  jsonb,
  index,
  point
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { providersTable } from "./providers-schema";
import { bookingsTable } from "./bookings-schema";

// ===== SPACES/VENUES TABLE =====
export const spacesTable = pgTable("spaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providersTable.id, { onDelete: "cascade" }),
  
  // Space details
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  spaceType: text("space_type", {
    enum: ["office", "studio", "venue", "meeting_room", "classroom", "gallery", "workshop", "coworking", "other"]
  }).notNull(),
  category: text("category").notNull(),
  
  // Location
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  country: text("country").default("US").notNull(),
  coordinates: jsonb("coordinates").$type<{ lat: number; lng: number }>(),
  neighborhood: text("neighborhood"),
  
  // Specifications
  capacity: integer("capacity").notNull(),
  squareFeet: integer("square_feet"),
  ceilingHeight: integer("ceiling_height"), // in feet
  floorNumber: integer("floor_number"),
  
  // Features & Amenities
  amenities: jsonb("amenities").$type<string[]>().default([]),
  features: jsonb("features").$type<{
    hasWifi?: boolean;
    hasParking?: boolean;
    hasKitchen?: boolean;
    hasAC?: boolean;
    hasHeating?: boolean;
    hasProjector?: boolean;
    hasSoundSystem?: boolean;
    hasWhiteboard?: boolean;
    isAccessible?: boolean;
    hasElevator?: boolean;
    hasOutdoorSpace?: boolean;
    allowsPets?: boolean;
    allowsSmoking?: boolean;
    allowsAlcohol?: boolean;
    allowsFood?: boolean;
  }>().default({}),
  equipment: jsonb("equipment").$type<string[]>().default([]),
  
  // Rules & Restrictions
  rules: jsonb("rules").$type<string[]>().default([]),
  noiseLevel: text("noise_level", {
    enum: ["quiet", "moderate", "loud"]
  }).default("moderate"),
  
  // Pricing
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  halfDayRate: decimal("half_day_rate", { precision: 10, scale: 2 }), // 4 hours
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }), // 8 hours
  weeklyRate: decimal("weekly_rate", { precision: 10, scale: 2 }),
  monthlyRate: decimal("monthly_rate", { precision: 10, scale: 2 }),
  
  // Additional fees
  cleaningFee: decimal("cleaning_fee", { precision: 10, scale: 2 }),
  securityDeposit: decimal("security_deposit", { precision: 10, scale: 2 }),
  
  // Availability
  operatingHours: jsonb("operating_hours").$type<{
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  }>().default({}),
  minimumBookingDuration: integer("minimum_booking_duration").default(60), // in minutes
  maximumBookingDuration: integer("maximum_booking_duration"), // in minutes, null = no limit
  advanceNoticeHours: integer("advance_notice_hours").default(24),
  bufferTimeBetweenBookings: integer("buffer_time").default(30), // in minutes
  
  // Media
  coverImageUrl: text("cover_image_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  virtualTourUrl: text("virtual_tour_url"),
  floorPlanUrl: text("floor_plan_url"),
  videoUrl: text("video_url"),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  instantBooking: boolean("instant_booking").default(false).notNull(),
  requiresApproval: boolean("requires_approval").default(true).notNull(),
  
  // Policies
  cancellationPolicy: text("cancellation_policy", {
    enum: ["flexible", "moderate", "strict", "super_strict"]
  }).default("moderate").notNull(),
  cancellationPolicyDetails: jsonb("cancellation_policy_details").$type<{
    fullRefundHours?: number;
    partialRefundHours?: number;
    partialRefundPercent?: number;
  }>().default({ fullRefundHours: 48, partialRefundHours: 24, partialRefundPercent: 50 }),
  
  // SEO & Discovery
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  
  // Analytics
  viewCount: integer("view_count").default(0).notNull(),
  favoriteCount: integer("favorite_count").default(0).notNull(),
  totalBookings: integer("total_bookings").default(0).notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  verifiedAt: timestamp("verified_at"),
}, (table) => {
  return {
    providerIdx: index("idx_spaces_provider").on(table.providerId),
    locationIdx: index("idx_spaces_location").on(table.city, table.state),
    typeIdx: index("idx_spaces_type").on(table.spaceType),
    categoryIdx: index("idx_spaces_category").on(table.category),
    slugIdx: index("idx_spaces_slug").on(table.slug),
    activeIdx: index("idx_spaces_active").on(table.isActive),
  };
});

// ===== SPACE AVAILABILITY TABLE =====
export const spaceAvailabilityTable = pgTable("space_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spacesTable.id, { onDelete: "cascade" }),
  
  // Availability type
  availabilityType: text("availability_type", {
    enum: ["available", "blocked", "holiday", "maintenance"]
  }).notNull(),
  
  // Date range
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Time range (optional, for partial day blocks)
  startTime: text("start_time"), // HH:MM format
  endTime: text("end_time"), // HH:MM format
  
  // Reason (for blocks)
  reason: text("reason"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    spaceIdx: index("idx_space_availability_space").on(table.spaceId),
    dateIdx: index("idx_space_availability_dates").on(table.startDate, table.endDate),
  };
});

// ===== SPACE FAVORITES TABLE =====
export const spaceFavoritesTable = pgTable("space_favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spacesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(), // Clerk user ID
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    spaceUserIdx: index("idx_space_favorites_space_user").on(table.spaceId, table.userId),
  };
});

// ===== SPACE REVIEWS TABLE =====
export const spaceReviewsTable = pgTable("space_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  spaceId: uuid("space_id")
    .notNull()
    .references(() => spacesTable.id, { onDelete: "cascade" }),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  
  // Reviewer info
  customerId: text("customer_id").notNull(), // Clerk user ID
  customerName: text("customer_name").notNull(),
  
  // Review content
  rating: integer("rating").notNull(), // 1-5 stars
  title: text("title"),
  comment: text("comment"),
  
  // Detailed ratings
  cleanlinessRating: integer("cleanliness_rating"), // 1-5
  accuracyRating: integer("accuracy_rating"), // 1-5
  valueRating: integer("value_rating"), // 1-5
  communicationRating: integer("communication_rating"), // 1-5
  locationRating: integer("location_rating"), // 1-5
  amenitiesRating: integer("amenities_rating"), // 1-5
  
  // Provider response
  providerResponse: text("provider_response"),
  providerRespondedAt: timestamp("provider_responded_at"),
  
  // Status
  isVerified: boolean("is_verified").default(false).notNull(), // Verified booking
  isHidden: boolean("is_hidden").default(false).notNull(),
  
  // Media
  photos: jsonb("photos").$type<string[]>().default([]),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    spaceIdx: index("idx_space_reviews_space").on(table.spaceId),
    customerIdx: index("idx_space_reviews_customer").on(table.customerId),
    bookingIdx: index("idx_space_reviews_booking").on(table.bookingId),
    ratingIdx: index("idx_space_reviews_rating").on(table.rating),
  };
});

// Type exports
export type Space = typeof spacesTable.$inferSelect;
export type NewSpace = typeof spacesTable.$inferInsert;

export type SpaceAvailability = typeof spaceAvailabilityTable.$inferSelect;
export type NewSpaceAvailability = typeof spaceAvailabilityTable.$inferInsert;

export type SpaceFavorite = typeof spaceFavoritesTable.$inferSelect;
export type NewSpaceFavorite = typeof spaceFavoritesTable.$inferInsert;

export type SpaceReview = typeof spaceReviewsTable.$inferSelect;
export type NewSpaceReview = typeof spaceReviewsTable.$inferInsert;

// Relations
export const spacesRelations = relations(spacesTable, ({ one, many }) => ({
  provider: one(providersTable, {
    fields: [spacesTable.providerId],
    references: [providersTable.id],
  }),
  availability: many(spaceAvailabilityTable),
  bookings: many(bookingsTable),
  favorites: many(spaceFavoritesTable),
  reviews: many(spaceReviewsTable),
}));

export const spaceAvailabilityRelations = relations(spaceAvailabilityTable, ({ one }) => ({
  space: one(spacesTable, {
    fields: [spaceAvailabilityTable.spaceId],
    references: [spacesTable.id],
  }),
}));

export const spaceFavoritesRelations = relations(spaceFavoritesTable, ({ one }) => ({
  space: one(spacesTable, {
    fields: [spaceFavoritesTable.spaceId],
    references: [spacesTable.id],
  }),
}));

export const spaceReviewsRelations = relations(spaceReviewsTable, ({ one }) => ({
  space: one(spacesTable, {
    fields: [spaceReviewsTable.spaceId],
    references: [spacesTable.id],
  }),
  booking: one(bookingsTable, {
    fields: [spaceReviewsTable.bookingId],
    references: [bookingsTable.id],
  }),
}));