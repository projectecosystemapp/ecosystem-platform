import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useMarketplaceStore, TabId } from "@/lib/stores/marketplace-store";
import { searchProvidersAction } from "@/actions/providers-actions";
import { useDebounce } from "./use-debounce";
import type { Provider } from "@/db/schema/providers-schema";

// Unified data types for all marketplace categories
export interface MarketplaceItem {
  id: string;
  category: TabId;
  title: string;
  description?: string;
  image?: string;
  location: {
    city?: string;
    state?: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
  price?: {
    amount: number;
    currency: string;
    unit?: 'hour' | 'day' | 'fixed';
  };
  provider?: {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
    reviewCount?: number;
    verified: boolean;
  };
  availability?: 'available' | 'busy' | 'offline';
  metadata?: Record<string, any>; // Category-specific data
}

// Search parameters that work across all categories
export interface UnifiedSearchParams {
  query?: string;
  category: TabId;
  location?: {
    city?: string;
    state?: string;
    radius?: number;
  };
  priceRange?: [number, number];
  rating?: number;
  verified?: boolean;
  availability?: string[];
  sortBy?: 'relevance' | 'price' | 'rating' | 'distance' | 'newest';
  page?: number;
  limit?: number;
}

// Transform provider data to unified format
function transformProviderToMarketplaceItem(provider: Provider): MarketplaceItem {
  return {
    id: provider.id,
    category: 'services',
    title: provider.tagline || provider.displayName,
    description: provider.bio,
    image: provider.coverImageUrl || provider.profileImageUrl,
    location: {
      city: provider.locationCity,
      state: provider.locationState,
      address: [provider.locationCity, provider.locationState].filter(Boolean).join(', '),
    },
    price: provider.hourlyRate ? {
      amount: provider.hourlyRate,
      currency: provider.currency || 'USD',
      unit: 'hour',
    } : undefined,
    provider: {
      id: provider.id,
      name: provider.displayName,
      avatar: provider.profileImageUrl,
      rating: provider.averageRating,
      reviewCount: provider.totalReviews,
      verified: provider.isVerified,
    },
    availability: provider.stripeOnboardingComplete ? 'available' : 'offline',
    metadata: {
      slug: provider.slug,
      services: provider.services,
      yearsExperience: provider.yearsExperience,
      instantBooking: provider.instantBooking,
      hasInsurance: provider.hasInsurance,
    },
  };
}

// Category-specific data fetchers
const categoryFetchers = {
  services: async (params: UnifiedSearchParams) => {
    const result = await searchProvidersAction({
      query: params.query,
      city: params.location?.city,
      state: params.location?.state,
      minPrice: params.priceRange?.[0],
      maxPrice: params.priceRange?.[1],
      minRating: params.rating,
      verifiedOnly: params.verified,
      sortBy: params.sortBy as any,
      page: params.page || 1,
      pageSize: params.limit || 12,
    });

    if (!result.isSuccess || !result.data) {
      throw new Error(result.error || 'Failed to fetch services');
    }

    return {
      items: result.data.providers.map(transformProviderToMarketplaceItem),
      total: result.data.total,
      hasMore: result.data.providers.length === (params.limit || 12),
    };
  },

  events: async (params: UnifiedSearchParams) => {
    // Mock implementation - replace with real API
    const mockEvents = [
      {
        id: '1',
        category: 'events' as TabId,
        title: 'Jazz Night Downtown',
        description: 'Live jazz music with dinner',
        image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400',
        location: {
          city: 'Denver',
          state: 'CO',
          address: '1801 California St, Denver, CO 80202',
          coordinates: { lat: 39.7392, lng: -104.9847 },
        },
        price: { amount: 35, currency: 'USD', unit: 'fixed' as const },
        provider: {
          id: 'venue1',
          name: 'The Blue Note',
          verified: true,
          rating: 4.8,
          reviewCount: 24,
        },
        metadata: {
          startDate: new Date('2024-02-11T20:00:00'),
          attendeeCount: 45,
          maxAttendees: 100,
          eventType: 'Music',
        },
      },
    ] as MarketplaceItem[];

    // Simple filtering for mock data
    let filtered = mockEvents;
    if (params.query) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(params.query!.toLowerCase())
      );
    }

