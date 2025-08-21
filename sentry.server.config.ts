import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Error Filtering
  ignoreErrors: [
    // Ignore expected errors
    "Unauthorized",
    "User not found",
  ],
  
  // Before sending errors
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === "development") {
      console.error("Sentry Server Event:", event, hint);
      return null;
    }
    
    // Remove sensitive data
    if (event.request) {
      // Remove auth headers
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      
      // Remove sensitive body data
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, any>;
        const sensitiveKeys = ["password", "token", "secret", "apiKey"];
        sensitiveKeys.forEach(key => {
          if (key in data) {
            data[key] = "[REDACTED]";
          }
        });
      }
    }
    
    return event;
  },
});