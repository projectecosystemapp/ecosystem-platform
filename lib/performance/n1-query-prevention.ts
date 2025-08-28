/**
 * N+1 Query Prevention Utilities
 * Provides patterns and utilities to prevent N+1 query problems
 */

import { db } from "@/db/db";
import { sql, eq, inArray, and, or } from "drizzle-orm";
import { 
  providersTable, 
  bookingsTable, 
  reviewsTable, 
  servicesTable,
  paymentsTable,
  notificationsTable,
  profilesTable,
  messagesTable,
} from "@/db/schema";

// ===============================
// BATCH LOADING UTILITIES
// ===============================

/**
 * Generic batch loader to prevent N+1 queries
 */
export class BatchLoader<K, V> {
  private batchLoadFn: (keys: K[]) => Promise<V[]>;
  private cache = new Map<string, V>();
  private batch: { keys: K[]; resolve: (values: (V | Error)[]) => void }[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(
    batchLoadFn: (keys: K[]) => Promise<V[]>,
    private keyFn: (key: K) => string = (key) => String(key),
    private maxBatchSize = 100,
    private batchTimeoutMs = 10
  ) {
    this.batchLoadFn = batchLoadFn;
  }

  async load(key: K): Promise<V> {
    const keyStr = this.keyFn(key);
    
    // Return from cache if available
    if (this.cache.has(keyStr)) {
      return this.cache.get(keyStr)!;
    }

    return new Promise<V>((resolve, reject) => {
      // Add to current batch
      if (this.batch.length === 0) {
        this.batch.push({ keys: [key], resolve: (values) => {
          const value = values[0];
          if (value instanceof Error) {
            reject(value);
          } else {
            resolve(value);
          }
        }});
      } else {
        const currentBatch = this.batch[this.batch.length - 1];
        currentBatch.keys.push(key);
      }

      // Schedule batch execution
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeBatch();
        }, this.batchTimeoutMs);
      }
    });
  }

  private async executeBatch(): Promise<void> {
    if (this.batch.length === 0) return;

    const currentBatch = this.batch;
    this.batch = [];
    this.batchTimeout = null;

    try {
      // Collect all keys
      const allKeys = currentBatch.flatMap(b => b.keys);
      const uniqueKeys = Array.from(new Set(allKeys.map(this.keyFn))).map(keyStr => 
        allKeys.find(k => this.keyFn(k) === keyStr)!
      );

      // Execute batch load
      const values = await this.batchLoadFn(uniqueKeys);

      // Cache results
      values.forEach((value, index) => {
        const key = uniqueKeys[index];
        const keyStr = this.keyFn(key);
        this.cache.set(keyStr, value);
      });

      // Resolve all promises
      let currentIndex = 0;
      for (const batch of currentBatch) {
        const batchValues = batch.keys.map(key => {
          const keyStr = this.keyFn(key);
          return this.cache.get(keyStr) || new Error(`No value found for key: ${keyStr}`);
        });
        batch.resolve(batchValues);
        currentIndex += batch.keys.length;
      }
    } catch (error) {
      // Reject all promises in case of error
      currentBatch.forEach(batch => {
        batch.resolve(batch.keys.map(() => error as Error));
      });
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ===============================
// SPECIFIC BATCH LOADERS
// ===============================

/**
 * Batch loader for provider profiles
 */
export const providerBatchLoader = new BatchLoader<string, any>(
  async (providerIds: string[]) => {
    const providers = await db
      .select({
        id: providersTable.id,
        displayName: providersTable.displayName,
        profileImage: providersTable.profileImage,
        averageRating: providersTable.averageRating,
        totalReviews: providersTable.totalReviews,
        isVerified: providersTable.isVerified,
        locationCity: providersTable.locationCity,
        locationState: providersTable.locationState,
      })
      .from(providersTable)
      .where(inArray(providersTable.id, providerIds));

    // Maintain order
    const providerMap = new Map(providers.map(p => [p.id, p]));
    return providerIds.map(id => providerMap.get(id) || null);
  }
);

/**
 * Batch loader for user profiles
 */
export const userProfileBatchLoader = new BatchLoader<string, any>(
  async (userIds: string[]) => {
    const profiles = await db
      .select({
        userId: profilesTable.userId,
        firstName: profilesTable.firstName,
        lastName: profilesTable.lastName,
        profileImageUrl: profilesTable.profileImageUrl,
        email: profilesTable.email,
      })
      .from(profilesTable)
      .where(inArray(profilesTable.userId, userIds));

    const profileMap = new Map(profiles.map(p => [p.userId, p]));
    return userIds.map(id => profileMap.get(id) || null);
  }
);

/**
 * Batch loader for provider services
 */
export const providerServicesBatchLoader = new BatchLoader<string, any[]>(
  async (providerIds: string[]) => {
    const services = await db
      .select({
        providerId: servicesTable.providerId,
        id: servicesTable.id,
        name: servicesTable.name,
        description: servicesTable.description,
        basePrice: servicesTable.basePrice,
        category: servicesTable.category,
      })
      .from(servicesTable)
      .where(
        and(
          inArray(servicesTable.providerId, providerIds),
          eq(servicesTable.isActive, true)
        )
      );

    // Group by provider
    const servicesByProvider = new Map<string, any[]>();
    services.forEach(service => {
      if (!servicesByProvider.has(service.providerId)) {
        servicesByProvider.set(service.providerId, []);
      }
      servicesByProvider.get(service.providerId)!.push(service);
    });

    return providerIds.map(id => servicesByProvider.get(id) || []);
  }
);

/**
 * Batch loader for provider reviews
 */
export const providerReviewsBatchLoader = new BatchLoader<string, any[]>(
  async (providerIds: string[]) => {
    const reviews = await db
      .select({
        providerId: reviewsTable.providerId,
        id: reviewsTable.id,
        rating: reviewsTable.rating,
        reviewText: reviewsTable.reviewText,
        createdAt: reviewsTable.createdAt,
        customerId: reviewsTable.customerId,
      })
      .from(reviewsTable)
      .where(
        and(
          inArray(reviewsTable.providerId, providerIds),
          eq(reviewsTable.isPublished, true)
        )
      )
      .orderBy(sql`created_at DESC`);

    // Group by provider
    const reviewsByProvider = new Map<string, any[]>();
    reviews.forEach(review => {
      if (!reviewsByProvider.has(review.providerId)) {
        reviewsByProvider.set(review.providerId, []);
      }
      reviewsByProvider.get(review.providerId)!.push(review);
    });

    return providerIds.map(id => reviewsByProvider.get(id) || []);
  }
);

// ===============================
// OPTIMIZED QUERY PATTERNS
// ===============================

/**
 * Fetch bookings with related provider and customer data
 * Prevents N+1 queries by using JOINs
 */
export async function getBookingsWithRelations(
  filters: {
    userId?: string;
    providerId?: string;
    status?: string[];
    limit?: number;
    offset?: number;
  } = {}
) {
  let query = db
    .select({
      // Booking data
      id: bookingsTable.id,
      providerId: bookingsTable.providerId,
      customerId: bookingsTable.customerId,
      serviceName: bookingsTable.serviceName,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      endTime: bookingsTable.endTime,
      status: bookingsTable.status,
      totalAmount: bookingsTable.totalAmount,
      createdAt: bookingsTable.createdAt,
      
      // Provider data
      providerName: providersTable.displayName,
      providerImage: providersTable.profileImage,
      providerCity: providersTable.locationCity,
      providerVerified: providersTable.isVerified,
      
      // Customer data
      customerName: profilesTable.firstName,
      customerImage: profilesTable.profileImageUrl,
      customerEmail: profilesTable.email,
    })
    .from(bookingsTable)
    .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
    .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId));

  // Apply filters
  const conditions: any[] = [];
  
  if (filters.userId) {
    conditions.push(
      or(
        eq(bookingsTable.customerId, filters.userId),
        eq(bookingsTable.providerId, filters.userId)
      )
    );
  }
  
  if (filters.providerId) {
    conditions.push(eq(bookingsTable.providerId, filters.providerId));
  }
  
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(bookingsTable.status, filters.status));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  return query
    .orderBy(sql`${bookingsTable.createdAt} DESC`)
    .limit(filters.limit || 20)
    .offset(filters.offset || 0);
}

