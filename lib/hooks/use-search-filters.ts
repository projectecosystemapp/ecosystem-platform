import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { FilterValues } from "@/components/provider/search/SearchFilters";

interface UseSearchFiltersOptions {
  syncWithURL?: boolean;
  onFiltersChange?: (filters: FilterValues) => void;
}

interface UseSearchFiltersReturn {
  filters: FilterValues;
  updateFilter: <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => void;
  updateFilters: (updates: Partial<FilterValues>) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  filterSummary: string[];
}

const defaultFilters: FilterValues = {
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
  availability: {
    days: [],
    timeOfDay: [],
  },
  experience: {
    min: undefined,
    max: undefined,
  },
  verifiedOnly: false,
  hasInsurance: false,
  instantBooking: false,
};

export function useSearchFilters(
  options: UseSearchFiltersOptions = {}
): UseSearchFiltersReturn {
  const { syncWithURL = true, onFiltersChange } = options;
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize filters from URL if syncing
  const getInitialFilters = (): FilterValues => {
    if (!syncWithURL) return defaultFilters;

    return {
      query: searchParams.get("q") || "",
      location: {
        city: searchParams.get("city") || "",
        state: searchParams.get("state") || "",
        zipCode: searchParams.get("zip") || "",
        radius: Number(searchParams.get("radius")) || 25,
      },
      priceRange: [
        Number(searchParams.get("minPrice")) || 0,
        Number(searchParams.get("maxPrice")) || 500,
      ],
      minRating: Number(searchParams.get("minRating")) || 0,
      services: searchParams.get("services")?.split(",").filter(Boolean) || [],
      availability: {
        days: searchParams.get("days")?.split(",").filter(Boolean) || [],
        timeOfDay: searchParams.get("timeOfDay")?.split(",").filter(Boolean) || [],
      },
      experience: {
        min: searchParams.get("minExp") ? Number(searchParams.get("minExp")) : undefined,
        max: searchParams.get("maxExp") ? Number(searchParams.get("maxExp")) : undefined,
      },
      verifiedOnly: searchParams.get("verified") === "true",
      hasInsurance: searchParams.get("insurance") === "true",
      instantBooking: searchParams.get("instant") === "true",
    };
  };

  const [filters, setFilters] = useState<FilterValues>(getInitialFilters());

  // Sync filters to URL
  const syncToURL = useCallback((newFilters: FilterValues) => {
    if (!syncWithURL) return;

    const params = new URLSearchParams();

    // Add non-default values to URL
    if (newFilters.query) params.set("q", newFilters.query);
    if (newFilters.location?.city) params.set("city", newFilters.location.city);
    if (newFilters.location?.state) params.set("state", newFilters.location.state);
    if (newFilters.location?.zipCode) params.set("zip", newFilters.location.zipCode);
    if (newFilters.location?.radius && newFilters.location.radius !== 25) {
      params.set("radius", String(newFilters.location.radius));
    }
    if (newFilters.priceRange[0] > 0) params.set("minPrice", String(newFilters.priceRange[0]));
    if (newFilters.priceRange[1] < 500) params.set("maxPrice", String(newFilters.priceRange[1]));
    if (newFilters.minRating > 0) params.set("minRating", String(newFilters.minRating));
    if (newFilters.services.length > 0) params.set("services", newFilters.services.join(","));
    if (newFilters.availability?.days && newFilters.availability.days.length > 0) {
      params.set("days", newFilters.availability.days.join(","));
    }
    if (newFilters.availability?.timeOfDay && newFilters.availability.timeOfDay.length > 0) {
      params.set("timeOfDay", newFilters.availability.timeOfDay.join(","));
    }
    if (newFilters.experience?.min) params.set("minExp", String(newFilters.experience.min));
    if (newFilters.experience?.max) params.set("maxExp", String(newFilters.experience.max));
    if (newFilters.verifiedOnly) params.set("verified", "true");
    if (newFilters.hasInsurance) params.set("insurance", "true");
    if (newFilters.instantBooking) params.set("instant", "true");

    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(url, { scroll: false });
  }, [syncWithURL, pathname, router]);

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof FilterValues>(
    key: K,
    value: FilterValues[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    syncToURL(newFilters);
    onFiltersChange?.(newFilters);
  }, [filters, syncToURL, onFiltersChange]);

  // Update multiple filters at once
  const updateFilters = useCallback((updates: Partial<FilterValues>) => {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);
    syncToURL(newFilters);
    onFiltersChange?.(newFilters);
  }, [filters, syncToURL, onFiltersChange]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    syncToURL(defaultFilters);
    onFiltersChange?.(defaultFilters);
  }, [syncToURL, onFiltersChange]);

  // Calculate active filters
  const hasActiveFilters = 
    Boolean(filters.query) ||
    Boolean(filters.location?.city) ||
    Boolean(filters.location?.state) ||
    Boolean(filters.location?.zipCode) ||
    (filters.location?.radius !== 25) ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < 500 ||
    filters.minRating > 0 ||
    filters.services.length > 0 ||
    (filters.availability?.days?.length || 0) > 0 ||
    (filters.availability?.timeOfDay?.length || 0) > 0 ||
    Boolean(filters.experience?.min) ||
    Boolean(filters.experience?.max) ||
    filters.verifiedOnly ||
    filters.hasInsurance ||
    filters.instantBooking;

  const activeFilterCount = [
    Boolean(filters.query),
    Boolean(filters.location?.city || filters.location?.state || filters.location?.zipCode),
    filters.location?.radius !== 25,
    filters.priceRange[0] > 0 || filters.priceRange[1] < 500,
    filters.minRating > 0,
    filters.services.length > 0,
    (filters.availability?.days?.length || 0) > 0,
    (filters.availability?.timeOfDay?.length || 0) > 0,
    Boolean(filters.experience?.min || filters.experience?.max),
    filters.verifiedOnly,
    filters.hasInsurance,
    filters.instantBooking,
  ].filter(Boolean).length;

  // Generate filter summary for display
  const filterSummary: string[] = [];
  
  if (filters.query) {
    filterSummary.push(`Search: "${filters.query}"`);
  }
  
  if (filters.location?.city || filters.location?.state) {
    const locationParts = [];
    if (filters.location.city) locationParts.push(filters.location.city);
    if (filters.location.state) locationParts.push(filters.location.state);
    filterSummary.push(`Location: ${locationParts.join(", ")}`);
  }
  
  if (filters.priceRange[0] > 0 || filters.priceRange[1] < 500) {
    filterSummary.push(
      `Price: $${filters.priceRange[0]}-$${filters.priceRange[1]}${
        filters.priceRange[1] >= 500 ? "+" : ""
      }`
    );
  }
  
  if (filters.minRating > 0) {
    filterSummary.push(`Rating: ${filters.minRating}+ stars`);
  }
  
  if (filters.services.length > 0) {
    filterSummary.push(`Services: ${filters.services.length} selected`);
  }
  
  if (filters.verifiedOnly) {
    filterSummary.push("Verified only");
  }
  
  if (filters.hasInsurance) {
    filterSummary.push("Has insurance");
  }
  
  if (filters.instantBooking) {
    filterSummary.push("Instant booking");
  }

  // Listen for browser back/forward navigation
  useEffect(() => {
    if (syncWithURL) {
      setFilters(getInitialFilters());
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    hasActiveFilters,
    activeFilterCount,
    filterSummary,
  };
}