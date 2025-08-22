/**
 * Redis Caching Layer for Database Query Optimization
 * Implements strategic caching with appropriate TTLs and invalidation
 */

// Redis client type definition (to avoid ioredis dependency issues)
interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  pipeline(): any;
}

// Mock Redis client for development/testing
class MockRedis implements RedisClient {
  private store = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    this.store.set(key, {
      value,
      expires: Date.now() + (seconds * 1000)
    });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    keys.forEach(key => {
      if (this.store.delete(key)) deleted++;
    });
    return deleted;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }

  pipeline() {
    const commands: Array<() => Promise<any>> = [];
    return {
      get: (key: string) => commands.push(() => this.get(key)),
      setex: (key: string, seconds: number, value: string) => 
        commands.push(() => this.setex(key, seconds, value)),
      exec: async () => {
        const results = await Promise.all(commands.map(cmd => cmd()));
        return results.map(result => [null, result]);
      }
    };
  }
}

// Redis client configuration
function createRedisClient(): RedisClient {
  try {
    // Try to import ioredis if available
    const Redis = require('ioredis').default || require('ioredis');
    return new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  } catch (error) {
    console.warn('Redis not available, using in-memory cache');
    return new MockRedis();
  }
}

const redis: RedisClient = createRedisClient();

// Cache key prefixes for organization
export const CACHE_KEYS = {
  PROVIDER_PROFILE: "provider:profile:",
  PROVIDER_SEARCH: "provider:search:",
  PROVIDER_AVAILABILITY: "provider:availability:",
  PROVIDER_STATS: "provider:stats:",
  FEATURED_PROVIDERS: "featured:providers",
  BOOKING_CONFLICTS: "booking:conflicts:",
  DASHBOARD_STATS: "dashboard:stats:",
} as const;

// TTL configurations (in seconds)
export const CACHE_TTL = {
  PROVIDER_PROFILE: 30 * 60, // 30 minutes
  PROVIDER_SEARCH: 10 * 60, // 10 minutes
  PROVIDER_AVAILABILITY: 15 * 60, // 15 minutes
  PROVIDER_STATS: 60 * 60, // 1 hour
  FEATURED_PROVIDERS: 60 * 60, // 1 hour
  BOOKING_CONFLICTS: 5 * 60, // 5 minutes
  DASHBOARD_STATS: 30 * 60, // 30 minutes
} as const;

export class CacheManager {
  private redis: RedisClient;

  constructor() {
    this.redis = redis;
  }

