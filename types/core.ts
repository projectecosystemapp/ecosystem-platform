/**
 * Core Type Definitions
 * 
 * Branded types and fundamental type utilities for the ecosystem marketplace.
 * These types ensure type safety and prevent common mistakes like passing
 * wrong ID types or mixing up entity types.
 */

// ============================================================================
// Branded Types - Prevent ID Mixing
// ============================================================================

/**
 * Create a branded type to ensure type safety for IDs
 */
type Brand<K, T> = K & { __brand: T };

// User & Profile IDs
export type UserId = Brand<string, 'UserId'>;
export type ProfileId = Brand<string, 'ProfileId'>;

// Provider & Service IDs
export type ProviderId = Brand<string, 'ProviderId'>;
export type ServiceId = Brand<string, 'ServiceId'>;

// Booking & Transaction IDs
export type BookingId = Brand<string, 'BookingId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type PaymentIntentId = Brand<string, 'PaymentIntentId'>;

// Subscription IDs
export type SubscriptionId = Brand<string, 'SubscriptionId'>;
export type SubscriptionPlanId = Brand<string, 'SubscriptionPlanId'>;

// Other Entity IDs
export type CategoryId = Brand<string, 'CategoryId'>;
export type ReviewId = Brand<string, 'ReviewId'>;
export type WebhookEventId = Brand<string, 'WebhookEventId'>;
export type NotificationId = Brand<string, 'NotificationId'>;

// Stripe IDs (for external consistency)
export type StripeCustomerId = Brand<string, 'StripeCustomerId'>;
export type StripeAccountId = Brand<string, 'StripeAccountId'>;
export type StripeSubscriptionId = Brand<string, 'StripeSubscriptionId'>;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep readonly type for immutability
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

/**
 * Nullable type utility
 */
export type Nullable<T> = T | null;

/**
 * Optional type utility
 */
export type Optional<T> = T | undefined;

/**
 * Extract non-nullable type
 */
export type NonNullableFields<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

// ============================================================================
// State Machines - Discriminated Unions
// ============================================================================

/**
 * Booking state machine with discriminated unions
 */
export type BookingState =
  | { status: 'INITIATED'; paymentIntent?: never; confirmedAt?: never; completedAt?: never }
  | { status: 'PENDING_PROVIDER'; paymentIntent?: never; confirmedAt?: never; completedAt?: never }
  | { status: 'ACCEPTED'; paymentIntent?: never; confirmedAt: Date; completedAt?: never }
  | { status: 'REJECTED'; paymentIntent?: never; confirmedAt?: never; completedAt?: never }
  | { status: 'PAYMENT_PENDING'; paymentIntent: string; confirmedAt: Date; completedAt?: never }
  | { status: 'PAYMENT_SUCCEEDED'; paymentIntent: string; confirmedAt: Date; completedAt?: never }
  | { status: 'PAYMENT_FAILED'; paymentIntent: string; confirmedAt: Date; completedAt?: never }
  | { status: 'COMPLETED'; paymentIntent: string; confirmedAt: Date; completedAt: Date }
  | { status: 'CANCELLED'; paymentIntent?: string; confirmedAt?: Date; completedAt?: never };

export type BookingStatus = BookingState['status'];

/**
 * Provider status with discriminated unions
 */
export type ProviderState =
  | { status: 'PENDING'; approvedAt?: never; suspendedAt?: never }
  | { status: 'ACTIVE'; approvedAt: Date; suspendedAt?: never }
  | { status: 'INACTIVE'; approvedAt: Date; suspendedAt?: never }
  | { status: 'SUSPENDED'; approvedAt: Date; suspendedAt: Date }
  | { status: 'BANNED'; approvedAt?: Date; suspendedAt?: Date };

export type ProviderStatus = ProviderState['status'];

/**
 * Subscription status
 */
export type SubscriptionStatus = 
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'trialing'
  | 'unpaid';

// ============================================================================
// Money & Currency Types
// ============================================================================

/**
 * Money type with currency
 */
export interface Money {
  readonly amount: number; // In smallest currency unit (cents for USD)
  readonly currency: CurrencyCode;
  readonly formatted?: string; // Human-readable format
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

// ============================================================================
// Time & Date Types
// ============================================================================

/**
 * Time slot for availability
 */
export interface TimeSlot {
  readonly date: Date;
  readonly startTime: string; // HH:MM format
  readonly endTime: string; // HH:MM format
  readonly available: boolean;
}

/**
 * Date range
 */
export interface DateRange {
  readonly start: Date;
  readonly end: Date;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
  readonly orderBy?: string;
  readonly orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly pagination: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export type ApiResponse<T = any> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: ApiError };

export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly timestamp: Date;
}

export type ErrorCode =
  // Client errors
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  // Server errors
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  // Business logic errors
  | 'INSUFFICIENT_FUNDS'
  | 'BOOKING_CONFLICT'
  | 'PROVIDER_UNAVAILABLE'
  | 'SUBSCRIPTION_REQUIRED'
  | 'QUOTA_EXCEEDED';

// ============================================================================
// Type Guards
// ============================================================================

export const isUserId = (value: any): value is UserId => 
  typeof value === 'string' && value.startsWith('user_');

export const isProviderId = (value: any): value is ProviderId =>
  typeof value === 'string' && value.length === 36; // UUID format

export const isBookingId = (value: any): value is BookingId =>
  typeof value === 'string' && value.length === 36; // UUID format

export const isApiError = (value: any): value is ApiError =>
  value && typeof value === 'object' && 'code' in value && 'message' in value;

export const isSuccessResponse = <T>(response: ApiResponse<T>): response is { success: true; data: T } =>
  response.success === true;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a branded ID with validation
 */
export function createUserId(id: string): UserId {
  if (!id.startsWith('user_')) {
    throw new Error(`Invalid user ID format: ${id}`);
  }
  return id as UserId;
}

export function createProviderId(id: string): ProviderId {
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new Error(`Invalid provider ID format: ${id}`);
  }
  return id as ProviderId;
}

export function createBookingId(id: string): BookingId {
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    throw new Error(`Invalid booking ID format: ${id}`);
  }
  return id as BookingId;
}

/**
 * Format money for display
 */
export function formatMoney(money: Money): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  });
  return formatter.format(money.amount / 100);
}

/**
 * Create API success response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create API error response
 */
export function errorResponse(code: ErrorCode, message: string, details?: Record<string, any>): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      timestamp: new Date(),
    },
  };
}