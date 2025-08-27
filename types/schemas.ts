/**
 * Zod Validation Schemas
 * 
 * Runtime validation schemas that mirror TypeScript types.
 * Use these for API validation, form validation, and data parsing.
 */

import { z } from 'zod';

// ============================================================================
// ID Validation Schemas
// ============================================================================

export const userIdSchema = z.string().refine(
  (val) => val.startsWith('user_'),
  { message: 'Invalid user ID format' }
);

export const providerIdSchema = z.string().uuid({
  message: 'Invalid provider ID format',
});

export const bookingIdSchema = z.string().uuid({
  message: 'Invalid booking ID format',
});

export const serviceIdSchema = z.string().uuid({
  message: 'Invalid service ID format',
});

export const stripeCustomerIdSchema = z.string().refine(
  (val) => val.startsWith('cus_'),
  { message: 'Invalid Stripe customer ID format' }
);

export const stripeAccountIdSchema = z.string().refine(
  (val) => val.startsWith('acct_'),
  { message: 'Invalid Stripe account ID format' }
);

// ============================================================================
// Money & Currency Schemas
// ============================================================================

export const currencyCodeSchema = z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);

export const moneySchema = z.object({
  amount: z.number().int().min(0),
  currency: currencyCodeSchema,
  formatted: z.string().optional(),
});

// ============================================================================
// Date & Time Schemas
// ============================================================================

export const timeFormatSchema = z.string().regex(
  /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  { message: 'Invalid time format. Use HH:MM' }
);

export const timeSlotSchema = z.object({
  date: z.date(),
  startTime: timeFormatSchema,
  endTime: timeFormatSchema,
  available: z.boolean(),
});

export const dateRangeSchema = z.object({
  start: z.date(),
  end: z.date(),
}).refine(
  (data) => data.end >= data.start,
  { message: 'End date must be after start date' }
);

// ============================================================================
// Booking Schemas
// ============================================================================

export const bookingStatusSchema = z.enum([
  'INITIATED',
  'PENDING_PROVIDER',
  'ACCEPTED',
  'REJECTED',
  'PAYMENT_PENDING',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'COMPLETED',
  'CANCELLED',
]);

export const bookingSchema = z.object({
  id: bookingIdSchema,
  status: bookingStatusSchema,
  providerId: providerIdSchema,
  serviceId: serviceIdSchema,
  customerId: userIdSchema.optional(),
  guestEmail: z.string().email().optional(),
  bookingDate: z.date(),
  startTime: timeFormatSchema,
  endTime: timeFormatSchema,
  totalAmount: moneySchema,
  platformFee: moneySchema,
  providerPayout: moneySchema,
  confirmationCode: z.string(),
  customerNotes: z.string().max(500).optional(),
  providerNotes: z.string().max(500).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  confirmedAt: z.date().optional(),
  completedAt: z.date().optional(),
  cancelledAt: z.date().optional(),
});

// ============================================================================
// Provider Schemas
// ============================================================================

export const providerStatusSchema = z.enum([
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'BANNED',
]);

export const weeklyAvailabilitySchema = z.object({
  monday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
  tuesday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
  wednesday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
  thursday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
  friday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
  saturday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
  sunday: z.object({
    available: z.boolean(),
    slots: z.array(timeSlotSchema),
  }),
});

export const providerSchema = z.object({
  id: providerIdSchema,
  userId: userIdSchema,
  displayName: z.string().min(1).max(100),
  slug: z.string().min(1).max(100),
  status: providerStatusSchema,
  tagline: z.string().max(200).nullable(),
  bio: z.string().max(2000).nullable(),
  profileImageUrl: z.string().url().nullable(),
  coverImageUrl: z.string().url().nullable(),
  hourlyRate: moneySchema,
  rating: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
  verified: z.boolean(),
  hasInsurance: z.boolean(),
  yearsExperience: z.number().int().min(0).optional(),
  certifications: z.array(z.string()),
  specializations: z.array(z.string()),
  availability: weeklyAvailabilitySchema,
  responseTime: z.number().int().min(0), // In minutes
  completedBookings: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Service Schemas
// ============================================================================

export const serviceSchema = z.object({
  id: serviceIdSchema,
  providerId: providerIdSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  price: moneySchema,
  duration: z.number().int().min(15).max(480), // In minutes
  category: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Subscription Schemas
// ============================================================================

export const subscriptionStatusSchema = z.enum([
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'trialing',
  'unpaid',
]);

export const subscriptionSchema = z.object({
  id: z.string(),
  userId: userIdSchema,
  planId: z.string(),
  status: subscriptionStatusSchema,
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  cancelAtPeriodEnd: z.boolean(),
  price: moneySchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Review Schemas
// ============================================================================

export const reviewSchema = z.object({
  id: z.string().uuid(),
  bookingId: bookingIdSchema,
  providerId: providerIdSchema,
  customerId: userIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  wouldRecommend: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Notification Schemas
// ============================================================================

export const notificationTypeSchema = z.enum([
  'booking_confirmed',
  'booking_cancelled',
  'booking_reminder',
  'payment_received',
  'payment_failed',
  'review_received',
  'provider_message',
  'system_announcement',
]);

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: userIdSchema,
  type: notificationTypeSchema,
  title: z.string().max(200),
  message: z.string().max(1000),
  read: z.boolean(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date(),
  readAt: z.date().optional(),
});

// ============================================================================
// API Response Schemas
// ============================================================================

export const errorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'DATABASE_ERROR',
  'EXTERNAL_SERVICE_ERROR',
  'INSUFFICIENT_FUNDS',
  'BOOKING_CONFLICT',
  'PROVIDER_UNAVAILABLE',
  'SUBSCRIPTION_REQUIRED',
  'QUOTA_EXCEEDED',
]);

export const apiErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
  timestamp: z.date(),
});

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: apiErrorSchema,
    }),
  ]);

// ============================================================================
// Pagination Schemas
// ============================================================================

export const paginationParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      total: z.number().int().min(0),
      page: z.number().int().min(1),
      limit: z.number().int().min(1),
      totalPages: z.number().int().min(0),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  });

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safe parse with error formatting
 */
export function safeParse<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map(
    (err: any) => `${err.path.join('.')}: ${err.message}`
  );
  
  return { success: false, errors };
}

/**
 * Parse with throwing for critical paths
 */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}