/**
 * Search Cache Manager
 * Implements Redis-based caching per Master PRD §4.4.3
 * 
 * Features:
 * - 60 second TTL for search results
 * - Stampede protection
 * - Cache key generation
 * - Invalidation on provider changes
 */

import { Redis } from "@upstash/redis";
import crypto from 'crypto';
import type { ProviderRankingData } from './ranking-engine';

/**
 * Search cache configuration
 */
export interface SearchCacheConfig {
  ttlSeconds: number;
  maxCacheSize: number;
  enableStampedeProtection: boolean;
}

/**
 * Cached search result
 */
export interface CachedSearchResult {
  query: any;
  results: ProviderRankingData[];
  totalCount: number;
  timestamp: Date;
  ttl: number;
  hits: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  stampedePrevented: number;
  averageResponseTime: number;
}

/**
 * Main search cache class
 */
export class SearchCache {
  private redis: Redis;
  private readonly DEFAULT_TTL_SECONDS = 60; // 60 seconds per Master PRD
  private readonly STAMPEDE_PROTECTION_TTL = 5; // 5 seconds for stampede protection
  private readonly MAX_CACHE_SIZE = 1000; // Maximum number of cached queries
  
  // In-memory stats (could be moved to Redis for persistence)
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    stampedePrevented: 0,
    averageResponseTime: 0
  };

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  /**
   * Get cached search results
   */
  async get(
    query: any,
    options: {
      extendTTL?: boolean;
      trackHit?: boolean;
    } = {}
  ): Promise<CachedSearchResult | null> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query);

    try {
      // Check if we're in stampede protection mode
      const stampedeKey = `stampede:${cacheKey}`;
      const isStampeding = await this.redis.get(stampedeKey);
      
      if (isStampeding) {
        this.stats.stampedePrevented++;
        // Wait briefly and retry
        await this.sleep(100);
        return this.get(query, options);
      }

      // Get cached result
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) {
        this.stats.misses++;
        this.updateResponseTime(Date.now() - startTime);
        return null;
      }

      const result = JSON.parse(cached as string) as CachedSearchResult;
      
      // Check if result is still valid
      const age = Date.now() - new Date(result.timestamp).getTime();
      if (age > result.ttl * 1000) {
        // Expired
        this.stats.misses++;
        await this.redis.del(cacheKey);
        return null;
      }

      // Track hit
      if (options.trackHit !== false) {
        this.stats.hits++;
        result.hits++;
        
        // Update hit count in cache
        await this.redis.set(
          cacheKey,
          JSON.stringify(result),
          { ex: Math.floor((result.ttl * 1000 - age) / 1000) }
        );
      }

      // Extend TTL if requested
      if (options.extendTTL) {
        await this.redis.expire(cacheKey, this.DEFAULT_TTL_SECONDS);
      }

      this.updateResponseTime(Date.now() - startTime);
      return result;

    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set search results in cache
   */
  async set(
    query: any,
    results: ProviderRankingData[],
    totalCount: number,
    options: {
      ttl?: number;
      preventStampede?: boolean;
    } = {}
  ): Promise<boolean> {
    const cacheKey = this.generateCacheKey(query);
    const ttl = options.ttl || this.DEFAULT_TTL_SECONDS;

    try {
      // Set stampede protection if enabled
      if (options.preventStampede) {
        const stampedeKey = `stampede:${cacheKey}`;
        await this.redis.setex(
          stampedeKey,
          this.STAMPEDE_PROTECTION_TTL,
          '1'
        );
      }

      const cacheData: CachedSearchResult = {
        query,
        results,
        totalCount,
        timestamp: new Date(),
        ttl,
        hits: 0
      };

      // Store in cache
      await this.redis.setex(
        cacheKey,
        ttl,
        JSON.stringify(cacheData)
      );

      // Track cache size and evict if necessary
      await this.enforceMaxSize();

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    } finally {
      // Clear stampede protection
      if (options.preventStampede) {
        const stampedeKey = `stampede:${cacheKey}`;
        await this.redis.del(stampedeKey);
      }
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(patterns: {
    providerId?: string;
    category?: string;
    location?: { latitude: number; longitude: number; radius: number };
    all?: boolean;
  }): Promise<number> {
    let invalidatedCount = 0;

    try {
      if (patterns.all) {
        // Clear all search cache
        const keys = await this.redis.keys('search:*');
        if (keys.length > 0) {
          await this.redis.del(...keys);
          invalidatedCount = keys.length;
        }
      } else if (patterns.providerId) {
        // Invalidate all searches that might include this provider
        // This is a broad invalidation - could be optimized with tagging
        const keys = await this.redis.keys('search:*');
        
        for (const key of keys) {
          const cached = await this.redis.get(key);
          if (cached) {
            const result = JSON.parse(cached as string) as CachedSearchResult;
            const hasProvider = result.results.some(p => p.id === patterns.providerId);
            
            if (hasProvider) {
              await this.redis.del(key);
              invalidatedCount++;
            }
          }
        }
      } else if (patterns.category) {
        // Invalidate searches with this category
        const keys = await this.redis.keys(`search:*category*${patterns.category}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          invalidatedCount = keys.length;
        }
      }

      this.stats.evictions += invalidatedCount;
      return invalidatedCount;

    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Warm the cache with common queries
   */
  async warmCache(
    commonQueries: any[],
    searchFunction: (query: any) => Promise<{ results: ProviderRankingData[]; total: number }>
  ): Promise<void> {
    console.log(`Warming cache with ${commonQueries.length} common queries`);

    for (const query of commonQueries) {
      const cached = await this.get(query, { trackHit: false });
      
      if (!cached) {
        try {
          const { results, total } = await searchFunction(query);
          await this.set(query, results, total, { preventStampede: true });
        } catch (error) {
          console.error('Cache warming error for query:', query, error);
        }
      }
    }
  }

  /**
   * Generate deterministic cache key from query
   */
  private generateCacheKey(query: any): string {
    // Sort query keys for consistent hashing
    const sortedQuery = this.sortObject(query);
    const queryString = JSON.stringify(sortedQuery);
    
    // Create hash of query
    const hash = crypto
      .createHash('sha256')
      .update(queryString)
      .digest('hex')
      .substring(0, 16);
    
    // Include important query params in key for debugging
    const prefix = this.getCacheKeyPrefix(query);
    
    return `search:${prefix}:${hash}`;
  }

  /**
   * Get cache key prefix for debugging
   */
  private getCacheKeyPrefix(query: any): string {
    const parts: string[] = [];
    
    if (query.query) {
      parts.push(`q-${query.query.substring(0, 10).replace(/\s+/g, '_')}`);
    }
    
    if (query.categories && query.categories.length > 0) {
      parts.push(`cat-${query.categories[0]}`);
    }
    
    if (query.location) {
      parts.push('loc');
    }
    
    return parts.join('-') || 'all';
  }

  /**
   * Sort object keys recursively for consistent hashing
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item)).sort();
    }

    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortObject(obj[key]);
      });

    return sorted;
  }

  /**
   * Enforce maximum cache size
   */
  private async enforceMaxSize(): Promise<void> {
    try {
      const keys = await this.redis.keys('search:*');
      
      if (keys.length > this.MAX_CACHE_SIZE) {
        // Get oldest entries
        const entries: Array<{ key: string; timestamp: number }> = [];
        
        for (const key of keys) {
          const cached = await this.redis.get(key);
          if (cached) {
            const result = JSON.parse(cached as string) as CachedSearchResult;
            entries.push({
              key,
              timestamp: new Date(result.timestamp).getTime()
            });
          }
        }
        
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a.timestamp - b.timestamp);
        
        // Delete oldest entries
        const toDelete = entries.slice(0, keys.length - this.MAX_CACHE_SIZE);
        if (toDelete.length > 0) {
          await this.redis.del(...toDelete.map(e => e.key));
          this.stats.evictions += toDelete.length;
        }
      }
    } catch (error) {
      console.error('Cache size enforcement error:', error);
    }
  }

  /**
   * Update average response time
   */
  private updateResponseTime(responseTime: number): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    if (totalRequests === 0) {
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    }
  }

  /**
   * Sleep helper for stampede protection
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      ...this.stats,
      hitRate,
    } as CacheStats & { hitRate: number };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      stampedePrevented: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys('search:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      console.log(`Cleared ${keys.length} cache entries`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }
}

// Export singleton instance
export const searchCache = new SearchCache();