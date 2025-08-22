/**
 * CSRF Token Hook
 * 
 * Provides easy access to CSRF token functionality in React components
 */

import { useEffect, useState } from 'react';
import { getCSRFTokenFromMeta, fetchWithCSRF } from '@/lib/security/csrf';

export interface UseCSRFReturn {
  token: string | null;
  fetchWithCSRF: typeof fetchWithCSRF;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to manage CSRF tokens in React components
 */
export function useCSRF(): UseCSRFReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeCSRF = async () => {
      try {
        // First, try to get token from meta tag
        let csrfToken = getCSRFTokenFromMeta();
        
        if (!csrfToken) {
          // If no token in meta, fetch from API to initialize
          const response = await fetch('/api/csrf', {
            method: 'GET',
            credentials: 'same-origin',
          });
          
          if (response.ok) {
            const data = await response.json();
            csrfToken = data.token;
            
            // Inject meta tag for future use
            if (csrfToken && typeof window !== 'undefined') {
              const meta = document.createElement('meta');
              meta.name = 'csrf-token';
              meta.content = csrfToken;
              document.head.appendChild(meta);
            }
          }
        }
        
        setToken(csrfToken);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize CSRF token:', err);
        setError('Failed to initialize CSRF protection');
      } finally {
        setIsLoading(false);
      }
    };

    initializeCSRF();
  }, []);

  return {
    token,
    fetchWithCSRF,
    isLoading,
    error,
  };
}

/**
 * Higher-order function to add CSRF token to form data
 */
export function withCSRFFormData(formData: FormData, token: string | null): FormData {
  if (token) {
    formData.append('_csrf', token);
  }
  return formData;
}

/**
 * Helper to create headers with CSRF token
 */
export function createCSRFHeaders(token: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['X-CSRF-Token'] = token;
  }
  
  return headers;
}