/**
 * Enhanced Rate Limiting Configuration
 * 
 * Provides advanced rate limiting with Upstash Redis
 * Falls back to in-memory rate limiting if Upstash Redis is unavailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createUpstashRateLimiter, 
  isUpstashConfigured,
  UpstashRateLimiter 
} from './upstash-redis';

// In-memory rate limit store for fallback
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimitConfigs = {
  // API endpoints
  api: {
    default: { requests: 100, window: '1m' },
    search: { requests: 30, window: '1m' },
    booking: { requests: 10, window: '1m' },
    payment: { requests: 5, window: '1m' },
    auth: { requests: 5, window: '15m' },
  },
  // Page routes
  pages: {
    default: { requests: 60, window: '1m' },
    dashboard: { requests: 30, window: '1m' },
  },
} as const;

// Pre-configured Upstash rate limiters for different endpoints
export const upstashRateLimiters = {
  // API endpoints
  api: createUpstashRateLimiter({
    tokensPerInterval: 100,
    intervalMs: 60 * 1000, // 1 minute
    namespace: 'api',
  }),
  
  search: createUpstashRateLimiter({
    tokensPerInterval: 30,
    intervalMs: 60 * 1000, // 1 minute
    namespace: 'search',
  }),
  
  booking: createUpstashRateLimiter({
    tokensPerInterval: 10,
    intervalMs: 60 * 1000, // 1 minute
    namespace: 'booking',
  }),
  
  payment: createUpstashRateLimiter({
    tokensPerInterval: 5,
    intervalMs: 60 * 1000, // 1 minute
    namespace: 'payment',
  }),
  
  auth: createUpstashRateLimiter({
    tokensPerInterval: 5,
    intervalMs: 15 * 60 * 1000, // 15 minutes
    namespace: 'auth',
  }),
  
  // Page routes
  pages: createUpstashRateLimiter({
    tokensPerInterval: 60,
    intervalMs: 60 * 1000, // 1 minute
    namespace: 'pages',
  }),
  
  dashboard: createUpstashRateLimiter({
    tokensPerInterval: 30,
    intervalMs: 60 * 1000, // 1 minute
    namespace: 'dashboard',
  }),
  
  // Webhooks
  webhook: createUpstashRateLimiter({
    tokensPerInterval: 100,
    intervalMs: 1000, // 1 second
    namespace: 'webhook',
  }),
};

// Log Upstash configuration status
if (isUpstashConfigured()) {
  console.log('✅ Upstash Redis rate limiting configured');
} else {
  console.warn('⚠️ Upstash Redis not configured, using in-memory rate limiting fallback');
}

/**
 * In-memory rate limit fallback
 */
function inMemoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const record = inMemoryStore.get(identifier);

  // Clean up old entries periodically
  if (inMemoryStore.size > 10000) {
    for (const [key, value] of inMemoryStore.entries()) {
      if (value.resetTime < now) {
        inMemoryStore.delete(key);
      }
    }
  }

  if (!record || record.resetTime < now) {
    // Start new window
    inMemoryStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (record.count >= limit) {
    // Rate limit exceeded
    return { success: false, remaining: 0, reset: record.resetTime };
  }

  // Increment counter
  record.count++;
  return { success: true, remaining: limit - record.count, reset: record.resetTime };
}

/**
 * Get identifier for rate limiting
 */
export function getRateLimitIdentifier(request: NextRequest): string {
  // Try to get user ID from various sources
  const userId = request.headers.get('x-user-id');
  if (userId) return `user:${userId}`;

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

/**
 * Parse window string to milliseconds
 */
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);

  const [, value, unit] = match;
  const num = parseInt(value, 10);

  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: throw new Error(`Invalid window unit: ${unit}`);
  }
}

/**
 * Apply rate limiting to a request
 */
export async function rateLimit(
  request: NextRequest,
  config: { requests: number; window: string }
): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
  headers: Headers;
}> {
  const identifier = getRateLimitIdentifier(request);
  const headers = new Headers();

  try {
    if (isUpstashConfigured()) {
      // Use Upstash Redis rate limiting
      // Select appropriate rate limiter based on endpoint
      let limiter = upstashRateLimiters.api; // Default
      const pathname = request.nextUrl.pathname;
      
      if (pathname.includes('/search')) {
        limiter = upstashRateLimiters.search;
      } else if (pathname.includes('/payment') || pathname.includes('/stripe')) {
        limiter = upstashRateLimiters.payment;
      } else if (pathname.includes('/auth') || pathname.includes('/login')) {
        limiter = upstashRateLimiters.auth;
      } else if (pathname.includes('/webhook')) {
        limiter = upstashRateLimiters.webhook;
      } else if (pathname.includes('/booking')) {
        limiter = upstashRateLimiters.booking;
      } else if (pathname.includes('/dashboard')) {
        limiter = upstashRateLimiters.dashboard;
      } else if (!pathname.startsWith('/api/')) {
        // Page routes
        limiter = upstashRateLimiters.pages;
      }
      
      const result = await limiter.limit(identifier);
      
      headers.set('X-RateLimit-Limit', result.limit.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
      
      if (!result.success) {
        headers.set('Retry-After', Math.floor((result.reset - Date.now()) / 1000).toString());
      }

      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
        headers,
      };
    } else {
      // Use in-memory fallback
      const windowMs = parseWindow(config.window);
      const result = inMemoryRateLimit(identifier, config.requests, windowMs);
      
      headers.set('X-RateLimit-Limit', config.requests.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString());
      
      if (!result.success) {
        headers.set('Retry-After', Math.floor((result.reset - Date.now()) / 1000).toString());
      }

      return {
        success: result.success,
        remaining: result.remaining,
        reset: result.reset,
        headers,
      };
    }
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the request but log it
    return {
      success: true,
      remaining: config.requests,
      reset: Date.now() + parseWindow(config.window),
      headers,
    };
  }
}

/**
 * Get rate limit config for a specific path
 */
export function getRateLimitConfig(pathname: string): { requests: number; window: string } {
  // API routes
  if (pathname.startsWith('/api/')) {
    if (pathname.includes('/search')) return rateLimitConfigs.api.search;
    if (pathname.includes('/booking')) return rateLimitConfigs.api.booking;
    if (pathname.includes('/payment') || pathname.includes('/stripe')) return rateLimitConfigs.api.payment;
    if (pathname.includes('/auth') || pathname.includes('/user')) return rateLimitConfigs.api.auth;
    return rateLimitConfigs.api.default;
  }
  
  // Page routes
  if (pathname.startsWith('/dashboard')) return rateLimitConfigs.pages.dashboard;
  return rateLimitConfigs.pages.default;
}

/**
 * Rate limit middleware for API routes
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const config = getRateLimitConfig(request.nextUrl.pathname);
  const { success, headers } = await rateLimit(request, config);

  if (!success) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers }
    );
  }

  const response = await handler();
  
  // Add rate limit headers to response
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}