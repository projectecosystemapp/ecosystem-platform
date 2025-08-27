import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { profilesTable } from "./schema/profiles-schema";
import { pendingProfilesTable } from "./schema/pending-profiles-schema";
import { 
  providersTable, 
  providerTestimonialsTable, 
  providerAvailabilityTable, 
  providerBlockedSlotsTable 
} from "./schema/providers-schema";
import { bookingsTable, transactionsTable } from "./schema/bookings-schema";
import { reviewsTable } from "./schema/reviews-schema";
import { 
  emailLogsTable, 
  emailEventsTable, 
  emailTemplatesTable, 
  emailBlacklistTable 
} from "./schema/email-logs-schema";
import {
  loyaltyAccountsTable,
  pointsTransactionsTable,
  referralsTable,
  loyaltyTiersTable,
  loyaltyCampaignsTable,
  redemptionOptionsTable
} from "./schema/loyalty-schema";
import {
  pricingRulesTable,
  demandMetricsTable,
  priceAlertsTable,
  surgePricingEventsTable,
  priceHistoryTable,
  competitorPricingTable
} from "./schema/pricing-schema";
import { servicesTable } from "./schema/enhanced-booking-schema";
import {
  subscriptionPlansTable,
  customerSubscriptionsTable,
  subscriptionBookingsTable,
  subscriptionUsageTable
} from "./schema/subscriptions-schema";
import {
  subscriptionUsageRecordsTable,
  subscriptionUsageSummariesTable
} from "./schema/subscription-usage-schema";

// Define the schema properly
const schema = { 
  profiles: profilesTable,
  pendingProfiles: pendingProfilesTable,
  providers: providersTable,
  providerTestimonials: providerTestimonialsTable,
  providerAvailability: providerAvailabilityTable,
  providerBlockedSlots: providerBlockedSlotsTable,
  bookings: bookingsTable,
  transactions: transactionsTable,
  reviews: reviewsTable,
  emailLogs: emailLogsTable,
  emailEvents: emailEventsTable,
  emailTemplates: emailTemplatesTable,
  emailBlacklist: emailBlacklistTable,
  loyaltyAccounts: loyaltyAccountsTable,
  pointsTransactions: pointsTransactionsTable,
  referrals: referralsTable,
  loyaltyTiers: loyaltyTiersTable,
  loyaltyCampaigns: loyaltyCampaignsTable,
  redemptionOptions: redemptionOptionsTable,
  services: servicesTable,
  pricingRules: pricingRulesTable,
  demandMetrics: demandMetricsTable,
  priceAlerts: priceAlertsTable,
  surgePricingEvents: surgePricingEventsTable,
  priceHistory: priceHistoryTable,
  competitorPricing: competitorPricingTable,
  subscriptionPlans: subscriptionPlansTable,
  customerSubscriptions: customerSubscriptionsTable,
  subscriptionBookings: subscriptionBookingsTable,
  subscriptionUsage: subscriptionUsageTable,
  subscriptionUsageRecords: subscriptionUsageRecordsTable,
  subscriptionUsageSummaries: subscriptionUsageSummariesTable
};

// Add connection options with improved timeout and retry settings for Vercel environment
const connectionOptions = {
  max: 3,               // Lower max connections to prevent overloading
  idle_timeout: 10,     // Shorter idle timeout
  connect_timeout: 5,   // Shorter connect timeout
  prepare: false,       // Disable prepared statements
  keepalive: true,      // Keep connections alive
  debug: false,         // Disable debug logging in production
  connection: {
    application_name: "whop-boilerplate" // Identify app in Supabase logs
  }
};

// Create a postgres client with optimized connection options
export const client = postgres(process.env.DATABASE_URL!, connectionOptions);

// Create a drizzle client
export const db = drizzle(client, { schema });

// Export a function to check the database connection health
export async function checkDatabaseConnection(): Promise<{ ok: boolean, message: string }> {
  try {
    // Attempt a simple query with a shorter timeout
    const startTime = Date.now();
    await Promise.race([
      client`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 2000))
    ]);
    const duration = Date.now() - startTime;
    return { 
      ok: true, 
      message: `Database connection successful (${duration}ms)` 
    };
  } catch (error) {
    console.error("Database connection check failed:", error);
    
    // Return detailed error information
    const message = error instanceof Error 
      ? `Connection error: ${error.message}`
      : "Unknown connection error";
      
    return { ok: false, message };
  }
}

// Function to check and log connection status
export async function logDatabaseConnectionStatus(): Promise<void> {
  try {
    const status = await checkDatabaseConnection();
    if (status.ok) {
      console.log(status.message);
    } else {
      console.error(status.message);
    }
  } catch (error) {
    console.error("Failed to check database connection:", error);
  }
}
