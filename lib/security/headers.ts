/**
 * Security Headers Configuration
 * 
 * Comprehensive security headers following OWASP best practices
 * for protecting against common web vulnerabilities
 */

import { NextResponse } from 'next/server';

/**
 * Content Security Policy directives
 * Configured for Clerk, Stripe, Supabase, and other third-party services
 */
export function getCSPDirectives(): string {
  const isDev = process.env.NODE_ENV === 'development';
  
  const directives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // 'unsafe-inline', // TODO: Remove this in production by using nonces or external scripts
      // 'unsafe-eval', // TODO: Remove this in production by using webpack config or external scripts
      'https://js.stripe.com',
      'https://checkout.stripe.com',
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
      'https://challenges.cloudflare.com',
      isDev && 'http://localhost:*',
    ].filter(Boolean),
    'style-src': [
      "'self'",
      // 'unsafe-inline', // TODO: Remove this in production by using external stylesheets or nonces
      'https://fonts.googleapis.com',
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
    ],
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'data:',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.supabase.co',
      'https://*.supabase.in',
      'https://img.clerk.com',
      'https://images.clerk.dev',
      'https://*.clerk.accounts.dev',
      'https://www.gravatar.com',
      'https://*.stripe.com',
      isDev && 'http://localhost:*',
    ].filter(Boolean),
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'https://*.supabase.in',
      'https://api.stripe.com',
      'https://checkout.stripe.com',
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
      'https://api.clerk.dev',
      'wss://*.supabase.co',
      'wss://*.supabase.in',
      isDev && 'http://localhost:*',
      isDev && 'ws://localhost:*',
    ].filter(Boolean),
    'frame-src': [
      "'self'",
      'https://js.stripe.com',
      'https://checkout.stripe.com',
      'https://hooks.stripe.com',
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
      'https://challenges.cloudflare.com',
    ],
    'frame-ancestors': ["'none'"],
    'form-action': [
      "'self'",
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
    ],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'media-src': ["'self'", 'blob:', 'data:'],
    'child-src': ["'self'", 'blob:'],
  };

  // Convert to CSP string
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Apply comprehensive security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  const csp = getCSPDirectives();
  response.headers.set('Content-Security-Policy', csp);
  
  // Strict Transport Security (HSTS)
  // Enforces HTTPS for 1 year, including subdomains
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');
  
  // XSS Protection (legacy but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy (formerly Feature Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  );
  
  // Prevent DNS prefetching
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  
  // Control browser features
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Disable client-side caching for sensitive data
  if (response.url?.includes('/api/') || response.url?.includes('/dashboard/')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }
  
  return response;
}

/**
 * CORS configuration for API routes
 */
export interface CORSConfig {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const defaultCORSConfig: CORSConfig = {
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  credentials: true,
};

/**
 * Apply CORS headers to response
 */
export function applyCORSHeaders(
  request: Request,
  response: NextResponse,
  config: CORSConfig = {}
): NextResponse {
  const mergedConfig = { ...defaultCORSConfig, ...config };
  const origin = request.headers.get('origin');
  
  // Determine allowed origins
  const allowedOrigins = mergedConfig.allowedOrigins || [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean) as string[];
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  // Set other CORS headers
  if (mergedConfig.allowedMethods?.length) {
    response.headers.set(
      'Access-Control-Allow-Methods',
      mergedConfig.allowedMethods.join(', ')
    );
  }
  
  if (mergedConfig.allowedHeaders?.length) {
    response.headers.set(
      'Access-Control-Allow-Headers',
      mergedConfig.allowedHeaders.join(', ')
    );
  }
  
  if (mergedConfig.exposedHeaders?.length) {
    response.headers.set(
      'Access-Control-Expose-Headers',
      mergedConfig.exposedHeaders.join(', ')
    );
  }
  
  if (mergedConfig.maxAge) {
    response.headers.set(
      'Access-Control-Max-Age',
      mergedConfig.maxAge.toString()
    );
  }
  
  if (mergedConfig.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }
  
  return response;
}

/**
 * Security headers for different route types
 */
export enum RouteType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  API = 'api',
  ADMIN = 'admin',
  WEBHOOK = 'webhook',
}

/**
 * Get security headers based on route type
 */
export function getSecurityHeadersForRoute(routeType: RouteType): Headers {
  const headers = new Headers();
  
  switch (routeType) {
    case RouteType.PUBLIC:
      // Less restrictive for public pages
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      break;
      
    case RouteType.AUTHENTICATED:
      // No caching for authenticated pages
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      headers.set('Pragma', 'no-cache');
      break;
      
    case RouteType.API:
      // API-specific headers
      headers.set('Cache-Control', 'no-store');
      headers.set('Content-Type', 'application/json');
      break;
      
    case RouteType.ADMIN:
      // Strictest security for admin routes
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      break;
      
    case RouteType.WEBHOOK:
      // Webhook-specific headers
      headers.set('Cache-Control', 'no-store');
      break;
  }
  
  return headers;
}