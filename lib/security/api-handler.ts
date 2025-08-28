/**
 * Secure API Route Handler
 * 
 * Wrapper for API routes with built-in security features
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { validateApiRequest } from './validation';
import { logSecurityEvent, SecurityAuditLevel } from './config';
import { withRateLimit } from './rate-limit';

export type ApiHandler<T = any> = (
  request: NextRequest,
  context: ApiContext
) => Promise<NextResponse<T>>;

export interface ApiContext {
  userId?: string | null;
  params?: Record<string, string>;
  searchParams?: URLSearchParams;
}

export interface SecureApiOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  rateLimit?: {
    requests: number;
    window: string;
  };
  validateBody?: z.ZodSchema;
  validateQuery?: z.ZodSchema;
  allowedMethods?: string[];
  auditLog?: boolean;
}

/**
 * Create a secure API route handler
 */
export function createSecureApiHandler<T = any>(
  handler: ApiHandler<T>,
  options: SecureApiOptions = {}
): (request: NextRequest, props?: any) => Promise<NextResponse<unknown>> {
  return async (request: NextRequest, props?: any) => {
    try {
      // Extract params from props (Next.js 14+ format)
      const params = props?.params ? await props.params : {};
      
      // Check allowed methods
      if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
        return NextResponse.json(
          { error: `Method ${request.method} not allowed` },
          { status: 405 }
        );
      }
      
      const processRequest = async () => {
        // Authentication check
        let userId: string | null = null;
        if (options.requireAuth || options.requireAdmin) {
          const { userId: clerkUserId, sessionClaims } = await auth();
          
          if (!clerkUserId) {
            return NextResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            );
          }
          
          userId = clerkUserId;
          
          // Admin check
          if (options.requireAdmin) {
            const metadata = sessionClaims?.metadata as { role?: string } | undefined;
            const isAdmin = metadata?.role === 'admin';
            
            if (!isAdmin) {
              logSecurityEvent(
                SecurityAuditLevel.WARNING,
                'Unauthorized admin access attempt',
                { userId, path: request.url }
              );
              
              return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
              );
            }
          }
        }
        
        // Validate request body if schema provided
        let validatedBody: any = undefined;
        if (options.validateBody && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
          const validation = await validateApiRequest(request, options.validateBody);
          
          if (!validation.success) {
            return NextResponse.json(
              { error: validation.error },
              { status: 400 }
            );
          }
          
          validatedBody = validation.data;
        }
        
        // Validate query parameters if schema provided
        let validatedQuery: any = undefined;
        if (options.validateQuery) {
          const searchParams = new URL(request.url).searchParams;
          const queryObject = Object.fromEntries(searchParams.entries());
          
          try {
            validatedQuery = options.validateQuery.parse(queryObject);
          } catch (error) {
            if (error instanceof z.ZodError) {
              return NextResponse.json(
                { error: error.issues[0]?.message || 'Invalid query parameters' },
                { status: 400 }
              );
            }
          }
        }
        
        // Create context
        const context: ApiContext = {
          userId,
          params,
          searchParams: new URL(request.url).searchParams,
        };
        
        // Audit logging if enabled
        if (options.auditLog) {
          logSecurityEvent(
            SecurityAuditLevel.INFO,
            'API request',
            {
              userId,
              method: request.method,
              path: request.url,
              ip: request.headers.get('x-forwarded-for') || 'unknown',
            }
          );
        }
        
        // Call the actual handler with validated data
        const modifiedRequest = request as NextRequest;
        if (validatedBody) {
          // Attach validated body to request
          (modifiedRequest as any).validatedBody = validatedBody;
        }
        if (validatedQuery) {
          // Attach validated query to request
          (modifiedRequest as any).validatedQuery = validatedQuery;
        }
        
        const response = await handler(modifiedRequest, context);
        
        // Add security headers to response
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        
        return response as NextResponse<unknown>;
      };
      
      // Apply rate limiting if configured
      if (options.rateLimit) {
        const rateLimitWrapper = async () => {
          return await processRequest();
        };
        
        return await withRateLimit(request, rateLimitWrapper);
      }
      
      return await processRequest();
      
    } catch (error) {
      // Log unexpected errors
      logSecurityEvent(
        SecurityAuditLevel.ERROR,
        'API handler error',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          path: request.url,
        }
      );
      
      // Return generic error to avoid leaking information
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Helper to extract validated body from request
 */
export function getValidatedBody<T>(request: NextRequest): T | undefined {
  return (request as any).validatedBody;
}

/**
 * Helper to extract validated query from request
 */
export function getValidatedQuery<T>(request: NextRequest): T | undefined {
  return (request as any).validatedQuery;
}

/**
 * Example usage of secure API handler
 */
export const exampleApiHandler = createSecureApiHandler(
  async (request, context) => {
    // Access validated data
    const body = getValidatedBody<{ name: string; email: string }>(request);
    const query = getValidatedQuery<{ page: number; limit: number }>(request);
    
    // Your API logic here
    return NextResponse.json({
      message: 'Success',
      userId: context.userId,
      data: { body, query },
    });
  },
  {
    requireAuth: true,
    validateBody: z.object({
      name: z.string().min(1).max(100),
      email: z.string().email(),
    }),
    validateQuery: z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    }),
    rateLimit: {
      requests: 10,
      window: '1m',
    },
    auditLog: true,
  }
);

/**
 * Create API response with consistent format
 */
export function createApiResponse<T>(
  data: T,
  options?: {
    status?: number;
    headers?: Record<string, string>;
    message?: string;
  }
): NextResponse {
  const response = NextResponse.json(
    {
      success: true,
      message: options?.message,
      data,
      timestamp: new Date().toISOString(),
    },
    { status: options?.status || 200 }
  );
  
  // Add custom headers
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return response;
}

/**
 * Create API error response with consistent format
 */
export function createApiError(
  message: string,
  options?: {
    status?: number;
    code?: string;
    details?: any;
  }
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code: options?.code,
        details: options?.details,
      },
      timestamp: new Date().toISOString(),
    },
    { status: options?.status || 400 }
  );
}