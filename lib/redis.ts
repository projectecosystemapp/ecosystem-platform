/**
 * Redis Configuration with Graceful Fallback
 * 
 * Provides Redis caching capabilities with automatic fallback to in-memory storage
 * when Redis is not available. This ensures the application works in all environments.
 */

import { Redis } from '@upstash/redis';

// Check if we have Redis configured
const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && 
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Create Redis client or null
export const redis = hasRedis ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
}) : null;

// Helper to check if Redis is available
export const isRedisAvailable = () => hasRedis;

// Fallback in-memory cache for development/environments without Redis
const memoryCache = new Map<string, { value: any; expires?: number }>();

// Clean up expired entries periodically
if (!hasRedis) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expires && entry.expires < now) {
        memoryCache.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// Wrapper functions that work with or without Redis
export const cacheGet = async (key: string) => {
  if (redis) {
    try {
      return await redis.get(key);
    } catch (error) {
      console.warn('Redis get failed, falling back to memory cache:', error);
      const entry = memoryCache.get(key);
      return entry?.value;
    }
  }
  
  const entry = memoryCache.get(key);
  if (entry && (!entry.expires || entry.expires > Date.now())) {
    return entry.value;
  }
  
  if (entry?.expires && entry.expires <= Date.now()) {
    memoryCache.delete(key);
  }
  
  return null;
};

export const cacheSet = async (key: string, value: any, ex?: number) => {
  if (redis) {
    try {
      return await redis.set(key, value, ex ? { ex } : undefined);
    } catch (error) {
      console.warn('Redis set failed, falling back to memory cache:', error);
      // Fall through to memory cache
    }
  }
  
  const expires = ex ? Date.now() + (ex * 1000) : undefined;
  memoryCache.set(key, { value, expires });
  return 'OK';
};

export const cacheDel = async (key: string) => {
  if (redis) {
    try {
      return await redis.del(key);
    } catch (error) {
      console.warn('Redis del failed, falling back to memory cache:', error);
      // Fall through to memory cache
    }
  }
  
  const deleted = memoryCache.delete(key);
  return deleted ? 1 : 0;
};

export const cacheExists = async (key: string) => {
  if (redis) {
    try {
      return await redis.exists(key);
    } catch (error) {
      console.warn('Redis exists failed, falling back to memory cache:', error);
      // Fall through to memory cache
    }
  }
  
  const entry = memoryCache.get(key);
  if (!entry) return 0;
  
  if (entry.expires && entry.expires <= Date.now()) {
    memoryCache.delete(key);
    return 0;
  }
  
  return 1;
};

export const cacheIncr = async (key: string) => {
  if (redis) {
    try {
      return await redis.incr(key);
    } catch (error) {
      console.warn('Redis incr failed, falling back to memory cache:', error);
      // Fall through to memory cache
    }
  }
  
  const entry = memoryCache.get(key);
  const currentValue = entry?.value || 0;
  const newValue = (typeof currentValue === 'number' ? currentValue : 0) + 1;
  
  memoryCache.set(key, { value: newValue, expires: entry?.expires });
  return newValue;
};

export const cacheExpire = async (key: string, seconds: number) => {
  if (redis) {
    try {
      return await redis.expire(key, seconds);
    } catch (error) {
      console.warn('Redis expire failed, falling back to memory cache:', error);
      // Fall through to memory cache
    }
  }
  
  const entry = memoryCache.get(key);
  if (!entry) return 0;
  
  entry.expires = Date.now() + (seconds * 1000);
  memoryCache.set(key, entry);
  return 1;
};

// Utility for rate limiting
export const rateLimit = async (
  identifier: string, 
  limit: number, 
  windowSeconds: number
): Promise<{ success: boolean; count: number; resetTime: number }> => {
  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const window = windowSeconds * 1000;
  const resetTime = Math.ceil(now / window) * window;
  
  try {
    if (redis) {
      // Use Redis for distributed rate limiting
      const multi = redis.multi();
      const currentWindow = Math.floor(now / window);
      const windowKey = `${key}:${currentWindow}`;
      
      multi.incr(windowKey);
      multi.expire(windowKey, windowSeconds);
      
      const results = await multi.exec();
      const count = results[0] as number;
      
      return {
        success: count <= limit,
        count,
        resetTime
      };
    }
  } catch (error) {
    console.warn('Redis rate limit failed, falling back to memory cache:', error);
  }
  
  // Memory-based rate limiting (single instance only)
  const entry = memoryCache.get(key);
  const currentWindow = Math.floor(now / window);
  
  if (!entry || entry.value.window !== currentWindow) {
    memoryCache.set(key, {
      value: { window: currentWindow, count: 1 },
      expires: resetTime
    });
    return { success: true, count: 1, resetTime };
  }
  
  entry.value.count += 1;
  memoryCache.set(key, entry);
  
  return {
    success: entry.value.count <= limit,
    count: entry.value.count,
    resetTime
  };
};

// Debugging helpers
export const getCacheStats = () => {
  return {
    hasRedis,
    memoryCacheSize: memoryCache.size,
    environment: process.env.NODE_ENV
  };
};

// Create rate limiter compatible with @upstash/ratelimit API
export const ratelimit = {
  limit: async (identifier: string) => {
    const result = await rateLimit(identifier, 10, 60); // 10 requests per minute default
    return { success: result.success };
  }
};

// Log Redis availability
if (process.env.NODE_ENV !== 'test') {
  console.log(`Redis cache: ${hasRedis ? 'enabled' : 'disabled (using memory fallback)'}`);
}