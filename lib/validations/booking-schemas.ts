import { z } from "zod";

/**
 * Comprehensive booking validation schemas
 * Covers all booking operations including creation, updates, and filtering
 */

// Booking status enum validation
export const bookingStatusSchema = z.enum([
  "pending", 
  "confirmed", 
  "in_progress", 
  "completed", 
  "cancelled", 
  "no_show"
] as const);

// Base booking data schema
export const bookingDataSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
  customerId: z.string().min(1, "Customer ID is required"),
  
  // Service details
  serviceName: z.string()
    .min(2, "Service name must be at least 2 characters")
    .max(100, "Service name cannot exceed 100 characters")
    .trim(),
  
  servicePrice: z.number()
    .int("Service price must be an integer (in cents)")
    .min(100, "Service price must be at least $1.00")
    .max(1000000, "Service price cannot exceed $10,000"),
  
  serviceDuration: z.number()
    .int("Service duration must be an integer")
    .min(15, "Service duration must be at least 15 minutes")
    .max(480, "Service duration cannot exceed 8 hours"),
  
  // Booking time
  bookingDate: z.string()
    .datetime("Invalid date format - use ISO 8601")
    .refine(
      (date) => new Date(date) > new Date(),
      "Booking date must be in the future"
    ),
  
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format - use HH:MM (24-hour)"),
  
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format - use HH:MM (24-hour)"),
  
  // Notes
  customerNotes: z.string()
    .max(500, "Customer notes cannot exceed 500 characters")
    .trim()
    .optional(),
    
  // Payment amounts (calculated)
  totalAmount: z.number()
    .int("Total amount must be an integer (in cents)")
    .min(100, "Total amount must be at least $1.00"),
  
  platformFee: z.number()
    .int("Platform fee must be an integer (in cents)")
    .min(0, "Platform fee cannot be negative"),
  
  providerPayout: z.number()
    .int("Provider payout must be an integer (in cents)")
    .min(0, "Provider payout cannot be negative")
});

// Create booking schema (POST /api/bookings)
export const createBookingSchema = bookingDataSchema.extend({
  // Remove computed fields that shouldn't be provided by client
  totalAmount: z.never().optional(),
  platformFee: z.never().optional(), 
  providerPayout: z.never().optional()
}).refine(
  (data) => {
    // Validate end time is after start time
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: "End time must be after start time",
    path: ["endTime"]
  }
).refine(
  (data) => {
    // Validate time slot duration matches service duration
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const actualDuration = endMinutes - startMinutes;
    return actualDuration === data.serviceDuration;
  },
  {
    message: "Time slot duration must match service duration",
    path: ["serviceDuration"]
  }
);

// Update booking schema (PATCH /api/bookings/[id])
export const updateBookingSchema = z.object({
  status: bookingStatusSchema.optional(),
  
  providerNotes: z.string()
    .max(500, "Provider notes cannot exceed 500 characters")
    .trim()
    .optional(),
  
  cancellationReason: z.string()
    .max(200, "Cancellation reason cannot exceed 200 characters")
    .trim()
    .optional(),
    
  // Only allow updating these fields for specific status changes
  completedAt: z.string().datetime().optional()
}).refine(
  (data) => {
    // If status is cancelled, cancellation reason is required
    if (data.status === "cancelled" && !data.cancellationReason) {
      return false;
    }
    return true;
  },
  {
    message: "Cancellation reason is required when cancelling a booking",
    path: ["cancellationReason"]
  }
);

// Booking filters schema (GET /api/bookings)
export const bookingFiltersSchema = z.object({
  // Status filtering
  status: z.union([
    bookingStatusSchema,
    z.array(bookingStatusSchema)
  ]).optional(),
  
  // Date range filtering
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  
  // Provider/customer filtering
  providerId: z.string().uuid().optional(),
  customerId: z.string().optional(),
  
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  
  // Sorting
  sortBy: z.enum([
    "createdAt", 
    "bookingDate", 
    "updatedAt", 
    "totalAmount"
  ]).default("createdAt"),
  
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  
  // Search
  search: z.string().max(100).trim().optional()
});

