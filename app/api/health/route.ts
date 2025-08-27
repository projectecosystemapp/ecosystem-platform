// @ts-nocheck
/**
 * Comprehensive Health Check Endpoint
 * Monitors all critical system components
 */

import { NextResponse } from "next/server";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";
import { checkRedisHealth } from "@/lib/redis-cloud";
import { isSentryConfigured } from "@/lib/sentry";
import { checkRequiredEnvVars } from "@/lib/env-validation";
import Stripe from "stripe";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    stripe: ComponentHealth;
    authentication: ComponentHealth;
    storage: ComponentHealth;
    monitoring: ComponentHealth;
    environment: ComponentHealth;
  };
  metadata: {
    node_version: string;
    deployment_id?: string;
    region?: string;
  };
}

interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  message?: string;
  details?: Record<string, any>;
}

// Track application start time
const startTime = Date.now();

/**
 * Simple HEAD request for basic health checks
 */
export async function HEAD() {
  return new Response(null, { 
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Service": "ecosystem-platform",
      "X-Status": "healthy",
    },
  });
}

/**
 * Comprehensive GET request for detailed health status
 */
export async function GET(request: Request) {
  const startCheck = Date.now();
  
  // Check for detailed query parameter
  const url = new URL(request.url);
  const detailed = url.searchParams.get("detailed") === "true";
  
  // Initialize health status
  const healthStatus: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "ecosystem-platform",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      stripe: await checkStripe(),
      authentication: checkAuthentication(),
      storage: await checkStorage(),
      monitoring: checkMonitoring(),
      environment: checkEnvironment(),
    },
    metadata: {
      node_version: process.version,
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID,
      region: process.env.VERCEL_REGION,
    },
  };
  
  // Determine overall health status
  const componentStatuses = Object.values(healthStatus.checks);
  if (componentStatuses.some(c => c.status === "unhealthy")) {
    healthStatus.status = "unhealthy";
  } else if (componentStatuses.some(c => c.status === "degraded")) {
    healthStatus.status = "degraded";
  }
  
  // Return appropriate status code
  const statusCode = 
    healthStatus.status === "unhealthy" ? 503 :
    healthStatus.status === "degraded" ? 200 : // Still return 200 for degraded
    200;
  
  // Remove sensitive details if not detailed mode
  if (!detailed) {
    Object.values(healthStatus.checks).forEach(check => {
      delete check.details;
    });
  }
  
  // Add response time
  const responseTime = Date.now() - startCheck;
  
  return NextResponse.json(
    {
      ...healthStatus,
      responseTime: `${responseTime}ms`,
    },
    { 
      status: statusCode,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Response-Time": `${responseTime}ms`,
        "X-Health-Status": healthStatus.status,
      },
    }
  );
}

/**
 * Check database connectivity and performance
 */
