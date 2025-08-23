/**
 * Rate Limiting Middleware Configuration
 * 
 * Centralized rate limiting middleware for API routes with specialized
 * configurations for different endpoint types and user categories.
 * 
 * @see /lib/rate-limit.ts for core rate limiting infrastructure
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  withRateLimit, 
  getClientIdentifier,
  checkRateLimitStatus,
  rateLimitServerAction,
  RATE_LIMIT_CONFIGS
} from "@/lib/rate-limit";

/**
 * Enhanced rate limit configurations for specific endpoint categories
 */
export const ENHANCED_RATE_LIMITS = {
  // Strict limits for guest users (3 requests per minute)
  guestEndpoint: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 3,
    message: "Too many requests from guest users. Please sign up for higher limits."
  },
  
  // Very strict for payment creation (5 per minute)
  paymentCreation: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: "Too many payment attempts. Please wait before trying again."
  },
  
  // Booking endpoints for authenticated users
  authenticatedBooking: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: "Too many booking requests. Please slow down."
  },
  
  // Stripe webhooks (100 per minute from verified Stripe IPs)
  stripeWebhook: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: "Webhook rate limit exceeded.",
    skipSuccessfulRequests: true // Only count failures
  },
  
  // Search and listing endpoints
  searchEndpoint: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: "Too many search requests. Please slow down."
  },
  
  // Provider profile updates
  profileUpdate: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: "Too many profile update requests. Please slow down."
  },
  
  // Image upload endpoints
  imageUpload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: "Too many image upload requests. Please wait before uploading more."
  },
  
  // Analytics and reporting
  analytics: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    message: "Too many analytics requests. Please slow down."
  }
} as const;

/**
 * Middleware to apply rate limiting based on user authentication status
 * Applies stricter limits to guest users
 */
export function createGuestAwareRateLimit(
  authenticatedConfig: keyof typeof RATE_LIMIT_CONFIGS | typeof ENHANCED_RATE_LIMITS[keyof typeof ENHANCED_RATE_LIMITS],
  guestConfig: typeof ENHANCED_RATE_LIMITS.guestEndpoint = ENHANCED_RATE_LIMITS.guestEndpoint
) {
  return async (req: NextRequest, handler: () => Promise<NextResponse>) => {
    // Check if user is authenticated (you might need to adjust this based on your auth setup)
    const isAuthenticated = req.headers.get('x-user-id') !== null || 
                          req.cookies.get('__session')?.value !== undefined;
    
    // Apply appropriate rate limit based on authentication status
    const config = isAuthenticated ? authenticatedConfig : guestConfig;
    const rateLimiter = typeof config === 'string' 
      ? withRateLimit(config, handler)
      : withRateLimit(config as any, handler);
    
    return rateLimiter(req);
  };
}

/**
 * Middleware for Stripe webhook endpoints with IP verification
 */
export function createStripeWebhookRateLimit() {
  return async (req: NextRequest, handler: () => Promise<NextResponse>) => {
    // Stripe webhook IPs (you should verify these are current)
    const stripeIPs = [
      '3.18.12.63',
      '3.130.192.231',
      '13.235.14.237',
      '13.235.122.149',
      '18.211.135.69',
      '35.154.171.200',
      '52.15.183.38',
      '54.88.130.119',
      '54.88.130.237',
      '54.187.174.169',
      '54.187.205.235',
      '54.187.216.72'
    ];
    
    // Get client IP
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0].trim() || realIp || 'unknown';
    
    // Check if IP is from Stripe
    const isStripeIP = stripeIPs.includes(clientIp);
    
    if (!isStripeIP) {
      console.warn(`Webhook request from non-Stripe IP: ${clientIp}`);
      // Apply stricter rate limiting for non-Stripe IPs
      return withRateLimit({
        windowMs: 60 * 1000,
        maxRequests: 5,
        message: "Unauthorized webhook source"
      } as any, handler)(req);
    }
    
    // Apply normal webhook rate limiting for Stripe IPs
    return withRateLimit('webhook', handler)(req);
  };
}

/**
 * Helper to check if a user/IP is currently rate limited
 * Useful for pre-flight checks in UI
 */
export async function isRateLimited(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIGS
): Promise<boolean> {
  const status = await checkRateLimitStatus(identifier, type);
  return !status.allowed;
}

/**
 * Helper to get remaining requests for a user/IP
 */
export async function getRemainingRequests(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIGS
): Promise<{ remaining: number; resetAt: Date }> {
  const status = await checkRateLimitStatus(identifier, type);
  return {
    remaining: status.remaining,
    resetAt: status.resetAt
  };
}

/**
 * Apply rate limiting to Server Actions
 * 
 * Usage in Server Actions:
 * ```typescript
 * import { applyServerActionRateLimit } from '@/lib/middleware/rate-limit-middleware';
 * 
 * export async function myServerAction() {
 *   const rateLimited = await applyServerActionRateLimit(userId, 'booking');
 *   if (!rateLimited.success) {
 *     throw new Error(rateLimited.error);
 *   }
 *   // ... rest of action
 * }
 * ```
 */
export async function applyServerActionRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMIT_CONFIGS = 'serverAction'
) {
  return rateLimitServerAction(identifier, type);
}

/**
 * Rate limit response helper
 * Generates consistent rate limit error responses
 */
export function rateLimitErrorResponse(
  message: string = "Too many requests",
  retryAfter: number = 60
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      retryAfter,
      timestamp: new Date().toISOString()
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString(),
      }
    }
  );
}

/**
 * Monitoring helper for rate limit violations
 * Logs violations for security monitoring
 */
export function logRateLimitViolation(
  identifier: string,
  endpoint: string,
  metadata?: Record<string, any>
) {
  const violation = {
    timestamp: new Date().toISOString(),
    identifier,
    endpoint,
    ...metadata
  };
  
  // Log to console (in production, send to monitoring service)
  console.warn('[RATE_LIMIT_VIOLATION]', JSON.stringify(violation));
  
  // TODO: Send to monitoring service (e.g., Sentry, DataDog, etc.)
  // Example:
  // Sentry.captureMessage('Rate limit violation', {
  //   level: 'warning',
  //   tags: { endpoint },
  //   extra: violation
  // });
}

export default {
  withRateLimit,
  createGuestAwareRateLimit,
  createStripeWebhookRateLimit,
  isRateLimited,
  getRemainingRequests,
  applyServerActionRateLimit,
  rateLimitErrorResponse,
  logRateLimitViolation,
  ENHANCED_RATE_LIMITS
};