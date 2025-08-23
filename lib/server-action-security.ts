/**
 * Server Action Security Utilities
 * 
 * Centralized security utilities for all Server Actions following Zero-Trust principles.
 * Every Server Action should use these utilities to ensure proper authentication,
 * authorization, validation, and audit logging.
 */

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { headers, cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Security event types for audit logging
export enum SecurityEvent {
  AUTH_FAILED = "AUTH_FAILED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  RESOURCE_CREATED = "RESOURCE_CREATED",
  RESOURCE_UPDATED = "RESOURCE_UPDATED",
  RESOURCE_DELETED = "RESOURCE_DELETED",
  PAYMENT_PROCESSED = "PAYMENT_PROCESSED",
  SENSITIVE_DATA_ACCESSED = "SENSITIVE_DATA_ACCESSED",
  SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
}

// Audit log entry interface
interface AuditLogEntry {
  timestamp: string;
  userId: string | null;
  event: SecurityEvent;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  success: boolean;
}

/**
 * Enhanced authentication check with request context
 */
export async function authenticateRequest(): Promise<{
  userId: string | null;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}> {
  const { userId, sessionId } = await auth();
  
  // Get request headers for additional context
  const headersList = headers();
  const ipAddress = headersList.get("x-forwarded-for") || 
                    headersList.get("x-real-ip") || 
                    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";
  
  return {
    userId,
    sessionId,
    ipAddress,
    userAgent,
  };
}

/**
 * Audit logger for security events
 */
export function auditLog(entry: Omit<AuditLogEntry, "timestamp">) {
  const logEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  
  // In production, send to centralized logging service (e.g., Datadog, Splunk)
  // For now, console log with structured format
  const logLevel = entry.success ? "INFO" : "ERROR";
  const logPrefix = entry.success ? "[AUDIT]" : "[SECURITY]";
  
  console.log(
    `${logPrefix} ${logLevel}:`,
    JSON.stringify(logEntry, null, 2)
  );
  
  // In production, also store in database for compliance
  // await db.insert(auditLogsTable).values(logEntry);
}

/**
 * Rate limiting implementation
 * @param identifier - Unique identifier (userId or IP)
 * @param limit - Number of requests allowed
 * @param windowMs - Time window in milliseconds
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const key = createHash("sha256").update(identifier).digest("hex");
  
  // Get current rate limit data
  const current = rateLimitStore.get(key);
  
  if (!current || current.resetAt <= now) {
    // Create new window
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  
  if (current.count >= limit) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  
  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);
  
  return {
    allowed: true,
    remaining: limit - current.count,
    resetAt: current.resetAt,
  };
}

/**
 * Generic server action wrapper with full security features
 */
export async function withSecureAction<T, R>(
  action: (userId: string, validatedData: T) => Promise<R>,
  options: {
    actionName: string;
    input?: T;
    schema?: z.ZodSchema<T>;
    requireAuth?: boolean;
    requireCSRF?: boolean; // New option for CSRF protection
    csrfToken?: string; // Token provided by client
    rateLimit?: { limit: number; window: number };
    auditEvent?: SecurityEvent;
    resourceType?: string;
    resourceId?: string;
  }
): Promise<{ success: boolean; data?: R; error?: string }> {
  const startTime = Date.now();
  
  try {
    // 1. Authentication check
    const { userId, ipAddress, userAgent } = await authenticateRequest();
    
    if (options.requireAuth !== false && !userId) {
      auditLog({
        userId: null,
        event: SecurityEvent.AUTH_FAILED,
        action: options.actionName,
        ipAddress,
        userAgent,
        success: false,
        details: { reason: "No authenticated user" },
      });
      
      return { success: false, error: "Unauthorized: Please sign in" };
    }
    
    // 2. CSRF Protection for state-changing operations
    // Default to requiring CSRF for authenticated state-changing actions
    const shouldCheckCSRF = options.requireCSRF !== false && 
                           options.requireAuth !== false;
    
    if (shouldCheckCSRF) {
      const csrfValidation = await validateCSRFToken(options.csrfToken);
      
      if (!csrfValidation.valid) {
        auditLog({
          userId,
          event: SecurityEvent.SUSPICIOUS_ACTIVITY,
          action: options.actionName,
          ipAddress,
          userAgent,
          success: false,
          details: { 
            reason: "CSRF validation failed",
            error: csrfValidation.error 
          },
        });
        
        return {
          success: false,
          error: csrfValidation.error || "CSRF validation failed",
        };
      }
    }
    
    // 3. Rate limiting
    if (options.rateLimit && userId) {
      const rateLimitResult = await checkRateLimit(
        userId,
        options.rateLimit.limit,
        options.rateLimit.window
      );
      
      if (!rateLimitResult.allowed) {
        auditLog({
          userId,
          event: SecurityEvent.RATE_LIMIT_EXCEEDED,
          action: options.actionName,
          ipAddress,
          userAgent,
          success: false,
          details: { resetAt: rateLimitResult.resetAt },
        });
        
        return {
          success: false,
          error: `Rate limit exceeded. Try again in ${Math.ceil(
            (rateLimitResult.resetAt - Date.now()) / 1000
          )} seconds`,
        };
      }
    }
    
    // 4. Input validation
    let validatedData = options.input;
    if (options.schema && options.input) {
      try {
        validatedData = options.schema.parse(options.input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          auditLog({
            userId,
            event: SecurityEvent.VALIDATION_FAILED,
            action: options.actionName,
            ipAddress,
            userAgent,
            success: false,
            details: { errors: error.errors },
          });
          
          return {
            success: false,
            error: `Validation error: ${error.errors
              .map((e) => e.message)
              .join(", ")}`,
          };
        }
        throw error;
      }
    }
    
    // 5. Execute the action
    const result = await action(userId!, validatedData as T);
    
    // 6. Audit successful action
    if (options.auditEvent) {
      auditLog({
        userId,
        event: options.auditEvent,
        action: options.actionName,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        ipAddress,
        userAgent,
        success: true,
        details: {
          executionTime: Date.now() - startTime,
        },
      });
    }
    
    return { success: true, data: result };
  } catch (error) {
    // 7. Error handling and logging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    const { userId, ipAddress, userAgent } = await authenticateRequest();
    
    auditLog({
      userId,
      event: SecurityEvent.SUSPICIOUS_ACTIVITY,
      action: options.actionName,
      ipAddress,
      userAgent,
      success: false,
      details: {
        error: errorMessage,
        executionTime: Date.now() - startTime,
      },
    });
    
    // Don't expose internal errors to client
    return {
      success: false,
      error: "An error occurred processing your request",
    };
  }
}

/**
 * Permission checker for resource-based authorization
 */
export async function checkResourcePermission(
  userId: string,
  resourceType: string,
  resourceId: string,
  permission: "read" | "write" | "delete",
  getOwner: () => Promise<string | null>
): Promise<boolean> {
  try {
    const owner = await getOwner();
    
    if (!owner) {
      console.warn(
        `[SECURITY] Resource ${resourceType}:${resourceId} has no owner`
      );
      return false;
    }
    
    if (owner !== userId) {
      auditLog({
        userId,
        event: SecurityEvent.PERMISSION_DENIED,
        action: `${permission}_${resourceType}`,
        resourceType,
        resourceId,
        success: false,
        details: {
          requestedBy: userId,
          ownedBy: owner,
        },
      });
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(
      `[SECURITY] Error checking permission for ${resourceType}:${resourceId}`,
      error
    );
    return false;
  }
}

/**
 * CSRF Configuration
 */
const CSRF_TOKEN_LENGTH = 32;
const CSRF_SECRET = process.env.CSRF_SECRET || (() => {
  console.error("[SECURITY] CSRF_SECRET not set in environment variables!");
  throw new Error("CSRF_SECRET must be set in production");
})();
const CSRF_COOKIE_NAME = "__Host-csrf-token";
const CSRF_TOKEN_MAX_AGE = 86400000; // 24 hours in milliseconds

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Create a signed CSRF token with timestamp
 */
export function createSignedCSRFToken(token: string): string {
  const timestamp = Date.now();
  const data = `${token}.${timestamp}`;
  const signature = createHash("sha256")
    .update(`${CSRF_SECRET}.${data}`)
    .digest("hex");
  return `${data}.${signature}`;
}

/**
 * Verify a signed CSRF token using timing-safe comparison
 */
export function verifySignedCSRFToken(
  signedToken: string,
  maxAge: number = CSRF_TOKEN_MAX_AGE
): { valid: boolean; reason?: string } {
  try {
    const parts = signedToken.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Invalid token format" };
    }

    const [token, timestamp, providedSignature] = parts;
    const data = `${token}.${timestamp}`;

    // Verify signature using timing-safe comparison
    const expectedSignature = createHash("sha256")
      .update(`${CSRF_SECRET}.${data}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const providedBuffer = Buffer.from(providedSignature, "hex");

    if (expectedBuffer.length !== providedBuffer.length) {
      return { valid: false, reason: "Invalid signature length" };
    }

    if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { valid: false, reason: "Invalid signature" };
    }

    // Check token age
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > maxAge) {
      return { valid: false, reason: "Token expired" };
    }

    if (tokenAge < 0) {
      return { valid: false, reason: "Token timestamp invalid" };
    }

    return { valid: true };
  } catch (error) {
    console.error("[SECURITY] CSRF token verification error:", error);
    return { valid: false, reason: "Token verification failed" };
  }
}

/**
 * CSRF token validation for state-changing operations
 * Validates tokens from both cookies and headers/body
 */
export async function validateCSRFToken(
  providedToken?: string | null
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get the session token from HTTP-only cookie
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(CSRF_COOKIE_NAME);

    if (!cookieToken?.value) {
      auditLog({
        userId: null,
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        action: "csrf_validation",
        success: false,
        details: { error: "No CSRF cookie present" },
      });
      return { valid: false, error: "CSRF protection: No session token" };
    }

    // If no token provided in request, check headers
    if (!providedToken) {
      const headersList = await headers();
      providedToken = headersList.get("x-csrf-token") || 
                     headersList.get("csrf-token");
    }

    if (!providedToken) {
      auditLog({
        userId: null,
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        action: "csrf_validation",
        success: false,
        details: { error: "No CSRF token in request" },
      });
      return { valid: false, error: "CSRF protection: No request token" };
    }

    // Verify both tokens match and are valid
    const cookieVerification = verifySignedCSRFToken(cookieToken.value);
    if (!cookieVerification.valid) {
      auditLog({
        userId: null,
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        action: "csrf_validation",
        success: false,
        details: { 
          error: "Invalid cookie token",
          reason: cookieVerification.reason 
        },
      });
      return { 
        valid: false, 
        error: `CSRF protection: Invalid session token - ${cookieVerification.reason}` 
      };
    }

    const requestVerification = verifySignedCSRFToken(providedToken);
    if (!requestVerification.valid) {
      auditLog({
        userId: null,
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        action: "csrf_validation",
        success: false,
        details: { 
          error: "Invalid request token",
          reason: requestVerification.reason 
        },
      });
      return { 
        valid: false, 
        error: `CSRF protection: Invalid request token - ${requestVerification.reason}` 
      };
    }

    // Extract the actual tokens from signed tokens for comparison
    const cookieTokenValue = cookieToken.value.split(".")[0];
    const requestTokenValue = providedToken.split(".")[0];

    // Use timing-safe comparison for the tokens
    const cookieBuffer = Buffer.from(cookieTokenValue);
    const requestBuffer = Buffer.from(requestTokenValue);

    if (cookieBuffer.length !== requestBuffer.length) {
      auditLog({
        userId: null,
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        action: "csrf_validation",
        success: false,
        details: { error: "Token length mismatch" },
      });
      return { valid: false, error: "CSRF protection: Token mismatch" };
    }

    if (!timingSafeEqual(cookieBuffer, requestBuffer)) {
      auditLog({
        userId: null,
        event: SecurityEvent.SUSPICIOUS_ACTIVITY,
        action: "csrf_validation",
        success: false,
        details: { error: "Tokens do not match" },
      });
      return { valid: false, error: "CSRF protection: Token mismatch" };
    }

    // Tokens are valid and match
    return { valid: true };
  } catch (error) {
    console.error("[SECURITY] CSRF validation error:", error);
    auditLog({
      userId: null,
      event: SecurityEvent.SUSPICIOUS_ACTIVITY,
      action: "csrf_validation",
      success: false,
      details: { 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
    });
    return { 
      valid: false, 
      error: "CSRF protection: Validation error" 
    };
  }
}

/**
 * Set CSRF token cookie for the response
 */
export async function setCSRFTokenCookie(): Promise<string> {
  const token = generateCSRFToken();
  const signedToken = createSignedCSRFToken(token);
  
  const cookieStore = await cookies();
  cookieStore.set({
    name: CSRF_COOKIE_NAME,
    value: signedToken,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400, // 24 hours
    // Use __Host- prefix for additional security in production
    ...(process.env.NODE_ENV === "production" && {
      name: "__Host-csrf-token",
    }),
  });

  return signedToken;
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput<T extends Record<string, any>>(
  input: T
): T {
  const sanitized = { ...input };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      // Remove any HTML tags and scripts
      sanitized[key] = sanitized[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeInput(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Clean up old rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute