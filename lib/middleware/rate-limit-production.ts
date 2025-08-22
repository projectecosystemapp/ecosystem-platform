/**
 * Production Rate Limiting Middleware
 * 
 * Enterprise-grade rate limiting with Redis backend and intelligent fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRateLimiter, isRedisConfigured } from '@/lib/services/redis.service';
import { RATE_LIMIT_RULES } from '@/config/redis.config';
import { rateLimit as inMemoryRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export type RateLimitType = keyof typeof RATE_LIMIT_RULES;

interface RateLimitOptions {
  type: RateLimitType;
  identifier?: (req: NextRequest) => string;
  skipAuth?: boolean; // Skip rate limiting for authenticated users
  customMessage?: string;
  onRateLimitExceeded?: (req: NextRequest, identifier: string) => Promise<void>;
}

/**
 * Production rate limiting middleware with Redis backend
 * Automatically falls back to in-memory limiting if Redis is unavailable
 */
export function withRateLimit(options: RateLimitOptions) {
  return async function rateLimitMiddleware<T extends NextRequest>(
    req: T,
    handler: (req: T) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Skip rate limiting for authenticated users if specified
      if (options.skipAuth) {
        const authHeader = req.headers.get('authorization');
        const sessionCookie = req.cookies.get('__session');
        
        if (authHeader || sessionCookie) {
          // User is authenticated, skip rate limiting
          return handler(req);
        }
      }
      
      // Get client identifier
      const identifier = options.identifier 
        ? options.identifier(req)
        : getDefaultIdentifier(req);
      
      // Try Redis rate limiting first
      if (isRedisConfigured()) {
        const rateLimiter = getRateLimiter(options.type);
        
        if (rateLimiter) {
          try {
            const { success, limit, reset, remaining } = await rateLimiter.limit(identifier);
            
            if (!success) {
              // Rate limit exceeded
              if (options.onRateLimitExceeded) {
                await options.onRateLimitExceeded(req, identifier);
              }
              
              const retryAfter = Math.ceil((reset - Date.now()) / 1000);
              
              return createRateLimitResponse({
                message: options.customMessage || RATE_LIMIT_RULES[options.type].prefix,
                retryAfter,
                limit,
                remaining,
                reset,
              });
            }
            
            // Add rate limit headers to successful response
            const response = await handler(req);
            addRateLimitHeaders(response, { limit, remaining, reset });
            
            return response;
          } catch (redisError) {
            // Redis error, fall back to in-memory
            console.error('Redis rate limit error, falling back to in-memory:', redisError);
            return fallbackToInMemory(req, handler, options);
          }
        }
      }
      
      // No Redis configured or available, use in-memory fallback
      return fallbackToInMemory(req, handler, options);
      
    } catch (error) {
      // Unexpected error, log and continue
      console.error('Rate limit middleware error:', error);
      
      // In production, we should still try to handle the request
      if (process.env.NODE_ENV === 'production') {
        return handler(req);
      }
      
      // In development, throw the error for debugging
      throw error;
    }
  };
}

/**
 * Fallback to in-memory rate limiting
 */
async function fallbackToInMemory<T extends NextRequest>(
  req: T,
  handler: (req: T) => Promise<NextResponse>,
  options: RateLimitOptions
): Promise<NextResponse> {
  // Log warning in production
  if (process.env.NODE_ENV === 'production') {
    console.warn(`Using in-memory rate limiting for ${options.type} - Redis not available`);
  }
  
  // Map to legacy config format
  const legacyConfig = RATE_LIMIT_CONFIGS[options.type] || {
    requests: 100,
    window: 60000, // 1 minute default
    message: 'Too many requests',
  };
  
  const inMemoryLimiter = inMemoryRateLimit(legacyConfig);
  return inMemoryLimiter(req, () => handler(req));
}

/**
 * Get default client identifier
 */
function getDefaultIdentifier(req: NextRequest): string {
  // Priority order for identifying clients
  const identifiers = [
    // 1. User ID from auth (if available)
    req.headers.get('x-user-id'),
    
    // 2. Session ID
    req.cookies.get('sessionId')?.value,
    
    // 3. API key
    req.headers.get('x-api-key'),
    
    // 4. IP address (with proxy support)
    req.headers.get('x-forwarded-for')?.split(',')[0].trim(),
    req.headers.get('x-real-ip'),
    req.headers.get('cf-connecting-ip'), // Cloudflare
    req.ip,
  ].filter(Boolean);
  
  // Use first available identifier
  const primary = identifiers[0] || 'anonymous';
  
  // Add user agent hash for better uniqueness
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const hash = simpleHash(userAgent);
  
  return `${primary}-${hash}`;
}

/**
 * Simple hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(options: {
  message: string;
  retryAfter: number;
  limit: number;
  remaining: number;
  reset: number;
}): NextResponse {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: options.message,
      retryAfter: options.retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': options.retryAfter.toString(),
        'X-RateLimit-Limit': options.limit.toString(),
        'X-RateLimit-Remaining': options.remaining.toString(),
        'X-RateLimit-Reset': new Date(options.reset).toISOString(),
      },
    }
  );
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(
  response: NextResponse,
  options: {
    limit: number;
    remaining: number;
    reset: number;
  }
): void {
  response.headers.set('X-RateLimit-Limit', options.limit.toString());
  response.headers.set('X-RateLimit-Remaining', options.remaining.toString());
  response.headers.set('X-RateLimit-Reset', new Date(options.reset).toISOString());
}

/**
 * Rate limit decorator for API routes
 */
export function rateLimited(type: RateLimitType, options?: Partial<RateLimitOptions>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (req: NextRequest, ...args: any[]) {
      const middleware = withRateLimit({ type, ...options });
      return middleware(req, async (req) => {
        return originalMethod.call(this, req, ...args);
      });
    };
    
    return descriptor;
  };
}

/**
 * Express-style rate limit middleware for API routes
 */
export function createRateLimitMiddleware(type: RateLimitType, options?: Partial<RateLimitOptions>) {
  const middleware = withRateLimit({ type, ...options });
  
  return async function (req: NextRequest, res: any, next?: () => void) {
    const result = await middleware(req, async (req) => {
      if (next) {
        next();
        return NextResponse.next();
      }
      return NextResponse.next();
    });
    
    if (result.status === 429) {
      // Rate limit exceeded
      return result;
    }
    
    // Continue to next middleware
    if (next) next();
    return result;
  };
}