/**
 * Redis Configuration for Production
 * 
 * This configuration file provides comprehensive Redis setup for:
 * - Rate limiting (via Upstash)
 * - Session caching
 * - Query result caching
 * - Real-time feature flags
 * - Analytics aggregation
 */

export interface RedisConfig {
  url: string;
  token: string;
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  commandTimeout: number;
  enableOfflineQueue: boolean;
  enableReadyCheck: boolean;
}

// Production Redis configurations
export const REDIS_CONFIGS = {
  // Primary Redis for rate limiting (Upstash)
  rateLimit: {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    maxRetries: 3,
    retryDelay: 100, // ms
    connectionTimeout: 5000, // ms
    commandTimeout: 1000, // ms
    enableOfflineQueue: false, // Don't queue when offline in production
    enableReadyCheck: true,
  },
  
  // Cache Redis (can be same or different instance)
  cache: {
    url: process.env.REDIS_CACHE_URL || process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.REDIS_CACHE_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
    maxRetries: 2,
    retryDelay: 50,
    connectionTimeout: 3000,
    commandTimeout: 500,
    enableOfflineQueue: true, // Allow queuing for cache
    enableReadyCheck: true,
  },
  
  // Session Redis
  session: {
    url: process.env.REDIS_SESSION_URL || process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.REDIS_SESSION_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
    maxRetries: 3,
    retryDelay: 100,
    connectionTimeout: 5000,
    commandTimeout: 1000,
    enableOfflineQueue: false,
    enableReadyCheck: true,
  },
} as const;

// Rate limiting configurations by endpoint type
export const RATE_LIMIT_RULES = {
  // Payment endpoints - strict limits
  payment: {
    requests: 10,
    window: '1 m', // 1 minute
    blockDuration: '5 m', // Block for 5 minutes after limit
    analytics: true,
    prefix: '@ecosystem/ratelimit:payment',
  },
  
  // Stripe webhooks - higher limits for burst traffic
  webhook: {
    requests: 10,
    window: '1 s', // 1 second
    blockDuration: '1 m',
    analytics: true,
    prefix: '@ecosystem/ratelimit:webhook',
  },
  
  // General API endpoints
  api: {
    requests: 100,
    window: '1 m',
    blockDuration: '1 m',
    analytics: true,
    prefix: '@ecosystem/ratelimit:api',
  },
  
  // Authentication endpoints - prevent brute force
  auth: {
    requests: 5,
    window: '15 m', // 15 minutes
    blockDuration: '30 m', // Block for 30 minutes
    analytics: true,
    prefix: '@ecosystem/ratelimit:auth',
  },
  
  // Search endpoints - moderate limits
  search: {
    requests: 30,
    window: '1 m',
    blockDuration: '2 m',
    analytics: true,
    prefix: '@ecosystem/ratelimit:search',
  },
  
  // Booking creation - prevent spam
  booking: {
    requests: 5,
    window: '5 m', // 5 bookings per 5 minutes
    blockDuration: '10 m',
    analytics: true,
    prefix: '@ecosystem/ratelimit:booking',
  },
  
  // Provider profile updates
  profileUpdate: {
    requests: 10,
    window: '10 m',
    blockDuration: '5 m',
    analytics: true,
    prefix: '@ecosystem/ratelimit:profile',
  },
  
  // Guest checkout - slightly stricter
  guestCheckout: {
    requests: 3,
    window: '5 m', // 3 guest checkouts per 5 minutes
    blockDuration: '15 m',
    analytics: true,
    prefix: '@ecosystem/ratelimit:guest',
  },
} as const;

// Cache TTL configurations (in seconds)
export const CACHE_TTL = {
  // Provider data
  providerProfile: 300, // 5 minutes
  providerList: 60, // 1 minute
  providerAvailability: 120, // 2 minutes
  
  // Search results
  searchResults: 30, // 30 seconds
  
  // Static data
  categories: 3600, // 1 hour
  services: 1800, // 30 minutes
  
  // User session data
  userSession: 900, // 15 minutes
  guestSession: 300, // 5 minutes
  
  // Analytics
  dashboardMetrics: 60, // 1 minute
  providerStats: 300, // 5 minutes
} as const;

// Redis key patterns for different data types
export const REDIS_KEYS = {
  // Rate limiting
  rateLimit: (type: string, identifier: string) => 
    `ratelimit:${type}:${identifier}`,
  
  // Cache keys
  provider: (id: string) => `cache:provider:${id}`,
  providerList: (filters: string) => `cache:providers:${filters}`,
  search: (query: string) => `cache:search:${query}`,
  availability: (providerId: string, date: string) => 
    `cache:availability:${providerId}:${date}`,
  
  // Session keys
  session: (sessionId: string) => `session:${sessionId}`,
  guestSession: (guestId: string) => `guest:${guestId}`,
  
  // Analytics keys
  metrics: (date: string) => `metrics:${date}`,
  providerStats: (providerId: string) => `stats:provider:${providerId}`,
  
  // Feature flags
  featureFlag: (flag: string) => `feature:${flag}`,
  
  // Locks (for distributed locking)
  lock: (resource: string) => `lock:${resource}`,
} as const;

// Health check configuration
export const HEALTH_CHECK_CONFIG = {
  interval: 30000, // Check every 30 seconds
  timeout: 5000, // 5 second timeout for health check
  retries: 3,
  alertThreshold: 5, // Alert after 5 consecutive failures
};

// Monitoring metrics to track
export const REDIS_METRICS = [
  'connected_clients',
  'used_memory',
  'used_memory_peak',
  'total_connections_received',
  'total_commands_processed',
  'instantaneous_ops_per_sec',
  'keyspace_hits',
  'keyspace_misses',
  'evicted_keys',
  'expired_keys',
] as const;

// Environment validation
export function validateRedisConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required environment variables
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    errors.push('UPSTASH_REDIS_REST_URL is not configured');
  }
  
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is not configured');
  }
  
  // Check optional but recommended variables
  if (!process.env.REDIS_CACHE_URL) {
    warnings.push('REDIS_CACHE_URL not set - using primary Redis for caching');
  }
  
  if (!process.env.REDIS_SESSION_URL) {
    warnings.push('REDIS_SESSION_URL not set - using primary Redis for sessions');
  }
  
  // Validate URL format
  if (process.env.UPSTASH_REDIS_REST_URL && 
      !process.env.UPSTASH_REDIS_REST_URL.startsWith('https://')) {
    errors.push('UPSTASH_REDIS_REST_URL must use HTTPS');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Export helper to check if Redis is properly configured
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

// Export helper to get appropriate fallback message
export function getRedisStatusMessage(): string {
  if (isRedisConfigured()) {
    return 'Redis configured and ready for production';
  }
  
  if (process.env.NODE_ENV === 'production') {
    return '⚠️ WARNING: Redis not configured in production - using in-memory fallback (not recommended)';
  }
  
  return 'Redis not configured - using in-memory rate limiting for development';
}