import { db } from "@/db/db";
import { 
  providersTable,
  providerAvailabilityTable,
  type Provider,
} from "@/db/schema/providers-schema";
import { servicesTable } from "@/db/schema/enhanced-booking-schema";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, or, ilike, sql, desc, asc } from "drizzle-orm";

/**
 * Get provider with all related data (services, recent reviews, availability)
 * This prevents N+1 queries by eagerly loading all related data
 */
export async function getProviderWithRelations(providerId: string) {
  // Use a single transaction for consistency
  return await db.transaction(async (tx) => {
    // Get provider
    const [provider] = await tx
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId));
    
    if (!provider) {
      return null;
    }
    
    // Get services (batch query)
    const services = await tx
      .select({
        id: servicesTable.id,
        name: servicesTable.name,
        description: servicesTable.description,
        category: servicesTable.category,
        basePrice: servicesTable.basePrice,
        priceType: servicesTable.priceType,
        minimumDuration: servicesTable.minimumDuration,
        isActive: servicesTable.isActive,
      })
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.providerId, providerId),
          eq(servicesTable.isActive, true)
        )
      );
    
    // Get recent reviews (batch query)
    const recentReviews = await tx
      .select({
        id: reviewsTable.id,
        rating: reviewsTable.rating,
        reviewText: reviewsTable.reviewText,
        customerName: sql<string>`(SELECT email FROM profiles WHERE user_id = ${reviewsTable.customerId})`,
        createdAt: reviewsTable.createdAt,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.providerId, providerId),
          eq(reviewsTable.isPublished, true)
        )
      )
      .orderBy(desc(reviewsTable.createdAt))
      .limit(5);
    
    // Get availability schedule (batch query)
    const availability = await tx
      .select()
      .from(providerAvailabilityTable)
      .where(
        and(
          eq(providerAvailabilityTable.providerId, providerId),
          eq(providerAvailabilityTable.isActive, true)
        )
      )
      .orderBy(asc(providerAvailabilityTable.dayOfWeek));
    
    // Get booking stats (single aggregated query)
    const [stats] = await tx
      .select({
        totalBookings: sql<number>`count(*)::int`,
        completedBookings: sql<number>`count(*) filter (where status = 'completed')::int`,
        upcomingBookings: sql<number>`count(*) filter (where status = 'confirmed' and booking_date >= current_date)::int`,
        revenue: sql<number>`sum(CAST(provider_payout AS numeric)) filter (where status = 'completed')`,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.providerId, providerId));
    
    return {
      ...provider,
      services,
      recentReviews,
      availability,
      stats,
    };
  });
}

/**
 * Get multiple providers with their services in a single query
 * Prevents N+1 queries when listing providers
 */
export async function getProvidersWithServices(
  providerIds: string[]
): Promise<Map<string, any[]>> {
  if (providerIds.length === 0) {
    return new Map();
  }
  
  // Get all services for all providers in one query
  const services = await db
    .select({
      providerId: servicesTable.providerId,
      id: servicesTable.id,
      name: servicesTable.name,
      category: servicesTable.category,
      basePrice: servicesTable.basePrice,
      minimumDuration: servicesTable.minimumDuration,
    })
    .from(servicesTable)
    .where(
      and(
        sql`${servicesTable.providerId} = ANY(${providerIds})`,
        eq(servicesTable.isActive, true)
      )
    );
  
  // Group services by provider
  const servicesByProvider = new Map<string, any[]>();
  
  services.forEach(service => {
    if (!servicesByProvider.has(service.providerId)) {
      servicesByProvider.set(service.providerId, []);
    }
    servicesByProvider.get(service.providerId)!.push(service);
  });
  
  return servicesByProvider;
}

/**
 * Get providers with all related data for search results
 * Optimized to prevent N+1 queries
 */
