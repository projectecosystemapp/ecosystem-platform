/**
 * Redis/Upstash Configuration Helper
 * Provides centralized Redis configuration with fallback strategies
 */

import { Redis } from '@upstash/redis';

// Define Redis configuration interface
export interface RedisConfig {
  url: string;
  token: string;
}

/**
 * Check if Redis is properly configured
 */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && 
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Get Redis configuration from environment
 */
export function getRedisConfig(): RedisConfig | null {
  if (!isRedisConfigured()) {
    return null;
  }

  return {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  };
}

/**
 * Create a Redis client instance
 * Returns null if Redis is not configured
 */
export async function createRedisClient(): Promise<Redis | null> {
  const config = getRedisConfig();
  
  if (!config) {
    console.warn('Redis not configured. Rate limiting will use in-memory fallback.');
    return null;
  }

  try {
    const client = new Redis({
      url: config.url,
      token: config.token,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.exp(retryCount) * 50
      }
    });

    // Test the connection
    await client.ping();
    console.log('Redis connection established successfully');
    
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.warn('Falling back to in-memory rate limiting');
    return null;
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  const config = getRedisConfig();
  
  if (!config) {
    return {
      connected: false,
      error: 'Redis not configured (missing environment variables)'
    };
  }

  try {
    const client = new Redis({
      url: config.url,
      token: config.token
    });

    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    return {
      connected: true,
      latency
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get Redis analytics data
 */
export async function getRedisAnalytics(): Promise<{
  operations?: number;
  memory?: string;
  uptime?: number;
  error?: string;
} | null> {
  const client = await createRedisClient();
  
  if (!client) {
    return null;
  }

  try {
    // Get basic info (note: some commands might be restricted in Upstash)
    const info = await client.dbsize();
    
    return {
      operations: info || 0,
      memory: 'N/A (Upstash managed)',
      uptime: Date.now()
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to get analytics'
    };
  }
}