/**
 * Application Initialization
 * Validates environment and initializes services at startup
 */

import { logEnvStatus, validateEnv } from "./env-validation";
import { initSentryForAPI } from "./sentry";

/**
 * Initialize application on startup
 */
export function initializeApp() {
  // Only run initialization once
  if (globalThis.__appInitialized) {
    return;
  }
  
  console.log("🚀 Initializing Ecosystem Platform...");
  console.log("=====================================");
  
  // Validate environment variables
  const envValidation = validateEnv();
  
  if (!envValidation.success) {
    console.error("❌ Environment validation failed!");
    console.error("Please check your .env file and ensure all required variables are set.");
    
    // Log detailed status
    logEnvStatus();
    
    // In production, fail fast
    if (process.env.NODE_ENV === "production") {
      throw new Error("Environment validation failed. Cannot start in production.");
    }
  } else {
    // Log environment status
    logEnvStatus();
  }
  
  // Initialize Sentry if configured
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    try {
      initSentryForAPI();
      console.log("✅ Sentry monitoring initialized");
    } catch (error) {
      console.error("⚠️  Failed to initialize Sentry:", error);
    }
  }
  
  // Log Redis status
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log("✅ Redis configured for rate limiting");
  } else {
    console.log("⚠️  Redis not configured - using in-memory rate limiting");
    if (process.env.NODE_ENV === "production") {
      console.warn("⚠️  WARNING: In-memory rate limiting is not suitable for production!");
    }
  }
  
  // Log Stripe status
  if (process.env.STRIPE_SECRET_KEY) {
    console.log("✅ Stripe payments configured");
    if (process.env.STRIPE_CONNECT_CLIENT_ID) {
      console.log("✅ Stripe Connect enabled for marketplace");
    }
  } else {
    console.error("❌ Stripe not configured - payments will not work");
  }
  
  // Mark as initialized
  globalThis.__appInitialized = true;
  
  console.log("=====================================");
  console.log("✅ Application initialized successfully");
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 URL: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`);
  console.log("=====================================\n");
}

// Extend global type
declare global {
  var __appInitialized: boolean | undefined;
}

// Auto-initialize in non-test environments
if (process.env.NODE_ENV !== "test") {
  initializeApp();
}