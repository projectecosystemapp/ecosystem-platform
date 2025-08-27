/**
 * Redis Cloud Health Check Endpoint
 * 
 * Provides real-time health status and metrics for Redis Cloud instance
 * Enhanced with native Redis protocol metrics and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRedisHealth, redis, cache } from '@/lib/redis-cloud';
import { rateLimiters } from '@/lib/rate-limiter-redis-cloud';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'error';
  configured: boolean;
  message: string;
  timestamp: string;
  redis?: {
    connected: boolean;
    latency?: number;
    host?: string;
    port?: number;
    version?: string;
    uptime?: string;
    memory?: {
      used: string;
      peak: string;
      rss: string;
    };
    clients?: {
      connected: number;
      blocked: number;
      maxClients: number;
    };
    stats?: {
      totalCommands: string;
      opsPerSec: string;
      hitRate?: string;
      evictedKeys: string;
    };
  };
  rateLimit?: {
    healthy: boolean;
    testLatency?: number;
  };
  cache?: {
    healthy: boolean;
    testLatency?: number;
  };
  warnings?: string[];
  error?: string;
}

/**
 * Test rate limiter functionality
 */
async function testRateLimiter(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  const testKey = `health:check:${Date.now()}`;
  
  try {
    // Test rate limit check
    const result = await rateLimiters.api.limit(testKey);
    const latency = Date.now() - start;
    
    // Clean up test key
    await rateLimiters.api.reset(testKey);
    
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Rate limiter test failed',
    };
  }
}

/**
 * Test cache functionality
 */
async function testCache(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  const testKey = `health:cache:${Date.now()}`;
  const testValue = { test: true, timestamp: Date.now() };
  
  try {
    // Test set
    await cache.set(testKey, testValue, 10);
    
    // Test get
    const retrieved = await cache.get(testKey);
    
    // Test delete
    await cache.delete(testKey);
    
    const latency = Date.now() - start;
    
    // Verify the value was correctly stored and retrieved
    const healthy = retrieved && JSON.stringify(retrieved) === JSON.stringify(testValue);
    
    return {
      healthy,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Cache test failed',
    };
  }
}

/**
 * Get detailed Redis metrics
 */
async function getRedisMetrics() {
  try {
    const info = await redis.info();
    const lines = info.split('\r\n');
    const metrics: Record<string, any> = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          metrics[key] = value;
        }
      }
    });
    
    return {
      version: metrics.redis_version,
      uptime: `${Math.floor(parseInt(metrics.uptime_in_seconds) / 86400)} days`,
      memory: {
        used: `${(parseInt(metrics.used_memory) / 1024 / 1024).toFixed(2)} MB`,
        peak: `${(parseInt(metrics.used_memory_peak) / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(parseInt(metrics.used_memory_rss) / 1024 / 1024).toFixed(2)} MB`,
      },
      clients: {
        connected: parseInt(metrics.connected_clients),
        blocked: parseInt(metrics.blocked_clients),
        maxClients: parseInt(metrics.maxclients || '10000'),
      },
      stats: {
        totalCommands: metrics.total_commands_processed,
        opsPerSec: metrics.instantaneous_ops_per_sec,
        hitRate: metrics.keyspace_hits && metrics.keyspace_misses
          ? `${((parseInt(metrics.keyspace_hits) / (parseInt(metrics.keyspace_hits) + parseInt(metrics.keyspace_misses))) * 100).toFixed(2)}%`
          : 'N/A',
        evictedKeys: metrics.evicted_keys || '0',
      },
    };
  } catch (error) {
    console.error('Error getting Redis metrics:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if this is an authenticated health check for detailed metrics
    const authHeader = request.headers.get('authorization');
    const isAuthenticated = authHeader === `Bearer ${process.env.HEALTH_CHECK_TOKEN}`;
    
    // Check Redis Cloud connection
    const redisHealth = await checkRedisHealth();
    
    // Basic response for unauthenticated requests
    if (!isAuthenticated) {
      return NextResponse.json({
        status: redisHealth.connected ? 'healthy' : 'unhealthy',
        configured: true,
        message: redisHealth.connected 
          ? 'Redis Cloud connected' 
          : 'Redis Cloud connection failed',
        timestamp: new Date().toISOString(),
      });
    }
    
    // Detailed health checks for authenticated requests
    const [rateLimitTest, cacheTest, metrics] = await Promise.all([
      testRateLimiter(),
      testCache(),
      getRedisMetrics(),
    ]);
    
    // Determine overall status
    let status: HealthCheckResponse['status'];
    const warnings: string[] = [];
    
    if (!redisHealth.connected) {
      status = 'unhealthy';
    } else if (!rateLimitTest.healthy || !cacheTest.healthy) {
      status = 'degraded';
      if (!rateLimitTest.healthy) warnings.push('Rate limiter test failed');
      if (!cacheTest.healthy) warnings.push('Cache test failed');
    } else if (redisHealth.latency && redisHealth.latency > 100) {
      status = 'degraded';
      warnings.push(`High latency detected: ${redisHealth.latency}ms`);
    } else {
      status = 'healthy';
    }
    
    // Check memory usage warning
    if (metrics?.memory) {
      const usedMemory = parseFloat(metrics.memory.used);
      if (usedMemory > 100) {
        warnings.push(`High memory usage: ${metrics.memory.used}`);
      }
    }
    
    // Build response
    const response: HealthCheckResponse = {
      status,
      configured: true,
      message: redisHealth.connected 
        ? `Redis Cloud operational (${redisHealth.latency}ms latency)`
        : 'Redis Cloud connection failed',
      timestamp: new Date().toISOString(),
      redis: {
        connected: redisHealth.connected,
        latency: redisHealth.latency,
        host: process.env.REDIS_HOST || 'redis-17405.c244.us-east-1-2.ec2.redns.redis-cloud.com',
        port: parseInt(process.env.REDIS_PORT || '17405'),
        ...(metrics || {}),
      },
      rateLimit: {
        healthy: rateLimitTest.healthy,
        testLatency: rateLimitTest.latency,
      },
      cache: {
        healthy: cacheTest.healthy,
        testLatency: cacheTest.latency,
      },
    };
    
    if (warnings.length > 0) {
      response.warnings = warnings;
    }
    
    if (redisHealth.error) {
      response.error = redisHealth.error;
    }
    
    return NextResponse.json(response, {
      status: status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503,
    });
    
  } catch (error) {
    console.error('Redis health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      configured: true,
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' 
        ? (error as Error).message 
        : 'Internal error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}