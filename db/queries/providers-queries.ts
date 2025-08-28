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
import { eq, and, or, like, ilike, sql, inArray } from "drizzle-orm";
import { getProviderReviewsWithCustomerInfo } from "./reviews-queries";

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

// Get provider by slug with reviews
export async function getProviderBySlugWithReviews(slug: string): Promise<(Provider & { reviews: any[] }) | null> {
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.slug, slug));
  
  if (!provider) {
    return null;
  }

  // Fetch reviews with customer information
  const reviews = await getProviderReviewsWithCustomerInfo(provider.id, {
    limit: 50, // Fetch up to 50 most recent reviews
  });

  return {
    ...provider,
    reviews: reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      reviewText: review.reviewText,
      createdAt: review.createdAt.toISOString(),
      customerName: review.customerName,
      customerAvatar: review.customerAvatar,
      providerResponse: review.providerResponse,
      providerRespondedAt: review.providerRespondedAt,
      isVerifiedBooking: review.isVerifiedBooking,
    })),
  };
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
    zipCode?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    services?: string[];
    verifiedOnly?: boolean;
    hasInsurance?: boolean;
    instantBooking?: boolean;
    availability?: {
      days?: string[];
      timeOfDay?: string[];
    };
    sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'reviews' | 'distance' | 'newest';
    limit?: number;
    offset?: number;
  }
): Promise<{ providers: Provider[]; total: number }> {
  const conditions = [eq(providersTable.isActive, true)];
  
  // Text search across multiple fields
  if (filters?.query) {
    conditions.push(
      or(
        ilike(providersTable.displayName, `%${filters.query}%`),
        ilike(providersTable.tagline, `%${filters.query}%`),
        ilike(providersTable.bio, `%${filters.query}%`),
        sql`${providersTable.services}::text ILIKE ${'%' + filters.query + '%'}`
      )!
    );
  }
  
  // Location filters
  if (filters?.city) {
    conditions.push(ilike(providersTable.locationCity, `%${filters.city}%`));
  }
  
  if (filters?.state) {
    conditions.push(eq(providersTable.locationState, filters.state));
  }
  
  if (filters?.zipCode) {
    // Add zip code proximity search later with PostGIS
    conditions.push(eq(providersTable.locationZipCode, filters.zipCode));
  }
  
  // Price range filters
  if (filters?.minPrice !== undefined) {
    conditions.push(sql`CAST(${providersTable.hourlyRate} AS DECIMAL) >= CAST(${filters.minPrice} AS DECIMAL)`);
  }
  
  if (filters?.maxPrice !== undefined) {
    conditions.push(sql`CAST(${providersTable.hourlyRate} AS DECIMAL) <= CAST(${filters.maxPrice} AS DECIMAL)`);
  }
  
  // Rating filter
  if (filters?.minRating !== undefined && filters.minRating > 0) {
    conditions.push(sql`CAST(${providersTable.averageRating} AS DECIMAL) >= CAST(${filters.minRating} AS DECIMAL)`);
  }
  
  // Service filters - check if provider offers any of the selected services
  if (filters?.services && filters.services.length > 0) {
    const serviceConditions = filters.services.map(service => 
      sql`${providersTable.services}::text ILIKE ${'%' + service + '%'}`
    );
    conditions.push(or(...serviceConditions)!);
  }
  
  // Boolean filters
  if (filters?.verifiedOnly) {
    conditions.push(eq(providersTable.isVerified, true));
  }
  
  if (filters?.hasInsurance) {
    conditions.push(eq(providersTable.hasInsurance, true));
  }
  
  if (filters?.instantBooking) {
    conditions.push(eq(providersTable.instantBooking, true));
  }
  
  // Availability filters - filter by providers who have availability on specific days
  let providerIdsWithAvailability: string[] | null = null;
  
  if (filters?.availability?.days && filters.availability.days.length > 0) {
    const dayNumbers: number[] = [];
    
    filters.availability.days.forEach(day => {
      if (day === 'Weekdays') {
        dayNumbers.push(1, 2, 3, 4, 5); // Monday to Friday
      } else if (day === 'Weekends') {
        dayNumbers.push(0, 6); // Sunday and Saturday
      } else {
        // Map day names to numbers
        const dayMap: Record<string, number> = {
          'Sunday': 0,
          'Monday': 1,
          'Tuesday': 2,
          'Wednesday': 3,
          'Thursday': 4,
          'Friday': 5,
          'Saturday': 6,
        };
        if (dayMap[day] !== undefined) {
          dayNumbers.push(dayMap[day]);
        }
      }
    });
    
    if (dayNumbers.length > 0) {
      const availableProviders = await db
        .selectDistinct({
          providerId: providerAvailabilityTable.providerId,
        })
        .from(providerAvailabilityTable)
        .where(
          and(
            inArray(providerAvailabilityTable.dayOfWeek, dayNumbers),
            eq(providerAvailabilityTable.isActive, true)
          )
        );
      
      providerIdsWithAvailability = availableProviders.map(p => p.providerId);
      
      // If time of day filter is also specified, further filter
      if (filters.availability.timeOfDay && filters.availability.timeOfDay.length > 0) {
        const timeConditions: any[] = [];
        
        filters.availability.timeOfDay.forEach(timeSlot => {
          if (timeSlot === 'Morning') {
            timeConditions.push(sql`${providerAvailabilityTable.startTime} <= '12:00'`);
          } else if (timeSlot === 'Afternoon') {
            timeConditions.push(
              and(
                sql`${providerAvailabilityTable.startTime} <= '17:00'`,
                sql`${providerAvailabilityTable.endTime} >= '12:00'`
              )
            );
          } else if (timeSlot === 'Evening') {
            timeConditions.push(
              and(
                sql`${providerAvailabilityTable.startTime} <= '21:00'`,
                sql`${providerAvailabilityTable.endTime} >= '17:00'`
              )
            );
          } else if (timeSlot === 'Night') {
            timeConditions.push(sql`${providerAvailabilityTable.endTime} >= '21:00'`);
          }
        });
        
        if (timeConditions.length > 0) {
          const timeFilteredProviders = await db
            .selectDistinct({
              providerId: providerAvailabilityTable.providerId,
            })
            .from(providerAvailabilityTable)
            .where(
              and(
                inArray(providerAvailabilityTable.dayOfWeek, dayNumbers),
                eq(providerAvailabilityTable.isActive, true),
                or(...timeConditions)!
              )
            );
          
          providerIdsWithAvailability = timeFilteredProviders.map(p => p.providerId);
        }
      }
    }
  }
  
  // Apply availability filter if we have provider IDs
  if (providerIdsWithAvailability !== null) {
    if (providerIdsWithAvailability.length === 0) {
      // No providers match the availability criteria
      return { providers: [], total: 0 };
    }
    conditions.push(inArray(providersTable.id, providerIdsWithAvailability));
  }
  
  // Determine sort order
  let orderByClause;
  switch (filters?.sortBy) {
    case 'price_low':
      orderByClause = sql`CAST(${providersTable.hourlyRate} AS DECIMAL) ASC NULLS LAST`;
      break;
    case 'price_high':
      orderByClause = sql`CAST(${providersTable.hourlyRate} AS DECIMAL) DESC NULLS LAST`;
      break;
    case 'rating':
      orderByClause = sql`CAST(${providersTable.averageRating} AS DECIMAL) DESC NULLS LAST`;
      break;
    case 'reviews':
      orderByClause = sql`${providersTable.totalReviews} DESC`;
      break;
    case 'newest':
      orderByClause = sql`${providersTable.createdAt} DESC`;
      break;
    case 'relevance':
    default:
      // For relevance, prioritize verified providers with high ratings and reviews
      orderByClause = sql`
        CASE 
          WHEN ${providersTable.isVerified} = true THEN 1 
          ELSE 0 
        END DESC,
        CAST(${providersTable.averageRating} AS DECIMAL) DESC NULLS LAST,
        ${providersTable.totalReviews} DESC
      `;
      break;
  }
  
  const [providersResult, countResult] = await Promise.all([
    db
      .select()
      .from(providersTable)
      .where(and(...conditions))
      .limit(filters?.limit || 20)
      .offset(filters?.offset || 0)
      .orderBy(orderByClause),
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
  availability: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>
): Promise<ProviderAvailability[]> {
  // Delete existing availability
  await db
    .delete(providerAvailabilityTable)
    .where(eq(providerAvailabilityTable.providerId, providerId));
  
  // Insert new availability with providerId and isActive
  if (availability.length > 0) {
    const availabilityData: NewProviderAvailability[] = availability.map(slot => ({
      providerId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: true,
    }));
    
    return await db
      .insert(providerAvailabilityTable)
      .values(availabilityData)
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

// Get available services with provider counts
export async function getAvailableServices(): Promise<
  Array<{ name: string; count: number }>
> {
  const providers = await db
    .select({
      services: providersTable.services,
    })
    .from(providersTable)
    .where(eq(providersTable.isActive, true));

  // Extract and count unique services
  const serviceCounts = new Map<string, number>();
  
  providers.forEach(provider => {
    if (provider.services && Array.isArray(provider.services)) {
      provider.services.forEach((service: any) => {
        if (service.name) {
          const currentCount = serviceCounts.get(service.name) || 0;
          serviceCounts.set(service.name, currentCount + 1);
        }
      });
    }
  });

  // Convert to array and sort by count
  return Array.from(serviceCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Get location suggestions for autocomplete
export async function getLocationSuggestions(
  type: 'city' | 'state'
): Promise<string[]> {
  if (type === 'city') {
    const results = await db
      .selectDistinct({
        city: providersTable.locationCity,
      })
      .from(providersTable)
      .where(
        and(
          eq(providersTable.isActive, true),
          sql`${providersTable.locationCity} IS NOT NULL`
        )
      )
      .orderBy(providersTable.locationCity);
    
    return results
      .map(r => r.city)
      .filter((city): city is string => city !== null);
  } else {
    const results = await db
      .selectDistinct({
        state: providersTable.locationState,
      })
      .from(providersTable)
      .where(
        and(
          eq(providersTable.isActive, true),
          sql`${providersTable.locationState} IS NOT NULL`
        )
      )
      .orderBy(providersTable.locationState);
    
    return results
      .map(r => r.state)
      .filter((state): state is string => state !== null);
  }
}

// Get price range statistics
export async function getPriceRangeStats(): Promise<{
  min: number;
  max: number;
  avg: number;
}> {
  const [stats] = await db
    .select({
      min: sql<number>`MIN(CAST(${providersTable.hourlyRate} AS DECIMAL))`,
      max: sql<number>`MAX(CAST(${providersTable.hourlyRate} AS DECIMAL))`,
      avg: sql<number>`AVG(CAST(${providersTable.hourlyRate} AS DECIMAL))`,
    })
    .from(providersTable)
    .where(
      and(
        eq(providersTable.isActive, true),
        sql`${providersTable.hourlyRate} IS NOT NULL`
      )
    );

  return {
    min: stats?.min || 0,
    max: stats?.max || 500,
    avg: stats?.avg || 0,
  };
}