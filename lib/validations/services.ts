import { z } from "zod";

/**
 * Service validation schemas
 * Ensures consistent data format across the application
 */

// Single service schema
export const serviceSchema = z.object({
  name: z.string()
    .min(1, "Service name is required")
    .max(100, "Service name must be less than 100 characters"),
  
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(500, "Description must be less than 500 characters"),
  
  duration: z.number()
    .int("Duration must be a whole number")
    .min(15, "Duration must be at least 15 minutes")
    .max(480, "Duration cannot exceed 8 hours (480 minutes)")
    .multipleOf(15, "Duration must be in 15-minute increments"),
  
  price: z.number()
    .positive("Price must be greater than 0")
    .max(10000, "Price cannot exceed $10,000")
    .transform(val => Math.round(val * 100) / 100), // Round to 2 decimal places
});

// Array of services schema
export const servicesArraySchema = z.array(serviceSchema)
  .min(1, "At least one service is required")
  .max(20, "Maximum 20 services allowed");

// Service form data (for UI forms)
export const serviceFormSchema = serviceSchema.extend({
  id: z.string().uuid().optional(), // For editing existing services
});

// Service update schema (partial, for updates)
export const serviceUpdateSchema = serviceSchema.partial();

// Provider services update schema
export const providerServicesUpdateSchema = z.object({
  services: servicesArraySchema,
});

// Type exports
export type Service = z.infer<typeof serviceSchema>;
export type ServiceFormData = z.infer<typeof serviceFormSchema>;
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;
export type ProviderServicesUpdate = z.infer<typeof providerServicesUpdateSchema>;

// Validation helpers
export const validateService = (data: unknown): Service | null => {
  try {
    return serviceSchema.parse(data);
  } catch (error) {
    console.error("Service validation failed:", error);
    return null;
  }
};

export const validateServices = (data: unknown): Service[] | null => {
  try {
    return servicesArraySchema.parse(data);
  } catch (error) {
    console.error("Services array validation failed:", error);
    return null;
  }
};

// Duration options for UI dropdowns
export const DURATION_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
  { value: 75, label: "1 hour 15 minutes" },
  { value: 90, label: "1 hour 30 minutes" },
  { value: 105, label: "1 hour 45 minutes" },
  { value: 120, label: "2 hours" },
  { value: 150, label: "2 hours 30 minutes" },
  { value: 180, label: "3 hours" },
  { value: 240, label: "4 hours" },
  { value: 300, label: "5 hours" },
  { value: 360, label: "6 hours" },
  { value: 480, label: "8 hours (Full day)" },
];

// Format duration for display
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}min`;
};

// Format price for display
export const formatPrice = (price: number, currency: string = "usd"): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(price);
};
