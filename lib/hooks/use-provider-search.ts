import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { searchProvidersAction } from "@/actions/providers-actions";
import type { Provider } from "@/db/schema/providers-schema";
import type { FilterValues } from "@/components/provider/search/SearchFilters";
import type { SortOption } from "@/components/provider/search/SortDropdown";
import type { ViewMode } from "@/components/provider/search/ViewToggle";
import { useDebounce } from "./use-debounce";

interface SearchFilters {
  query?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  services?: string[];
  verifiedOnly?: boolean;
  hasInsurance?: boolean;
  instantBooking?: boolean;
  sortBy?: SortOption;
  page?: number;
  pageSize?: number;
}

interface UseProviderSearchOptions {
  initialFilters?: SearchFilters;
  initialProviders?: Provider[];
  initialTotal?: number;
  debounceMs?: number;
  pageSize?: number;
}

interface UseProviderSearchReturn {
  // Data
  providers: Provider[];
  total: number;
  totalPages: number;
  currentPage: number;
  
  // State
  filters: FilterValues;
  searchQuery: string;
  sortBy: SortOption;
  viewMode: ViewMode;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Actions
  setFilters: (filters: FilterValues) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sort: SortOption) => void;
  setViewMode: (mode: ViewMode) => void;
  setPage: (page: number) => void;
  applyFilters: () => void;
  clearFilters: () => void;
  refetch: () => void;
  
  // Computed
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useProviderSearch(
  options: UseProviderSearchOptions = {}
): UseProviderSearchReturn {
  const {
    initialFilters = {},
    initialProviders = [],
    initialTotal = 0,
    debounceMs = 300,
    pageSize = 12,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Parse initial state from URL
  const getInitialFilters = (): FilterValues => ({
    query: initialFilters.query || searchParams.get("q") || "",
    location: {
      city: initialFilters.city || searchParams.get("city") || "",
      state: initialFilters.state || searchParams.get("state") || "",
      zipCode: initialFilters.zipCode || searchParams.get("zip") || "",
      radius: 25,
    },
    priceRange: [
      initialFilters.minPrice || Number(searchParams.get("minPrice")) || 0,
      initialFilters.maxPrice || Number(searchParams.get("maxPrice")) || 500,
    ],
    minRating: initialFilters.minRating || Number(searchParams.get("minRating")) || 0,
    services: initialFilters.services || searchParams.get("services")?.split(",") || [],
    verifiedOnly: initialFilters.verifiedOnly || searchParams.get("verified") === "true",
    hasInsurance: initialFilters.hasInsurance || searchParams.get("insurance") === "true",
    instantBooking: initialFilters.instantBooking || searchParams.get("instant") === "true",
  });

  // State management
  const [filters, setFilters] = useState<FilterValues>(getInitialFilters());
  const [searchQuery, setSearchQuery] = useState(filters.query || "");
  const [sortBy, setSortBy] = useState<SortOption>(
    (initialFilters.sortBy || searchParams.get("sort") || "relevance") as SortOption
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(
    initialFilters.page || Number(searchParams.get("page")) || 1
  );

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, debounceMs);

  // Build query key for React Query
  const buildQueryKey = useCallback(() => [
    "providers",
    "search",
    {
      query: debouncedSearchQuery,
      city: filters.location?.city,
      state: filters.location?.state,
      zipCode: filters.location?.zipCode,
      minPrice: filters.priceRange[0],
      maxPrice: filters.priceRange[1],
      minRating: filters.minRating,
      services: filters.services,
      availability: filters.availability,
      verifiedOnly: filters.verifiedOnly,
      hasInsurance: filters.hasInsurance,
      instantBooking: filters.instantBooking,
      sortBy,
      page: currentPage,
      pageSize,
    },
  ], [
    debouncedSearchQuery,
    filters,
    sortBy,
    currentPage,
    pageSize
  ]);

  // Search query
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: buildQueryKey(),
    queryFn: async () => {
      const searchFilters: any = {
        query: debouncedSearchQuery || undefined,
        city: filters.location?.city || undefined,
        state: filters.location?.state || undefined,
        zipCode: filters.location?.zipCode || undefined,
        minPrice: filters.priceRange[0] > 0 ? filters.priceRange[0] : undefined,
        maxPrice: filters.priceRange[1] < 500 ? filters.priceRange[1] : undefined,
        minRating: filters.minRating > 0 ? filters.minRating : undefined,
        services: filters.services.length > 0 ? filters.services : undefined,
        verifiedOnly: filters.verifiedOnly || undefined,
        hasInsurance: filters.hasInsurance || undefined,
        instantBooking: filters.instantBooking || undefined,
        availability: filters.availability && (filters.availability.days?.length || filters.availability.timeOfDay?.length) 
          ? filters.availability 
          : undefined,
        sortBy,
        page: currentPage,
        pageSize,
      };

      const result = await searchProvidersAction(searchFilters);
      
      if (result.isSuccess && result.data) {
        return {
          providers: result.data.providers,
          total: result.data.total,
        };
      }
      
      throw new Error(result.message || "Failed to search providers");
    },
    initialData: initialProviders.length > 0 
      ? { providers: initialProviders, total: initialTotal }
      : undefined,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });

  // Update URL with current filters
  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    
    if (debouncedSearchQuery) params.set("q", debouncedSearchQuery);
    if (filters.location?.city) params.set("city", filters.location.city);
    if (filters.location?.state) params.set("state", filters.location.state);
    if (filters.location?.zipCode) params.set("zip", filters.location.zipCode);
    if (filters.priceRange[0] > 0) params.set("minPrice", String(filters.priceRange[0]));
    if (filters.priceRange[1] < 500) params.set("maxPrice", String(filters.priceRange[1]));
    if (filters.minRating > 0) params.set("minRating", String(filters.minRating));
    if (filters.services.length > 0) params.set("services", filters.services.join(","));
    if (filters.verifiedOnly) params.set("verified", "true");
    if (filters.hasInsurance) params.set("insurance", "true");
    if (filters.instantBooking) params.set("instant", "true");
    if (sortBy !== "relevance") params.set("sort", sortBy);
    if (currentPage > 1) params.set("page", String(currentPage));
    
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(url, { scroll: false });
  }, [
    debouncedSearchQuery,
    filters,
    sortBy,
    currentPage,
    pathname,
    router,
  ]);

  // Update URL when filters change
  useEffect(() => {
    updateURL();
  }, [debouncedSearchQuery, filters, sortBy, currentPage, updateURL]);

  // Apply filters (trigger search)
  const applyFilters = useCallback(() => {
    setCurrentPage(1);
    refetch();
  }, [refetch]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      query: "",
      location: {
        city: "",
        state: "",
        zipCode: "",
        radius: 25,
      },
      priceRange: [0, 500],
      minRating: 0,
      services: [],
      verifiedOnly: false,
      hasInsurance: false,
      instantBooking: false,
    });
    setSearchQuery("");
    setSortBy("relevance");
    setCurrentPage(1);
  }, []);

  // Set page
  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Computed values
  const hasActiveFilters = 
    Boolean(filters.query) ||
    Boolean(filters.location?.city) ||
    Boolean(filters.location?.state) ||
    Boolean(filters.location?.zipCode) ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 500 ||
    filters.minRating > 0 ||
    filters.services.length > 0 ||
    filters.verifiedOnly ||
    filters.hasInsurance ||
    filters.instantBooking;

  const activeFilterCount = [
    Boolean(filters.query),
    Boolean(filters.location?.city || filters.location?.state || filters.location?.zipCode),
    filters.priceRange[0] > 0 || filters.priceRange[1] < 500,
    filters.minRating > 0,
    filters.services.length > 0,
    filters.verifiedOnly,
    filters.hasInsurance,
    filters.instantBooking,
  ].filter(Boolean).length;

  const providers = data?.providers || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Prefetch next page
  useEffect(() => {
    if (currentPage < totalPages) {
      const nextPageKey = buildQueryKey();
      const queryParams = nextPageKey[2] as any;
      queryParams.page = currentPage + 1;
      
      queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async () => {
          const searchFilters: any = {
            ...queryParams,
            page: currentPage + 1,
          };
          const result = await searchProvidersAction(searchFilters);
          return result.isSuccess ? result.data : null;
        },
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [currentPage, totalPages, queryClient, buildQueryKey]);

  return {
    // Data
    providers,
    total,
    totalPages,
    currentPage,
    
    // State
    filters,
    searchQuery,
    sortBy,
    viewMode,
    isLoading,
    isError,
    error: error as Error | null,
    
    // Actions
    setFilters,
    setSearchQuery,
    setSortBy,
    setViewMode,
    setPage,
    applyFilters,
    clearFilters,
    refetch,
    
    // Computed
    hasActiveFilters,
    activeFilterCount,
  };
}