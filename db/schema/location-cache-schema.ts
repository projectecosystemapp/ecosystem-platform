import { 
  pgTable, 
  text, 
  uuid, 
  timestamp, 
  decimal,
  index,
  unique
} from "drizzle-orm/pg-core";

// Location cache table for storing geocoded results
// Reduces API calls and improves performance
export const locationCacheTable = pgTable("location_cache", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Input address (normalized)
  inputAddress: text("input_address").notNull(),
  inputCity: text("input_city"),
  inputState: text("input_state"),
  inputZipCode: text("input_zip_code"),
  inputCountry: text("input_country").default("US").notNull(),
  
  // Geocoding results from Mapbox
  formattedAddress: text("formatted_address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  
  // Address components
  streetNumber: text("street_number"),
  streetName: text("street_name"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  
  // Mapbox response metadata
  accuracy: text("accuracy"), // exact, interpolated, etc.
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  mapboxId: text("mapbox_id"),
  
  // Cache metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Cache for 30 days
  hitCount: decimal("hit_count", { precision: 10, scale: 0 }).default("1").notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
}, (table) => ({
  // Index for fast lookups
  inputAddressIdx: index("location_cache_input_address_idx").on(
    table.inputAddress, 
    table.inputCity, 
    table.inputState, 
    table.inputZipCode
  ),
  
  // Unique constraint to prevent duplicates
  uniqueInput: unique("location_cache_unique_input").on(
    table.inputAddress, 
    table.inputCity, 
    table.inputState, 
    table.inputZipCode, 
    table.inputCountry
  ),
  
  // Index for cleanup of expired entries
  expiresAtIdx: index("location_cache_expires_at_idx").on(table.expiresAt),
  
  // Index for reverse lookups
  coordinatesIdx: index("location_cache_coordinates_idx").on(table.latitude, table.longitude),
}));

// Type exports
export type LocationCache = typeof locationCacheTable.$inferSelect;
export type NewLocationCache = typeof locationCacheTable.$inferInsert;