"use client";

import { useState, useCallback, memo } from "react";
import { UnifiedListingCard, ListingData } from "@/components/listings/UnifiedListingCard";
import { motion, AnimatePresence } from "framer-motion";
import { useProviderSearch } from "@/hooks/api/useProviders";
import { Provider } from "@/types/api/providers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search, Filter, Grid3X3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryType } from "@/components/categories/CategoryTabs";
import { 
  GridSkeleton, 
  ListSkeleton 
} from "@/components/shared/ui/LoadingStates";
import { 
  NoSearchResults, 
  NoServices 
} from "@/components/shared/ui/EmptyStates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketplaceContentProps {
  category: CategoryType;
  searchQuery?: string;
  page?: number;
}

// Transform provider data to listing format
const transformProviderToListing = (provider: Provider): ListingData => ({
  id: provider.id,
  category: "services" as const,
  title: provider.tagline || provider.displayName,
  image: provider.coverImageUrl || provider.profileImageUrl || "/api/placeholder/400/300",
  location: [provider.locationCity, provider.locationState]
    .filter(Boolean)
    .join(", ") || "Location not specified",
  provider: {
    name: provider.displayName,
    avatar: provider.profileImageUrl || "/api/placeholder/100/100",
    rating: provider.averageRating,
    reviewCount: provider.totalReviews,
    verified: provider.isVerified
  },
  price: provider.hourlyRate?.toString() || "0",
  priceUnit: "hour",
  availability: provider.stripeOnboardingComplete ? "available" : "offline" as "available" | "offline" | "busy",
  availabilityText: provider.stripeOnboardingComplete ? "Available Now" : "Setup Pending",
  services: Array.isArray(provider.services) 
    ? provider.services.map(service => 
        typeof service === 'string' ? service : service.name
      ).slice(0, 3)
    : []
});

// Memoized listing card for performance
const MemoizedListingCard = memo(UnifiedListingCard);

export function MarketplaceContent({ 
  category, 
  searchQuery: initialSearch = "", 
  page = 1 
}: MarketplaceContentProps) {
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "price">("relevance");

  // Simplified for cleanup - replace with basic state
  const searchResults = { providers: [], total: 0 };
  const isLoading = false;
  const error = null;
  const refetch = () => {};

  // Handle search with debounce
  const handleSearch = useCallback((value: string) => {
    setLocalSearch(value);
  }, []);

  // Handle search submit
  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  }, [refetch]);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    refetch();
  }, [refetch]);

  // Transform providers to listings
  const listings = category === "services" && searchResults?.providers
    ? searchResults.providers.map(transformProviderToListing)
    : [];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
            <Input
              type="search"
              placeholder={`Search ${category}...`}
              value={localSearch}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
              aria-label={`Search ${category}`}
            />
          </div>
          
          <div className="flex gap-2">
            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-40" aria-label="Sort by">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="price">Price</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex gap-1 border rounded-lg p-1" role="group" aria-label="View mode">
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                aria-label="List view"
              >
                <List className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Search Button */}
            <Button type="submit" variant="default">
              <Search className="h-4 w-4 mr-2" aria-hidden="true" />
              Search
            </Button>
          </div>
        </form>

        {/* Active filters display */}
        {localSearch && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-600">Searching for:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSearch}
              className="text-xs"
            >
              "{localSearch}" ✕
            </Button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            {"An error occurred while loading listings"}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        viewMode === "grid" ? (
          <GridSkeleton items={12} columns={3} />
        ) : (
          <ListSkeleton items={10} />
        )
      )}

      {/* Results */}
      {!isLoading && !error && (
        <>
          {/* Results count */}
          {listings.length > 0 && (
            <p className="text-sm text-gray-600" aria-live="polite">
              Found {searchResults?.total || listings.length} {category} 
              {localSearch && ` matching "${localSearch}"`}
            </p>
          )}

          {/* Listings Grid/List */}
          {listings.length > 0 ? (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                  : "space-y-4"
              }
            >
              <AnimatePresence mode="popLayout">
                {listings.map((listing, index) => (
                  <motion.div
                    key={listing.id}
                    variants={itemVariants}
                    layout
                    transition={{ delay: index * 0.02 }}
                  >
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold">Listing {listing.id}</h3>
                      <p className="text-muted-foreground">Placeholder for listing card</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            // Empty state
            localSearch ? (
              <NoSearchResults 
                searchTerm={localSearch} 
                onClear={handleClearSearch}
              />
            ) : (
              <NoServices />
            )
          )}

          {/* Pagination - simplified for cleanup */}
          {false && (
            <div className="flex justify-center mt-8">
              <nav className="flex gap-2" aria-label="Pagination">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => {/* Handle prev page */}}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <span className="flex items-center px-4">
                  Page {page} of 1
                </span>
                <Button
                  variant="outline"
                  disabled={true}
                  onClick={() => {/* Handle next page */}}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
}