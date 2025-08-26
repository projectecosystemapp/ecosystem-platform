/**
 * Search Module
 * Centralized exports for search and ranking functionality
 * Per Master PRD §4.4
 */

export {
  rankingEngine,
  RANKING_WEIGHTS,
  type ProviderRankingData,
  type SearchQuery,
  type RankingResult
} from './ranking-engine';

export {
  searchCache,
  type CachedSearchResult,
  type CacheStats,
  type SearchCacheConfig
} from './search-cache';

import { rankingEngine, type ProviderRankingData, type SearchQuery } from './ranking-engine';
import { searchCache } from './search-cache';
import { db } from '@/db/db';
import { providersTable, bookingsTable, reviewsTable } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * Main search function that combines caching and ranking
 */
export async function searchProviders(
  query: SearchQuery,
  options: {
    limit?: number;
    offset?: number;
    useCache?: boolean;
    includeStats?: boolean;
  } = {}
): Promise<{
  providers: ProviderRankingData[];
  total: number;
  cached: boolean;
}> {
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  
  // Create cache-friendly query object
  const cacheQuery = {
    ...query,
    limit,
    offset
  };

  // Check cache if enabled
  if (options.useCache !== false) {
    const cached = await searchCache.get(cacheQuery);
    
    if (cached) {
      return {
        providers: cached.results.slice(offset, offset + limit),
        total: cached.totalCount,
        cached: true
      };
    }
  }

  // Fetch providers from database with stats
  const providers = await fetchProvidersWithStats(query, options.includeStats);
  
  // Convert to ranking data format
  const rankingData: ProviderRankingData[] = await Promise.all(
    providers.map(async (provider) => {
      // Calculate stats if needed
      const stats = await calculateProviderStats(provider.id);
      
      return {
        id: provider.id,
        name: provider.displayName,
        slug: provider.slug,
        categories: provider.categories || [],
        services: provider.services || [],
        location: provider.latitude && provider.longitude ? {
          latitude: parseFloat(provider.latitude),
          longitude: parseFloat(provider.longitude)
        } : undefined,
        stats: {
          averageRating: parseFloat(provider.averageRating || '0'),
          totalReviews: provider.totalReviews || 0,
          completedBookings: stats.completedBookings,
          totalViews: stats.totalViews,
          conversionRate: stats.conversionRate,
          lastAvailabilityUpdate: provider.updatedAt,
          recentReviewCount: stats.recentReviewCount
        },
        isVerified: provider.isVerified,
        isActive: provider.isActive,
        createdAt: provider.createdAt
      };
    })
  );

  // Rank providers
  const rankedResults = rankingEngine.rank(rankingData, query, {
    boostVerified: true,
    includeDebugInfo: false
  });

  // Extract ranked provider data
  const rankedProviders = rankedResults.map(result => {
    const provider = rankingData.find(p => p.id === result.providerId);
    return provider!;
  });

  // Cache results if enabled
  if (options.useCache !== false) {
    await searchCache.set(
      cacheQuery,
      rankedProviders,
      rankedProviders.length,
      { preventStampede: true }
    );
  }

  // Apply pagination
  const paginatedProviders = rankedProviders.slice(offset, offset + limit);

  return {
    providers: paginatedProviders,
    total: rankedProviders.length,
    cached: false
  };
}

/**
 * Fetch providers from database
 */
async function fetchProvidersWithStats(
  query: SearchQuery,
  includeStats?: boolean
) {
  const conditions = [];

  // Add basic conditions
  conditions.push(eq(providersTable.isActive, true));

  // Category filter
  if (query.categories && query.categories.length > 0) {
    conditions.push(
      sql`${providersTable.categories} && ARRAY[${sql.raw(
        query.categories.map(c => `'${c}'`).join(',')
      )}]`
    );
  }

  // Price range filter
  if (query.priceRange) {
    conditions.push(
      and(
        gte(providersTable.hourlyRate, query.priceRange.min.toString()),
        sql`${providersTable.hourlyRate} <= ${query.priceRange.max}`
      )
    );
  }

  // Minimum rating filter
  if (query.minRating) {
    conditions.push(
      gte(providersTable.averageRating, query.minRating.toString())
    );
  }

  return await db
    .select()
    .from(providersTable)
    .where(and(...conditions));
}

/**
 * Calculate provider statistics for ranking
 */
async function calculateProviderStats(providerId: string): Promise<{
  completedBookings: number;
  totalViews: number;
  conversionRate: number;
  recentReviewCount: number;
}> {
  // Get completed bookings count
  const [bookingStats] = await db
    .select({
      completed: sql<number>`COUNT(CASE WHEN status = 'completed' THEN 1 END)`,
      total: sql<number>`COUNT(*)`
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.providerId, providerId));

  // Get recent review count (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [reviewStats] = await db
    .select({
      recent: sql<number>`COUNT(*)`
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.providerId, providerId),
        gte(reviewsTable.createdAt, thirtyDaysAgo)
      )
    );

  // Calculate conversion rate
  // For now, using a simple booking/total ratio
  // In production, this would track actual views
  const totalViews = bookingStats?.total || 0;
  const completedBookings = bookingStats?.completed || 0;
  const conversionRate = totalViews > 0 ? completedBookings / totalViews : 0;

  return {
    completedBookings,
    totalViews: totalViews * 10, // Estimate views as 10x bookings
    conversionRate,
    recentReviewCount: reviewStats?.recent || 0
  };
}

/**
 * Invalidate search cache when provider data changes
 */
export async function invalidateProviderSearchCache(providerId: string): Promise<void> {
  await searchCache.invalidate({ providerId });
}

/**
 * Warm cache with common searches
 */
export async function warmSearchCache(): Promise<void> {
  const commonQueries: SearchQuery[] = [
    {}, // All providers
    { categories: ['personal-training'] },
    { categories: ['massage-therapy'] },
    { categories: ['home-cleaning'] },
    { minRating: 4 },
    { priceRange: { min: 0, max: 100 } }
  ];

  await searchCache.warmCache(commonQueries, async (query) => {
    const result = await searchProviders(query, { useCache: false });
    return {
      results: result.providers,
      total: result.total
    };
  });
}