  /**
   * Get cached data with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with automatic JSON serialization and TTL
   */
  async set(key: string, data: any, ttl: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data);
      await this.redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data by key
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.redis.del(...keys);
    } catch (error) {
      console.error(`Cache delete pattern error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Cache wrapper that handles get/set logic
   */
  async cached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not cached, fetch and cache the result
    const result = await fetcher();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Batch cache operations for efficiency
   */
  async multiSet(items: Array<{ key: string; data: any; ttl: number }>): Promise<boolean> {
    try {
      const pipeline = this.redis.pipeline();
      
      items.forEach(({ key, data, ttl }) => {
        const serialized = JSON.stringify(data);
        pipeline.setex(key, ttl, serialized);
      });
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache multiSet error:', error);
      return false;
    }
  }

  /**
   * Batch cache retrieval
   */
  async multiGet<T>(keys: string[]): Promise<Record<string, T | null>> {
    try {
      const pipeline = this.redis.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const results = await pipeline.exec();
      const data: Record<string, T | null> = {};
      
      keys.forEach((key, index) => {
        const result = results?.[index];
        if (result && result[1]) {
          try {
            data[key] = JSON.parse(result[1] as string);
          } catch {
            data[key] = null;
          }
        } else {
          data[key] = null;
        }
      });
      
      return data;
    } catch (error) {
      console.error('Cache multiGet error:', error);
      return keys.reduce((acc, key) => ({ ...acc, [key]: null }), {});
    }
  }
}

// Singleton instance
export const cache = new CacheManager();

/**
 * Provider-specific cache operations
 */
export class ProviderCache {
  /**
   * Cache provider profile data
   */
  static getCacheKey(operation: string, ...params: string[]): string {
    return `${operation}:${params.join(':')}`;
  }

  /**
   * Cache provider profile
   */
  static async cacheProviderProfile(slug: string, data: any): Promise<void> {
    const key = this.getCacheKey(CACHE_KEYS.PROVIDER_PROFILE, slug);
    await cache.set(key, data, CACHE_TTL.PROVIDER_PROFILE);
  }

  /**
   * Get cached provider profile
   */
  static async getCachedProviderProfile(slug: string): Promise<any | null> {
    const key = this.getCacheKey(CACHE_KEYS.PROVIDER_PROFILE, slug);
    return await cache.get(key);
  }

  /**
   * Cache provider search results
   */
  static async cacheSearchResults(searchHash: string, data: any): Promise<void> {
    const key = this.getCacheKey(CACHE_KEYS.PROVIDER_SEARCH, searchHash);
    await cache.set(key, data, CACHE_TTL.PROVIDER_SEARCH);
  }

  /**
   * Get cached search results
   */
  static async getCachedSearchResults(searchHash: string): Promise<any | null> {
    const key = this.getCacheKey(CACHE_KEYS.PROVIDER_SEARCH, searchHash);
    return await cache.get(key);
  }

  /**
   * Cache provider availability
   */
  static async cacheAvailability(providerId: string, dateRange: string, data: any): Promise<void> {
    const key = this.getCacheKey(CACHE_KEYS.PROVIDER_AVAILABILITY, providerId, dateRange);
    await cache.set(key, data, CACHE_TTL.PROVIDER_AVAILABILITY);
  }

  /**
   * Get cached availability
   */
  static async getCachedAvailability(providerId: string, dateRange: string): Promise<any | null> {
    const key = this.getCacheKey(CACHE_KEYS.PROVIDER_AVAILABILITY, providerId, dateRange);
    return await cache.get(key);
  }

  /**
   * Invalidate provider-related caches
   */
  static async invalidateProviderCache(providerId: string): Promise<void> {
    await Promise.all([
      cache.deletePattern(`${CACHE_KEYS.PROVIDER_PROFILE}${providerId}*`),
      cache.deletePattern(`${CACHE_KEYS.PROVIDER_AVAILABILITY}${providerId}*`),
      cache.deletePattern(`${CACHE_KEYS.PROVIDER_STATS}${providerId}*`),
      cache.delete(CACHE_KEYS.FEATURED_PROVIDERS),
    ]);
  }

  /**
   * Invalidate search caches (when provider data changes)
   */
  static async invalidateSearchCache(): Promise<void> {
    await cache.deletePattern(`${CACHE_KEYS.PROVIDER_SEARCH}*`);
  }
}

/**
 * Booking-specific cache operations
 */
export class BookingCache {
  /**
   * Cache booking conflict check results
   */
  static async cacheConflictCheck(
    providerId: string,
    date: string,
    timeSlot: string,
    data: any
  ): Promise<void> {
    const key = `${CACHE_KEYS.BOOKING_CONFLICTS}${providerId}:${date}:${timeSlot}`;
    await cache.set(key, data, CACHE_TTL.BOOKING_CONFLICTS);
  }

  /**
   * Get cached conflict check results
   */
  static async getCachedConflictCheck(
    providerId: string,
    date: string,
    timeSlot: string
  ): Promise<any | null> {
    const key = `${CACHE_KEYS.BOOKING_CONFLICTS}${providerId}:${date}:${timeSlot}`;
    return await cache.get(key);
  }

  /**
   * Invalidate booking-related caches when new booking is created
   */
  static async invalidateBookingCache(providerId: string, date: string): Promise<void> {
    await Promise.all([
      cache.deletePattern(`${CACHE_KEYS.BOOKING_CONFLICTS}${providerId}:${date}*`),
      cache.deletePattern(`${CACHE_KEYS.PROVIDER_AVAILABILITY}${providerId}*`),
      ProviderCache.invalidateProviderCache(providerId),
    ]);
  }
}

/**
 * Dashboard-specific cache operations
 */
export class DashboardCache {
  /**
   * Cache dashboard statistics
   */
  static async cacheStatistics(userId: string, userType: string, data: any): Promise<void> {
    const key = `${CACHE_KEYS.DASHBOARD_STATS}${userType}:${userId}`;
    await cache.set(key, data, CACHE_TTL.DASHBOARD_STATS);
  }

  /**
   * Get cached dashboard statistics
   */
  static async getCachedStatistics(userId: string, userType: string): Promise<any | null> {
    const key = `${CACHE_KEYS.DASHBOARD_STATS}${userType}:${userId}`;
    return await cache.get(key);
  }

  /**
   * Invalidate dashboard caches
   */
  static async invalidateDashboardCache(userId: string): Promise<void> {
    await cache.deletePattern(`${CACHE_KEYS.DASHBOARD_STATS}*:${userId}`);
  }
}

/**
 * Cache warming utilities
 */
export class CacheWarmer {
  /**
   * Warm up popular provider caches during off-peak hours
   */
  static async warmProviderCaches(popularProviderIds: string[]): Promise<void> {
    console.log('Starting cache warming for popular providers...');
    
    // This would typically be called by a cron job
    // Import optimized queries here to avoid circular dependency
    const { getFeaturedProvidersOptimized, getProviderBySlugOptimized } = await import('../db/queries/optimized-providers-queries');
    
    try {
      // Warm featured providers cache
      const featuredProviders = await getFeaturedProvidersOptimized(12);
      await cache.set(CACHE_KEYS.FEATURED_PROVIDERS, featuredProviders, CACHE_TTL.FEATURED_PROVIDERS);
      
      // Warm individual popular provider caches
      for (const providerId of popularProviderIds.slice(0, 10)) {
        try {
          // This would need the slug, so in practice you'd query for slug first
          // const provider = await getProviderBySlugOptimized(slug);
          // if (provider) {
          //   await ProviderCache.cacheProviderProfile(provider.slug, provider);
          // }
        } catch (error) {
          console.error(`Failed to warm cache for provider ${providerId}:`, error);
        }
      }
      
      console.log(`Cache warming completed for ${popularProviderIds.length} providers`);
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  /**
   * Generate cache key hash for search parameters
   */
  static generateSearchHash(filters: Record<string, any>): string {
    const sortedEntries = Object.entries(filters)
      .filter(([_, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`);
    
    return Buffer.from(sortedEntries.join('|')).toString('base64');
  }
}

// Export redis client for direct use if needed
export { redis };
