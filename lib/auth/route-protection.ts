/**
 * Route Protection Middleware
 * Implements authorization checks per Master PRD requirements
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { profilesTable, providersTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export type UserRole = "guest" | "customer" | "provider" | "admin";

export interface AuthContext {
  userId: string | null;
  role: UserRole;
  providerId?: string;
  isAuthenticated: boolean;
}

/**
 * Get the current user's role from the database
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    // Check if user is in profiles table
    const profile = await db
      .select({ role: profilesTable.role })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (profile.length === 0) {
      return "customer"; // Default role for authenticated users without profile
    }

    // Check for admin role (stored in profile metadata or Clerk metadata)
    if (profile[0].role === "admin") {
      return "admin";
    }

    // Check if user is a provider
    const provider = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);

    if (provider.length > 0) {
      return "provider";
    }

    return "customer";
  } catch (error) {
    console.error("Error fetching user role:", error);
    return "customer"; // Safe default
  }
}

/**
 * Base authentication check - validates user is authenticated
 */
export async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const role = await getUserRole(userId);
  
  // Get provider ID if user is a provider
  let providerId: string | undefined;
  if (role === "provider") {
    const provider = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);
    
    if (provider.length > 0) {
      providerId = provider[0].id;
    }
  }

  return {
    userId,
    role,
    providerId,
    isAuthenticated: true
  };
}

/**
 * Require specific role(s) for access
 */
export async function requireRole(
  req: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthContext | NextResponse> {
  const authResult = await requireAuth(req);
  
  // If auth check failed, return the error response
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  // Check if user has one of the allowed roles
  if (!allowedRoles.includes(authResult.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Allow guest access but track authentication status
 */
export async function allowGuest(req: NextRequest): Promise<AuthContext> {
  const { userId } = auth();

  if (!userId) {
    return {
      userId: null,
      role: "guest",
      isAuthenticated: false
    };
  }

  const role = await getUserRole(userId);
  
  // Get provider ID if user is a provider
  let providerId: string | undefined;
  if (role === "provider") {
    const provider = await db
      .select({ id: providersTable.id })
      .from(providersTable)
      .where(eq(providersTable.userId, userId))
      .limit(1);
    
    if (provider.length > 0) {
      providerId = provider[0].id;
    }
  }

  return {
    userId,
    role,
    providerId,
    isAuthenticated: true
  };
}

/**
 * Verify user owns the resource they're trying to access
 */
export async function requireResourceOwnership(
  authContext: AuthContext,
  resourceOwnerId: string
): Promise<boolean> {
  // Admins can access any resource
  if (authContext.role === "admin") {
    return true;
  }

  // Check if user owns the resource
  return authContext.userId === resourceOwnerId;
}

/**
 * Verify provider owns the resource they're trying to access
 */
export async function requireProviderOwnership(
  authContext: AuthContext,
  providerId: string
): Promise<boolean> {
  // Admins can access any resource
  if (authContext.role === "admin") {
    return true;
  }

  // Check if provider owns the resource
  return authContext.providerId === providerId;
}

/**
 * Log authorization attempts for audit trail
 */
export async function logAuthAttempt(
  authContext: AuthContext,
  resource: string,
  action: string,
  allowed: boolean
) {
  // TODO: Implement audit logging to database
  console.log({
    timestamp: new Date().toISOString(),
    userId: authContext.userId,
    role: authContext.role,
    resource,
    action,
    allowed
  });
}

/**
 * HOF to wrap API routes with auth checks
 */
export function withAuth(
  handler: (req: NextRequest, authContext: AuthContext) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean;
    allowedRoles?: UserRole[];
    allowGuest?: boolean;
  } = { requireAuth: true }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      let authContext: AuthContext | NextResponse;

      if (options.allowGuest) {
        authContext = await allowGuest(req);
      } else if (options.allowedRoles) {
        authContext = await requireRole(req, options.allowedRoles);
      } else if (options.requireAuth) {
        authContext = await requireAuth(req);
      } else {
        authContext = await allowGuest(req);
      }

      // If auth check failed, return the error response
      if (authContext instanceof NextResponse) {
        return authContext;
      }

      // Call the actual handler with auth context
      return await handler(req, authContext as AuthContext);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}