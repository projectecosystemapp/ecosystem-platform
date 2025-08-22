/**
 * Booking API Types
 * TypeScript interfaces for booking-related API requests and responses
 */

// Booking status enum
export type BookingStatus = 
  | "pending"
  | "confirmed" 
  | "completed"
  | "cancelled"
  | "no_show";

// Base booking data
export interface Booking {
  id: string;
  providerId: string;
  customerId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number; // in minutes
  bookingDate: Date;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  status: BookingStatus;
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
  customerNotes?: string;
  providerNotes?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extended booking with provider/customer info
export interface BookingWithDetails extends Booking {
  provider?: {
    id: string;
    displayName: string;
    profileImageUrl?: string;
    slug: string;
  };
  customer?: {
    id: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string;
  };
  transactions?: BookingTransaction[];
}

// Booking transaction
export interface BookingTransaction {
  id: string;
  bookingId: string;
  stripeChargeId?: string;
  amount: number;
  platformFee: number;
  providerPayout: number;
  status: "pending" | "completed" | "failed" | "refunded";
  processedAt?: Date;
  createdAt: Date;
}

// Booking creation request
export interface CreateBookingRequest {
  providerId: string;
  serviceName: string;
  servicePrice: number;
  serviceDuration: number;
  bookingDate: string; // ISO date string
  startTime: string;   // HH:MM format
  endTime: string;     // HH:MM format
  customerNotes?: string;
  csrfToken: string;
}

// Booking creation response
export interface CreateBookingResponse {
  success: boolean;
  booking: {
    id: string;
    providerId: string;
    serviceName: string;
    servicePrice: number;
    serviceDuration: number;
    bookingDate: Date;
    startTime: string;
    endTime: string;
    status: BookingStatus;
    totalAmount: number;
    platformFee: number;
    customerNotes?: string;
    createdAt: Date;
  };
  message: string;
}

// Booking list query parameters
export interface BookingListParams {
  type?: "upcoming" | "history";
  userType?: "customer" | "provider";
  page?: number;
  pageSize?: number;
  status?: BookingStatus;
}

// Booking list response
export interface BookingListResponse {
  bookings: BookingWithDetails[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  type: "upcoming" | "history";
  count?: number;
}

// Booking details response
export interface BookingDetailsResponse {
  booking: BookingWithDetails;
}

// Booking update request
export interface UpdateBookingRequest {
  status?: BookingStatus;
  notes?: string;
  cancellationReason?: string;
}

// Booking statistics
export interface BookingStatistics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  upcomingBookings: number;
  totalRevenue: number;
  averageRating?: number;
  thisMonth: {
    bookings: number;
    revenue: number;
  };
  lastMonth: {
    bookings: number;
    revenue: number;
  };
  recentBookings: Booking[];
}

// Booking confirmation request (after payment)
export interface ConfirmBookingRequest {
  stripePaymentIntentId: string;
}

// Booking confirmation response
export interface ConfirmBookingResponse {
  success: boolean;
  booking: Booking;
  message: string;
}

// Cancel booking request
export interface CancelBookingRequest {
  reason?: string;
  csrfToken: string;
}

// Cancel booking response
export interface CancelBookingResponse {
  success: boolean;
  booking: Booking;
  message: string;
  refundInfo?: {
    amount: number;
    refundId: string;
    status: string;
  };
}

// Complete booking request (provider action)
export interface CompleteBookingRequest {
  notes?: string;
  csrfToken: string;
}

// Complete booking response
export interface CompleteBookingResponse {
  success: boolean;
  booking: Booking;
  message: string;
}

// No-show booking request (provider action)
export interface NoShowBookingRequest {
  notes?: string;
  csrfToken: string;
}

// No-show booking response
export interface NoShowBookingResponse {
  success: boolean;
  booking: Booking;
  message: string;
}

// CSRF token response
export interface CsrfTokenResponse {
  csrfToken: string;
  expiresAt: number; // Unix timestamp
}

// Common error response
export interface BookingApiError {
  error: string;
  details?: any[];
  code?: string;
}

// Booking API response wrapper
export type BookingApiResponse<T> = {
  data: T;
  success: true;
} | {
  error: string;
  details?: any[];
  success: false;
};