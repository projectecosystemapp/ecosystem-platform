"use client";

import { useState, useCallback, useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface UseErrorRecoveryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onError?: (error: Error, attemptNumber: number) => void;
  onSuccess?: () => void;
  fallbackData?: any;
  cacheKey?: string;
}

interface ErrorRecoveryState {
  isError: boolean;
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  data: any;
}

/**
 * Custom hook for error recovery with retry logic
 */
export function useErrorRecovery<T = any>(
  asyncFunction: () => Promise<T>,
  options: UseErrorRecoveryOptions = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    exponentialBackoff = true,
    onError,
    onSuccess,
    fallbackData,
    cacheKey,
  } = options;

  const [state, setState] = useState<ErrorRecoveryState>({
    isError: false,
    error: null,
    isRetrying: false,
    retryCount: 0,
    data: fallbackData || null,
  });

  const [isLoading, setIsLoading] = useState(false);

  // Load cached data if available
  useEffect(() => {
    if (cacheKey && typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`error-recovery-${cacheKey}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // Use cached data if it's less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setState(prev => ({ ...prev, data }));
          }
        }
      } catch (e) {
        console.error("Failed to load cached data:", e);
      }
    }
  }, [cacheKey]);

  const calculateDelay = useCallback((attemptNumber: number) => {
    if (!exponentialBackoff) return retryDelay;
    return Math.min(retryDelay * Math.pow(2, attemptNumber), 30000);
  }, [retryDelay, exponentialBackoff]);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setState(prev => ({ ...prev, isError: false, error: null }));

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setState(prev => ({ ...prev, isRetrying: true, retryCount: attempt }));
          const delay = calculateDelay(attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await asyncFunction();
        
        // Cache successful result
        if (cacheKey && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(
              `error-recovery-${cacheKey}`,
              JSON.stringify({ data: result, timestamp: Date.now() })
            );
          } catch (e) {
            console.error("Failed to cache data:", e);
          }
        }

        setState({
          isError: false,
          error: null,
          isRetrying: false,
          retryCount: 0,
          data: result,
        });
        
        setIsLoading(false);
        
        if (onSuccess) {
          onSuccess();
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Log to Sentry on each attempt
        if (attempt === maxRetries) {
          Sentry.captureException(error, {
            tags: {
              errorRecovery: true,
              finalAttempt: true,
              retryCount: attempt,
            },
          });
        }
        
        if (onError) {
          onError(lastError, attempt + 1);
        }

        // Don't retry on certain errors
        if (
          lastError.message?.includes("401") ||
          lastError.message?.includes("403") ||
          lastError.message?.includes("404")
        ) {
          break;
        }
      }
    }

    // All retries failed
    setState(prev => ({
      ...prev,
      isError: true,
      error: lastError,
      isRetrying: false,
      data: fallbackData || null,
    }));
    
    setIsLoading(false);
    throw lastError;
  }, [asyncFunction, maxRetries, calculateDelay, onError, onSuccess, fallbackData, cacheKey]);

  const reset = useCallback(() => {
    setState({
      isError: false,
      error: null,
      isRetrying: false,
      retryCount: 0,
      data: fallbackData || null,
    });
  }, [fallbackData]);

  const retry = useCallback(() => {
    return execute();
  }, [execute]);

  return {
    ...state,
    isLoading,
    execute,
    reset,
    retry,
  };
}

/**
 * Hook for handling transient network errors
 */
export function useNetworkErrorRecovery() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? navigator.onLine : true
  );
  const [networkError, setNetworkError] = useState<Error | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkError(null);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setNetworkError(new Error("Network connection lost"));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/health", {
        method: "HEAD",
        cache: "no-cache",
      });
      return response.ok;
    } catch (error) {
      setNetworkError(error as Error);
      return false;
    }
  }, []);

  return {
    isOnline,
    networkError,
    checkConnection,
  };
}

/**
 * Hook for graceful degradation with cached data
 */
export function useGracefulDegradation<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  options: {
    staleTime?: number;
    fallbackData?: T;
  } = {}
) {
  const { staleTime = 60000, fallbackData } = options; // Default 1 minute
  const [data, setData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cacheKey = `graceful-${key}`;
    
    // Try to load from cache first
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          setData(cachedData);
          setIsStale(age > staleTime);
          
          return { data: cachedData, isStale: age > staleTime };
        }
      } catch (e) {
        console.error("Cache read error:", e);
      }
      return null;
    };

    const cached = loadFromCache();
    
    // Fetch fresh data
    const fetchData = async () => {
      try {
        const freshData = await fetchFunction();
        
        // Update cache
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: freshData, timestamp: Date.now() })
          );
        } catch (e) {
          console.error("Cache write error:", e);
        }
        
        setData(freshData);
        setIsStale(false);
        setError(null);
      } catch (err) {
        setError(err as Error);
        
        // Fall back to cached or default data
        if (!cached?.data) {
          setData(fallbackData || null);
        }
        
        Sentry.captureException(err, {
          tags: { gracefulDegradation: true, cacheKey: key },
        });
      }
    };

    fetchData();
  }, [key, fetchFunction, staleTime, fallbackData]);

  return { data, isStale, error };
}