/**
 * CORS Configuration
 * Centralized CORS settings to prevent security vulnerabilities
 * 
 * SECURITY: Never use wildcard (*) origins in production.
 * Always specify explicit allowed origins.
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://yourdomain.com', // Replace with your production domain
  'https://www.yourdomain.com', // Replace with your production domain
].filter(Boolean);

/**
 * Get secure CORS headers for API responses
 * @param origin - Origin header from the request
 * @returns Object containing CORS headers
 */
export function getCorsHeaders(origin?: string | null): Record<string, string> {
  // Default to first allowed origin if no origin provided
  let allowedOrigin = ALLOWED_ORIGINS[0];
  
  // Check if the request origin is in our allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    allowedOrigin = origin;
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin',
  };
}

/**
 * Handle CORS preflight requests
 * @param request - The incoming request
 * @returns Response for OPTIONS requests
 */
export function handleCorsPreflightRequest(request: Request): Response {
  const origin = request.headers.get('origin');
  const headers = getCorsHeaders(origin);
  
  return new Response(null, {
    status: 200,
    headers,
  });
}

/**
 * Apply CORS headers to an existing response
 * @param response - The response to modify
 * @param origin - Origin header from the request
 * @returns Response with CORS headers applied
 */
export function applyCorsHeaders(response: Response, origin?: string | null): Response {
  const corsHeaders = getCorsHeaders(origin);
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * Check if an origin is allowed
 * @param origin - Origin to check
 * @returns Boolean indicating if origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Secure CORS wrapper for API routes
 * @param handler - The API route handler
 * @returns Wrapped handler with CORS protection
 */
export function withSecureCors<T extends Request>(
  handler: (req: T) => Promise<Response>
) {
  return async (req: T): Promise<Response> => {
    const origin = req.headers.get('origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return handleCorsPreflightRequest(req);
    }
    
    // Execute the handler
    const response = await handler(req);
    
    // Apply CORS headers to the response
    return applyCorsHeaders(response, origin);
  };
}