/**
 * Fetch messages with sender/recipient data
 * Single query with JOINs instead of N+1
 */
export async function getConversationMessagesWithProfiles(
  conversationId: string,
  limit = 50,
  offset = 0
) {
  return await db
    .select({
      // Message data
      id: messagesTable.id,
      content: messagesTable.content,
      senderId: messagesTable.senderId,
      recipientId: messagesTable.recipientId,
      createdAt: messagesTable.createdAt,
      isRead: messagesTable.isRead,
      messageType: messagesTable.messageType,
      
      // Sender data
      senderName: sql<string>`sender.first_name`,
      senderImage: sql<string>`sender.profile_image_url`,
      
      // Recipient data
      recipientName: sql<string>`recipient.first_name`,
      recipientImage: sql<string>`recipient.profile_image_url`,
    })
    .from(messagesTable)
    .leftJoin(
      sql`profiles as sender`,
      eq(messagesTable.senderId, sql`sender.user_id`)
    )
    .leftJoin(
      sql`profiles as recipient`,
      eq(messagesTable.recipientId, sql`recipient.user_id`)
    )
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(sql`${messagesTable.createdAt} ASC`)
    .limit(limit)
    .offset(offset);
}

/**
 * Fetch providers with aggregate stats
 * Single query with subqueries instead of N+1
 */
