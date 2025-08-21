import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Release Tracking
  environment: process.env.NODE_ENV,
  
  // Error Filtering
  ignoreErrors: [
    // Browser errors
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
    // Network errors
    "NetworkError",
    "Network request failed",
  ],
  
  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  
  // Before sending errors
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      console.error("Sentry Event:", event, hint);
      return null;
    }
    
    // Filter out sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    
    return event;
  },
});