import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring for Edge Runtime
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Edge-specific configuration
  ignoreErrors: [
    "Edge Runtime Error",
    "Timeout",
  ],
});