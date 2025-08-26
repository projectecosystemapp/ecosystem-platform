/**
 * API Gateway
 * 
 * Unified entry point for all API requests, routing to appropriate modules
 * and handling cross-cutting concerns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Result } from '@/modules/shared/domain/value-object';

export interface ApiRequest<T = any> {
  method: string;
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: T;
  headers: Record<string, string>;
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}

export interface ApiResponse<T = any> {
  status: number;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface RouteHandler {
  path: string;
  method: string;
  handler: (request: ApiRequest) => Promise<ApiResponse>;
  middleware?: Middleware[];
  rateLimit?: RateLimitConfig;
  auth?: AuthConfig;
}

export interface Middleware {
  name: string;
  execute: (request: ApiRequest, next: () => Promise<ApiResponse>) => Promise<ApiResponse>;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: ApiRequest) => string;
}

export interface AuthConfig {
  required: boolean;
  roles?: string[];
}

/**
 * API Gateway Class
 */
export class ApiGateway {
  private routes: Map<string, RouteHandler> = new Map();
  private globalMiddleware: Middleware[] = [];
  private version: string = '1.0.0';

  /**
   * Register a route handler
   */
  registerRoute(handler: RouteHandler): void {
    const key = `${handler.method.toUpperCase()}:${handler.path}`;
    this.routes.set(key, handler);
  }

  /**
   * Register multiple routes
   */
  registerRoutes(handlers: RouteHandler[]): void {
    handlers.forEach(handler => this.registerRoute(handler));
  }

  /**
   * Add global middleware
   */
  useGlobalMiddleware(middleware: Middleware): void {
    this.globalMiddleware.push(middleware);
  }

  /**
   * Process incoming request
   */
  async processRequest(request: NextRequest): Promise<NextResponse> {
    const apiRequest = await this.parseRequest(request);
    const routeKey = `${apiRequest.method}:${apiRequest.path}`;
    
    // Generate request ID for tracking
    const requestId = this.generateRequestId();
    
    try {
      // Find matching route
      const handler = this.findRoute(routeKey);
      if (!handler) {
        return this.createErrorResponse(404, 'Route not found', requestId);
      }

      // Check authentication if required
      if (handler.auth?.required && !apiRequest.user) {
        return this.createErrorResponse(401, 'Authentication required', requestId);
      }

      // Check authorization
      if (handler.auth?.roles && apiRequest.user) {
        if (!handler.auth.roles.includes(apiRequest.user.role)) {
          return this.createErrorResponse(403, 'Insufficient permissions', requestId);
        }
      }

      // Apply rate limiting
      if (handler.rateLimit) {
        const rateLimitResult = await this.checkRateLimit(apiRequest, handler.rateLimit);
        if (!rateLimitResult.allowed) {
          return this.createErrorResponse(429, 'Too many requests', requestId);
        }
      }

      // Execute middleware chain
      const response = await this.executeMiddlewareChain(
        apiRequest,
        [...this.globalMiddleware, ...(handler.middleware || [])],
        () => handler.handler(apiRequest)
      );

      // Add metadata to response
      response.metadata = {
        timestamp: new Date().toISOString(),
        requestId,
        version: this.version
      };

      return this.createSuccessResponse(response);

    } catch (error: any) {
      console.error(`Error processing request ${requestId}:`, error);
      return this.createErrorResponse(
        500,
        'Internal server error',
        requestId,
        error.message
      );
    }
  }

