import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";

// Create Redis client - falls back to in-memory if not configured
let redis: Redis | null = null;
let ratelimit: Record<string, Ratelimit> | null = null;

// Check if Redis is configured
const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

if (isRedisConfigured) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  // Create rate limiters for different endpoint types
  ratelimit = {
    payment: new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute
      analytics: true,
      prefix: "@upstash/ratelimit:payment",
    }),
    api: new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
      analytics: true,
      prefix: "@upstash/ratelimit:api",
    }),
    auth: new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 requests per 15 minutes
      analytics: true,
      prefix: "@upstash/ratelimit:auth",
    }),
    webhook: new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(10, "1 s"), // 10 requests per second
      analytics: true,
      prefix: "@upstash/ratelimit:webhook",
    }),
  };
}

// Fallback to the existing in-memory implementation if Redis is not configured
import { rateLimit as inMemoryRateLimit, RATE_LIMIT_CONFIGS } from "./rate-limit";

interface RateLimitConfig {
  type: keyof typeof RATE_LIMIT_CONFIGS;
  message?: string;
}

/**
 * Production-ready rate limiting middleware
 * Uses Redis/Upstash when available, falls back to in-memory for development
 */
export function withRateLimitRedis<T extends NextRequest>(
  config: RateLimitConfig,
  handler: (req: T) => Promise<NextResponse>
) {
  return async (req: T): Promise<NextResponse> => {
    // Use Redis rate limiting if configured
    if (isRedisConfigured && ratelimit) {
      const identifier = getClientIdentifier(req);
      const rateLimiter = ratelimit[config.type];
      
      if (!rateLimiter) {
        console.error(`Rate limiter not found for type: ${config.type}`);
        return handler(req);
      }

      const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        
        return NextResponse.json(
          { 
            error: config.message || RATE_LIMIT_CONFIGS[config.type].message,
            retryAfter 
          },
          { 
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': new Date(reset).toISOString()
            }
          }
        );
      }

      // Add rate limit headers to successful response
      const response = await handler(req);
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());
      
      return response;
    }

    // Fallback to in-memory rate limiting for development
    console.warn('Redis not configured - using in-memory rate limiting (not suitable for production)');
    const inMemoryLimiter = inMemoryRateLimit(RATE_LIMIT_CONFIGS[config.type]);
    return inMemoryLimiter(req, () => handler(req));
  };
}

/**
 * Get client identifier for rate limiting
 * Uses IP address with fallback to a generic identifier
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers (for proxied requests)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip'); // Cloudflare
  
  // Use the first available IP
  const ip = forwardedFor?.split(',')[0].trim() || 
             realIp || 
             cfConnectingIp ||
             'unknown';
  
  // Combine IP with user agent for better identification
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const hash = simpleHash(`${ip}-${userAgent}`);
  
  return `${ip}-${hash}`;
}

/**
 * Simple hash function for consistent client identification
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!isRedisConfigured || !redis) {
    return false;
  }

  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Get rate limit analytics (if available)
 */
export async function getRateLimitAnalytics(type: keyof typeof RATE_LIMIT_CONFIGS) {
  if (!isRedisConfigured || !ratelimit) {
    return null;
  }

  try {
    const limiter = ratelimit[type];
    if (!limiter) return null;

    // Note: Analytics functionality depends on your Upstash plan
    return {
      type,
      configured: true,
      healthy: await checkRedisHealth(),
    };
  } catch (error) {
    console.error('Failed to get rate limit analytics:', error);
    return null;
  }
}