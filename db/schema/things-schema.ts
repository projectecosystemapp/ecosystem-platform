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
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profilesTable } from "./profiles-schema";

// Enum for item condition
export const itemConditionEnum = pgEnum("item_condition", [
  "new",
  "like_new",
  "excellent",
  "good",
  "fair",
  "for_parts",
]);

// Enum for item category
export const itemCategoryEnum = pgEnum("item_category", [
  "electronics",
  "furniture",
  "clothing",
  "tools",
  "sports",
  "books",
  "toys",
  "appliances",
  "automotive",
  "garden",
  "music",
  "art",
  "collectibles",
  "other",
]);

// Enum for listing status
export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "active",
  "pending",
  "sold",
  "reserved",
  "expired",
  "deleted",
]);

// Main things/marketplace items table
export const thingsTable = pgTable(
  "things",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Basic information
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: itemCategoryEnum("category").notNull(),
    subcategory: text("subcategory"),
    condition: itemConditionEnum("condition").notNull(),
    brand: text("brand"),
    model: text("model"),
    
    // Pricing
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
    negotiable: boolean("negotiable").default(false).notNull(),
    currency: text("currency").default("USD").notNull(),
    
    // Media
    images: jsonb("images").$type<string[]>().default([]).notNull(),
    thumbnailUrl: text("thumbnail_url"),
    videoUrl: text("video_url"),
    
    // Location
    location: text("location").notNull(),
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    
    // Availability
    status: listingStatusEnum("status").default("draft").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    availableFrom: timestamp("available_from"),
    availableUntil: timestamp("available_until"),
    
    // Delivery options
    shippingAvailable: boolean("shipping_available").default(false).notNull(),
    shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
    localPickupOnly: boolean("local_pickup_only").default(true).notNull(),
    deliveryRadius: integer("delivery_radius"), // in miles
    
    // Seller information
    sellerId: text("seller_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    preferredContact: text("preferred_contact", { 
      enum: ["app", "email", "phone", "text"] 
    }).default("app"),
    
    // Additional details
    specifications: jsonb("specifications").$type<Record<string, any>>(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    yearManufactured: integer("year_manufactured"),
    dimensions: jsonb("dimensions").$type<{
      length?: number;
      width?: number;
      height?: number;
      weight?: number;
      unit?: string;
    }>(),
    
    // Engagement metrics
    viewCount: integer("view_count").default(0).notNull(),
    favoriteCount: integer("favorite_count").default(0).notNull(),
    inquiryCount: integer("inquiry_count").default(0).notNull(),
    
    // SEO and search
    slug: text("slug").unique(),
    keywords: text("keywords"),
    featured: boolean("featured").default(false).notNull(),
    boosted: boolean("boosted").default(false).notNull(),
    boostedUntil: timestamp("boosted_until"),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    publishedAt: timestamp("published_at"),
    soldAt: timestamp("sold_at"),
    lastBumpedAt: timestamp("last_bumped_at"),
  },
  (table) => ({
    sellerIdIdx: index("things_seller_id_idx").on(table.sellerId),
    categoryIdx: index("things_category_idx").on(table.category),
    statusIdx: index("things_status_idx").on(table.status),
    priceIdx: index("things_price_idx").on(table.price),
    locationIdx: index("things_location_idx").on(table.city, table.state),
    createdAtIdx: index("things_created_at_idx").on(table.createdAt),
    featuredIdx: index("things_featured_idx").on(table.featured),
  })
);

// Favorites/Saved items table
export const thingsFavoritesTable = pgTable(
  "things_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    thingId: uuid("thing_id")
      .notNull()
      .references(() => thingsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("things_favorites_user_id_idx").on(table.userId),
    thingIdIdx: index("things_favorites_thing_id_idx").on(table.thingId),
  })
);

// Messages/Inquiries table for item discussions
export const thingsInquiriesTable = pgTable(
  "things_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    thingId: uuid("thing_id")
      .notNull()
      .references(() => thingsTable.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => profilesTable.userId, { onDelete: "cascade" }),
    message: text("message").notNull(),
    offerAmount: decimal("offer_amount", { precision: 10, scale: 2 }),
    status: text("status", {
      enum: ["pending", "replied", "accepted", "declined", "expired"]
    }).default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    repliedAt: timestamp("replied_at"),
  },
  (table) => ({
    thingIdIdx: index("things_inquiries_thing_id_idx").on(table.thingId),
    fromUserIdIdx: index("things_inquiries_from_user_id_idx").on(table.fromUserId),
    toUserIdIdx: index("things_inquiries_to_user_id_idx").on(table.toUserId),
  })
);

// Relations
export const thingsRelations = relations(thingsTable, ({ one, many }) => ({
  seller: one(profilesTable, {
    fields: [thingsTable.sellerId],
    references: [profilesTable.userId],
  }),
  favorites: many(thingsFavoritesTable),
  inquiries: many(thingsInquiriesTable),
}));

export const thingsFavoritesRelations = relations(thingsFavoritesTable, ({ one }) => ({
  user: one(profilesTable, {
    fields: [thingsFavoritesTable.userId],
    references: [profilesTable.userId],
  }),
  thing: one(thingsTable, {
    fields: [thingsFavoritesTable.thingId],
    references: [thingsTable.id],
  }),
}));

export const thingsInquiriesRelations = relations(thingsInquiriesTable, ({ one }) => ({
  thing: one(thingsTable, {
    fields: [thingsInquiriesTable.thingId],
    references: [thingsTable.id],
  }),
  fromUser: one(profilesTable, {
    fields: [thingsInquiriesTable.fromUserId],
    references: [profilesTable.userId],
  }),
  toUser: one(profilesTable, {
    fields: [thingsInquiriesTable.toUserId],
    references: [profilesTable.userId],
  }),
}));

// Type exports
export type Thing = typeof thingsTable.$inferSelect;
export type NewThing = typeof thingsTable.$inferInsert;
export type ThingFavorite = typeof thingsFavoritesTable.$inferSelect;
export type ThingInquiry = typeof thingsInquiriesTable.$inferSelect;