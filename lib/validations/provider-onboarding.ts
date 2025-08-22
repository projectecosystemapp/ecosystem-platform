/**
 * Provider Onboarding Validation Schemas
 * 
 * Comprehensive validation for all provider onboarding forms
 * following Series A production standards.
 * 
 * @module validations/provider-onboarding
 */

import { z } from 'zod';

// ============================================================================
// CONSTANTS
// ============================================================================

const LIMITS = {
  displayName: { min: 2, max: 100 },
  tagline: { min: 10, max: 200 },
  bio: { min: 50, max: 2000 },
  location: { min: 2, max: 100 },
  experience: { min: 0, max: 50 },
  hourlyRate: { min: 0, max: 10000 },
  service: {
    name: { min: 2, max: 100 },
    description: { min: 10, max: 500 },
    duration: { min: 15, max: 480 }, // minutes
    price: { min: 0, max: 10000 },
  },
  images: {
    maxGallery: 10,
    maxFileSize: 5 * 1024 * 1024, // 5MB
  },
} as const;

const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const URL_REGEX = /^https?:\/\/.+\..+/;

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Converts time string (HH:MM) to minutes since midnight for comparison
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Capitalizes first letter of each word
 */
function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validates and normalizes URL
 */
function normalizeUrl(url: string): string {
  // Ensure https:// if no protocol specified
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

// ============================================================================
// BASIC INFO SCHEMA
// ============================================================================

export const basicInfoSchema = z.object({
  displayName: z
    .string()
    .min(LIMITS.displayName.min, `Display name must be at least ${LIMITS.displayName.min} characters`)
    .max(LIMITS.displayName.max, `Display name cannot exceed ${LIMITS.displayName.max} characters`)
    .transform(val => val.trim())
    .refine(
      val => val.length >= LIMITS.displayName.min,
      `Display name must be at least ${LIMITS.displayName.min} characters after trimming`
    ),

  tagline: z
    .string()
    .min(LIMITS.tagline.min, `Tagline should be at least ${LIMITS.tagline.min} characters to be effective`)
    .max(LIMITS.tagline.max, `Tagline cannot exceed ${LIMITS.tagline.max} characters`)
    .transform(val => val.trim())
    .optional()
    .or(z.literal('')),

  bio: z
    .string()
    .min(LIMITS.bio.min, `Bio should be at least ${LIMITS.bio.min} characters to give customers enough information`)
    .max(LIMITS.bio.max, `Bio cannot exceed ${LIMITS.bio.max} characters`)
    .transform(val => val.trim())
    .optional()
    .or(z.literal('')),

  locationCity: z
    .string()
    .min(LIMITS.location.min, `City must be at least ${LIMITS.location.min} characters`)
    .max(LIMITS.location.max, `City cannot exceed ${LIMITS.location.max} characters`)
    .transform(val => capitalizeWords(val.trim()))
    .refine(
      val => /^[a-zA-Z\s\-']+$/.test(val),
      'City name should only contain letters, spaces, hyphens, and apostrophes'
    ),

  locationState: z
    .string()
    .min(LIMITS.location.min, `State/Province must be at least ${LIMITS.location.min} characters`)
    .max(LIMITS.location.max, `State/Province cannot exceed ${LIMITS.location.max} characters`)
    .transform(val => val.trim().toUpperCase()),

  locationCountry: z
    .string()
    .default('US')
    .transform(val => val.toUpperCase())
    .refine(
      val => /^[A-Z]{2}$/.test(val),
      'Country must be a valid 2-letter ISO code (e.g., US, CA, GB)'
    ),

  yearsExperience: z
    .number()
    .int('Years of experience must be a whole number')
    .min(LIMITS.experience.min, 'Years of experience cannot be negative')
    .max(LIMITS.experience.max, `Years of experience seems unrealistic (max ${LIMITS.experience.max})`)
    .optional()
    .or(z.nan().transform(() => undefined)),

  hourlyRate: z
    .number()
    .min(LIMITS.hourlyRate.min, 'Hourly rate cannot be negative')
    .max(LIMITS.hourlyRate.max, `Hourly rate cannot exceed $${LIMITS.hourlyRate.max}`)
    .multipleOf(0.01, 'Hourly rate must be in valid currency format (e.g., 50.00)')
    .optional()
    .or(z.nan().transform(() => undefined)),
});

export type BasicInfo = z.infer<typeof basicInfoSchema>;

// ============================================================================
// SERVICE SCHEMA
// ============================================================================

export const serviceSchema = z.object({
  id: z.string().uuid().optional(), // For existing services
  
  name: z
    .string()
    .min(LIMITS.service.name.min, `Service name must be at least ${LIMITS.service.name.min} characters`)
    .max(LIMITS.service.name.max, `Service name cannot exceed ${LIMITS.service.name.max} characters`)
    .transform(val => val.trim())
    .refine(
      val => val.length >= LIMITS.service.name.min,
      `Service name must be at least ${LIMITS.service.name.min} characters after trimming`
    ),

  description: z
    .string()
    .min(LIMITS.service.description.min, `Description should be at least ${LIMITS.service.description.min} characters to inform customers`)
    .max(LIMITS.service.description.max, `Description cannot exceed ${LIMITS.service.description.max} characters`)
    .transform(val => val.trim()),

  duration: z
    .number()
    .int('Duration must be in whole minutes')
    .min(LIMITS.service.duration.min, `Minimum service duration is ${LIMITS.service.duration.min} minutes`)
    .max(LIMITS.service.duration.max, `Maximum service duration is ${LIMITS.service.duration.max} minutes (8 hours)`)
    .multipleOf(15, 'Duration must be in 15-minute increments (e.g., 15, 30, 45, 60)')
    .refine(
      val => val >= LIMITS.service.duration.min && val <= LIMITS.service.duration.max,
      {
        message: `Duration must be between ${LIMITS.service.duration.min} and ${LIMITS.service.duration.max} minutes`,
      }
    ),

  price: z
    .number()
    .min(LIMITS.service.price.min, 'Service price cannot be negative')
    .max(LIMITS.service.price.max, `Service price cannot exceed $${LIMITS.service.price.max}`)
    .multipleOf(0.01, 'Price must be in valid currency format (e.g., 99.99)')
    .transform(val => Math.round(val * 100) / 100), // Ensure 2 decimal places

  isActive: z.boolean().default(true),
});

export type Service = z.infer<typeof serviceSchema>;

export const servicesArraySchema = z
  .array(serviceSchema)
  .min(1, 'You must offer at least one service')
  .max(50, 'Maximum 50 services allowed')
  .refine(
    services => {
      const names = services.map(s => s.name.toLowerCase());
      return names.length === new Set(names).size;
    },
    'Service names must be unique'
  );

// ============================================================================
// AVAILABILITY SCHEMA
// ============================================================================

export const availabilitySlotSchema = z
  .object({
    dayOfWeek: z
      .number()
      .int()
      .min(0, 'Day of week must be between 0 (Sunday) and 6 (Saturday)')
      .max(6, 'Day of week must be between 0 (Sunday) and 6 (Saturday)'),

    startTime: z
      .string()
      .regex(TIME_REGEX, 'Start time must be in HH:MM format (e.g., 09:00)')
      .refine(
        time => {
          const minutes = timeToMinutes(time);
          return minutes >= 0 && minutes < 24 * 60;
        },
        'Invalid time value'
      ),

    endTime: z
      .string()
      .regex(TIME_REGEX, 'End time must be in HH:MM format (e.g., 17:00)')
      .refine(
        time => {
          const minutes = timeToMinutes(time);
          return minutes >= 0 && minutes < 24 * 60;
        },
        'Invalid time value'
      ),

    isActive: z.boolean().default(true),
  })
  .refine(
    data => timeToMinutes(data.endTime) > timeToMinutes(data.startTime),
    {
      message: 'End time must be after start time',
      path: ['endTime'],
    }
  )
  .refine(
    data => {
      const duration = timeToMinutes(data.endTime) - timeToMinutes(data.startTime);
      return duration >= 30; // Minimum 30 minutes
    },
    {
      message: 'Availability window must be at least 30 minutes',
      path: ['endTime'],
    }
  );

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilityArraySchema = z
  .array(availabilitySlotSchema)
  .refine(
    slots => {
      // Check for overlapping slots on the same day
      const activeSlots = slots.filter(s => s.isActive);
      const dayGroups = activeSlots.reduce((acc, slot) => {
        if (!acc[slot.dayOfWeek]) acc[slot.dayOfWeek] = [];
        acc[slot.dayOfWeek].push(slot);
        return acc;
      }, {} as Record<number, typeof activeSlots>);

      for (const daySlots of Object.values(dayGroups)) {
        for (let i = 0; i < daySlots.length; i++) {
          for (let j = i + 1; j < daySlots.length; j++) {
            const slot1Start = timeToMinutes(daySlots[i].startTime);
            const slot1End = timeToMinutes(daySlots[i].endTime);
            const slot2Start = timeToMinutes(daySlots[j].startTime);
            const slot2End = timeToMinutes(daySlots[j].endTime);

            // Check for overlap
            if (
              (slot1Start < slot2End && slot1End > slot2Start) ||
              (slot2Start < slot1End && slot2End > slot1Start)
            ) {
              return false;
            }
          }
        }
      }
      return true;
    },
    'Availability slots cannot overlap on the same day'
  );

// ============================================================================
// IMAGES SCHEMA
// ============================================================================

export const imageUrlSchema = z
  .string()
  .transform(normalizeUrl)
  .refine(
    url => URL_REGEX.test(url),
    'Please enter a valid URL (e.g., https://example.com/image.jpg)'
  )
  .refine(
    url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },
    'Invalid URL format'
  );

export const imagesSchema = z.object({
  profileImageUrl: imageUrlSchema
    .optional()
    .or(z.literal(''))
    .transform(val => (val === '' ? undefined : val)),

  coverImageUrl: imageUrlSchema
    .optional()
    .or(z.literal(''))
    .transform(val => (val === '' ? undefined : val)),

  galleryImages: z
    .array(imageUrlSchema)
    .max(LIMITS.images.maxGallery, `Maximum ${LIMITS.images.maxGallery} gallery images allowed`)
    .default([])
    .refine(
      images => images.length === new Set(images).size,
      'Duplicate images are not allowed in the gallery'
    ),
});

export type Images = z.infer<typeof imagesSchema>;

// ============================================================================
// COMPLETE ONBOARDING SCHEMA
// ============================================================================

export const completeOnboardingSchema = z
  .object({
    basicInfo: basicInfoSchema,
    services: servicesArraySchema,
    availability: availabilityArraySchema,
    images: imagesSchema,
    
    // Additional fields for complete onboarding
    termsAccepted: z
      .boolean()
      .refine(val => val === true, 'You must accept the terms and conditions'),
    
    stripeConnected: z.boolean().optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    data => {
      // Ensure at least basic availability is set
      const hasActiveAvailability = data.availability.some(slot => slot.isActive);
      return hasActiveAvailability;
    },
    {
      message: 'You must set at least one availability window',
      path: ['availability'],
    }
  )
  .refine(
    data => {
      // Ensure hourly rate is set if any service is hourly
      const hasHourlyService = data.services.some(
        service => service.duration === 60 && !service.price
      );
      return !hasHourlyService || data.basicInfo.hourlyRate !== undefined;
    },
    {
      message: 'Hourly rate is required when offering hourly services',
      path: ['basicInfo', 'hourlyRate'],
    }
  );

export type CompleteOnboarding = z.infer<typeof completeOnboardingSchema>;

// ============================================================================
// PARTIAL SCHEMAS FOR STEP-BY-STEP FORMS
// ============================================================================

export const onboardingStep1Schema = basicInfoSchema;
export const onboardingStep2Schema = servicesArraySchema;
export const onboardingStep3Schema = availabilityArraySchema;
export const onboardingStep4Schema = imagesSchema;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates a partial onboarding object (for draft saving)
 */
export const partialOnboardingSchema = z.object({
  basicInfo: basicInfoSchema.optional(),
  services: servicesArraySchema.optional(),
  availability: availabilityArraySchema.optional(),
  images: imagesSchema.optional(),
  termsAccepted: z.boolean().optional(),
  stripeConnected: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Helper to get user-friendly day name
 */
export function getDayName(dayOfWeek: number): string {
  return DAYS_OF_WEEK[dayOfWeek] || 'Unknown';
}

/**
 * Helper to format time for display
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Helper to validate file upload (for use with file inputs)
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Please upload a valid image file (JPEG, PNG, or WebP)' 
    };
  }
  
  if (file.size > LIMITS.images.maxFileSize) {
    return { 
      valid: false, 
      error: `Image size must be less than ${LIMITS.images.maxFileSize / (1024 * 1024)}MB` 
    };
  }
  
  return { valid: true };
}

// ============================================================================
// ERROR MESSAGE HELPERS
// ============================================================================

/**
 * Extracts user-friendly error messages from Zod errors
 */
export function getErrorMessage(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.issues.forEach(issue => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });
  
  return errors;
}

/**
 * Gets a single error message for a field
 */
export function getFieldError(
  error: z.ZodError | null,
  fieldPath: string
): string | undefined {
  if (!error) return undefined;
  
  const issue = error.issues.find(
    issue => issue.path.join('.') === fieldPath
  );
  
  return issue?.message;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type OnboardingStep1 = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2 = z.infer<typeof onboardingStep2Schema>;
export type OnboardingStep3 = z.infer<typeof onboardingStep3Schema>;
export type OnboardingStep4 = z.infer<typeof onboardingStep4Schema>;
export type PartialOnboarding = z.infer<typeof partialOnboardingSchema>;