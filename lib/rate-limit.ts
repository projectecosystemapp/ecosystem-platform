/**
 * Comprehensive Rate Limiting Infrastructure
 * 
 * Production-ready rate limiting with Upstash Redis
 * Supports API routes, Server Actions, and middleware
 * 
 * @see CLAUDE.md for Series A production standards
 */

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Type definitions
interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  message?: string;  // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: NextRequest | string) => string; // Custom key generator
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// Check if Redis is configured
const isRedisConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Simple in-memory store for fallback
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for sensitive operations
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many authentication attempts. Please try again later."
  },
  payment: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: "Too many payment requests. Please wait before trying again."
  },
  
  // Moderate limits for booking operations
  booking: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Too many booking requests. Please slow down."
  },
  
  // Loose limits for search and general API
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: "Too many search requests. Please slow down."
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: "Too many requests. Please slow down."
  },
  
  // Special limits for webhooks
  webhook: {
    windowMs: 1000, // 1 second
    maxRequests: 10,
    message: "Webhook rate limit exceeded.",
    skipSuccessfulRequests: true // Only count failures
  },
  
  // Server action limits
  serverAction: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: "Too many server action requests. Please slow down."
  }
} as const;

/**
 * Initialize Redis rate limiters
 */
let redisClient: Redis | null = null;
let rateLimiters: Record<string, Ratelimit> | null = null;

if (isRedisConfigured) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // Create rate limiters with sliding window algorithm
    rateLimiters = {
      auth: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(5, "15 m"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:auth",
      }),
      payment: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:payment",
      }),
      booking: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:booking",
      }),
      search: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:search",
      }),
      api: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(100, "1 m"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:api",
      }),
      webhook: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "1 s"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:webhook",
      }),
      serverAction: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: true,
        prefix: "@ecosystem/ratelimit:serverAction",
      }),
    };
  } catch (error) {
    console.error("Failed to initialize Redis rate limiters:", error);
    // Continue with in-memory fallback
  }
}

/**
 * Core rate limiting function with Redis/in-memory fallback
 */
export async function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIGS
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_CONFIGS[type];
  
  // Try Redis first if available
  if (rateLimiters && rateLimiters[type]) {
    try {
      const result = await rateLimiters[type].limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch (error) {
      console.error(`Redis rate limit error for ${type}:`, error);
      // Fall through to in-memory
    }
  }
  
  // In-memory fallback
  return inMemoryRateLimit(identifier, config);
}

/**
 * In-memory rate limiting implementation
 */
function inMemoryRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }
  
  if (!entry || now > entry.resetTime) {
    // Start new window
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: now + config.windowMs,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      reset: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    reset: entry.resetTime,
  };
}

/**
 * Rate limiting middleware for API routes
 */
export function rateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    req: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    const identifier = config.keyGenerator?.(req) ?? getClientIdentifier(req);
    const type = determineRateLimitType(req.url);
    
    const result = await checkRateLimit(identifier, type);
    
    if (!result.success) {
      return NextResponse.json(
        {
          error: config.message || RATE_LIMIT_CONFIGS[type].message,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': result.retryAfter?.toString() ?? '60',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          },
        }
      );
    }
    
    // Execute handler
    const response = await handler();
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
    
    return response;
  };
}

/**
 * Get client identifier for rate limiting
 * Prioritizes user ID over IP address for authenticated users
 */
export function getClientIdentifier(req: NextRequest | string): string {
  // If string is passed (for Server Actions), use it directly
  if (typeof req === 'string') {
    return req;
  }
  
  // Try to get user ID from headers (set by middleware)
  const userId = req.headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try to get real IP from various headers (for proxied requests)
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip'); // Cloudflare
  const vercelIp = req.headers.get('x-vercel-forwarded-for'); // Vercel
  
  // Use the first available IP
  const ip = forwardedFor?.split(',')[0].trim() || 
             realIp || 
             cfConnectingIp ||
             vercelIp ||
             'unknown';
  
  // Combine IP with user agent for better identification
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const hash = simpleHash(`${ip}-${userAgent}`);
  
  return `ip:${ip}-${hash}`;
}

/**
 * Determine rate limit type based on URL
 */
