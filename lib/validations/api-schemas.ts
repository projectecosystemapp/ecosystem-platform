import { z } from "zod";

/**
 * Common validation patterns and constraints
 */
const VALIDATION_RULES = {
  // String length limits
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_BIO_LENGTH: 2000,
  MAX_URL_LENGTH: 2048,
  
  // Numeric limits
  MIN_PRICE: 0,
  MAX_PRICE: 1000000, // $10,000 in cents
  MIN_DURATION: 15, // 15 minutes
  MAX_DURATION: 480, // 8 hours
  MAX_QUANTITY: 100,
  
  // Rate limits
  MIN_FEE_PERCENT: 0,
  MAX_FEE_PERCENT: 30, // Maximum 30% platform fee
  
  // Array limits
  MAX_SERVICES: 20,
  MAX_IMAGES: 12,
  MAX_LINE_ITEMS: 10,
} as const;

/**
 * Reusable field schemas
 */
const emailSchema = z.string().email("Invalid email address").toLowerCase();
const urlSchema = z.string().url("Invalid URL").max(VALIDATION_RULES.MAX_URL_LENGTH);
const currencySchema = z.enum(["usd", "eur", "gbp", "cad", "aud"]).default("usd");
const countrySchema = z.string().length(2, "Country code must be 2 characters").toUpperCase();

/**
 * Money amount schema (in cents)
 */
const moneySchema = z.number()
  .int("Amount must be an integer (in cents)")
  .min(VALIDATION_RULES.MIN_PRICE, "Amount cannot be negative")
  .max(VALIDATION_RULES.MAX_PRICE, `Amount cannot exceed ${VALIDATION_RULES.MAX_PRICE} cents`);

/**
 * Service schema for provider services
 */
const serviceSchema = z.object({
  name: z.string()
    .min(VALIDATION_RULES.MIN_NAME_LENGTH)
    .max(VALIDATION_RULES.MAX_NAME_LENGTH)
    .trim(),
  description: z.string()
    .max(VALIDATION_RULES.MAX_DESCRIPTION_LENGTH)
    .trim(),
  duration: z.number()
    .int()
    .min(VALIDATION_RULES.MIN_DURATION)
    .max(VALIDATION_RULES.MAX_DURATION),
  price: moneySchema
});

/**
 * Checkout session creation schema
 */
export const createCheckoutSchema = z.object({
  accountId: z.string()
    .min(1, "Account ID is required")
    .regex(/^acct_[a-zA-Z0-9]+$/, "Invalid Stripe account ID format"),
  
  lineItems: z.array(
    z.object({
      price: z.string()
        .min(1, "Price ID is required")
        .regex(/^price_[a-zA-Z0-9]+$/, "Invalid Stripe price ID format"),
      quantity: z.number()
        .int()
        .min(1, "Quantity must be at least 1")
        .max(VALIDATION_RULES.MAX_QUANTITY)
    })
  )
  .min(1, "At least one line item is required")
  .max(VALIDATION_RULES.MAX_LINE_ITEMS, `Maximum ${VALIDATION_RULES.MAX_LINE_ITEMS} items allowed`),
  
  applicationFeePercent: z.number()
    .min(VALIDATION_RULES.MIN_FEE_PERCENT)
    .max(VALIDATION_RULES.MAX_FEE_PERCENT)
    .optional(),
  
  successUrl: urlSchema.optional(),
  cancelUrl: urlSchema.optional(),
  
  metadata: z.record(z.string()).optional()
});

/**
 * Provider profile creation/update schema
 */
export const providerProfileSchema = z.object({
  displayName: z.string()
    .min(VALIDATION_RULES.MIN_NAME_LENGTH)
    .max(VALIDATION_RULES.MAX_NAME_LENGTH)
    .trim(),
  
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  
  tagline: z.string()
    .max(150)
    .trim()
    .optional(),
  
  bio: z.string()
    .max(VALIDATION_RULES.MAX_BIO_LENGTH)
    .trim()
    .optional(),
  
  coverImageUrl: urlSchema.optional(),
  profileImageUrl: urlSchema.optional(),
  
  galleryImages: z.array(urlSchema)
    .max(VALIDATION_RULES.MAX_IMAGES)
    .optional(),
  
  locationCity: z.string().max(100).trim().optional(),
  locationState: z.string().max(100).trim().optional(),
  locationCountry: countrySchema.optional(),
  
  hourlyRate: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid price format")
    .optional(),
  
  currency: currencySchema,
  
  services: z.array(serviceSchema)
    .max(VALIDATION_RULES.MAX_SERVICES)
    .optional(),
  
  yearsExperience: z.number()
    .int()
    .min(0)
    .max(100)
    .optional()
});

