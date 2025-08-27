/**
 * Upstash Redis Configuration for Rate Limiting
 * 
 * This module provides a Redis client using Upstash's REST API.
 * Upstash Redis is serverless-friendly and doesn't require persistent connections.
 * 
 * Benefits:
 * - No connection pooling issues in serverless environments
 * - Automatic scaling and availability
 * - Pay-per-request pricing model
 * - Built-in rate limiting and security
 */

import { Redis } from '@upstash/redis';

// Environment variables for Upstash Redis
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Check if Upstash Redis is properly configured
 */
export function isUpstashConfigured(): boolean {
  return !!(UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Create Upstash Redis client
 */
function createUpstashClient(): Redis | null {
  if (!isUpstashConfigured()) {
    console.warn('⚠️ Upstash Redis not configured. Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    return null;
  }

  return new Redis({
    url: UPSTASH_REDIS_REST_URL!,
    token: UPSTASH_REDIS_REST_TOKEN!,
  });
}

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get Upstash Redis client (singleton)
 */
export function getUpstashClient(): Redis | null {
  if (!redisClient && isUpstashConfigured()) {
    redisClient = createUpstashClient();
    
    if (redisClient) {
      console.log('✅ Upstash Redis client initialized');
    }
  }
  
  return redisClient;
}

/**
 * Health check for Upstash Redis connection
 */
export async function checkUpstashHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  const client = getUpstashClient();
  
  if (!client) {
    return {
      connected: false,
      error: 'Upstash Redis not configured',
    };
  }
  
  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;
    
    return {
      connected: true,
      latency,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upstash Redis rate limiter implementation
 */
export class UpstashRateLimiter {
  private redis: Redis | null;
  private tokensPerInterval: number;
  private intervalMs: number;
  private namespace: string;
  
  constructor(config: {
    tokensPerInterval: number;
    intervalMs: number;
    namespace?: string;
  }) {
    this.redis = getUpstashClient();
    this.tokensPerInterval = config.tokensPerInterval;
    this.intervalMs = config.intervalMs;
    this.namespace = config.namespace || 'ratelimit';
  }
  
  /**
   * Check rate limit for an identifier using sliding window algorithm
   */
  async limit(identifier: string): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }> {
    // If Redis is not configured, allow the request
    if (!this.redis) {
      console.warn('[UpstashRateLimiter] Redis not configured, allowing request');
      return {
        success: true,
        limit: this.tokensPerInterval,
        remaining: this.tokensPerInterval,
        reset: Date.now() + this.intervalMs,
      };
    }
    
    const key = `${this.namespace}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.intervalMs;
    
    try {
      // Use Upstash pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Count requests in current window
      pipeline.zcard(key);
      
      // Execute pipeline
      const results = await pipeline.exec();
      
      if (!results || results.length < 2) {
        throw new Error('Pipeline execution failed');
      }
      
      const currentCount = (results[1] as number) || 0;
      
      // Check if limit exceeded
      if (currentCount >= this.tokensPerInterval) {
        // Get oldest entry to calculate reset time
        const oldestEntries = await this.redis.zrange(key, 0, 0, {
          withScores: true,
        });
        
        const resetTime = oldestEntries.length > 1 
          ? Number(oldestEntries[1]) + this.intervalMs
          : now + this.intervalMs;
        
        return {
          success: false,
          limit: this.tokensPerInterval,
          remaining: 0,
          reset: resetTime,
        };
      }
      
      // Add new request to window
      await this.redis.zadd(key, {
        score: now,
        member: `${now}-${Math.random()}`,
      });
      
      // Set expiry on the key (convert to seconds)
      await this.redis.expire(key, Math.ceil(this.intervalMs / 1000));
      
      return {
        success: true,
        limit: this.tokensPerInterval,
        remaining: this.tokensPerInterval - currentCount - 1,
        reset: now + this.intervalMs,
      };
      
    } catch (error) {
      console.error('[UpstashRateLimiter] Redis error:', error);
      
      // On error, allow the request but log it
      return {
        success: true,
        limit: this.tokensPerInterval,
        remaining: this.tokensPerInterval,
        reset: now + this.intervalMs,
      };
    }
  }
  
  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    if (!this.redis) return;
    
    const key = `${this.namespace}:${identifier}`;
    await this.redis.del(key);
  }
}

/**
 * Create rate limiter with config
 */
export function createUpstashRateLimiter(config: {
  tokensPerInterval: number;
  intervalMs: number;
  namespace?: string;
}): UpstashRateLimiter {
  return new UpstashRateLimiter(config);
}

// Export the client for advanced usage
export { Redis } from '@upstash/redis';
export const upstashRedis = getUpstashClient();