/**
 * API Type Definitions
 * 
 * Standardized types for API requests, responses, and contracts.
 * All API routes should use these types for consistency.
 */

import { z } from 'zod';
import {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
  BookingId,
  ProviderId,
  UserId,
  NotificationId,
  ReviewId,
  ServiceId,
  Money,
  TimeSlot,
} from './core';

// ============================================================================
// Request Validation Schemas
// ============================================================================

/**
 * Pagination request schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
});

/**
 * Date range request schema
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * Money amount schema (in cents)
 */
export const moneySchema = z.object({
  amount: z.number().int().min(0),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']).default('USD'),
});

// ============================================================================
// Provider API Types
// ============================================================================

export const providerSearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
    radius: z.number().default(10),
  }).optional(),
  priceRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  availability: z.object({
    date: z.string().datetime(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }).optional(),
  ...paginationSchema.shape,
});

export type ProviderSearchRequest = z.infer<typeof providerSearchSchema>;
export type ProviderSearchResponse = ApiResponse<PaginatedResponse<ProviderSummary>>;

export interface ProviderSummary {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly slug: string;
  readonly tagline: string | null;
  readonly rating: number;
  readonly reviewCount: number;
  readonly hourlyRate: Money;
  readonly profileImageUrl: string | null;
  readonly distance?: number; // In kilometers
  readonly nextAvailable?: TimeSlot;
  readonly verified: boolean;
  readonly hasInsurance: boolean;
  readonly yearsExperience?: number;
}

export interface ProviderDetail extends ProviderSummary {
  readonly bio: string | null;
  readonly coverImageUrl: string | null;
  readonly services: ServiceSummary[];
  readonly availability: WeeklyAvailability;
  readonly certifications: string[];
  readonly specializations: string[];
  readonly responseTime: number; // In minutes
  readonly completedBookings: number;
}

// ============================================================================
// Service API Types
// ============================================================================

export interface ServiceSummary {
  readonly id: ServiceId;
  readonly name: string;
  readonly description: string | null;
  readonly price: Money;
  readonly duration: number; // In minutes
  readonly category: string;
  readonly isActive: boolean;
}

export const createServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: moneySchema,
  duration: z.number().int().min(15).max(480),
  category: z.string(),
  isActive: z.boolean().default(true),
});

export type CreateServiceRequest = z.infer<typeof createServiceSchema>;
export type CreateServiceResponse = ApiResponse<ServiceSummary>;

// ============================================================================
// Booking API Types
// ============================================================================

export const createBookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  bookingDate: z.string().datetime(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  customerNotes: z.string().max(500).optional(),
  // Guest checkout fields
  guestEmail: z.string().email().optional(),
  guestName: z.string().min(2).max(100).optional(),
  guestPhone: z.string().optional(),
  // Tracking
  referrer: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
export type CreateBookingResponse = ApiResponse<BookingSummary>;

export interface BookingSummary {
  readonly id: BookingId;
  readonly status: string;
  readonly providerId: ProviderId;
  readonly serviceId: ServiceId;
  readonly customerId?: UserId;
  readonly guestEmail?: string;
  readonly bookingDate: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly totalAmount: Money;
  readonly platformFee: Money;
  readonly providerPayout: Money;
  readonly confirmationCode: string;
  readonly createdAt: Date;
}

export interface BookingDetail extends BookingSummary {
  readonly provider: ProviderSummary;
  readonly service: ServiceSummary;
  readonly customerNotes?: string;
  readonly providerNotes?: string;
  readonly paymentIntentId?: string;
  readonly refundId?: string;
  readonly cancelledAt?: Date;
  readonly completedAt?: Date;
}

// ============================================================================
// Payment API Types
// ============================================================================

export const processPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  paymentMethodId: z.string(),
  returnUrl: z.string().url().optional(),
});

export type ProcessPaymentRequest = z.infer<typeof processPaymentSchema>;
export type ProcessPaymentResponse = ApiResponse<{
  clientSecret: string;
  paymentIntentId: string;
  requiresAction: boolean;
}>;

export interface PaymentSummary {
  readonly id: string;
  readonly amount: Money;
  readonly status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  readonly method: string;
  readonly createdAt: Date;
  readonly processedAt?: Date;
}

// ============================================================================
// Subscription API Types
// ============================================================================

export const createSubscriptionSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string(),
  couponCode: z.string().optional(),
});

export type CreateSubscriptionRequest = z.infer<typeof createSubscriptionSchema>;
export type CreateSubscriptionResponse = ApiResponse<SubscriptionSummary>;

export interface SubscriptionSummary {
  readonly id: string;
  readonly planId: string;
  readonly status: string;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly price: Money;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly data: Record<string, any>;
  readonly timestamp: Date;
  readonly signature: string;
}

export const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.any()),
  timestamp: z.string().datetime(),
  signature: z.string(),
});

// ============================================================================
// Notification API Types
// ============================================================================

export interface NotificationSummary {
  readonly id: NotificationId;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly read: boolean;
  readonly createdAt: Date;
  readonly readAt?: Date;
}

export const markNotificationReadSchema = z.object({
  notificationIds: z.array(z.string()),
});

// ============================================================================
// Availability Types
// ============================================================================

export interface WeeklyAvailability {
  readonly monday: DayAvailability;
  readonly tuesday: DayAvailability;
  readonly wednesday: DayAvailability;
  readonly thursday: DayAvailability;
  readonly friday: DayAvailability;
  readonly saturday: DayAvailability;
  readonly sunday: DayAvailability;
}

export interface DayAvailability {
  readonly available: boolean;
  readonly slots: TimeSlot[];
}

// ============================================================================
// Review API Types
// ============================================================================

export const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  wouldRecommend: z.boolean(),
});

export type CreateReviewRequest = z.infer<typeof createReviewSchema>;
export type CreateReviewResponse = ApiResponse<ReviewSummary>;

export interface ReviewSummary {
  readonly id: ReviewId;
  readonly bookingId: BookingId;
  readonly rating: number;
  readonly comment?: string;
  readonly wouldRecommend: boolean;
  readonly createdAt: Date;
  readonly customerName: string;
  readonly customerAvatar?: string;
}

// ============================================================================
// Type Guards for API Types
// ============================================================================

export const isProviderSearchRequest = (value: any): value is ProviderSearchRequest => {
  return providerSearchSchema.safeParse(value).success;
};

export const isCreateBookingRequest = (value: any): value is CreateBookingRequest => {
  return createBookingSchema.safeParse(value).success;
};

export const isProcessPaymentRequest = (value: any): value is ProcessPaymentRequest => {
  return processPaymentSchema.safeParse(value).success;
};