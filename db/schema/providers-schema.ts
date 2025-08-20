import { pgTable, text, uuid, timestamp, numeric, boolean, jsonb, integer } from "drizzle-orm/pg-core";

// Main providers table
export const providersTable = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(), // Will add foreign key constraint in migration
  
  // Display information
  displayName: text("display_name").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly name
  tagline: text("tagline"),
  bio: text("bio"),
  
  // Images
  coverImageUrl: text("cover_image_url"),
  profileImageUrl: text("profile_image_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  
  // Location
  locationCity: text("location_city"),
  locationState: text("location_state"),
  locationCountry: text("location_country").default("US"),
  
  // Pricing
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  currency: text("currency").default("usd").notNull(),
  
  // Services offered
  services: jsonb("services").$type<{
    name: string;
    description: string;
    duration: number; // in minutes
    price: number;
  }[]>().default([]),
  
  // Experience & Stats
  yearsExperience: integer("years_experience"),
  completedBookings: integer("completed_bookings").default(0).notNull(),
  averageRating: numeric("average_rating", { precision: 2, scale: 1 }).default("0.0"),
  totalReviews: integer("total_reviews").default(0).notNull(),
  
  // Verification & Status
  isVerified: boolean("is_verified").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  
  // Stripe Connect
  stripeConnectAccountId: text("stripe_connect_account_id"),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false).notNull(),
  commissionRate: numeric("commission_rate", { precision: 3, scale: 2 }).default("0.15").notNull(), // 15% default
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Provider testimonials (featured reviews)
export const providerTestimonialsTable = pgTable("provider_testimonials", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").notNull(), // Will add foreign key constraint in migration
  
  customerName: text("customer_name").notNull(),
  customerImage: text("customer_image"),
  testimonialText: text("testimonial_text").notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Provider availability (recurring weekly schedule)
export const providerAvailabilityTable = pgTable("provider_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").notNull(), // Will add foreign key constraint in migration
  
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday, 6 = Saturday
  startTime: text("start_time").notNull(), // Format: "09:00"
  endTime: text("end_time").notNull(), // Format: "17:00"
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Provider blocked slots (for vacations, appointments, etc.)
export const providerBlockedSlotsTable = pgTable("provider_blocked_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerId: uuid("provider_id").notNull(), // Will add foreign key constraint in migration
  
  blockedDate: timestamp("blocked_date").notNull(),
  startTime: text("start_time"), // Null means full day
  endTime: text("end_time"), // Null means full day
  reason: text("reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for TypeScript
export type Provider = typeof providersTable.$inferSelect;
export type NewProvider = typeof providersTable.$inferInsert;
export type ProviderTestimonial = typeof providerTestimonialsTable.$inferSelect;
export type NewProviderTestimonial = typeof providerTestimonialsTable.$inferInsert;
export type ProviderAvailability = typeof providerAvailabilityTable.$inferSelect;
export type NewProviderAvailability = typeof providerAvailabilityTable.$inferInsert;
export type ProviderBlockedSlot = typeof providerBlockedSlotsTable.$inferSelect;
export type NewProviderBlockedSlot = typeof providerBlockedSlotsTable.$inferInsert;