// @ts-nocheck
import { NextResponse } from "next/server";
import { 
  checkRateLimitHealth, 
  getRateLimitAnalytics,
  checkRateLimitStatus,
  RATE_LIMIT_CONFIGS
} from "@/lib/rate-limit";

/**
 * GET /api/health/rate-limit
 * Health check endpoint for rate limiting system
 * 
 * Returns:
 * - Redis connection status
 * - Rate limit configurations
 * - Current analytics (if available)
 * - System health status
 */
export async function GET() {
  try {
    // Check basic health
    const health = await checkRateLimitHealth();
    
    // Get analytics for all rate limit types
    const analytics = await getRateLimitAnalytics();
    
    // Test rate limit functionality with a test identifier
    const testIdentifier = "health-check-test";
    const testResults: Record<string, any> = {};
    
    for (const type of Object.keys(RATE_LIMIT_CONFIGS) as Array<keyof typeof RATE_LIMIT_CONFIGS>) {
      try {
        const status = await checkRateLimitStatus(testIdentifier, type);
        testResults[type] = {
          functional: true,
          allowed: status.allowed,
          remaining: status.remaining,
          resetAt: status.resetAt
        };
      } catch (error) {
        testResults[type] = {
          functional: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
    
    // Compile comprehensive health report
    const report = {
      status: health.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      redis: {
        connected: health.usingRedis,
        healthy: health.healthy,
        error: health.error
      },
      configurations: Object.entries(RATE_LIMIT_CONFIGS).map(([key, config]) => ({
        type: key,
        windowMs: config.windowMs,
        maxRequests: config.maxRequests,
        windowFormatted: formatTimeWindow(config.windowMs)
      })),
      testResults,
      analytics,
      fallbackMode: !health.usingRedis ? 'in-memory' : null,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasRedisConfig: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
      }
    };
    
    // Return appropriate status code based on health
    const statusCode = health.healthy ? 200 : 503;
    
    return NextResponse.json(report, { status: statusCode });
  } catch (error) {
    console.error('Rate limit health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to perform rate limit health check'
      },
      { status: 500 }
    );
  }
}

/**
 * Format time window in human-readable format
 */
function formatTimeWindow(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}