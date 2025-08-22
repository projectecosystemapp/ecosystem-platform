"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Booking,
  BookingWithDetails,
  CreateBookingRequest,
  CreateBookingResponse,
  BookingListParams,
  BookingListResponse,
  BookingDetailsResponse,
  CsrfTokenResponse,
  CancelBookingRequest,
  CompleteBookingRequest,
  BookingApiError,
} from "@/types/api/bookings";

/**
 * Custom hooks for booking-related API calls
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

// Hook for CSRF token management
export function useCsrfToken() {
  const { isSignedIn } = useAuth();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCsrfToken = useCallback(async () => {
    if (!isSignedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<CsrfTokenResponse>(`${API_BASE}/csrf`);
      setCsrfToken(response.csrfToken);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get CSRF token";
      setError(errorMessage);
      console.error("CSRF token error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn) {
      fetchCsrfToken();
    } else {
      setCsrfToken(null);
    }
  }, [isSignedIn, fetchCsrfToken]);

  return {
    csrfToken,
    isLoading,
    error,
    refreshToken: fetchCsrfToken,
  };
}

// Hook for creating bookings
export function useCreateBooking() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { csrfToken } = useCsrfToken();

  const createBooking = useCallback(async (
    bookingData: Omit<CreateBookingRequest, "csrfToken">
  ): Promise<CreateBookingResponse | null> => {
    if (!csrfToken) {
      throw new Error("CSRF token not available");
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<CreateBookingResponse>(`${API_BASE}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          ...bookingData,
          csrfToken,
        }),
      });

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create booking";
      setError(errorMessage);
      console.error("Create booking error:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [csrfToken]);

  return {
    createBooking,
    isLoading,
    error,
  };
}

// Hook for listing bookings
export function useBookings(params: BookingListParams = {}) {
  const { isSignedIn } = useAuth();
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  const fetchBookings = useCallback(async (queryParams: BookingListParams = {}) => {
    if (!isSignedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const searchParams = new URLSearchParams();
      
      Object.entries({ ...params, ...queryParams }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, value.toString());
        }
      });

      const response = await apiRequest<BookingListResponse>(
        `${API_BASE}/bookings?${searchParams.toString()}`
      );

      setBookings(response.bookings);
      
      if (response.pagination) {
        setPagination({
          page: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
          hasMore: response.pagination.hasMore,
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch bookings";
      setError(errorMessage);
      console.error("Fetch bookings error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, JSON.stringify(params)]);

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || isLoading) return;

    const nextPage = pagination.page + 1;
    
    try {
      const searchParams = new URLSearchParams();
      
      Object.entries({ ...params, page: nextPage }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.set(key, value.toString());
        }
      });

      const response = await apiRequest<BookingListResponse>(
        `${API_BASE}/bookings?${searchParams.toString()}`
      );

      setBookings(prev => [...prev, ...response.bookings]);
      
      if (response.pagination) {
        setPagination({
          page: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
          hasMore: response.pagination.hasMore,
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load more bookings";
      setError(errorMessage);
      console.error("Load more bookings error:", err);
    }
  }, [params, pagination.hasMore, pagination.page, isLoading]);

  const refreshBookings = useCallback(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (isSignedIn) {
      fetchBookings();
    } else {
      setBookings([]);
    }
  }, [isSignedIn, fetchBookings]);

  // Memoized data transformations
  const bookingData = useMemo(() => {
    return {
      all: bookings,
      upcoming: bookings.filter(booking => 
        ["pending", "confirmed"].includes(booking.status) &&
        new Date(booking.bookingDate) >= new Date()
      ),
      completed: bookings.filter(booking => booking.status === "completed"),
      cancelled: bookings.filter(booking => booking.status === "cancelled"),
      // Helper methods
      getBookingById: (id: string) => bookings.find(booking => booking.id === id),
      getBookingsByProvider: (providerId: string) => 
        bookings.filter(booking => booking.providerId === providerId),
      getBookingsByStatus: (status: string) => 
        bookings.filter(booking => booking.status === status),
    };
  }, [bookings]);

  return {
    bookings: bookingData,
    isLoading,
    error,
    pagination,
    loadMore,
    refreshBookings,
  };
}

// Hook for individual booking details
export function useBooking(bookingId: string | null) {
  const { isSignedIn } = useAuth();
  const [booking, setBooking] = useState<BookingWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async (id: string) => {
    if (!isSignedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest<BookingDetailsResponse>(
        `${API_BASE}/bookings/${encodeURIComponent(id)}`
      );
      setBooking(response.booking);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch booking details";
      setError(errorMessage);
      console.error("Fetch booking error:", err);
      setBooking(null);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const refreshBooking = useCallback(() => {
    if (bookingId) {
      fetchBooking(bookingId);
    }
  }, [bookingId, fetchBooking]);

  useEffect(() => {
    if (bookingId && isSignedIn) {
      fetchBooking(bookingId);
    } else {
      setBooking(null);
      setError(null);
    }
  }, [bookingId, isSignedIn, fetchBooking]);

  return {
    booking,
    isLoading,
    error,
    refreshBooking,
  };
}

// Hook for booking actions (cancel, complete, etc.)
export function useBookingActions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { csrfToken } = useCsrfToken();

  const cancelBooking = useCallback(async (
    bookingId: string,
    reason?: string
  ): Promise<boolean> => {
    if (!csrfToken) {
      throw new Error("CSRF token not available");
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiRequest(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          reason,
          csrfToken,
        }),
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to cancel booking";
      setError(errorMessage);
      console.error("Cancel booking error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [csrfToken]);

  const completeBooking = useCallback(async (
    bookingId: string,
    notes?: string
  ): Promise<boolean> => {
    if (!csrfToken) {
      throw new Error("CSRF token not available");
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiRequest(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}/complete`, {
        method: "POST",
        body: JSON.stringify({
          notes,
          csrfToken,
        }),
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to complete booking";
      setError(errorMessage);
      console.error("Complete booking error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [csrfToken]);

  const markNoShow = useCallback(async (
    bookingId: string,
    notes?: string
  ): Promise<boolean> => {
    if (!csrfToken) {
      throw new Error("CSRF token not available");
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiRequest(`${API_BASE}/bookings/${encodeURIComponent(bookingId)}/no-show`, {
        method: "POST",
        body: JSON.stringify({
          notes,
          csrfToken,
        }),
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to mark as no-show";
      setError(errorMessage);
      console.error("Mark no-show error:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [csrfToken]);

  return {
    cancelBooking,
    completeBooking,
    markNoShow,
    isLoading,
    error,
  };
}