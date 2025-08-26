/**
 * Sentry Configuration and Utilities
 * Centralized Sentry setup with user identification and error context
 */

import * as Sentry from "@sentry/nextjs";
import { auth } from "@clerk/nextjs/server";

/**
 * Check if Sentry is configured
 */
export function isSentryConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
}

/**
 * Get Sentry DSN based on environment (client or server)
 */
export function getSentryDSN(): string | undefined {
  return process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
}

/**
 * Set user context in Sentry
 */
export async function setSentryUser() {
  if (!isSentryConfigured()) return;

  try {
    const { userId, sessionClaims } = await auth();
    
    if (userId) {
      Sentry.setUser({
        id: userId,
        email: sessionClaims?.email as string | undefined,
        username: sessionClaims?.username as string | undefined,
        ip_address: "{{auto}}", // Let Sentry detect IP
      });

      // Add additional context
      Sentry.setContext("session", {
        role: sessionClaims?.metadata?.role || "user",
        sessionId: sessionClaims?.sid,
      });
    } else {
      // Clear user context for anonymous users
      Sentry.setUser(null);
    }
  } catch (error) {
    console.error("Failed to set Sentry user context:", error);
  }
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: Sentry.SeverityLevel;
    fingerprint?: string[];
  }
) {
  if (!isSentryConfigured()) {
    console.error("Sentry not configured. Error:", error);
    return;
  }

  Sentry.withScope((scope) => {
    // Add tags
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Add extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    // Set level
    if (context?.level) {
      scope.setLevel(context.level);
    }

    // Set fingerprint for grouping
    if (context?.fingerprint) {
      scope.setFingerprint(context.fingerprint);
    }

    // Capture the exception
    Sentry.captureException(error);
  });
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = "info",
  context?: Record<string, any>
) {
  if (!isSentryConfigured()) {
    console.log(`[${level.toUpperCase()}]`, message, context);
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Add breadcrumb for better error tracking
 */
export function addBreadcrumb(breadcrumb: {
  message: string;
  category?: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>;
}) {
  if (!isSentryConfigured()) return;

  Sentry.addBreadcrumb({
    message: breadcrumb.message,
    category: breadcrumb.category || "custom",
    level: breadcrumb.level || "info",
    data: breadcrumb.data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  op: string = "http.server"
): Sentry.Transaction | null {
  if (!isSentryConfigured()) return null;

  return Sentry.startTransaction({
    name,
    op,
    trimEnd: true,
  });
}

/**
 * Monitor async function execution
 */
export async function withSentry<T>(
  fn: () => Promise<T>,
  options: {
    name: string;
    op?: string;
    tags?: Record<string, string>;
  }
): Promise<T> {
  if (!isSentryConfigured()) {
    return fn();
  }

  const transaction = startTransaction(options.name, options.op);
  
  if (transaction && options.tags) {
    Object.entries(options.tags).forEach(([key, value]) => {
      transaction.setTag(key, value);
    });
  }

  try {
    const result = await fn();
    transaction?.setStatus("ok");
    return result;
  } catch (error) {
    transaction?.setStatus("internal_error");
    captureException(error, {
      tags: options.tags,
      extra: { operation: options.name },
    });
    throw error;
  } finally {
    transaction?.finish();
  }
}

/**
 * Initialize Sentry for API routes
 */
export function initSentryForAPI() {
  if (!isSentryConfigured()) return;

  const dsn = getSentryDSN();
  
  if (!Sentry.getCurrentHub().getClient()) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
  }
}