/**
 * Booking creation schema
 */
export const createBookingSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
  customerId: z.string().min(1, "Customer ID is required"),
  
  serviceName: z.string()
    .min(VALIDATION_RULES.MIN_NAME_LENGTH)
    .max(VALIDATION_RULES.MAX_NAME_LENGTH)
    .trim(),
  
  servicePrice: moneySchema,
  
  bookingDate: z.string()
    .datetime("Invalid date format")
    .refine(
      (date) => new Date(date) > new Date(),
      "Booking date must be in the future"
    ),
  
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  
  totalAmount: moneySchema,
  platformFee: moneySchema,
  providerPayout: moneySchema
});

/**
 * Provider availability schema
 */
export const availabilitySchema = z.object({
  dayOfWeek: z.number()
    .int()
    .min(0, "Day of week must be between 0-6")
    .max(6, "Day of week must be between 0-6"),
  
  startTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  
  endTime: z.string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)"),
  
  isActive: z.boolean().default(true)
});

/**
 * Connected account creation schema
 */
export const createConnectedAccountSchema = z.object({
  email: emailSchema.optional(),
  country: countrySchema.optional(),
  businessType: z.enum(["individual", "company"]).optional()
});

/**
 * Product creation schema for connected accounts
 */
export const createProductSchema = z.object({
  accountId: z.string()
    .regex(/^acct_[a-zA-Z0-9]+$/, "Invalid Stripe account ID"),
  
  name: z.string()
    .min(VALIDATION_RULES.MIN_NAME_LENGTH)
    .max(VALIDATION_RULES.MAX_NAME_LENGTH)
    .trim(),
  
  description: z.string()
    .max(VALIDATION_RULES.MAX_DESCRIPTION_LENGTH)
    .trim()
    .optional(),
  
  priceInCents: moneySchema,
  currency: currencySchema,
  
  images: z.array(urlSchema)
    .max(8, "Maximum 8 product images allowed")
    .optional()
});

/**
 * Review/testimonial schema
 */
export const reviewSchema = z.object({
  providerId: z.string().uuid("Invalid provider ID"),
  bookingId: z.string().uuid("Invalid booking ID"),
  
  rating: z.number()
    .int()
    .min(1, "Rating must be between 1-5")
    .max(5, "Rating must be between 1-5"),
  
  reviewText: z.string()
    .max(1000, "Review text cannot exceed 1000 characters")
    .trim()
    .optional(),
  
  customerName: z.string()
    .max(VALIDATION_RULES.MAX_NAME_LENGTH)
    .trim(),
  
  customerImage: urlSchema.optional()
});

/**
 * Pagination schema for list endpoints
 */
export const paginationSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1),
  
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  
  sortBy: z.enum(["created", "updated", "price", "rating"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

/**
 * Search/filter schema for provider listings
 */
export const searchProvidersSchema = z.object({
  query: z.string().max(200).trim().optional(),
  
  category: z.string().max(50).optional(),
  
  minPrice: moneySchema.optional(),
  maxPrice: moneySchema.optional(),
  
  location: z.object({
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: countrySchema.optional(),
    radius: z.number().min(1).max(100).optional() // in miles
  }).optional(),
  
  minRating: z.number().min(0).max(5).optional(),
  
  availableThisWeek: z.boolean().optional(),
  
  ...paginationSchema.shape
});

/**
 * Validate request body with schema
 * Returns validated data or throws with detailed errors
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors for API response
      const formattedErrors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      
      throw new ValidationError('Validation failed', formattedErrors);
    }
    throw error;
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Helper to sanitize HTML content (for rich text fields)
 */
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}