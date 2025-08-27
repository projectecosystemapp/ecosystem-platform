/**
 * Next.js Middleware with Comprehensive Security
 * 
 * Implements defense-in-depth security strategy:
 * - CSRF Protection
 * - Security Headers (CSP, HSTS, etc.)
 * - Rate Limiting
 * - Authentication & Authorization
 * - Request Validation
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import { 
  applySecurityHeaders, 
  applyCORSHeaders, 
  RouteType, 
  getSecurityHeadersForRoute 
} from "@/lib/security/headers";
import { 
  generateCSRFToken, 
  createSignedToken, 
  verifySignedToken, 
  requiresCSRFProtection, 
  shouldSkipCSRF, 
  csrfCookieOptions 
} from "@/lib/security/csrf";
import { rateLimit, getRateLimitConfig } from "@/lib/security/rate-limit";
import { generateNonce, generateCSPHeader } from "@/lib/security/csp-nonce";

// Route matchers for different protection levels
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/become-a-provider(.*)",
  "/api/stripe/connect/accounts(.*)",
  "/api/stripe/connect/link",
  "/api/bookings(.*)",
  "/api/user(.*)",
  "/api/provider/manage(.*)",
]);

const isPublicApiRoute = createRouteMatcher([
  "/api/stripe/webhooks(.*)",
  "/api/stripe/connect/webhooks(.*)",
  "/api/webhooks/subscriptions(.*)",
  "/api/providers/search",
  "/api/providers/[slug]",
  "/api/health",
]);

const isAdminRoute = createRouteMatcher([
  "/dashboard/admin(.*)",
  "/api/admin(.*)",
]);

const isWebhookRoute = createRouteMatcher([
  "/api/stripe/webhooks(.*)",
  "/api/stripe/connect/webhooks(.*)",
  "/api/clerk/webhooks(.*)",
]);

/**
 * Main middleware function with Clerk integration
 */
export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims } = await auth();
  const pathname = req.nextUrl.pathname;
  const method = req.method;
  
  // Generate CSP nonce for this request
  const nonce = generateNonce();
  
  // Create response with nonce header
  let response = NextResponse.next();
  response.headers.set('x-csp-nonce', nonce);
  
  // Step 1: Apply rate limiting (except for webhooks)
  if (!isWebhookRoute(req)) {
    const rateLimitConfig = getRateLimitConfig(pathname);
    const rateLimitResult = await rateLimit(req, rateLimitConfig);
    
    if (!rateLimitResult.success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: rateLimitResult.headers,
      });
    }
    
    // Add rate limit headers to response
    rateLimitResult.headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
  }
  
  // Step 2: CSRF Protection
  if (!shouldSkipCSRF(pathname) && requiresCSRFProtection(method)) {
    // Get CSRF token from cookie
    const cookieToken = req.cookies.get(csrfCookieOptions.name);
    
    if (!cookieToken) {
      // No CSRF token, generate new one for GET requests
      if (method === 'GET') {
        const token = generateCSRFToken();
        const signedToken = createSignedToken(token);
        response.cookies.set({
          ...csrfCookieOptions,
          value: signedToken,
        });
      } else {
        // Non-GET request without CSRF token
        return new NextResponse('CSRF token missing', { status: 403 });
      }
    } else {
      // Verify CSRF token for state-changing requests
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const headerToken = req.headers.get('x-csrf-token');
        
        if (!headerToken) {
          return new NextResponse('CSRF token header missing', { status: 403 });
        }
        
        // Verify the token
        if (!verifySignedToken(headerToken)) {
          return new NextResponse('Invalid CSRF token', { status: 403 });
        }
      }
    }
  }
  
  // Step 3: Authentication & Authorization
  if (isProtectedRoute(req)) {
    if (!userId) {
      // Redirect to login for protected routes
      await auth().protect();
    }
    
    // Admin route authorization
    if (isAdminRoute(req)) {
      const metadata = sessionClaims?.metadata as { role?: string } | undefined;
      const isAdmin = metadata?.role === "admin";
      
      if (!isAdmin) {
        return new NextResponse(
          JSON.stringify({ error: "Unauthorized: Admin access required" }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
  }
  
  // Step 4: Determine route type for security headers
  let routeType: RouteType;
  if (isWebhookRoute(req)) {
    routeType = RouteType.WEBHOOK;
  } else if (isAdminRoute(req)) {
    routeType = RouteType.ADMIN;
  } else if (pathname.startsWith('/api/')) {
    routeType = RouteType.API;
  } else if (isProtectedRoute(req)) {
    routeType = RouteType.AUTHENTICATED;
  } else {
    routeType = RouteType.PUBLIC;
  }
  
  // Step 5: Apply security headers based on route type
  const routeHeaders = getSecurityHeadersForRoute(routeType);
  routeHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  
  // Step 6: Apply comprehensive security headers with nonce
  response = applySecurityHeaders(response, nonce);
  
  // Set CSP header with nonce for production
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CSP === 'true') {
    const cspHeader = generateCSPHeader(nonce);
    response.headers.set('Content-Security-Policy', cspHeader);
  }
  
  // Step 7: Apply CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    // Configure CORS based on route type
    const corsConfig = isPublicApiRoute(req) 
      ? { allowedOrigins: ['*'] } // Public APIs can be accessed from anywhere
      : {}; // Default CORS config for protected APIs
    
    response = applyCORSHeaders(req, response, corsConfig);
    
    // Handle preflight requests
    if (method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }
  
  // Step 8: Add additional security context to request
  if (userId) {
    response.headers.set('X-User-ID', userId);
  }
  
  // Step 9: Security logging for sensitive operations
  if (isAdminRoute(req) || pathname.includes('/api/payment')) {
    console.log('Security Audit Log:', {
      timestamp: new Date().toISOString(),
      userId,
      method,
      pathname,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent'),
    });
  }
  
  // Step 10: Add security headers for embedding prevention
  if (!pathname.startsWith('/api/')) {
    // Prevent embedding in iframes (except for Stripe/Clerk frames)
    response.headers.set('X-Frame-Options', 'DENY');
  }
  
  return response;
});

/**
 * Middleware configuration
 * Runs on all routes except static files and Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt (static files)
     * - Public assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|eot)).*)",
    // Always run for API routes
    "/api/(.*)",
  ],
};