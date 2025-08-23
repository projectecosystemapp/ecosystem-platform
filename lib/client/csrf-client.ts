/**
 * Client-side CSRF Protection Utilities
 * 
 * Provides utilities for handling CSRF tokens in client-side requests
 */

import { useState, useEffect } from 'react';

/**
 * Get CSRF token from cookie (for reading on client)
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === '__Host-csrf-token' || name === 'csrf-token') {
      return decodeURIComponent(value);
    }
  }
  
  return null;
}

/**
 * Get CSRF token from meta tag
 */
export function getCSRFTokenFromMeta(): string | null {
  if (typeof document === 'undefined') return null;
  
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}

/**
 * Get CSRF token from any available source
 */
export function getCSRFToken(): string | null {
  // Try meta tag first (preferred for SSR)
  const metaToken = getCSRFTokenFromMeta();
  if (metaToken) return metaToken;
  
  // Fall back to cookie
  return getCSRFTokenFromCookie();
}

/**
 * Fetch wrapper that automatically includes CSRF token
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getCSRFToken();
  
  if (!token) {
    console.warn('[Security] No CSRF token available for request to:', url);
  }
  
  const headers = new Headers(options.headers);
  
  // Add CSRF token header if we have one
  if (token) {
    headers.set('x-csrf-token', token);
  }
  
  // Ensure credentials are included for same-origin requests
  const enhancedOptions: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials || 'same-origin',
  };
  
  return fetch(url, enhancedOptions);
}

/**
 * Server action wrapper with CSRF protection
 * Use this when calling server actions from the client
 */
export async function callServerAction<T extends Record<string, any>, R>(
  action: (data: T & { csrfToken?: string }) => Promise<R>,
  data: T
): Promise<R> {
  const csrfToken = getCSRFToken();
  
  if (!csrfToken) {
    console.error('[Security] CSRF token required for server action');
    throw new Error('Security validation failed. Please refresh the page and try again.');
  }
  
  // Add CSRF token to the data
  const enhancedData = {
    ...data,
    csrfToken,
  };
  
  try {
    return await action(enhancedData);
  } catch (error) {
    // Handle CSRF-specific errors
    if (error instanceof Error && error.message.includes('CSRF')) {
      // Token might be expired, suggest page refresh
      throw new Error('Security token expired. Please refresh the page and try again.');
    }
    throw error;
  }
}

/**
 * Hook for managing CSRF tokens in React components
 */
export function useCSRFToken(): {
  token: string | null;
  refreshToken: () => Promise<void>;
  fetchWithToken: (url: string, options?: RequestInit) => Promise<Response>;
} {
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    // Get initial token
    setToken(getCSRFToken());
    
    // Listen for token updates (if using a global state manager)
    const handleTokenUpdate = () => {
      setToken(getCSRFToken());
    };
    
    window.addEventListener('csrf-token-updated', handleTokenUpdate);
    return () => {
      window.removeEventListener('csrf-token-updated', handleTokenUpdate);
    };
  }, []);
  
  const refreshToken = async () => {
    // Request a new token from the server
    try {
      const response = await fetch('/api/csrf/refresh', {
        method: 'GET',
        credentials: 'same-origin',
      });
      
      if (response.ok) {
        // Token will be set in cookie by server
        // Update local state
        setTimeout(() => {
          setToken(getCSRFToken());
          window.dispatchEvent(new Event('csrf-token-updated'));
        }, 100);
      }
    } catch (error) {
      console.error('[Security] Failed to refresh CSRF token:', error);
    }
  };
  
  const fetchWithToken = (url: string, options?: RequestInit) => {
    return fetchWithCSRF(url, options);
  };
  
  return {
    token,
    refreshToken,
    fetchWithToken,
  };
}

// React hooks are imported at the top of the file