    return {
      items: filtered,
      total: filtered.length,
      hasMore: false,
    };
  },

  spaces: async (params: UnifiedSearchParams) => {
    // Mock implementation
    const mockSpaces = [
      {
        id: '1',
        category: 'spaces' as TabId,
        title: 'Creative Studio Space',
        description: 'Perfect for photoshoots and workshops',
        image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400',
        location: {
          city: 'Denver',
          state: 'CO',
          address: '1234 Art District, Denver, CO 80202',
          coordinates: { lat: 39.7547, lng: -104.9965 },
        },
        price: { amount: 50, currency: 'USD', unit: 'hour' as const },
        provider: {
          id: 'space1',
          name: 'Creative Hub',
          verified: true,
          rating: 4.8,
          reviewCount: 45,
        },
        metadata: {
          capacity: 20,
          size: '1200 sq ft',
          amenities: ['WiFi', 'Projector', 'Kitchen', 'Parking'],
        },
      },
    ] as MarketplaceItem[];

    let filtered = mockSpaces;
    if (params.query) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(params.query!.toLowerCase())
      );
    }

    return {
      items: filtered,
      total: filtered.length,
      hasMore: false,
    };
  },

  things: async (params: UnifiedSearchParams) => {
    // Mock implementation
    const mockThings = [
      {
        id: '1',
        category: 'things' as TabId,
        title: 'MacBook Pro 16" 2021',
        description: 'Excellent condition, perfect for professionals',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca4?w=400',
        location: {
          city: 'Denver',
          state: 'CO',
          address: '1500 California St, Denver, CO 80202',
          coordinates: { lat: 39.7435, lng: -104.9913 },
        },
        price: { amount: 1899, currency: 'USD', unit: 'fixed' as const },
        provider: {
          id: 'seller1',
          name: 'TechTrader',
          verified: true,
          rating: 4.9,
          reviewCount: 156,
        },
        metadata: {
          condition: 'Like New',
          originalPrice: 2499,
          negotiable: true,
          posted: '2 days ago',
        },
      },
    ] as MarketplaceItem[];

    let filtered = mockThings;
    if (params.query) {
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(params.query!.toLowerCase())
      );
    }

    return {
      items: filtered,
      total: filtered.length,
      hasMore: false,
    };
  },
};

// Main hook for marketplace data
export function useMarketplaceData() {
  const { activeTab, getCurrentTabState, updateTabState } = useMarketplaceStore();
  const tabState = getCurrentTabState();
  const debouncedQuery = useDebounce(tabState.searchQuery, 300);

  // Build search parameters from store state
  const searchParams: UnifiedSearchParams = {
    query: debouncedQuery,
    category: activeTab,
    sortBy: tabState.sortBy as any,
    page: tabState.page,
    limit: 12,
    ...tabState.filters,
  };

  // Use React Query for data fetching with proper cache keys
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['marketplace', activeTab, searchParams],
    queryFn: () => categoryFetchers[activeTab](searchParams),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    enabled: true,
  });

  // Update search function
  const updateSearch = (updates: Partial<UnifiedSearchParams>) => {
    updateTabState(activeTab, {
      ...updates,
      page: updates.page || 1, // Reset page when filters change
    });
  };

  return {
    // Data
    items: data?.items || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    
    // State
    isLoading,
    isFetching,
    error,
    
    // Current search state
    searchParams,
    currentQuery: debouncedQuery,
    currentTab: activeTab,
    
    // Actions
    refetch,
    updateSearch,
    
    // Computed
    isEmpty: !isLoading && (!data?.items || data.items.length === 0),
    hasResults: !isLoading && data?.items && data.items.length > 0,
  };
}

// Category-specific hooks for enhanced type safety
export const useServicesData = () => {
  const result = useMarketplaceData();
  return {
    ...result,
    services: result.items as MarketplaceItem[],
  };
};

export const useEventsData = () => {
  const result = useMarketplaceData();
  return {
    ...result,
    events: result.items as MarketplaceItem[],
  };
};

export const useSpacesData = () => {
  const result = useMarketplaceData();
  return {
    ...result,
    spaces: result.items as MarketplaceItem[],
  };
};

export const useThingsData = () => {
  const result = useMarketplaceData();
  return {
    ...result,
    things: result.items as MarketplaceItem[],
  };
};