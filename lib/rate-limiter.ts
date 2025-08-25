/**
 * Rate Limiter
 * 
 * Token bucket algorithm implementation for API rate limiting.
 * Protects endpoints from abuse and ensures fair usage.
 */

import { LRUCache } from 'lru-cache';

interface RateLimiterOptions {
  tokensPerInterval: number;
  interval: number; // milliseconds
  fireImmediately?: boolean;
  maxCacheSize?: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private cache: LRUCache<string, TokenBucket>;
  private tokensPerInterval: number;
  private interval: number;
  private fireImmediately: boolean;

  constructor(options: RateLimiterOptions) {
    this.tokensPerInterval = options.tokensPerInterval;
    this.interval = options.interval;
    this.fireImmediately = options.fireImmediately ?? true;
    
    // Initialize LRU cache for storing rate limit data
    this.cache = new LRUCache<string, TokenBucket>({
      max: options.maxCacheSize ?? 10000,
      ttl: this.interval * 2, // TTL is twice the interval
      updateAgeOnGet: true,
      updateAgeOnHas: true
    });
  }

  /**
   * Check if a request is allowed under the rate limit
   */
  async check(identifier: string, cost: number = 1): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.cache.get(identifier);
    
    if (!bucket) {
      // First request from this identifier
      bucket = {
        tokens: this.fireImmediately ? this.tokensPerInterval - cost : this.tokensPerInterval,
        lastRefill: now
      };
      
      if (this.fireImmediately && cost <= this.tokensPerInterval) {
        this.cache.set(identifier, bucket);
        return {
          success: true,
          limit: this.tokensPerInterval,
          remaining: bucket.tokens,
          reset: now + this.interval
        };
      }
    } else {
      // Refill tokens based on time elapsed
      const timePassed = now - bucket.lastRefill;
      const intervalsElapsed = Math.floor(timePassed / this.interval);
      
      if (intervalsElapsed > 0) {
        bucket.tokens = Math.min(
          this.tokensPerInterval,
          bucket.tokens + (intervalsElapsed * this.tokensPerInterval)
        );
        bucket.lastRefill = now;
      }
    }
    
    // Check if request can be fulfilled
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.cache.set(identifier, bucket);
      
      return {
        success: true,
        limit: this.tokensPerInterval,
        remaining: bucket.tokens,
        reset: bucket.lastRefill + this.interval
      };
    }
    
    // Rate limit exceeded
    const resetTime = bucket.lastRefill + this.interval;
    
    return {
      success: false,
      limit: this.tokensPerInterval,
      remaining: 0,
      reset: resetTime
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    this.cache.delete(identifier);
  }

  /**
   * Get current rate limit status without consuming tokens
   */
  status(identifier: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.cache.get(identifier);
    
    if (!bucket) {
      return {
        success: true,
        limit: this.tokensPerInterval,
        remaining: this.tokensPerInterval,
        reset: now + this.interval
      };
    }
    
    // Calculate current tokens after refill
    const timePassed = now - bucket.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / this.interval);
    const currentTokens = Math.min(
      this.tokensPerInterval,
      bucket.tokens + (intervalsElapsed * this.tokensPerInterval)
    );
    
    return {
      success: currentTokens > 0,
      limit: this.tokensPerInterval,
      remaining: currentTokens,
      reset: bucket.lastRefill + this.interval
    };
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Create a middleware-style rate limiter for Next.js API routes
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const limiter = new RateLimiter(options);
  
  return {
    check: (identifier: string, cost?: number) => limiter.check(identifier, cost),
    reset: (identifier: string) => limiter.reset(identifier),
    status: (identifier: string) => limiter.status(identifier),
    clear: () => limiter.clear()
  };
}

/**
 * IP-based rate limiter factory
 */
export function createIPRateLimiter(
  tokensPerInterval: number = 10,
  intervalMs: number = 60000
) {
  return new RateLimiter({
    tokensPerInterval,
    interval: intervalMs,
    fireImmediately: true,
    maxCacheSize: 50000
  });
}

/**
 * User-based rate limiter factory
 */
export function createUserRateLimiter(
  tokensPerInterval: number = 100,
  intervalMs: number = 60000
) {
  return new RateLimiter({
    tokensPerInterval,
    interval: intervalMs,
    fireImmediately: true,
    maxCacheSize: 10000
  });
}

/**
 * API key-based rate limiter factory
 */
export function createAPIKeyRateLimiter(
  tokensPerInterval: number = 1000,
  intervalMs: number = 60000
) {
  return new RateLimiter({
    tokensPerInterval,
    interval: intervalMs,
    fireImmediately: true,
    maxCacheSize: 1000
  });
}

// Export types
export type { RateLimiterOptions, RateLimitResult, TokenBucket };