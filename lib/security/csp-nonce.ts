/**
 * Content Security Policy Nonce Implementation
 * 
 * Provides secure nonce generation for inline scripts and styles
 * to prevent XSS attacks while allowing necessary inline code
 */

import { headers } from 'next/headers';

/**
 * Generate a secure CSP nonce using Web Crypto API (Edge runtime compatible)
 */
export function generateNonce(): string {
  // Use Web Crypto API for Edge runtime compatibility
  const array = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to base64
  const binaryString = String.fromCharCode(...array);
  return btoa(binaryString);
}

/**
 * Get the CSP nonce from request headers
 * This is set by the middleware
 */
export function getCSPNonce(): string | undefined {
  try {
    const headersList = headers();
    return headersList.get('x-csp-nonce') || undefined;
  } catch {
    // Headers not available (e.g., in static generation)
    return undefined;
  }
}

/**
 * Generate CSP header with nonce
 */
export function generateCSPHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Required for Stripe
      'https://js.stripe.com',
      'https://checkout.stripe.com',
      // Required for Clerk
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
      'https://challenges.cloudflare.com',
      // Development only
      ...(isDev ? ["'unsafe-eval'", 'http://localhost:*'] : []),
    ],
    'style-src': [
      "'self'",
      `'nonce-${nonce}'`,
      // Required for fonts
      'https://fonts.googleapis.com',
      // Required for Clerk
      'https://clerk.ecosystem-platform.com',
      'https://*.clerk.accounts.dev',
      // Allow inline styles with nonce in development
      ...(isDev ? ["'unsafe-inline'"] : []),
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
      ...(isDev ? ['http://localhost:*'] : []),
    ],
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
      ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
    ],
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
  
  // Build CSP string
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * React component props with nonce
 */
export interface NonceProps {
  nonce?: string;
}

/**
 * Hook to get CSP nonce in client components
 */
export function useCSPNonce(): string | undefined {
  if (typeof window === 'undefined') {
    return getCSPNonce();
  }
  
  // On client, get from meta tag
  const metaTag = document.querySelector('meta[property="csp-nonce"]');
  return metaTag?.getAttribute('content') || undefined;
}

/**
 * Add nonce to inline script
 */
export function nonceScript(nonce: string | undefined, script: string): string {
  if (!nonce) return script;
  return `<script nonce="${nonce}">${script}</script>`;
}

/**
 * Add nonce to inline style
 */
export function nonceStyle(nonce: string | undefined, style: string): string {
  if (!nonce) return style;
  return `<style nonce="${nonce}">${style}</style>`;
}

/**
 * Verify nonce format
 */
export function isValidNonce(nonce: string): boolean {
  // Nonces should be base64 encoded and at least 16 characters
  const nonceRegex = /^[A-Za-z0-9+/=]{16,}$/;
  return nonceRegex.test(nonce);
}