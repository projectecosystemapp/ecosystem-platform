/**
 * Redis Cloud Client Configuration
 * 
 * Native Redis protocol connection using ioredis for optimal performance.
 * This replaces the REST-based Upstash connection with a direct Redis connection.
 * 
 * Benefits over REST API:
 * - Lower latency (sub-millisecond vs 10-50ms)
 * - Connection pooling
 * - Pub/sub support
 * - Advanced Redis features (streams, geo, etc.)
 */

import Redis from 'ioredis';

// Redis connection options
const REDIS_OPTIONS = {
  host: process.env.REDIS_HOST || 'redis-17405.c244.us-east-1-2.ec2.redns.redis-cloud.com',
  port: parseInt(process.env.REDIS_PORT || '17405'),
  password: process.env.REDIS_PASSWORD || 'wyr7LqK5IjaJwppkEB7L18IRcz4iqIzy',
  username: process.env.REDIS_USERNAME || 'default',
  
  // Connection settings
  retryStrategy: (times: number) => {
    // Exponential backoff: 50ms, 100ms, 200ms, 400ms...
    const delay = Math.min(times * 50, 2000);
    console.log(`[Redis] Reconnecting... attempt ${times} (delay: ${delay}ms)`);
    return delay;
  },
  
  // Performance optimizations
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000, // 10 seconds
  commandTimeout: 5000, // 5 seconds
  
  // Connection pool settings
  lazyConnect: true, // Don't connect until first command
  keepAlive: 30000, // Send keep-alive every 30 seconds
  
  // Security
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  
  // Monitoring
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
};

// Create singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_OPTIONS);
    
    // Connection event handlers
    redisClient.on('connect', () => {
      console.log('[Redis Cloud] Connected successfully');
    });
    
    redisClient.on('ready', () => {
      console.log('[Redis Cloud] Ready to accept commands');
    });
    
    redisClient.on('error', (error) => {
      console.error('[Redis Cloud] Connection error:', error);
    });
    
    redisClient.on('close', () => {
      console.log('[Redis Cloud] Connection closed');
    });
    
    redisClient.on('reconnecting', (delay: number) => {
      console.log(`[Redis Cloud] Reconnecting in ${delay}ms`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      if (redisClient) {
        await redisClient.quit();
        redisClient = null;
      }
    });
  }
  
  return redisClient;
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
  info?: Record<string, any>;
}> {
  const client = getRedisClient();
  
  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;
    
    // Get basic info
    const infoRaw = await client.info('server');
    const info = parseRedisInfo(infoRaw);
    
    return {
      connected: true,
      latency,
      info: {
        version: info.redis_version,
        uptime: info.uptime_in_seconds,
        mode: info.redis_mode,
      },
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse Redis INFO command output
 */
function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = info.split('\r\n');
  
  for (const line of lines) {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Cache utilities using Redis Cloud
 */
export class RedisCache {
  private client: Redis;
  private defaultTTL: number;
  
  constructor(defaultTTL = 300) { // 5 minutes default
    this.client = getRedisClient();
    this.defaultTTL = defaultTTL;
  }
  
  /**
   * Get cached value
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[RedisCache] Error getting key ${key}:`, error);
      return null;
    }
  }
  
  /**
   * Set cached value with TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const ttlSeconds = ttl || this.defaultTTL;
      
      await this.client.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      console.error(`[RedisCache] Error setting key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Delete cached value
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`[RedisCache] Error deleting key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.client.del(...keys);
    } catch (error) {
      console.error(`[RedisCache] Error deleting pattern ${pattern}:`, error);
      return 0;
    }
  }
  
  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      console.error(`[RedisCache] Error checking key ${key}:`, error);
      return false;
    }
  }
  
  /**
   * Get remaining TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`[RedisCache] Error getting TTL for key ${key}:`, error);
      return -1;
    }
  }
}

/**
 * Provider search caching
 */
export const providerCache = {
  key: (filters: any) => `cache:providers:${JSON.stringify(filters)}`,
  ttl: 60, // 1 minute
  
  async get(filters: any) {
    const cache = new RedisCache();
    return cache.get(this.key(filters));
  },
  
  async set(filters: any, data: any) {
    const cache = new RedisCache();
    return cache.set(this.key(filters), data, this.ttl);
  },
  
  async invalidate() {
    const cache = new RedisCache();
    return cache.deletePattern('cache:providers:*');
  },
};

/**
 * Service listing caching
 */
export const serviceCache = {
  key: (providerId: string) => `cache:services:${providerId}`,
  ttl: 300, // 5 minutes
  
  async get(providerId: string) {
    const cache = new RedisCache();
    return cache.get(this.key(providerId));
  },
  
  async set(providerId: string, services: any) {
    const cache = new RedisCache();
    return cache.set(this.key(providerId), services, this.ttl);
  },
  
  async invalidate(providerId: string) {
    const cache = new RedisCache();
    return cache.delete(this.key(providerId));
  },
};

/**
 * Availability caching
 */
export const availabilityCache = {
  key: (providerId: string, date: string) => `cache:availability:${providerId}:${date}`,
  ttl: 120, // 2 minutes
  
  async get(providerId: string, date: string) {
    const cache = new RedisCache();
    return cache.get(this.key(providerId, date));
  },
  
  async set(providerId: string, date: string, slots: any) {
    const cache = new RedisCache();
    return cache.set(this.key(providerId, date), slots, this.ttl);
  },
  
  async invalidate(providerId: string) {
    const cache = new RedisCache();
    return cache.deletePattern(`cache:availability:${providerId}:*`);
  },
};

/**
 * Export singleton client for direct use
 */
export const redis = getRedisClient();

// Export cache instance for general use
export const cache = new RedisCache();

// Type exports for better DX
export type { Redis };