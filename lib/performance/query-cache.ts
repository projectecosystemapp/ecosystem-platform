/**
 * Advanced Query Caching System with Redis Integration
 * Provides multi-layer caching for expensive database operations
 */

import { cache } from '@/lib/cache';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

// Cache configuration
export const QUERY_CACHE_CONFIG = {
  // Memory cache for frequently accessed data (in-memory)
  MEMORY: {
    MAX_SIZE: 1000, // Maximum number of entries
    TTL: 5 * 60 * 1000, // 5 minutes in milliseconds
  },
  
  // Redis cache for shared data across instances
  REDIS: {
    DEFAULT_TTL: 15 * 60, // 15 minutes in seconds
    LONG_TTL: 60 * 60, // 1 hour in seconds
    SHORT_TTL: 2 * 60, // 2 minutes in seconds
  },
  
  // Performance thresholds
  PERFORMANCE: {
    SLOW_QUERY_THRESHOLD: 100, // milliseconds
    CACHE_WARMING_THRESHOLD: 1000, // milliseconds
  }
};

// In-memory cache for ultra-fast access
class MemoryCache<T> {
  private cache = new Map<string, { data: T; timestamp: number; ttl: number }>();
  private maxSize: number;

  constructor(maxSize: number = QUERY_CACHE_CONFIG.MEMORY.MAX_SIZE) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: T, ttl: number = QUERY_CACHE_CONFIG.MEMORY.TTL): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Multi-layer caching system
export class QueryCache {
  private memoryCache = new MemoryCache();
  private static instance: QueryCache;

