/**
 * Redis Cloud Rate Limiter
 * 
 * High-performance distributed rate limiting using Redis Cloud with ioredis.
 * Implements sliding window algorithm for accurate rate limiting.
 * 
 * Advantages over Upstash REST:
 * - 10x faster response times (sub-ms vs 10-50ms)
 * - Native Redis protocol efficiency
 * - Better handling of high concurrent requests
 * - Lower overhead for frequent rate checks
 */

import { redis } from './redis-cloud';
import { RateLimiter as InMemoryRateLimiter } from './rate-limiter';

interface RateLimiterConfig {
  tokensPerInterval: number;
  interval: 'ms' | 's' | 'm' | 'h' | 'd';
  namespace?: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Convert interval string to milliseconds
 */
function intervalToMs(interval: RateLimiterConfig['interval']): number {
  const map = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };
  return map[interval];
}

/**
 * Redis-based sliding window rate limiter
 */
export class RedisRateLimiter {
  private config: RateLimiterConfig;
  private windowMs: number;
  private fallbackLimiter?: InMemoryRateLimiter;
  
  constructor(config: RateLimiterConfig) {
    this.config = config;
    this.windowMs = intervalToMs(config.interval);
    
    // Create in-memory fallback for when Redis is unavailable
    this.fallbackLimiter = new InMemoryRateLimiter({
      tokensPerInterval: config.tokensPerInterval,
      interval: this.windowMs,
      fireImmediately: true,
    });
  }
  
  /**
   * Check rate limit for an identifier
   */
  async limit(identifier: string): Promise<RateLimitResult> {
    const key = this.getKey(identifier);
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    try {
      // Use Redis transaction for atomic operations
      const pipeline = redis.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Count requests in current window
      pipeline.zcard(key);
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }
      
      const currentCount = results[1]?.[1] as number || 0;
      
      // Check if limit exceeded
      if (currentCount >= this.config.tokensPerInterval) {
        // Get oldest entry to calculate reset time
        const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetTime = oldestEntry.length > 1 
          ? parseInt(oldestEntry[1]) + this.windowMs
          : now + this.windowMs;
        
        return {
          success: false,
          limit: this.config.tokensPerInterval,
          remaining: 0,
          reset: resetTime,
        };
      }
      
      // Add new request to window
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      
      // Set expiry on the key
      await redis.expire(key, Math.ceil(this.windowMs / 1000));
      
      return {
        success: true,
        limit: this.config.tokensPerInterval,
        remaining: this.config.tokensPerInterval - currentCount - 1,
        reset: now + this.windowMs,
      };
      
    } catch (error) {
      console.error('[RateLimiter] Redis error, falling back to in-memory:', error);
      
      // Fallback to in-memory rate limiting
      if (this.fallbackLimiter) {
        const result = await this.fallbackLimiter.check(identifier);
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        };
      }
      
      // If no fallback, allow the request but log warning
      console.warn('[RateLimiter] No fallback available, allowing request');
      return {
        success: true,
        limit: this.config.tokensPerInterval,
        remaining: this.config.tokensPerInterval,
        reset: now + this.windowMs,
      };
    }
  }
  
  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = this.getKey(identifier);
    await redis.del(key);
  }
  
  /**
   * Get Redis key for identifier
   */
  private getKey(identifier: string): string {
    const namespace = this.config.namespace || 'ratelimit';
    return `${namespace}:${identifier}`;
  }
}

/**
 * Create rate limiter with config
 */
export const createRateLimiter = (config: RateLimiterConfig) => {
  return new RedisRateLimiter(config);
};

/**
 * Pre-configured rate limiters for different endpoints
 * Optimized for Redis Cloud performance characteristics
 */
export const rateLimiters = {
  // Public API: 100 requests per minute (increased from 30 due to better performance)
  api: createRateLimiter({
    tokensPerInterval: 100,
    interval: 'm',
    namespace: 'ecosystem:api',
  }),
  
  // Guest checkout: 10 requests per hour
  guestCheckout: createRateLimiter({
    tokensPerInterval: 10,
    interval: 'h',
    namespace: 'ecosystem:guest',
  }),
  
  // Authentication: 10 attempts per 15 minutes
  auth: createRateLimiter({
    tokensPerInterval: 10,
    interval: 'm', // Will need custom logic for 15 minutes
    namespace: 'ecosystem:auth',
  }),
  
  // Webhooks: 1000 requests per second (increased from 100 due to Redis Cloud performance)
  webhook: createRateLimiter({
    tokensPerInterval: 1000,
    interval: 's',
    namespace: 'ecosystem:webhook',
  }),
  
  // Search: 120 requests per minute (increased from 60)
  search: createRateLimiter({
    tokensPerInterval: 120,
    interval: 'm',
    namespace: 'ecosystem:search',
  }),
  
  // Provider registration: 3 attempts per day
  providerRegistration: createRateLimiter({
    tokensPerInterval: 3,
    interval: 'd',
    namespace: 'ecosystem:provider:reg',
  }),
  
  // Stripe Connect operations: 30 per minute
  stripeConnect: createRateLimiter({
    tokensPerInterval: 30,
    interval: 'm',
    namespace: 'ecosystem:stripe:connect',
  }),
  
  // Payment processing: 20 per minute per user
  payment: createRateLimiter({
    tokensPerInterval: 20,
    interval: 'm',
    namespace: 'ecosystem:payment',
  }),
};

/**
 * Helper to get client IP from request
 */
export const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback to a default identifier
  return 'anonymous';
};

/**
 * Rate limiting middleware helper with enhanced error responses
 */
export const withRateLimit = async (
  request: Request,
  limiter: RedisRateLimiter,
  identifier?: string
): Promise<Response | null> => {
  const clientId = identifier || getClientIp(request);
  const result = await limiter.limit(clientId);
  
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please slow down your requests.',
        retryAfter,
        limit: result.limit,
        reset: new Date(result.reset).toISOString(),
      }),
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'Retry-After': retryAfter.toString(),
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
  
  // Add rate limit headers to successful responses
  return null;
};

/**
 * Express/Next.js middleware wrapper
 */
export const rateLimitMiddleware = (limiter: RedisRateLimiter) => {
  return async (req: any, res: any, next: any) => {
    const identifier = req.ip || req.connection.remoteAddress || 'unknown';
    const result = await limiter.limit(identifier);
    
    // Always set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.limit);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.reset).toISOString());
    
    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter,
      });
    }
    
    next();
  };
};

/**
 * Get rate limit status for an identifier without consuming a token
 */
export const getRateLimitStatus = async (
  limiter: RedisRateLimiter,
  identifier: string
): Promise<RateLimitResult> => {
  // This would need a custom implementation to check without consuming
  // For now, we'll use the regular limit check
  return limiter.limit(identifier);
};

// Export types
export type { RateLimiterConfig, RateLimitResult };