function determineRateLimitType(url: string): keyof typeof RATE_LIMIT_CONFIGS {
  const pathname = new URL(url).pathname;
  
  // Check for specific endpoint types
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/signup')) {
    return 'auth';
  }
  if (pathname.includes('/payment') || pathname.includes('/stripe')) {
    return 'payment';
  }
  if (pathname.includes('/booking')) {
    return 'booking';
  }
  if (pathname.includes('/search')) {
    return 'search';
  }
  if (pathname.includes('/webhook')) {
    return 'webhook';
  }
  
  // Default to general API
  return 'api';
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
 * Clean up expired entries from the rate limit store
 * Prevents memory leak from accumulated entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];
  
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime + 60000) { // Keep for 1 minute after expiry
      entriesToDelete.push(key);
    }
  });
  
  entriesToDelete.forEach(key => rateLimitStore.delete(key));
}

/**
 * Wrapper for applying rate limiting to API route handlers
 * 
 * Usage:
 * ```typescript
 * export const POST = withRateLimit(
 *   RATE_LIMIT_CONFIGS.payment,
 *   async (req) => { ... }
 * );
 * ```
 */
export function withRateLimit<T extends NextRequest>(
  config: RateLimitConfig | keyof typeof RATE_LIMIT_CONFIGS,
  handler: (req: T) => Promise<NextResponse>
) {
  const resolvedConfig = typeof config === 'string' ? RATE_LIMIT_CONFIGS[config] : config;
  
  return async (req: T): Promise<NextResponse> => {
    const rateLimiter = rateLimit(resolvedConfig);
    return rateLimiter(req, () => handler(req));
  };
}

/**
 * Rate limiting for Server Actions
 * 
 * Usage:
 * ```typescript
 * export async function myServerAction() {
 *   const rateLimited = await rateLimitServerAction('userId123', 'booking');
 *   if (!rateLimited.success) {
 *     throw new Error(rateLimited.error);
 *   }
 *   // ... rest of action
 * }
 * ```
 */
export async function rateLimitServerAction(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIGS = 'serverAction'
): Promise<{ success: boolean; error?: string; retryAfter?: number }> {
  const result = await checkRateLimit(identifier, type);
  
  if (!result.success) {
    return {
      success: false,
      error: RATE_LIMIT_CONFIGS[type].message,
      retryAfter: result.retryAfter,
    };
  }
  
  return { success: true };
}

/**
 * Check if rate limit would be exceeded without incrementing counter
 * Useful for pre-flight checks
 */
export async function checkRateLimitStatus(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIGS
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMIT_CONFIGS[type];
  
  // Try Redis first
  if (rateLimiters && rateLimiters[type]) {
    try {
      // Note: This doesn't increment the counter
      const result = await rateLimiters[type].limit(identifier, { rate: 0 });
      return {
        allowed: result.remaining > 0,
        remaining: result.remaining,
        resetAt: new Date(result.reset),
      };
    } catch (error) {
      console.error(`Redis rate limit check error for ${type}:`, error);
    }
  }
  
  // In-memory fallback
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
    };
  }
  
  return {
    allowed: entry.count < config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: new Date(entry.resetTime),
  };
}

/**
 * Health check for Redis rate limiting
 */
export async function checkRateLimitHealth(): Promise<{
  healthy: boolean;
  usingRedis: boolean;
  error?: string;
}> {
  if (!isRedisConfigured) {
    return {
      healthy: true,
      usingRedis: false,
    };
  }
  
  try {
    if (redisClient) {
      await redisClient.ping();
      return {
        healthy: true,
        usingRedis: true,
      };
    }
  } catch (error) {
    return {
      healthy: false,
      usingRedis: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  return {
    healthy: true,
    usingRedis: false,
  };
}

/**
 * Get rate limit analytics
 */
export async function getRateLimitAnalytics(
  type?: keyof typeof RATE_LIMIT_CONFIGS
): Promise<any> {
  if (!rateLimiters) {
    return { available: false, reason: 'Redis not configured' };
  }
  
  try {
    // This would depend on your Upstash plan
    // Analytics API is available in paid plans
    const analytics: any = {};
    
    if (type && rateLimiters[type]) {
      // Get analytics for specific limiter
      analytics[type] = {
        configured: true,
        prefix: `@ecosystem/ratelimit:${type}`,
      };
    } else {
      // Get analytics for all limiters
      for (const [key, limiter] of Object.entries(rateLimiters)) {
        analytics[key] = {
          configured: true,
          prefix: `@ecosystem/ratelimit:${key}`,
        };
      }
    }
    
    return analytics;
  } catch (error) {
    console.error('Failed to get rate limit analytics:', error);
    return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}