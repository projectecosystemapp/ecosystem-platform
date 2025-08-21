import { NextRequest, NextResponse } from "next/server";

// Simple in-memory store for rate limiting
// In production, use Redis or similar persistent store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  message?: string;  // Custom error message
}

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  payment: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Too many payment requests. Please wait before trying again."
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: "Too many requests. Please slow down."
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: "Too many authentication attempts. Please try again later."
  },
  webhook: {
    windowMs: 1000, // 1 second
    maxRequests: 10,
    message: "Webhook rate limit exceeded."
  }
} as const;

/**
 * Rate limiting middleware for API routes
 * @param config - Rate limit configuration
 * @returns Middleware function that enforces rate limits
 */
export function rateLimit(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    req: NextRequest,
    handler: () => Promise<NextResponse>
  ): Promise<NextResponse> {
    // Get client identifier (IP address or user ID)
    const identifier = getClientIdentifier(req);
    const now = Date.now();
    
    // Get or create rate limit entry
    const rateLimitEntry = rateLimitStore.get(identifier);
    
    if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
      // Create new entry or reset expired one
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs
      });
      
      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance
        cleanupExpiredEntries();
      }
      
      // Add rate limit headers to response
      const response = await handler();
      response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', (config.maxRequests - 1).toString());
      response.headers.set('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());
      
      return response;
    }
    
    // Check if rate limit exceeded
    if (rateLimitEntry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((rateLimitEntry.resetTime - now) / 1000);
      
      return NextResponse.json(
        { 
          error: config.message || "Rate limit exceeded",
          retryAfter 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitEntry.resetTime).toISOString()
          }
        }
      );
    }
    
    // Increment counter
    rateLimitEntry.count++;
    rateLimitStore.set(identifier, rateLimitEntry);
    
    // Add rate limit headers to response
    const response = await handler();
    response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', (config.maxRequests - rateLimitEntry.count).toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitEntry.resetTime).toISOString());
    
    return response;
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
 * Usage:
 * export const POST = withRateLimit(
 *   RATE_LIMIT_CONFIGS.payment,
 *   async (req) => { ... }
 * );
 */
export function withRateLimit<T extends NextRequest>(
  config: RateLimitConfig,
  handler: (req: T) => Promise<NextResponse>
) {
  return async (req: T): Promise<NextResponse> => {
    const rateLimiter = rateLimit(config);
    return rateLimiter(req, () => handler(req));
  };
}

/**
 * Check if rate limit would be exceeded without incrementing counter
 * Useful for pre-flight checks
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || now > entry.resetTime) {
    return true; // Would be allowed
  }
  
  return entry.count < config.maxRequests;
}