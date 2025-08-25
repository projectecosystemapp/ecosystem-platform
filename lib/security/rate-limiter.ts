import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

const defaultConfigs: Record<string, RateLimitConfig> = {
  mapbox: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
    message: 'Too many geocoding requests. Please wait before trying again.',
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many API requests. Please wait before trying again.',
  },
  search: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50, // 50 requests per minute
    message: 'Too many search requests. Please wait before trying again.',
  },
};

// Simple in-memory store for rate limiting
// In production, use Redis or similar persistent storage
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  request: NextRequest,
  configKey: keyof typeof defaultConfigs = 'api'
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  const config = defaultConfigs[configKey];
  const identifier = getClientIdentifier(request);
  const now = Date.now();
  
  // Clean up expired entries
  cleanupExpiredEntries(now);
  
  const key = `${configKey}:${identifier}`;
  const current = requestCounts.get(key);
  
  if (!current || now > current.resetTime) {
    // First request or window has reset
    requestCounts.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      success: true,
      remaining: config.maxRequests - 1,
    };
  }
  
  if (current.count >= config.maxRequests) {
    return {
      success: false,
      error: config.message,
      remaining: 0,
    };
  }
  
  // Increment count
  current.count += 1;
  requestCounts.set(key, current);
  
  return {
    success: true,
    remaining: config.maxRequests - current.count,
  };
}

function getClientIdentifier(request: NextRequest): string {
  // Use IP address as primary identifier
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             request.ip || 
             'unknown';
  
  // In production, you might also consider user ID if authenticated
  return ip;
}

function cleanupExpiredEntries(now: number): void {
  // Clean up every 5 minutes to prevent memory leaks
  const CLEANUP_INTERVAL = 5 * 60 * 1000;
  
  if (!cleanupExpiredEntries.lastCleanup || 
      now - cleanupExpiredEntries.lastCleanup > CLEANUP_INTERVAL) {
    
    for (const [key, data] of requestCounts.entries()) {
      if (now > data.resetTime) {
        requestCounts.delete(key);
      }
    }
    
    cleanupExpiredEntries.lastCleanup = now;
  }
}

// Add static property to function for cleanup tracking
declare namespace cleanupExpiredEntries {
  let lastCleanup: number;
}

export function getRateLimitHeaders(
  result: Awaited<ReturnType<typeof rateLimit>>,
  config: RateLimitConfig
): Record<string, string> {
  return {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': (result.remaining || 0).toString(),
    'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
  };
}