  static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache();
    }
    return QueryCache.instance;
  }

  /**
   * Generate a consistent cache key from query parameters
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return result;
      }, {} as Record<string, string>);

    const paramString = JSON.stringify(sortedParams);
    const hash = createHash('md5').update(paramString).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Cache a query with multi-layer strategy
   */
  async cached<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: {
      memoryTtl?: number;
      redisTtl?: number;
      skipMemory?: boolean;
      skipRedis?: boolean;
    } = {}
  ): Promise<{
    data: T;
    fromCache: boolean;
    cacheLayer: 'memory' | 'redis' | 'database';
    executionTime: number;
  }> {
    const startTime = performance.now();

    // Try memory cache first (fastest)
    if (!options.skipMemory) {
      const memoryResult = this.memoryCache.get<T>(key);
      if (memoryResult !== null) {
        return {
          data: memoryResult,
          fromCache: true,
          cacheLayer: 'memory',
          executionTime: performance.now() - startTime
        };
      }
    }

    // Try Redis cache (medium speed)
    if (!options.skipRedis) {
      try {
        const redisResult = await cache.get<T>(key);
        if (redisResult !== null) {
          // Store in memory cache for next time
          if (!options.skipMemory) {
            this.memoryCache.set(
              key,
              redisResult,
              options.memoryTtl || QUERY_CACHE_CONFIG.MEMORY.TTL
            );
          }
          
          return {
            data: redisResult,
            fromCache: true,
            cacheLayer: 'redis',
            executionTime: performance.now() - startTime
          };
        }
      } catch (error) {
        console.warn('Redis cache read failed:', error);
      }
    }

    // Execute query (slowest)
    const queryStartTime = performance.now();
    const result = await queryFn();
    const queryTime = performance.now() - queryStartTime;

    // Store results in caches
    const cachePromises = [];

    // Memory cache
    if (!options.skipMemory) {
      this.memoryCache.set(
        key,
        result,
        options.memoryTtl || QUERY_CACHE_CONFIG.MEMORY.TTL
      );
    }

    // Redis cache
    if (!options.skipRedis) {
      cachePromises.push(
        cache.set(
          key,
          result,
          options.redisTtl || QUERY_CACHE_CONFIG.REDIS.DEFAULT_TTL
        ).catch(error => console.warn('Redis cache write failed:', error))
      );
    }

    // Log slow queries for monitoring
    if (queryTime > QUERY_CACHE_CONFIG.PERFORMANCE.SLOW_QUERY_THRESHOLD) {
      console.warn(`Slow query detected: ${key} took ${queryTime.toFixed(2)}ms`);
      this.logSlowQuery(key, queryTime);
    }

    // Don't wait for cache writes to complete
    if (cachePromises.length > 0) {
      Promise.allSettled(cachePromises);
    }

    return {
      data: result,
      fromCache: false,
      cacheLayer: 'database',
      executionTime: performance.now() - startTime
    };
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache entries matching pattern
    for (const key of this.memoryCache['cache'].keys()) {
      if (key.includes(pattern) || key.match(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache entries
    try {
      await cache.deletePattern(pattern);
    } catch (error) {
      console.warn('Redis cache invalidation failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    memorySize: number;
    memoryMaxSize: number;
    uptime: number;
  } {
    return {
      memorySize: this.memoryCache.size(),
      memoryMaxSize: QUERY_CACHE_CONFIG.MEMORY.MAX_SIZE,
      uptime: process.uptime()
    };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      await cache.flush();
    } catch (error) {
      console.warn('Redis cache clear failed:', error);
    }
  }

  /**
   * Log slow queries for analysis
   */
  private logSlowQuery(key: string, executionTime: number): void {
    // In production, this would log to a monitoring service
    console.log({
      type: 'slow_query',
      key,
      executionTime,
      timestamp: new Date().toISOString()
    });
  }
}

// Singleton instance
export const queryCache = QueryCache.getInstance();

// Specialized cache utilities for common query patterns

/**
 * Provider-specific query cache
 */
export class ProviderQueryCache {
  private static prefix = 'provider_query';

  static async searchProviders<T>(
    filters: Record<string, any>,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = queryCache.generateKey(
      `${this.prefix}:search`,
      filters
    );
    
    const result = await queryCache.cached(key, queryFn, {
      memoryTtl: 2 * 60 * 1000, // 2 minutes in memory
      redisTtl: 10 * 60 // 10 minutes in Redis
    });
    
    return result.data;
  }

  static async getProvider<T>(
    providerId: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = queryCache.generateKey(
      `${this.prefix}:detail`,
      { providerId }
    );
    
    const result = await queryCache.cached(key, queryFn, {
      memoryTtl: 5 * 60 * 1000, // 5 minutes in memory
      redisTtl: 30 * 60 // 30 minutes in Redis
    });
    
    return result.data;
  }

  static async invalidateProvider(providerId: string): Promise<void> {
    await Promise.all([
      queryCache.invalidate(`${this.prefix}:detail:*${providerId}*`),
      queryCache.invalidate(`${this.prefix}:search:*`) // Invalidate all searches
    ]);
  }
}

/**
 * Booking-specific query cache
 */
export class BookingQueryCache {
  private static prefix = 'booking_query';

  static async getAvailability<T>(
    providerId: string,
    date: Date,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = queryCache.generateKey(
      `${this.prefix}:availability`,
      { 
        providerId, 
        date: date.toISOString().split('T')[0] // Just the date part
      }
    );
    
    const result = await queryCache.cached(key, queryFn, {
      memoryTtl: 30 * 1000, // 30 seconds in memory (very short for real-time data)
      redisTtl: 2 * 60 // 2 minutes in Redis
    });
    
    return result.data;
  }

  static async getBookingHistory<T>(
    userId: string,
    filters: Record<string, any>,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = queryCache.generateKey(
      `${this.prefix}:history`,
      { userId, ...filters }
    );
    
    const result = await queryCache.cached(key, queryFn, {
      memoryTtl: 2 * 60 * 1000, // 2 minutes in memory
      redisTtl: 10 * 60 // 10 minutes in Redis
    });
    
    return result.data;
  }

  static async invalidateBooking(bookingId: string, providerId?: string): Promise<void> {
    const patterns = [
      `${this.prefix}:*${bookingId}*`
    ];
    
    if (providerId) {
      patterns.push(`${this.prefix}:availability:*${providerId}*`);
    }
    
    await Promise.all(
      patterns.map(pattern => queryCache.invalidate(pattern))
    );
  }
}

/**
 * Analytics query cache with longer TTL
 */
export class AnalyticsQueryCache {
  private static prefix = 'analytics_query';

  static async getDashboardData<T>(
    userId: string,
    userType: 'provider' | 'customer',
    dateRange: { start: Date; end: Date },
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = queryCache.generateKey(
      `${this.prefix}:dashboard`,
      {
        userId,
        userType,
        start: dateRange.start.toISOString().split('T')[0],
        end: dateRange.end.toISOString().split('T')[0]
      }
    );
    
    const result = await queryCache.cached(key, queryFn, {
      memoryTtl: 5 * 60 * 1000, // 5 minutes in memory
      redisTtl: 30 * 60 // 30 minutes in Redis
    });
    
    return result.data;
  }

  static async getTrends<T>(
    period: 'daily' | 'weekly' | 'monthly',
    queryFn: () => Promise<T>
  ): Promise<T> {
    const key = queryCache.generateKey(
      `${this.prefix}:trends`,
      { period }
    );
    
    const ttl = period === 'daily' 
      ? QUERY_CACHE_CONFIG.REDIS.SHORT_TTL
      : QUERY_CACHE_CONFIG.REDIS.LONG_TTL;
    
    const result = await queryCache.cached(key, queryFn, {
      memoryTtl: 10 * 60 * 1000, // 10 minutes in memory
      redisTtl: ttl
    });
    
    return result.data;
  }
}

// Export all cache utilities
export {
  MemoryCache,
  QUERY_CACHE_CONFIG
};