async function checkDatabase(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    
    // Simple query to check connectivity
    const result = await db.execute(sql`SELECT 1 as health_check`);
    
    const latency = Date.now() - start;
    
    if (!result || result.length === 0) {
      return {
        status: "unhealthy",
        message: "Database query returned no results",
      };
    }
    
    // Check latency thresholds
    if (latency > 1000) {
      return {
        status: "degraded",
        latency,
        message: "Database response time is high",
      };
    }
    
    return {
      status: "healthy",
      latency,
      message: "Database connection successful",
      details: {
        type: "PostgreSQL",
        provider: "Supabase",
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

/**
 * Check Redis connectivity and performance
 */
async function checkRedis(): Promise<ComponentHealth> {
  const redisHealth = await checkRedisHealth();
  
  if (!redisHealth.connected) {
    // Check if Redis is configured (either Upstash or Redis Cloud)
    const hasUpstash = !!(
      process.env.UPSTASH_REDIS_REST_URL && 
      process.env.UPSTASH_REDIS_REST_TOKEN
    );
    const hasRedisCloud = !!(
      process.env.REDIS_HOST && 
      process.env.REDIS_PORT && 
      process.env.REDIS_PASSWORD
    );
    const isConfigured = hasUpstash || hasRedisCloud;
    
    if (!isConfigured) {
      return {
        status: "degraded",
        message: "Redis not configured - using in-memory fallback",
        details: {
          fallback: "in-memory",
          suitable_for_production: false,
        },
      };
    }
    
    return {
      status: "unhealthy",
      message: redisHealth.error || "Redis connection failed",
    };
  }
  
  // Check latency thresholds
  if (redisHealth.latency && redisHealth.latency > 100) {
    return {
      status: "degraded",
      latency: redisHealth.latency,
      message: "Redis response time is high",
    };
  }
  
  const hasRedisCloud = !!(
    process.env.REDIS_HOST && 
    process.env.REDIS_PORT && 
    process.env.REDIS_PASSWORD
  );
  
  return {
    status: "healthy",
    latency: redisHealth.latency,
    message: "Redis connection successful",
    details: {
      provider: hasRedisCloud ? "Redis Cloud" : "Upstash",
      type: hasRedisCloud ? "Native Protocol" : "REST API",
    },
  };
}

/**
 * Check Stripe API connectivity
 */
async function checkStripe(): Promise<ComponentHealth> {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        status: "unhealthy",
        message: "Stripe not configured",
      };
    }
    
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-07-30.basil",
    });
    
    const start = Date.now();
    
    // Check Stripe API with a simple request
    const balance = await stripe.balance.retrieve();
    
    const latency = Date.now() - start;
    
    if (latency > 2000) {
      return {
        status: "degraded",
        latency,
        message: "Stripe API response time is high",
      };
    }
    
    return {
      status: "healthy",
      latency,
      message: "Stripe API connection successful",
      details: {
        livemode: balance.livemode,
        connect_enabled: !!process.env.STRIPE_CONNECT_CLIENT_ID,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Stripe check failed",
    };
  }
}

/**
 * Check authentication service (Clerk)
 */
function checkAuthentication(): ComponentHealth {
  const isConfigured = !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
  
  if (!isConfigured) {
    return {
      status: "unhealthy",
      message: "Authentication not configured",
    };
  }
  
  // For Clerk, we can't easily test the API without making actual requests
  // So we'll just check configuration
  return {
    status: "healthy",
    message: "Authentication service configured",
    details: {
      provider: "Clerk",
      sign_in_url: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
      sign_up_url: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    },
  };
}

/**
 * Check storage service (Supabase)
 */
async function checkStorage(): Promise<ComponentHealth> {
  const isConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  if (!isConfigured) {
    return {
      status: "unhealthy",
      message: "Storage service not configured",
    };
  }
  
  try {
    // Simple check - verify URL is accessible
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    
    if (!response.ok && response.status !== 404) {
      return {
        status: "degraded",
        message: `Storage service responded with status ${response.status}`,
      };
    }
    
    return {
      status: "healthy",
      message: "Storage service accessible",
      details: {
        provider: "Supabase",
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: error instanceof Error ? error.message : "Storage check failed",
    };
  }
}

/**
 * Check monitoring services
 */
function checkMonitoring(): ComponentHealth {
  const sentryConfigured = isSentryConfigured();
  
  if (!sentryConfigured) {
    return {
      status: "degraded",
      message: "Error monitoring not configured",
      details: {
        sentry: false,
      },
    };
  }
  
  return {
    status: "healthy",
    message: "Monitoring services configured",
    details: {
      sentry: true,
      environment: process.env.NODE_ENV,
    },
  };
}

/**
 * Check environment variables
 */
function checkEnvironment(): ComponentHealth {
  const envCheck = checkRequiredEnvVars();
  
  if (!envCheck.valid) {
    return {
      status: "unhealthy",
      message: "Required environment variables missing",
      details: {
        missing: envCheck.missing,
      },
    };
  }
  
  // Check for production requirements
  if (process.env.NODE_ENV === "production") {
    const productionIssues = [];
    
    const hasRedis = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_HOST;
    if (!hasRedis) {
      productionIssues.push("Redis not configured");
    }
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      productionIssues.push("Sentry not configured");
    }
    if (!process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
      productionIssues.push("Production URL not configured");
    }
    
    if (productionIssues.length > 0) {
      return {
        status: "degraded",
        message: "Production recommendations not met",
        details: {
          issues: productionIssues,
        },
      };
    }
  }
  
  return {
    status: "healthy",
    message: "All required environment variables configured",
  };
}