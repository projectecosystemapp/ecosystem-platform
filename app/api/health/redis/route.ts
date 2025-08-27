// @ts-nocheck
/**
 * Redis Health Check Endpoint
 * 
 * Provides real-time health status and metrics for Redis services
 * Used for monitoring dashboards and alerting systems
 */

import { NextRequest, NextResponse } from 'next/server';
import { HealthMonitor, isRedisConfigured, getRedisStatusMessage } from '@/lib/services/redis.service';
import { validateRedisConfig } from '@/config/redis.config';
import { checkRateLimitHealth, getRateLimitAnalytics } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Check if this is an authenticated health check
    const authHeader = request.headers.get('authorization');
    const isAuthenticated = authHeader === `Bearer ${process.env.HEALTH_CHECK_TOKEN}`;
    
    // Basic health check
    const configured = isRedisConfigured();
    const validation = validateRedisConfig();
    const message = getRedisStatusMessage();
    
    if (!configured) {
      // Redis not configured
      return NextResponse.json({
        status: 'degraded',
        configured: false,
        message,
        timestamp: new Date().toISOString(),
        validation: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
      }, { 
        status: process.env.NODE_ENV === 'production' ? 503 : 200 
      });
    }
    
    // Perform health check
    const health = await HealthMonitor.checkHealth();
    
    // Basic response for unauthenticated requests
    if (!isAuthenticated) {
      return NextResponse.json({
        status: health.healthy ? 'healthy' : 'unhealthy',
        configured: true,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Detailed response for authenticated monitoring systems
    const metrics = await HealthMonitor.getMetrics();
    
    // Check rate limiting health
    const rateLimitHealth = await checkRateLimitHealth();
    const rateLimitAnalytics = await getRateLimitAnalytics();
    
    // Calculate overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (health.healthy && Object.values(health.services).every(s => s) && rateLimitHealth.healthy) {
      status = 'healthy';
    } else if (health.healthy || rateLimitHealth.healthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    // Check latency thresholds
    const latencyWarnings: string[] = [];
    Object.entries(health.latency).forEach(([service, latency]) => {
      if (latency && latency > 100) {
        latencyWarnings.push(`${service}: ${latency}ms (>100ms threshold)`);
      }
    });
    
    return NextResponse.json({
      status,
      configured: true,
      message,
      timestamp: new Date().toISOString(),
      services: health.services,
      latency: health.latency,
      metrics,
      rateLimit: {
        healthy: rateLimitHealth.healthy,
        usingRedis: rateLimitHealth.usingRedis,
        error: rateLimitHealth.error,
        analytics: rateLimitAnalytics,
      },
      validation: {
        errors: validation.errors,
        warnings: [...validation.warnings, ...latencyWarnings],
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        hasCacheUrl: !!process.env.REDIS_CACHE_URL,
        hasSessionUrl: !!process.env.REDIS_SESSION_URL,
      },
    });
    
  } catch (error) {
    console.error('Redis health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      configured: isRedisConfigured(),
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
    },
  });
}