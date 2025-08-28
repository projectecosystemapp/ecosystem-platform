/**
 * Provider API Types
 * TypeScript interfaces for provider-related API requests and responses
 */

// Base provider data
export interface Provider {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  tagline?: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  hourlyRate?: number;
  currency: string;
  averageRating: number;
  totalReviews: number;
  completedBookings: number;
  isVerified: boolean;
  isActive: boolean;
  services?: ProviderService[];
  portfolio?: PortfolioItem[];
  socialLinks?: SocialLinks;
  stripeOnboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Provider service definition
export interface ProviderService {
  id?: string;
  name: string;
  description: string;
  price: number;
  duration: number; // in minutes
  category?: string;
  isActive?: boolean;
}

// Portfolio item
export interface PortfolioItem {
  id?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  projectUrl?: string;
  category?: string;
}

// Social links
export interface SocialLinks {
  website?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
}

// Provider search filters
export interface ProviderSearchFilters {
  query?: string;
  city?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  isVerified?: boolean;
  featured?: boolean;
  limit?: number;
  offset?: number;
  page?: number;
}

// Provider search response
export interface ProviderSearchResponse {
  providers: Provider[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: ProviderSearchFilters;
}

// Individual provider response
export interface ProviderResponse {
  provider: Provider;
}

// Provider availability slot
export interface AvailabilitySlot {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  available: boolean;
  reason?: string;   // Why it's not available
}

// Day availability
export interface DayAvailability {
  date: string;      // YYYY-MM-DD format
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  slots: AvailabilitySlot[];
  summary: {
    totalSlots: number;
    availableSlots: number;
    hasAvailability: boolean;
  };
}

// Provider availability response
export interface ProviderAvailabilityResponse {
  availability: DayAvailability[];
  summary: {
    totalDays: number;
    daysWithAvailability: number;
    totalSlots: number;
    totalAvailableSlots: number;
  };
  parameters: {
    providerId: string;
    startDate: string; // ISO string
    endDate: string;   // ISO string
    slotDuration: number;
    timezone: string;
  };
}

// Provider availability request params
export interface ProviderAvailabilityParams {
  startDate?: string;    // ISO date string
  endDate?: string;      // ISO date string
  slotDuration?: number; // minutes
  timezone?: string;
  serviceId?: string;
}

// Provider update data
export interface ProviderUpdateData {
  displayName?: string;
  tagline?: string;
  bio?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  hourlyRate?: number;
  currency?: string;
  services?: ProviderService[];
  portfolio?: PortfolioItem[];
  socialLinks?: SocialLinks;
}

// Provider update response
export interface ProviderUpdateResponse {
  provider: Partial<Provider>;
  message: string;
}

// API Error response
export interface ApiError {
  error: string;
  details?: any[];
  code?: string;
}

// Common API response wrapper
export type ApiResponse<T> = {
  data: T;
  success: true;
} | {
  error: string;
  details?: any[];
  success: false;
};