/**
 * CSRF Protection Utilities - SECURED VERSION
 * 
 * Provides CSRF token generation, validation, and management
 * for protecting against Cross-Site Request Forgery attacks
 */

import crypto from 'crypto';

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32;

// Require CSRF_SECRET from environment - CRITICAL for security
const CSRF_SECRET = process.env.CSRF_SECRET;

// In production, enforce CSRF_SECRET strictly
if (process.env.NODE_ENV === 'production') {
  if (!CSRF_SECRET || CSRF_SECRET.length < 32) {
    console.error('FATAL: CSRF_SECRET is not properly configured in production');
    process.exit(1); // Terminate the application
  }
} else if (!CSRF_SECRET) {
  // In development, provide a warning but use a default
  console.warn(
    '⚠️  WARNING: CSRF_SECRET not set. Using default for development only. ' +
    'Generate one with: openssl rand -hex 32'
  );
  // Use a development-only default (NEVER use in production)
  process.env.CSRF_SECRET = 'development-only-secret-do-not-use-in-production';
}

const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a signed CSRF token with timestamp
 */
export function createSignedToken(token: string): string {
  const timestamp = Date.now();
  const data = `${token}.${timestamp}`;
  const signature = crypto
    .createHmac('sha256', process.env.CSRF_SECRET!)
    .update(data)
    .digest('hex');
  return `${data}.${signature}`;
}

/**
 * Verify a signed CSRF token with constant-time comparison
 */
export function verifySignedToken(signedToken: string, maxAge: number = 86400000): boolean {
  try {
    const parts = signedToken.split('.');
    if (parts.length !== 3) return false;

    const [token, timestamp, signature] = parts;
    const data = `${token}.${timestamp}`;
    
    // Verify signature with constant-time comparison
    const expectedSignature = crypto
      .createHmac('sha256', process.env.CSRF_SECRET!)
      .update(data)
      .digest('hex');
    
    // Use timing-safe comparison
    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      return false;
    }
    
    // Check token age
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > maxAge) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract CSRF token from headers or body
 */
export function extractCSRFToken(request: Request): string | null {
  // Check header first (preferred method)
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) return headerToken;
  
  // Check body for form submissions
  const contentType = request.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    // For JSON requests, the token would be in the body
    // This would need to be parsed in the middleware
    return null;
  }
  
  return null;
}

/**
 * CSRF token cookie options for production
 */
export const csrfCookieOptions = {
  name: CSRF_COOKIE_NAME,
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 86400, // 24 hours
};

/**
 * Check if a request method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  return !safeMethods.includes(method.toUpperCase());
}

/**
 * Check if a route should skip CSRF protection
 */
export function shouldSkipCSRF(pathname: string): boolean {
  const skipPaths = [
    '/api/stripe/webhooks',
    '/api/stripe/connect/webhooks',
    '/api/health',
    '/api/public',
  ];
  
  return skipPaths.some(path => pathname.startsWith(path));
}

/**
 * Generate CSRF meta tag for HTML pages
 */
export function generateCSRFMetaTag(token: string): string {
  return `<meta name="csrf-token" content="${token}">`;
}

/**
 * Client-side helper to get CSRF token from meta tag
 */
export function getCSRFTokenFromMeta(): string | null {
  if (typeof window === 'undefined') return null;
  
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}

/**
 * Add CSRF token to fetch requests
 */
export function fetchWithCSRF(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getCSRFTokenFromMeta();
  
  if (!token) {
    console.warn('No CSRF token found for request to:', url);
  }
  
  const headers = new Headers(options.headers);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
}