export async function searchProvidersOptimized(
  filters?: {
    query?: string;
    city?: string;
    state?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }
) {
  // Build search conditions
  const conditions = [eq(providersTable.isActive, true)];
  
  if (filters?.query) {
    conditions.push(
      or(
        ilike(providersTable.displayName, `%${filters.query}%`),
        ilike(providersTable.tagline, `%${filters.query}%`),
        ilike(providersTable.bio, `%${filters.query}%`)
      )!
    );
  }
  
  if (filters?.city) {
    conditions.push(ilike(providersTable.locationCity, `%${filters.city}%`));
  }
  
  if (filters?.state) {
    conditions.push(eq(providersTable.locationState, filters.state));
  }
  
  // Get providers
  const providers = await db
    .select()
    .from(providersTable)
    .where(and(...conditions))
    .limit(filters?.limit || 20)
    .offset(filters?.offset || 0)
    .orderBy(desc(providersTable.averageRating));
  
  if (providers.length === 0) {
    return { providers: [], services: new Map() };
  }
  
  // Get all services for these providers in one query
  const providerIds = providers.map(p => p.id);
  const servicesByProvider = await getProvidersWithServices(providerIds);
  
  // If category filter is specified, filter providers by their services
  let filteredProviders = providers;
  if (filters?.category) {
    filteredProviders = providers.filter(provider => {
      const services = servicesByProvider.get(provider.id) || [];
      return services.some(service => service.category === filters.category);
    });
  }
  
  return {
    providers: filteredProviders,
    services: servicesByProvider,
  };
}

/**
 * Batch update provider statistics
 * More efficient than individual updates
 */
export async function batchUpdateProviderStats(
  updates: Array<{
    providerId: string;
    completedBookings?: number;
    averageRating?: number;
    totalReviews?: number;
  }>
) {
  if (updates.length === 0) {
    return;
  }
  
  // Use a transaction for consistency
  await db.transaction(async (tx) => {
    for (const update of updates) {
      const setClause: any = { updatedAt: new Date() };
      
      if (update.completedBookings !== undefined) {
        setClause.completedBookings = update.completedBookings;
      }
      
      if (update.averageRating !== undefined) {
        setClause.averageRating = update.averageRating.toString();
      }
      
      if (update.totalReviews !== undefined) {
        setClause.totalReviews = update.totalReviews;
      }
      
      await tx
        .update(providersTable)
        .set(setClause)
        .where(eq(providersTable.id, update.providerId));
    }
  });
}

/**
 * Get provider dashboard data with all metrics in optimized queries
 */
export async function getProviderDashboardData(providerId: string) {
  const [
    provider,
    bookingMetrics,
    reviewMetrics,
    upcomingBookings,
    recentActivity
  ] = await Promise.all([
    // Provider info
    db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .then(r => r[0]),
    
    // Booking metrics (single aggregated query)
    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where status = 'completed')::int`,
        cancelled: sql<number>`count(*) filter (where status = 'cancelled')::int`,
        revenue: sql<number>`coalesce(sum(CAST(provider_payout AS numeric)) filter (where status = 'completed'), 0)`,
        avgBookingValue: sql<number>`coalesce(avg(CAST(provider_payout AS numeric)) filter (where status = 'completed'), 0)`,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.providerId, providerId))
      .then(r => r[0]),
    
    // Review metrics (single aggregated query)
    db
      .select({
        total: sql<number>`count(*)::int`,
        avgRating: sql<number>`coalesce(avg(rating), 0)`,
        fiveStarCount: sql<number>`count(*) filter (where rating = 5)::int`,
        wouldRecommend: sql<number>`count(*) filter (where would_recommend = true)::int`,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.providerId, providerId),
          eq(reviewsTable.isPublished, true)
        )
      )
      .then(r => r[0]),
    
    // Upcoming bookings
    db
      .select({
        id: bookingsTable.id,
        customerName: sql<string>`(SELECT display_name FROM profiles WHERE user_id = ${bookingsTable.customerId})`,
        serviceName: bookingsTable.serviceName,
        bookingDate: bookingsTable.bookingDate,
        startTime: bookingsTable.startTime,
        totalAmount: bookingsTable.totalAmount,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, 'confirmed'),
          sql`${bookingsTable.bookingDate} >= current_date`
        )
      )
      .orderBy(asc(bookingsTable.bookingDate), asc(bookingsTable.startTime))
      .limit(10),
    
    // Recent activity (bookings and reviews combined)
    db.execute(sql`
      SELECT * FROM (
        SELECT 
          'booking' as type,
          id,
          created_at,
          status as detail,
          service_name as title,
          total_amount::numeric as amount
        FROM bookings
        WHERE provider_id = ${providerId}
        AND created_at >= current_date - interval '7 days'
        
        UNION ALL
        
        SELECT 
          'review' as type,
          id,
          created_at,
          rating::text as detail,
          comment as title,
          NULL as amount
        FROM reviews
        WHERE provider_id = ${providerId}
        AND created_at >= current_date - interval '7 days'
      ) as activity
      ORDER BY created_at DESC
      LIMIT 20
    `)
  ]);
  
  return {
    provider,
    metrics: {
      bookings: bookingMetrics,
      reviews: reviewMetrics,
    },
    upcomingBookings,
    recentActivity,
  };
}