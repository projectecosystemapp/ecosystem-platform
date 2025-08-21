import { db } from "@/db/db";
import { 
  providersTable,
  providerAvailabilityTable,
  providerBlockedSlotsTable,
  type Provider,
  type NewProvider,
  type ProviderAvailability,
  type NewProviderAvailability,
} from "@/db/schema/providers-schema";
import { eq, and, or, like, ilike, sql } from "drizzle-orm";

// Create a new provider profile
export async function createProvider(data: NewProvider): Promise<Provider> {
  const [provider] = await db
    .insert(providersTable)
    .values(data)
    .returning();
  
  return provider;
}

// Get provider by user ID
export async function getProviderByUserId(userId: string): Promise<Provider | null> {
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.userId, userId));
  
  return provider || null;
}

// Get provider by ID
export async function getProviderById(providerId: string): Promise<Provider | null> {
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.id, providerId));
  
  return provider || null;
}

// Get provider by slug
export async function getProviderBySlug(slug: string): Promise<Provider | null> {
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.slug, slug));
  
  return provider || null;
}

// Update provider profile
export async function updateProvider(
  providerId: string,
  data: Partial<NewProvider>
): Promise<Provider> {
  const [updatedProvider] = await db
    .update(providersTable)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(providersTable.id, providerId))
    .returning();
  
  return updatedProvider;
}

// Search providers with filters
export async function searchProviders(
  filters?: {
    query?: string;
    city?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    isVerified?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ providers: Provider[]; total: number }> {
  const conditions = [eq(providersTable.isActive, true)];
  
  if (filters?.query) {
    conditions.push(
      or(
        ilike(providersTable.displayName, `%${filters.query}%`),
        ilike(providersTable.tagline, `%${filters.query}%`),
        ilike(providersTable.bio, `%${filters.query}%`),
        sql`${providersTable.services}::text ILIKE ${`%${filters.query}%`}`
      )!
    );
  }
  
  if (filters?.city) {
    conditions.push(eq(providersTable.locationCity, filters.city));
  }
  
  if (filters?.state) {
    conditions.push(eq(providersTable.locationState, filters.state));
  }
  
  if (filters?.minPrice !== undefined) {
    conditions.push(sql`${providersTable.hourlyRate} >= ${filters.minPrice}`);
  }
  
  if (filters?.maxPrice !== undefined) {
    conditions.push(sql`${providersTable.hourlyRate} <= ${filters.maxPrice}`);
  }
  
  if (filters?.minRating !== undefined) {
    conditions.push(sql`${providersTable.averageRating} >= ${filters.minRating}`);
  }
  
  if (filters?.isVerified !== undefined) {
    conditions.push(eq(providersTable.isVerified, filters.isVerified));
  }
  
  const [providersResult, countResult] = await Promise.all([
    db
      .select()
      .from(providersTable)
      .where(and(...conditions))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0)
      .orderBy(providersTable.averageRating),
    db
      .select({ count: sql<number>`count(*)` })
      .from(providersTable)
      .where(and(...conditions))
  ]);
  
  return {
    providers: providersResult,
    total: countResult[0].count,
  };
}

// Get featured providers
export async function getFeaturedProviders(limit: number = 6): Promise<Provider[]> {
  return await db
    .select()
    .from(providersTable)
    .where(
      and(
        eq(providersTable.isActive, true),
        eq(providersTable.isVerified, true),
        sql`${providersTable.averageRating} >= 4.5`
      )
    )
    .orderBy(sql`${providersTable.completedBookings} DESC`)
    .limit(limit);
}

// Update provider stats (after booking completion or review)
export async function updateProviderStats(
  providerId: string,
  stats: {
    completedBookings?: number;
    averageRating?: number;
    totalReviews?: number;
  }
): Promise<Provider> {
  const [updatedProvider] = await db
    .update(providersTable)
    .set({
      ...(stats.completedBookings !== undefined && { completedBookings: stats.completedBookings }),
      ...(stats.averageRating !== undefined && { averageRating: stats.averageRating.toString() }),
      ...(stats.totalReviews !== undefined && { totalReviews: stats.totalReviews }),
      updatedAt: new Date(),
    })
    .where(eq(providersTable.id, providerId))
    .returning();
  
  return updatedProvider;
}

// Update provider Stripe Connect status
export async function updateProviderStripeStatus(
  providerId: string,
  stripeData: {
    stripeConnectAccountId?: string;
    stripeOnboardingComplete?: boolean;
  }
): Promise<Provider> {
  const [updatedProvider] = await db
    .update(providersTable)
    .set({
      ...stripeData,
      updatedAt: new Date(),
    })
    .where(eq(providersTable.id, providerId))
    .returning();
  
  return updatedProvider;
}

// Check if slug is available
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: providersTable.id })
    .from(providersTable)
    .where(eq(providersTable.slug, slug));
  
  return !existing;
}

// Generate unique slug from display name
export async function generateUniqueSlug(displayName: string): Promise<string> {
  const baseSlug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  
  let slug = baseSlug;
  let counter = 1;
  
  while (!(await isSlugAvailable(slug))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

// Get provider's availability
export async function getProviderAvailability(
  providerId: string
): Promise<ProviderAvailability[]> {
  return await db
    .select()
    .from(providerAvailabilityTable)
    .where(eq(providerAvailabilityTable.providerId, providerId))
    .orderBy(providerAvailabilityTable.dayOfWeek);
}

// Set provider availability
export async function setProviderAvailability(
  providerId: string,
  availability: NewProviderAvailability[]
): Promise<ProviderAvailability[]> {
  // Delete existing availability
  await db
    .delete(providerAvailabilityTable)
    .where(eq(providerAvailabilityTable.providerId, providerId));
  
  // Insert new availability
  if (availability.length > 0) {
    return await db
      .insert(providerAvailabilityTable)
      .values(availability)
      .returning();
  }
  
  return [];
}

// Increment completed bookings count
export async function incrementCompletedBookings(providerId: string): Promise<void> {
  await db
    .update(providersTable)
    .set({
      completedBookings: sql`${providersTable.completedBookings} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(providersTable.id, providerId));
}

// Update provider rating after new review
export async function updateProviderRating(
  providerId: string,
  newRating: number
): Promise<void> {
  // Get current stats
  const [provider] = await db
    .select({
      totalReviews: providersTable.totalReviews,
      averageRating: providersTable.averageRating,
    })
    .from(providersTable)
    .where(eq(providersTable.id, providerId));
  
  if (!provider) return;
  
  // Calculate new average
  const currentTotal = parseFloat(provider.averageRating?.toString() || "0") * provider.totalReviews;
  const newTotal = currentTotal + newRating;
  const newReviewCount = provider.totalReviews + 1;
  const newAverage = newTotal / newReviewCount;
  
  // Update provider
  await db
    .update(providersTable)
    .set({
      averageRating: newAverage.toFixed(1),
      totalReviews: newReviewCount,
      updatedAt: new Date(),
    })
    .where(eq(providersTable.id, providerId));
}