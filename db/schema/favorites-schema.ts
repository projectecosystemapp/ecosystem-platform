import { 
  pgTable, 
  text, 
  uuid, 
  timestamp,
  pgEnum,
  uniqueIndex,
  jsonb
} from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles-schema";
import { providersTable } from "./providers-schema";
import { eventsTable } from "./events-schema";
import { spacesTable } from "./spaces-schema";
import { thingsTable } from "./things-schema";

// Favorite type enum
export const favoriteTypeEnum = pgEnum("favorite_type", [
  "provider",
  "service",
  "event",
  "space",
  "thing"
]);

// Favorites table for saved items
export const favoritesTable = pgTable("favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // User who favorited the item
  userId: text("user_id")
    .notNull()
    .references(() => profilesTable.userId, { onDelete: "cascade" }),
  
  // Type of favorited item
  type: favoriteTypeEnum("type").notNull(),
  
  // References to different entities (only one will be filled based on type)
  providerId: uuid("provider_id")
    .references(() => providersTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id"), // Reference to services when that table is created
  eventId: uuid("event_id")
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  spaceId: uuid("space_id")
    .references(() => spacesTable.id, { onDelete: "cascade" }),
  thingId: uuid("thing_id")
    .references(() => thingsTable.id, { onDelete: "cascade" }),
  
  // Cached data for quick display (avoid joins)
  cachedData: jsonb("cached_data").$type<{
    name: string;
    description?: string;
    price?: number;
    imageUrl?: string;
    category?: string;
    providerName?: string;
    rating?: number;
  }>(),
  
  // User notes about the favorite
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure a user can only favorite an item once
  uniqueFavorite: uniqueIndex("unique_user_favorite")
    .on(table.userId, table.type, table.providerId, table.serviceId, table.eventId, table.spaceId, table.thingId),
  // Index for quick lookups by user
  userIdIndex: uniqueIndex("favorites_user_id_idx").on(table.userId),
}));

// Type exports
export type Favorite = typeof favoritesTable.$inferSelect;
export type NewFavorite = typeof favoritesTable.$inferInsert;