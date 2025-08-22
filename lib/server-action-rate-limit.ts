/**
 * Server Action Rate Limiting Utilities
 * 
 * Provides rate limiting for Next.js Server Actions
 * with proper error handling and user feedback
 */

import { auth } from "@clerk/nextjs/server";
import { rateLimitServerAction, RATE_LIMIT_CONFIGS } from "./rate-limit";

/**
 * Rate limit error class for consistent error handling
 */
export class RateLimitError extends Error {
  public retryAfter: number;
  
  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Get rate limit identifier for current user
 */
async function getRateLimitIdentifier(): Promise<string> {
  const { userId } = await auth();
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // For unauthenticated users, we need to use a different identifier
  // In Server Actions, we don't have access to request headers
  // So we use a generic identifier (not ideal, but necessary)
  return `anonymous:server-action`;
}

/**
 * Apply rate limiting to a Server Action
 * 
 * Usage:
 * ```typescript
 * export async function createBooking(data: BookingData) {
 *   await enforceRateLimit('booking');
 *   // ... rest of action
 * }
 * ```
 */
export async function enforceRateLimit(
  type: keyof typeof RATE_LIMIT_CONFIGS = 'serverAction',
  customIdentifier?: string
): Promise<void> {
  const identifier = customIdentifier ?? await getRateLimitIdentifier();
  const result = await rateLimitServerAction(identifier, type);
  
  if (!result.success) {
    throw new RateLimitError(
      result.error || "Too many requests. Please slow down.",
      result.retryAfter || 60
    );
  }
}

/**
 * Check rate limit status without incrementing counter
 * Useful for showing warnings before hitting the limit
 */
export async function checkRateLimit(
  type: keyof typeof RATE_LIMIT_CONFIGS = 'serverAction',
  customIdentifier?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const { checkRateLimitStatus } = await import("./rate-limit");
  const identifier = customIdentifier ?? await getRateLimitIdentifier();
  return checkRateLimitStatus(identifier, type);
}

/**
 * Decorator for Server Actions with rate limiting
 * 
 * Usage:
 * ```typescript
 * export const createBooking = withRateLimitAction(
 *   'booking',
 *   async (data: BookingData) => {
 *     // ... action implementation
 *   }
 * );
 * ```
 */
export function withRateLimitAction<T extends any[], R>(
  type: keyof typeof RATE_LIMIT_CONFIGS,
  action: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    await enforceRateLimit(type);
    return action(...args);
  };
}

/**
 * Rate limit with custom identifier (e.g., based on action parameters)
 * 
 * Usage:
 * ```typescript
 * export async function searchProviders(query: string) {
 *   // Rate limit based on query to prevent abuse
 *   await enforceRateLimitWithKey(`search:${query}`, 'search');
 *   // ... rest of action
 * }
 * ```
 */
export async function enforceRateLimitWithKey(
  key: string,
  type: keyof typeof RATE_LIMIT_CONFIGS = 'serverAction'
): Promise<void> {
  const result = await rateLimitServerAction(key, type);
  
  if (!result.success) {
    throw new RateLimitError(
      result.error || "Too many requests. Please slow down.",
      result.retryAfter || 60
    );
  }
}

/**
 * Helper to format retry after message
 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Example error handler for rate limit errors
 */
export function handleRateLimitError(error: unknown): {
  error: string;
  retryAfter?: string;
} {
  if (error instanceof RateLimitError) {
    return {
      error: error.message,
      retryAfter: formatRetryAfter(error.retryAfter),
    };
  }
  
  // Handle other errors
  return {
    error: error instanceof Error ? error.message : "An error occurred",
  };
}