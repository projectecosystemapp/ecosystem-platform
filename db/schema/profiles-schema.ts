import { pgEnum, pgTable, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const membershipEnum = pgEnum("membership", ["free", "pro"]);
export const paymentProviderEnum = pgEnum("payment_provider", ["stripe"]);

export const profilesTable = pgTable("profiles", {
  userId: text("user_id").primaryKey().notNull(),
  email: text("email"),
  membership: membershipEnum("membership").notNull().default("free"),
  paymentProvider: paymentProviderEnum("payment_provider").default("stripe"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())
}, (table) => {
  return {
    // Enable RLS on this table
    rls: sql`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    
    // 1. Allow users to read only their own profile
    readPolicy: sql`
      CREATE POLICY "Users can only view their own profile" 
      ON ${table}
      FOR SELECT 
      USING (auth.uid()::text = user_id);
    `,
    
    // 2. Block direct writes from clients
    insertPolicy: sql`
      CREATE POLICY "Block direct client writes" 
      ON ${table}
      FOR INSERT 
      WITH CHECK (false);
    `,
    
    updatePolicy: sql`
      CREATE POLICY "Block direct client updates" 
      ON ${table}
      FOR UPDATE
      USING (false);
    `,
    
    deletePolicy: sql`
      CREATE POLICY "Block direct client deletes" 
      ON ${table}
      FOR DELETE
      USING (false);
    `,
    
    // 3. Create a bypass policy for service role
    serviceRolePolicy: sql`
      CREATE POLICY "Service role has full access" 
      ON ${table}
      USING (auth.role() = 'service_role');
    `,
  };
});

export type InsertProfile = typeof profilesTable.$inferInsert;
export type SelectProfile = typeof profilesTable.$inferSelect;