export async function getProvidersWithStats(
  filters: {
    city?: string;
    state?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const conditions: any[] = [eq(providersTable.isActive, true)];
  
  if (filters.city) {
    conditions.push(eq(providersTable.locationCity, filters.city));
  }
  
  if (filters.state) {
    conditions.push(eq(providersTable.locationState, filters.state));
  }

  return await db
    .select({
      // Provider data
      id: providersTable.id,
      displayName: providersTable.displayName,
      tagline: providersTable.tagline,
      profileImage: providersTable.profileImage,
      locationCity: providersTable.locationCity,
      locationState: providersTable.locationState,
      averageRating: providersTable.averageRating,
      totalReviews: providersTable.totalReviews,
      isVerified: providersTable.isVerified,
      
      // Aggregated stats (calculated in query)
      totalBookings: sql<number>`(
        SELECT COUNT(*)::int 
        FROM bookings b 
        WHERE b.provider_id = providers.id
      )`,
      
      completedBookings: sql<number>`(
        SELECT COUNT(*)::int 
        FROM bookings b 
        WHERE b.provider_id = providers.id AND b.status = 'completed'
      )`,
      
      totalRevenue: sql<number>`(
        SELECT COALESCE(SUM(CAST(provider_payout AS numeric)), 0)
        FROM bookings b 
        WHERE b.provider_id = providers.id AND b.status = 'completed'
      )`,
      
      activeServices: sql<number>`(
        SELECT COUNT(*)::int 
        FROM services s 
        WHERE s.provider_id = providers.id AND s.is_active = true
      )`,
      
      responseRate: sql<number>`(
        SELECT COALESCE(AVG(
          CASE WHEN responded_at IS NOT NULL THEN 100 ELSE 0 END
        ), 0)
        FROM messages m 
        WHERE m.recipient_id = providers.user_id
        AND m.created_at >= NOW() - INTERVAL '30 days'
      )`,
    })
    .from(providersTable)
    .where(and(...conditions))
    .orderBy(sql`${providersTable.averageRating} DESC, ${providersTable.totalReviews} DESC`)
    .limit(filters.limit || 20)
    .offset(filters.offset || 0);
}

// ===============================
// DATA PRELOADING UTILITIES
// ===============================

/**
 * Preload related data for a set of entities
 */
export class DataPreloader {
  private static cache = new Map<string, any>();

  /**
   * Preload provider data for bookings
   */
  static async preloadProviderData(bookings: any[]): Promise<Map<string, any>> {
    const providerIds = [...new Set(bookings.map(b => b.providerId))];
    const providers = await db
      .select()
      .from(providersTable)
      .where(inArray(providersTable.id, providerIds));

    const providerMap = new Map(providers.map(p => [p.id, p]));
    
    // Cache results
    providers.forEach(provider => {
      this.cache.set(`provider:${provider.id}`, provider);
    });

    return providerMap;
  }

  /**
   * Preload user profiles for messages
   */
  static async preloadUserProfiles(messages: any[]): Promise<Map<string, any>> {
    const userIds = [...new Set([
      ...messages.map(m => m.senderId),
      ...messages.map(m => m.recipientId)
    ])];

    const profiles = await db
      .select()
      .from(profilesTable)
      .where(inArray(profilesTable.userId, userIds));

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    // Cache results
    profiles.forEach(profile => {
      this.cache.set(`profile:${profile.userId}`, profile);
    });

    return profileMap;
  }

  /**
   * Get cached data
   */
  static getCached(key: string): any {
    return this.cache.get(key);
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}

// ===============================
// QUERY ANALYZERS
// ===============================

/**
 * Analyze queries for N+1 patterns
 */
export class QueryAnalyzer {
  private static queryLog: Array<{
    query: string;
    timestamp: number;
    executionTime: number;
  }> = [];

  static logQuery(query: string, executionTime: number): void {
    this.queryLog.push({
      query,
      timestamp: Date.now(),
      executionTime
    });

    // Keep only last 1000 queries
    if (this.queryLog.length > 1000) {
      this.queryLog.shift();
    }
  }

  /**
   * Detect potential N+1 query patterns
   */
  static analyzeForN1Patterns(timeWindowMs = 1000): Array<{
    pattern: string;
    count: number;
    avgExecutionTime: number;
    totalTime: number;
  }> {
    const cutoffTime = Date.now() - timeWindowMs;
    const recentQueries = this.queryLog.filter(q => q.timestamp > cutoffTime);

    // Group similar queries
    const patterns = new Map<string, {
      count: number;
      totalTime: number;
      queries: string[];
    }>();

    recentQueries.forEach(({ query, executionTime }) => {
      // Normalize query by removing specific values
      const normalizedQuery = query
        .replace(/\$\d+/g, '$?') // Replace parameters
        .replace(/['"][^'"]*['"]/g, "'?'") // Replace string literals
        .replace(/\b\d+\b/g, '?'); // Replace numbers

      if (!patterns.has(normalizedQuery)) {
        patterns.set(normalizedQuery, {
          count: 0,
          totalTime: 0,
          queries: []
        });
      }

      const pattern = patterns.get(normalizedQuery)!;
      pattern.count++;
      pattern.totalTime += executionTime;
      pattern.queries.push(query);
    });

    // Return patterns with high repetition (potential N+1)
    return Array.from(patterns.entries())
      .filter(([, data]) => data.count > 5) // More than 5 similar queries
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        avgExecutionTime: data.totalTime / data.count,
        totalTime: data.totalTime
      }))
      .sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Get query statistics
   */
  static getStats(): {
    totalQueries: number;
    avgExecutionTime: number;
    slowQueries: number;
  } {
    const total = this.queryLog.length;
    const avgTime = total > 0 
      ? this.queryLog.reduce((sum, q) => sum + q.executionTime, 0) / total 
      : 0;
    const slowQueries = this.queryLog.filter(q => q.executionTime > 100).length;

    return {
      totalQueries: total,
      avgExecutionTime: avgTime,
      slowQueries
    };
  }
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

/**
 * Create a dataloader-style function for any entity
 */
export function createDataLoader<K, V>(
  batchLoadFn: (keys: K[]) => Promise<V[]>,
  keyFn?: (key: K) => string,
  maxBatchSize = 100
): (key: K) => Promise<V> {
  const loader = new BatchLoader(batchLoadFn, keyFn, maxBatchSize);
  return (key: K) => loader.load(key);
}

/**
 * Batch process with controlled concurrency
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize = 10,
  concurrency = 3
): Promise<R[]> {
  const batches: T[][] = [];
  
  // Create batches
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results: R[] = [];
  
  // Process batches with controlled concurrency
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchPromises = batches
      .slice(i, i + concurrency)
      .map(batch => processor(batch));
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
  }

  return results;
}

export {
  BatchLoader,
  DataPreloader,
  QueryAnalyzer
};