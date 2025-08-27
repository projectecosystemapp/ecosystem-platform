/**
 * Admin Utilities
 * 
 * Common utilities and helpers for admin operations
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if the current user is an admin
 */
export async function checkAdminRole(userId?: string): Promise<boolean> {
  try {
    const targetUserId = userId || (await auth()).userId;
    
    if (!targetUserId) {
      return false;
    }

    // First check Clerk metadata
    const user = await currentUser();
    const clerkMetadata = user?.publicMetadata as { role?: string } | undefined;
    
    if (clerkMetadata?.role === "admin") {
      return true;
    }

    // Fallback to database check
    const profile = await db.select({ role: profilesTable.role })
      .from(profilesTable)
      .where(eq(profilesTable.userId, targetUserId))
      .limit(1);

    return profile[0]?.role === "admin";
  } catch (error) {
    console.error("Error checking admin role:", error);
    return false;
  }
}

/**
 * Log admin action for audit trail
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: any
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    adminId,
    action,
    resourceType,
    resourceId,
    details,
    userAgent: "", // You can pass this from request headers
    ipAddress: "", // You can pass this from request
  };

  // TODO: Implement actual audit logging to database
  // For now, just console log (should be replaced with proper audit table)
  console.log("ADMIN_ACTION:", logEntry);
  
  // In production, you would insert this into an audit_logs table:
  // await db.insert(auditLogsTable).values(logEntry);
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Format currency amount from cents to dollar string
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Format large numbers with appropriate suffixes (K, M, B)
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + "B";
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toString();
}

/**
 * Calculate growth rate and format as string
 */
export function formatGrowthRate(current: number, previous: number): string {
  const growth = calculatePercentageChange(current, previous);
  const sign = growth > 0 ? "+" : "";
  return `${sign}${growth.toFixed(1)}%`;
}

/**
 * Validate date range for analytics queries
 */
export function validateDateRange(startDate: string, endDate: string): {
  isValid: boolean;
  error?: string;
  start?: Date;
  end?: Date;
} {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return { isValid: false, error: "Invalid date format" };
    }
    
    if (start >= end) {
      return { isValid: false, error: "Start date must be before end date" };
    }
    
    // Check if range is not too large (e.g., more than 1 year)
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > oneYear) {
      return { isValid: false, error: "Date range cannot exceed 1 year" };
    }
    
    return { isValid: true, start, end };
  } catch (error) {
    return { isValid: false, error: "Date parsing error" };
  }
}

/**
 * Sanitize search query to prevent injection attacks
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[<>"\\/]/g, "") // Remove potentially dangerous characters
    .trim()
    .substring(0, 100); // Limit length
}

/**
 * Generate CSV content from data array
 */
export function generateCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(",");
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(",")
  ).join("\n");
  
  return `${csvHeaders}\n${csvRows}`;
}

/**
 * Validate and sanitize admin input
 */
export function sanitizeAdminInput(input: any): any {
  if (typeof input === "string") {
    return input.trim().substring(0, 1000); // Limit string length
  }
  
  if (typeof input === "number") {
    // Ensure reasonable number ranges
    return Math.max(-1_000_000_000, Math.min(1_000_000_000, input));
  }
  
  if (Array.isArray(input)) {
    return input.slice(0, 100).map(sanitizeAdminInput); // Limit array size
  }
  
  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof key === "string" && key.length <= 100) {
        sanitized[key] = sanitizeAdminInput(value);
      }
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Common admin response wrapper with consistent structure
 */
export function createAdminResponse<T>(
  data: T,
  success: boolean = true,
  message?: string
): {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
} {
  return {
    success,
    data: success ? data : undefined,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, limit?: number): {
  page: number;
  limit: number;
  offset: number;
} {
  const validPage = Math.max(1, page || 1);
  const validLimit = Math.min(100, Math.max(1, limit || 20));
  const offset = (validPage - 1) * validLimit;
  
  return { page: validPage, limit: validLimit, offset };
}

/**
 * Admin notification types for different actions
 */
export enum AdminNotificationType {
  POINTS_ADJUSTED = "points_adjusted",
  SUBSCRIPTION_MODIFIED = "subscription_modified",
  PRICING_RULE_CREATED = "pricing_rule_created",
  SURGE_EVENT_CREATED = "surge_event_created",
  CAMPAIGN_CREATED = "campaign_created",
  TIER_UPDATED = "tier_updated",
  DATA_EXPORTED = "data_exported"
}

/**
 * Send admin notification (placeholder for future implementation)
 */
export async function sendAdminNotification(
  type: AdminNotificationType,
  adminId: string,
  details: any
): Promise<void> {
  // TODO: Implement actual notification system
  // This could integrate with email, Slack, or push notifications
  console.log(`ADMIN_NOTIFICATION: ${type}`, { adminId, details });
}

/**
 * Batch processing utility for large operations
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Rate limiting check for admin operations
 */
export function checkAdminRateLimit(adminId: string, operation: string): boolean {
  // TODO: Implement actual rate limiting using Redis or similar
  // For now, just return true (no limiting)
  return true;
}