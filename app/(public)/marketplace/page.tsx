"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Grid3X3,
  List,
  Map,
  Filter as FilterIcon,
  X,
  ChevronDown,
  Loader2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

// Import our custom components
import { UnifiedSearchBar } from "@/components/search/UnifiedSearchBar";
import { SearchFilters, FilterState } from "@/components/search/SearchFilters";
import { LocationPicker } from "@/components/search/LocationPicker";
import { FeaturedSection } from "@/components/discovery/FeaturedSection";
import { CategoryBrowser } from "@/components/discovery/CategoryBrowser";
import { UniversalListingCard } from "@/components/marketplace/cards/UniversalListingCard";
import type { ListingData } from "@/components/marketplace/cards/UniversalListingCard";

// View modes
type ViewMode = "grid" | "list" | "map";

// Sort options
const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "distance", label: "Distance: Nearest" },
  { value: "rating", label: "Rating: Highest" },
  { value: "newest", label: "Newest First" },
];

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Parse URL parameters
  const initialQuery = searchParams.get("q") || "";
  const initialVertical = searchParams.get("vertical") || "all";
  const initialCategory = searchParams.get("category") || "";
  const initialSort = searchParams.get("sort") || "relevance";

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showCategories, setShowCategories] = useState(!initialQuery);
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedVertical, setSelectedVertical] = useState(initialVertical);
  const [sortBy, setSortBy] = useState(initialSort);
  const [location, setLocation] = useState<any>(null);

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch search results
  const {
    data: searchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["marketplace-search", initialQuery, selectedVertical, filters, sortBy, location],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        q: initialQuery,
        page: pageParam.toString(),
        pageSize: "20",
        sortBy,
      });

      if (selectedVertical !== "all") {
        params.append("verticals[]", selectedVertical);
      }

      if (initialCategory) {
        params.append("category", initialCategory);
      }

      // Add common filters
      if (filters.priceRange) {
        params.append("minPrice", filters.priceRange.min.toString());
        params.append("maxPrice", filters.priceRange.max.toString());
      }

      if (filters.location || location) {
        const loc = filters.location || location;
        params.append("lat", loc.lat.toString());
        params.append("lng", loc.lng.toString());
        params.append("radius", (loc.radius || 10).toString());
      }

      if (filters.rating) {
        params.append("minRating", filters.rating.toString());
      }

      // Add service-specific filters
      if (filters.availability) {
        params.append("availability", filters.availability);
      }

      if (filters.instantBooking !== undefined) {
        params.append("instantBooking", filters.instantBooking.toString());
      }

      if (filters.providerVerified !== undefined) {
        params.append("providerVerified", filters.providerVerified.toString());
      }

      // Add event-specific filters
      if (filters.eventDateRange) {
        if (filters.eventDateRange.start) {
          params.append("startDate", filters.eventDateRange.start.toISOString());
        }
        if (filters.eventDateRange.end) {
          params.append("endDate", filters.eventDateRange.end.toISOString());
        }
      }

      if (filters.isVirtual !== undefined) {
        params.append("isOnline", filters.isVirtual.toString());
      }

      if (filters.hasTickets !== undefined) {
        params.append("hasSpots", filters.hasTickets.toString());
      }

      // Add space-specific filters
      if (filters.spaceCapacity) {
        if (filters.spaceCapacity.min !== undefined) {
          params.append("minCapacity", filters.spaceCapacity.min.toString());
        }
        if (filters.spaceCapacity.max !== undefined) {
          params.append("maxCapacity", filters.spaceCapacity.max.toString());
        }
      }

      if (filters.squareFeet) {
        if (filters.squareFeet.min !== undefined) {
          params.append("minSize", filters.squareFeet.min.toString());
        }
        if (filters.squareFeet.max !== undefined) {
          params.append("maxSize", filters.squareFeet.max.toString());
        }
      }

      if (filters.amenities && filters.amenities.length > 0) {
        filters.amenities.forEach(amenity => {
          params.append("amenities[]", amenity);
        });
      }

      if (filters.priceUnit) {
        params.append("priceUnit", filters.priceUnit);
      }

      // Add thing-specific filters
      if (filters.condition) {
        params.append("condition", filters.condition);
      }

      if (filters.brand) {
        params.append("brand", filters.brand);
      }

      if (filters.isNegotiable !== undefined) {
        params.append("negotiable", filters.isNegotiable.toString());
      }

      if (filters.shippingAvailable !== undefined) {
        params.append("shippingAvailable", filters.shippingAvailable.toString());
      }

      if (filters.localPickupOnly !== undefined) {
        params.append("localPickupOnly", filters.localPickupOnly.toString());
      }

      const response = await fetch(`/api/unified-search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch results");
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination.page < lastPage.pagination.totalPages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    enabled: !!initialQuery || !!initialCategory,
    initialPageParam: 1,
  });

  // Flatten pages of results
  const results = searchData?.pages.flatMap(page => page.results) || [];
  const totalResults = searchData?.pages[0]?.pagination.total || 0;
  const categories = searchData?.pages[0]?.categories || [];

  // Handle search
  const handleSearch = useCallback((query: string, searchFilters?: any) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (searchFilters?.vertical && searchFilters.vertical !== "all") {
      params.set("vertical", searchFilters.vertical);
    }
    if (searchFilters?.location) {
      params.set("lat", searchFilters.location.lat.toString());
      params.set("lng", searchFilters.location.lng.toString());
    }

    router.push(`/marketplace?${params.toString()}`);
  }, [router]);

  // Handle filter change
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  // Handle filter apply
  const handleApplyFilters = () => {
    refetch();
    setShowFilters(false);
  };

  // Handle infinite scroll
  useEffect(() => {
    if (viewMode !== "grid" && viewMode !== "list") return;

    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, viewMode]);

  // Handle listing interactions
  const handleItemClick = (item: ListingData) => {
    router.push(`/listing/${item.type}/${item.id}`);
  };

  const handleFavorite = async (item: ListingData, isFavorited: boolean) => {
    try {
      // API call to toggle favorite
      toast({
        title: isFavorited ? "Added to favorites" : "Removed from favorites",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    }
  };

  const handleShare = (item: ListingData) => {
    const url = `${window.location.origin}/listing/${item.type}/${item.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Listing link copied to clipboard",
      duration: 2000,
    });
  };

  // Render map view
  const renderMapView = () => (
    <div className="h-[calc(100vh-200px)] bg-muted rounded-lg flex items-center justify-center">
      <div className="text-center">
        <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Map view coming soon</p>
      </div>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-12"
    >
      <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-xl font-semibold mb-2">
        {initialQuery ? "No results found" : "Start your search"}
      </h3>
      <p className="text-muted-foreground mb-6">
        {initialQuery
          ? `We couldn't find any listings matching "${initialQuery}"`
          : "Use the search bar above to find services, events, spaces, and things"}
      </p>
      {initialQuery && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Try:</p>
          <ul className="text-sm text-muted-foreground">
            <li>• Checking your spelling</li>
            <li>• Using more general terms</li>
            <li>• Removing filters</li>
          </ul>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Search */}
      <div className="sticky top-0 z-30 bg-background border-b">
        <div className="container mx-auto px-4 py-4">
          <UnifiedSearchBar
            onSearch={handleSearch}
            categories={categories}
            currentLocation={location}
            showVoiceSearch
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Show featured section if no search */}
        {!initialQuery && !initialCategory && (
          <div className="mb-8">
            <FeaturedSection
              autoPlay
              onItemClick={handleItemClick}
              viewAllLink="/marketplace?featured=true"
            />
          </div>
        )}

        {/* Show categories browser if no search */}
        {showCategories && !initialQuery && (
          <div className="mb-8">
            <CategoryBrowser
              categories={categories}
              viewMode="grid"
              showCounts
              showSubcategories
              showSearch={false}
              columns={3}
              onCategoryClick={(category) => {
                router.push(`/marketplace?category=${category.slug}`);
              }}
            />
          </div>
        )}

        {/* Results Section */}
        {(initialQuery || initialCategory) && (
          <div className="flex gap-6">
            {/* Desktop Filters Sidebar */}
            {!isMobile && (
              <aside className="w-64 flex-shrink-0 hidden lg:block">
                <div className="sticky top-24 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Filters</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilters({})}
                    >
                      Clear all
                    </Button>
                  </div>
                  <SearchFilters
                    vertical={selectedVertical as any}
                    filters={filters}
                    onFiltersChange={handleFiltersChange}
                    onApply={handleApplyFilters}
                    categories={categories}
                  />
                </div>
              </aside>
            )}

            {/* Results Area */}
            <div className="flex-1">
              {/* Results Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-semibold">
                    {initialQuery ? (
                      <>
                        Results for <span className="text-primary">"{initialQuery}"</span>
                      </>
                    ) : (
                      "All Listings"
                    )}
                  </h2>
                  {totalResults > 0 && (
                    <Badge variant="secondary">
                      {totalResults} {totalResults === 1 ? "result" : "results"}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Mobile Filter Button */}
                  {isMobile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(true)}
                    >
                      <FilterIcon className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  )}

                  {/* Sort Dropdown */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* View Mode Toggle */}
                  <div className="flex rounded-lg border">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("grid")}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "map" ? "default" : "ghost"}
                      size="icon"
                      onClick={() => setViewMode("map")}
                    >
                      <Map className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Filters Display */}
              {Object.keys(filters).length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {filters.priceRange && (
                    <Badge variant="secondary">
                      ${filters.priceRange.min} - ${filters.priceRange.max}
                      <button
                        onClick={() => setFilters({ ...filters, priceRange: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.rating && (
                    <Badge variant="secondary">
                      {filters.rating}+ stars
                      <button
                        onClick={() => setFilters({ ...filters, rating: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.instantBooking && (
                    <Badge variant="secondary">
                      Instant Booking
                      <button
                        onClick={() => setFilters({ ...filters, instantBooking: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.providerVerified && (
                    <Badge variant="secondary">
                      Verified Providers
                      <button
                        onClick={() => setFilters({ ...filters, providerVerified: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.availability && (
                    <Badge variant="secondary">
                      {filters.availability === "available" ? "Available Now" : filters.availability}
                      <button
                        onClick={() => setFilters({ ...filters, availability: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.condition && (
                    <Badge variant="secondary">
                      Condition: {filters.condition.replace("_", " ")}
                      <button
                        onClick={() => setFilters({ ...filters, condition: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.amenities && filters.amenities.length > 0 && (
                    <Badge variant="secondary">
                      {filters.amenities.length} amenities
                      <button
                        onClick={() => setFilters({ ...filters, amenities: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.location && (
                    <Badge variant="secondary">
                      Within {filters.location.radius} miles
                      <button
                        onClick={() => setFilters({ ...filters, location: undefined })}
                        className="ml-2"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}

              {/* Results Grid/List/Map */}
              {isLoading && !results.length ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-red-500">Error loading results</p>
                  <Button onClick={() => refetch()} className="mt-4">
                    Try Again
                  </Button>
                </div>
              ) : viewMode === "map" ? (
                renderMapView()
              ) : results.length > 0 ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={viewMode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        viewMode === "grid"
                          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                          : "space-y-4"
                      )}
                    >
                      {results.map((item: ListingData) => (
                        <UniversalListingCard
                          key={item.id}
                          listing={item}
                          view={viewMode}
                          onClick={handleItemClick}
                          onFavorite={handleFavorite}
                          onShare={handleShare}
                        />
                      ))}
                    </motion.div>
                  </AnimatePresence>

                  {/* Load More / Loading Indicator */}
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}

                  {hasNextPage && !isFetchingNextPage && (
                    <div className="flex justify-center py-8">
                      <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                renderEmptyState()
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Filter Sheet */}
      <Sheet open={showFilters && isMobile} onOpenChange={setShowFilters}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Refine your search results
            </SheetDescription>
          </SheetHeader>
          <Separator className="my-4" />
          <SearchFilters
            vertical={selectedVertical as any}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onApply={handleApplyFilters}
            onReset={() => setFilters({})}
            categories={categories}
            isMobile
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}