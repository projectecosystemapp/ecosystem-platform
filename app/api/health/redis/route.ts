import { NextRequest, NextResponse } from 'next/server';
import { 
  checkUpstashHealth,
  isUpstashConfigured,
  getUpstashClient
} from '@/lib/security/upstash-redis';

/**
 * Health check endpoint for Redis connectivity
 * 
 * GET /api/health/redis
 * 
 * Returns:
 * - 200: Redis is healthy and connected
 * - 503: Redis is not configured or connection failed
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Redis is configured
    const configured = isUpstashConfigured();
    
    if (!configured) {
      return NextResponse.json(
        {
          status: 'not_configured',
          message: 'Upstash Redis not configured. Using in-memory fallback.',
          configured: false,
          connected: false,
          timestamp: new Date().toISOString(),
        },
        { 
          status: 503,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          }
        }
      );
    }
    
    // Run health check
    const health = await checkUpstashHealth();
    
    if (!health.connected) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: `Redis connection failed: ${health.error}`,
          configured: true,
          connected: false,
          error: health.error,
          timestamp: new Date().toISOString(),
        },
        { 
          status: 503,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          }
        }
      );
    }
    
    // Get additional Redis info
    const client = getUpstashClient();
    let dbSize: number | null = 0;
    let memoryUsage = null;
    
    if (client) {
      try {
        // Try to get dbsize if available (may not work with Upstash REST API)
        try {
          dbSize = await (client as any).dbsize?.() ?? null;
        } catch {
          // dbsize not available in Upstash REST API
          dbSize = null;
        }
        
        // Memory info is generally not available in Upstash REST API
        // Skip memory info for Upstash
      } catch (err) {
        console.error('Failed to get Redis info:', err);
      }
    }
    
    return NextResponse.json(
      {
        status: 'healthy',
        message: 'Redis is connected and operational',
        configured: true,
        connected: true,
        latency: health.latency,
        stats: {
          dbSize,
          memoryUsage,
        },
        timestamp: new Date().toISOString(),
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
    
  } catch (error) {
    console.error('Redis health check error:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        configured: isUpstashConfigured(),
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }
}