  /**
   * Parse Next.js request into ApiRequest
   */
  private async parseRequest(request: NextRequest): Promise<ApiRequest> {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const apiPath = '/' + pathSegments.slice(1).join('/'); // Remove /api prefix

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        body = await request.json();
      } catch {
        // Body might not be JSON
      }
    }

    // Extract user from auth header or session
    const user = await this.extractUser(request);

    return {
      method: request.method,
      path: apiPath,
      query: Object.fromEntries(url.searchParams),
      body,
      headers,
      user
    };
  }

  /**
   * Find matching route handler
   */
  private findRoute(routeKey: string): RouteHandler | undefined {
    // Direct match
    if (this.routes.has(routeKey)) {
      return this.routes.get(routeKey);
    }

    // Pattern matching for dynamic routes
    const [method, path] = routeKey.split(':');
    for (const [key, handler] of this.routes) {
      if (key.startsWith(method + ':')) {
        const pattern = key.split(':')[1];
        if (this.matchPath(path, pattern)) {
          return handler;
        }
      }
    }

    return undefined;
  }

  /**
   * Match path with pattern (supports :param and * wildcards)
   */
  private matchPath(path: string, pattern: string): boolean {
    const pathParts = path.split('/').filter(Boolean);
    const patternParts = pattern.split('/').filter(Boolean);

    if (pathParts.length !== patternParts.length && !pattern.includes('*')) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart === '*') {
        return true; // Wildcard matches everything after
      }

      if (!patternPart.startsWith(':') && patternPart !== pathPart) {
        return false; // Literal parts must match
      }
    }

    return true;
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddlewareChain(
    request: ApiRequest,
    middleware: Middleware[],
    finalHandler: () => Promise<ApiResponse>
  ): Promise<ApiResponse> {
    if (middleware.length === 0) {
      return finalHandler();
    }

    const [current, ...rest] = middleware;
    
    return current.execute(request, () => 
      this.executeMiddlewareChain(request, rest, finalHandler)
    );
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(
    request: ApiRequest,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining?: number }> {
    // Implementation would use Redis or in-memory cache
    // Simplified for now
    return { allowed: true, remaining: config.maxRequests };
  }

  /**
   * Extract user from request
   */
  private async extractUser(request: NextRequest): Promise<ApiRequest['user'] | undefined> {
    // Implementation would extract from JWT, session, etc.
    // Simplified for now
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // Decode JWT or validate token
      return {
        id: 'user-id',
        role: 'customer',
        email: 'user@example.com'
      };
    }
    return undefined;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create success response
   */
  private createSuccessResponse(response: ApiResponse): NextResponse {
    return NextResponse.json(response, { status: response.status || 200 });
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    status: number,
    message: string,
    requestId: string,
    details?: string
  ): NextResponse {
    return NextResponse.json(
      {
        status,
        error: message,
        details,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          version: this.version
        }
      },
      { status }
    );
  }
}

/**
 * Common Middleware Implementations
 */

export class LoggingMiddleware implements Middleware {
  name = 'logging';

  async execute(
    request: ApiRequest,
    next: () => Promise<ApiResponse>
  ): Promise<ApiResponse> {
    const start = Date.now();
    console.log(`[${request.method}] ${request.path} - Starting`);
    
    try {
      const response = await next();
      const duration = Date.now() - start;
      console.log(`[${request.method}] ${request.path} - Completed in ${duration}ms`);
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[${request.method}] ${request.path} - Failed in ${duration}ms`, error);
      throw error;
    }
  }
}

export class ValidationMiddleware implements Middleware {
  constructor(private schema: any) {}
  
  name = 'validation';

  async execute(
    request: ApiRequest,
    next: () => Promise<ApiResponse>
  ): Promise<ApiResponse> {
    // Validate request body against schema
    if (request.body && this.schema) {
      const validationResult = this.schema.safeParse(request.body);
      if (!validationResult.success) {
        return {
          status: 400,
          error: 'Validation failed',
          data: validationResult.error.errors
        };
      }
      request.body = validationResult.data;
    }
    
    return next();
  }
}

export class CorsMiddleware implements Middleware {
  constructor(private config: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
  }) {}
  
  name = 'cors';

  async execute(
    request: ApiRequest,
    next: () => Promise<ApiResponse>
  ): Promise<ApiResponse> {
    const response = await next();
    
    // Add CORS headers to response
    // Implementation would modify Next.js response headers
    
    return response;
  }
}

// Singleton instance
let gatewayInstance: ApiGateway | null = null;

export function getApiGateway(): ApiGateway {
  if (!gatewayInstance) {
    gatewayInstance = new ApiGateway();
    
    // Add default global middleware
    gatewayInstance.useGlobalMiddleware(new LoggingMiddleware());
  }
  
  return gatewayInstance;
}