// Provider availability slot schema
export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number()
    .int("Day of week must be an integer")
    .min(0, "Day of week must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "Day of week must be between 0 (Sunday) and 6 (Saturday)"),
  
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format - use HH:MM (24-hour)"),
  
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format - use HH:MM (24-hour)"),
  
  isActive: z.boolean().default(true)
}).refine(
  (data) => {
    // Validate end time is after start time
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: "End time must be after start time",
    path: ["endTime"]
  }
);

// Update provider availability schema (POST /api/providers/[id]/availability)
export const updateAvailabilitySchema = z.object({
  availability: z.array(availabilitySlotSchema)
    .max(21, "Maximum 3 slots per day (7 days × 3 slots = 21 total)")
    .optional(),
  
  blockedSlots: z.array(
    z.object({
      blockedDate: z.string().datetime("Invalid date format"),
      startTime: z.string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format")
        .optional(),
      endTime: z.string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format")
        .optional(),
      reason: z.string().max(200).trim().optional()
    })
  ).optional()
});

// Availability check schema (GET /api/providers/[id]/availability)
export const checkAvailabilitySchema = z.object({
  date: z.string().datetime("Invalid date format"),
  duration: z.number()
    .int("Duration must be an integer")
    .min(15, "Duration must be at least 15 minutes")
    .max(480, "Duration cannot exceed 8 hours")
    .optional(),
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format")
    .optional(),
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format")
    .optional()
});

// Payment intent creation schema
export const createPaymentIntentSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  
  amount: z.number()
    .int("Amount must be an integer (in cents)")
    .min(100, "Amount must be at least $1.00"),
  
  currency: z.enum(["usd", "eur", "gbp", "cad", "aud"]).default("usd"),
  
  customerId: z.string().optional(),
  
  metadata: z.record(z.string()).optional()
});

// Refund schema
export const createRefundSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID"),
  
  amount: z.number()
    .int("Refund amount must be an integer (in cents)")
    .min(0, "Refund amount cannot be negative")
    .optional(), // If not provided, refund full amount
  
  reason: z.enum([
    "requested_by_customer",
    "duplicate", 
    "fraudulent",
    "provider_cancellation",
    "no_show"
  ]).default("requested_by_customer"),
  
  metadata: z.record(z.string()).optional()
});

// Webhook validation schema
export const webhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.record(z.any())
  }),
  created: z.number(),
  livemode: z.boolean()
});

/**
 * Helper function to validate and parse request body
 */
export function validateBookingRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Format validation errors for API responses
 */
export function formatValidationErrors(error: z.ZodError) {
  return {
    message: "Validation failed",
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}

/**
 * Calculate booking amounts based on service price and authentication status
 */
export function calculateBookingAmounts(
  servicePrice: number, 
  isAuthenticated: boolean
): {
  totalAmount: number;
  platformFee: number;
  providerPayout: number;
} {
  const feeRate = isAuthenticated ? 0.10 : 0.20; // 10% for logged-in, 20% for guests
  const platformFee = Math.round(servicePrice * feeRate);
  const providerPayout = servicePrice - platformFee;
  
  return {
    totalAmount: servicePrice,
    platformFee,
    providerPayout
  };
}

/**
 * Validate time slot availability (helper for conflict detection)
 */
export function validateTimeSlot(
  date: string,
  startTime: string,
  endTime: string,
  existingBookings: Array<{ 
    bookingDate: Date; 
    startTime: string; 
    endTime: string;
    status: string;
  }>
): boolean {
  const bookingDate = new Date(date);
  const targetStart = timeToMinutes(startTime);
  const targetEnd = timeToMinutes(endTime);
  
  // Check against existing confirmed bookings on the same date
  for (const booking of existingBookings) {
    if (
      booking.bookingDate.toDateString() === bookingDate.toDateString() &&
      ["pending", "confirmed", "in_progress"].includes(booking.status)
    ) {
      const existingStart = timeToMinutes(booking.startTime);
      const existingEnd = timeToMinutes(booking.endTime);
      
      // Check for overlap
      if (targetStart < existingEnd && targetEnd > existingStart) {
        return false; // Conflict detected
      }
    }
  }
  
  return true; // No conflicts
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}