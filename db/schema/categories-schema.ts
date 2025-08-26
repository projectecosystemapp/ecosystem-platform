import { pgTable, text, uuid, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { servicesTable } from "./enhanced-booking-schema";

// Service Categories table
export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  
  // Hierarchy support
  parentId: uuid("parent_id"),
  level: integer("level").default(0).notNull(), // 0 for top-level categories
  sortOrder: integer("sort_order").default(0).notNull(),
  
  // Display configuration
  icon: text("icon"), // Icon name or URL
  color: text("color"), // Hex color for UI
  imageUrl: text("image_url"),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  
  // Metadata
  metadata: jsonb("metadata").$type<{
    keywords?: string[];
    averagePrice?: number;
    providerCount?: number;
    popularServices?: string[];
  }>().default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  parent: one(categoriesTable, {
    fields: [categoriesTable.parentId],
    references: [categoriesTable.id],
    relationName: "parentChild",
  }),
  children: many(categoriesTable, {
    relationName: "parentChild",
  }),
  services: many(servicesTable),
}));

// Type exports
export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;