/**
 * Redis Rate Limiter
 * 
 * Distributed rate limiting using Redis with token bucket algorithm.
 * Falls back to in-memory cache if Redis is unavailable.
 */

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { RateLimiter as InMemoryRateLimiter } from './rate-limiter';

interface RateLimiterConfig {
  tokensPerInterval: number;
  interval: 'ms' | 's' | 'm' | 'h' | 'd';
  analytics?: boolean;
}

// Initialize Redis client
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Create rate limiters for different use cases
export const createRateLimiter = (config: RateLimiterConfig) => {
  if (redis) {
    // Use Redis-based rate limiting for production
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.tokensPerInterval, config.interval),
      analytics: config.analytics ?? true,
      prefix: 'ecosystem_ratelimit',
    });
  } else {
    // Fallback to in-memory rate limiting for development
    console.warn('[Rate Limiter] Redis not configured, using in-memory fallback');
    
    const intervalMs = {
      ms: 1,
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    }[config.interval];
    
    const inMemoryLimiter = new InMemoryRateLimiter({
      tokensPerInterval: config.tokensPerInterval,
      interval: intervalMs,
      fireImmediately: true,
    });
    
    // Wrap to match Upstash interface
    return {
      limit: async (identifier: string) => {
        const result = await inMemoryLimiter.check(identifier);
        return {
          success: result.success,
          limit: result.limit,
          reset: result.reset,
          remaining: result.remaining,
        };
      },
    };
  }
};

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  // Public API: 30 requests per minute
  api: createRateLimiter({
    tokensPerInterval: 30,
    interval: 'm',
  }),
  
  // Guest checkout: 10 requests per hour (prevent abuse)
  guestCheckout: createRateLimiter({
    tokensPerInterval: 10,
    interval: 'h',
  }),
  
  // Authentication: 5 attempts per 15 minutes
  auth: createRateLimiter({
    tokensPerInterval: 5,
    interval: 'm', // Will need to multiply by 15 in usage
  }),
  
  // Webhooks: 100 requests per second (high throughput)
  webhook: createRateLimiter({
    tokensPerInterval: 100,
    interval: 's',
  }),
  
  // Search: 60 requests per minute
  search: createRateLimiter({
    tokensPerInterval: 60,
    interval: 'm',
  }),
  
  // Provider registration: 3 attempts per day
  providerRegistration: createRateLimiter({
    tokensPerInterval: 3,
    interval: 'd',
  }),
};

// Helper to get client IP from request
export const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback to a default identifier
  return 'anonymous';
};

// Rate limiting middleware helper
export const withRateLimit = async (
  request: Request,
  limiter: ReturnType<typeof createRateLimiter>,
  identifier?: string
) => {
  const clientId = identifier || getClientIp(request);
  const result = await limiter.limit(clientId);
  
  if (!result.success) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Please slow down your requests',
        retryAfter: Math.floor((result.reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'Retry-After': Math.floor((result.reset - Date.now()) / 1000).toString(),
          'Content-Type': 'application/json',
        },
      }
    );
  }
  
  return null; // Continue with request
};