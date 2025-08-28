/**
 * Canonical Search Contracts
 * Single source of truth for provider search interfaces
 */

export type Provider = {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  tagline: string | null;
  bio: string | null;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  hourlyRate: string | null;
  minimumHours: number;
  maxLeadTime: number;
  services: Array<{ id: string; name: string; duration: number; price: string }> | string[];
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  timezone: string | null;
  languages: string[];
  isVerified: boolean;
  averageRating: number | null;
  totalReviews: number;
  stripeConnectAccountId: string | null;
  stripeOnboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderFilters = {
  query?: string;              // Canonical naming (not searchTerm)
  tags?: string[];
  location?: { 
    lat: number; 
    lng: number; 
    radiusKm?: number;
  };
  minRating?: number;
  maxPrice?: number;
  availability?: 'available' | 'busy' | 'offline';
  verified?: boolean;
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'rating' | 'price' | 'distance';
};

export type ProviderSearchResult = {
  items: Provider[];
  nextCursor?: string | null;
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
};

export type ProviderSearchState = {
  result: ProviderSearchResult | null;
  isLoading: boolean;
  error?: string;
  filters: ProviderFilters;
};

export type ProviderSearchApi = {
  search: (filters?: Partial<ProviderFilters>) => Promise<void>;
  loadMore: () => Promise<void>;
  clear: () => void;
  setFilters: (update: Partial<ProviderFilters>) => void;
};

export type UseProviderSearch = ProviderSearchState & ProviderSearchApi;

// Response types for API compatibility
export type ProviderSearchResponse = {
  providers: Provider[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export type ProviderResponse = {
  provider: Provider;
};

export type ProviderAvailabilityParams = {
  providerId: string;
  date: string;
  duration: number;
  timezone?: string;
};

export type ProviderAvailabilityResponse = {
  available: boolean;
  slots: Array<{
    start: string;
    end: string;
    available: boolean;
  }>;
};

export type ApiError = {
  error: string;
  message?: string;
  code?: string;
  statusCode?: number;
};