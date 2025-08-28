"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import type {
  UseProviderSearch,
  Provider,
  ProviderFilters,
  ProviderSearchResult,
  ProviderSearchResponse,
  ProviderResponse,
  ProviderAvailabilityResponse,
  ProviderAvailabilityParams,
  ApiError,
} from "@/types/search";

/**
 * Custom hooks for provider-related API calls
 */

// Base API configuration
const API_BASE = "/api";

// Custom fetch wrapper with error handling
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Hook for searching providers - implements canonical UseProviderSearch contract
export function useProviderSearch(initialFilters: ProviderFilters = {}): UseProviderSearch {
  const [result, setResult] = useState<ProviderSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<ProviderFilters>(initialFilters);

  const searchProviders = useCallback(async (searchFilters: ProviderSearchFilters = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      Object.entries({ ...filters, ...searchFilters }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, value.toString());
        }
      });

      const response = await apiRequest<ProviderSearchResponse>(
        `${API_BASE}/providers?${searchParams.toString()}`
      );

      setProviders(response.providers);
      setPagination({
        total: response.pagination.total,
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        hasMore: response.pagination.hasMore,
      });
      setFilters({ ...filters, ...searchFilters });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to search providers";
      setError(errorMessage);
      console.error("Provider search error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || isLoading) return;

    const nextPage = pagination.page + 1;
    setIsLoading(true);

    try {
      const searchParams = new URLSearchParams();
      
      Object.entries({ ...filters, page: nextPage }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, value.toString());
        }
      });

      const response = await apiRequest<ProviderSearchResponse>(
        `${API_BASE}/providers?${searchParams.toString()}`
      );

      setProviders(prev => [...prev, ...response.providers]);
      setPagination({
        total: response.pagination.total,
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        hasMore: response.pagination.hasMore,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load more providers";
      setError(errorMessage);
      console.error("Load more error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.hasMore, pagination.page, isLoading]);

  const clearResults = useCallback(() => {
    setProviders([]);
    setPagination({ total: 0, page: 1, totalPages: 0, hasMore: false });
    setError(null);
  }, []);

  // Auto-search on filters change
  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      searchProviders();
    }
  }, []); // Only run on mount to avoid infinite loops

  return {
    providers,
    isLoading,
    error,
    filters,
    pagination,
    searchProviders,
    loadMore,
    clearResults,
    setFilters,
  };
}

// Hook for getting a single provider
export function useProvider(providerId: string | null) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvider = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<ProviderResponse>(
        `${API_BASE}/providers/${encodeURIComponent(id)}`
      );
      setProvider(response.provider);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch provider";
      setError(errorMessage);
      console.error("Provider fetch error:", err);
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProvider = useCallback(() => {
    if (providerId) {
      fetchProvider(providerId);
    }
  }, [providerId, fetchProvider]);

  useEffect(() => {
    if (providerId) {
      fetchProvider(providerId);
    } else {
      setProvider(null);
      setError(null);
    }
  }, [providerId, fetchProvider]);

  return {
    provider,
    isLoading,
    error,
    refreshProvider,
  };
}

// Hook for provider availability
export function useProviderAvailability(
  providerId: string | null,
  params: ProviderAvailabilityParams = {}
) {
  const [availability, setAvailability] = useState<ProviderAvailabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async (
    id: string,
    availabilityParams: ProviderAvailabilityParams = {}
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      Object.entries({ ...params, ...availabilityParams }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, value.toString());
        }
      });

      const response = await apiRequest<ProviderAvailabilityResponse>(
        `${API_BASE}/providers/${encodeURIComponent(id)}/availability?${searchParams.toString()}`
      );
      
      setAvailability(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch availability";
      setError(errorMessage);
      console.error("Availability fetch error:", err);
      setAvailability(null);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  const refreshAvailability = useCallback((newParams?: ProviderAvailabilityParams) => {
    if (providerId) {
      fetchAvailability(providerId, newParams);
    }
  }, [providerId, fetchAvailability]);

  useEffect(() => {
    if (providerId) {
      fetchAvailability(providerId, params);
    } else {
      setAvailability(null);
      setError(null);
    }
  }, [providerId, fetchAvailability, JSON.stringify(params)]);

  // Memoized availability data for performance
  const availabilityData = useMemo(() => {
    if (!availability) return null;

    return {
      availability: availability.availability,
      summary: availability.summary,
      parameters: availability.parameters,
      // Helper methods
      getDayAvailability: (date: string) => 
        availability.availability.find(day => day.date === date),
      getAvailableSlots: (date: string) => 
        availability.availability
          .find(day => day.date === date)
          ?.slots.filter(slot => slot.available) || [],
      hasAvailabilityOnDate: (date: string) =>
        availability.availability
          .find(day => day.date === date)
          ?.summary.hasAvailability || false,
    };
  }, [availability]);

  return {
    availability: availabilityData,
    isLoading,
    error,
    refreshAvailability,
  };
}

// Hook for featured providers
export function useFeaturedProviders(limit: number = 6) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeaturedProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<ProviderSearchResponse>(
        `${API_BASE}/providers?featured=true&limit=${limit}`
      );
      setProviders(response.providers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch featured providers";
      setError(errorMessage);
      console.error("Featured providers error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeaturedProviders();
  }, [fetchFeaturedProviders]);

  return {
    providers,
    isLoading,
    error,
    refresh: fetchFeaturedProviders,
  };
}