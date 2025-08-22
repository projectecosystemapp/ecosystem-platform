"use client";

import { useState, useTransition } from "react";
import { useProviderSearch } from "@/lib/hooks/use-provider-search";
import { SearchBar } from "@/components/provider/search/SearchBar";
import { SearchFilters, type FilterValues } from "@/components/provider/search/SearchFilters";
import { ProviderCard, ProviderCardSkeleton } from "@/components/provider/search/ProviderCard";
import { SortDropdown, type SortOption } from "@/components/provider/search/SortDropdown";
import { ViewToggle, type ViewMode } from "@/components/provider/search/ViewToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Star,
  Shield,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/db/schema/providers-schema";

interface ProvidersSearchClientProps {
  initialProviders: Provider[];
  totalCount: number;
  featuredProviders?: Provider[];
  initialFilters: any;
}

export default function ProvidersSearchClient({ 
  initialProviders, 
  totalCount,
  featuredProviders = [],
  initialFilters 
}: ProvidersSearchClientProps) {
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const {
    providers,
    total,
    totalPages,
    currentPage,
    filters,
    searchQuery,
    sortBy,
    viewMode,
    isLoading,
    setFilters,
    setSearchQuery,
    setSortBy,
    setViewMode,
    setPage,
    applyFilters,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useProviderSearch({
    initialFilters,
    initialProviders,
    initialTotal: totalCount,
    pageSize: 12,
  });

  const handleSearch = () => {
    startTransition(() => {
      applyFilters();
    });
  };

  const handleFiltersChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    startTransition(() => {
      applyFilters();
      setMobileFiltersOpen(false);
    });
  };

  const handleClearFilters = () => {
    startTransition(() => {
      clearFilters();
    });
  };

  const handlePageChange = (page: number) => {
    startTransition(() => {
      setPage(page);
    });
  };

  // Calculate pagination range
  const getPaginationRange = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const showingStart = total > 0 ? (currentPage - 1) * 12 + 1 : 0;
  const showingEnd = Math.min(currentPage * 12, total);

  return (
    <div className="space-y-6">
      {/* Featured Providers Section */}
      {featuredProviders.length > 0 && currentPage === 1 && !hasActiveFilters && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">Featured Providers</h2>
            <Badge variant="secondary">Top Rated</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredProviders.map((provider) => (
              <div key={provider.id} className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-lg opacity-20" />
                <ProviderCard provider={provider} showFavorite={false} className="relative" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onSearch={handleSearch}
        isLoading={isLoading || isPending}
        instantSearch={true}
        debounceMs={300}
      />

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">Active filters:</span>
          {filters.location?.city && (
            <Badge variant="secondary">
              <MapPin className="h-3 w-3 mr-1" />
              {filters.location.city}
            </Badge>
          )}
          {filters.minRating > 0 && (
            <Badge variant="secondary">
              <Star className="h-3 w-3 mr-1" />
              {filters.minRating}+ stars
            </Badge>
          )}
          {filters.verifiedOnly && (
            <Badge variant="secondary">
              <Shield className="h-3 w-3 mr-1" />
              Verified only
            </Badge>
          )}
          {filters.priceRange[0] > 0 || filters.priceRange[1] < 500 && (
            <Badge variant="secondary">
              ${filters.priceRange[0]}-${filters.priceRange[1]}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Mobile Filter Button */}
        <div className="lg:hidden">
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="w-full">
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-2" variant="secondary">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter Providers</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <SearchFilters
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onApplyFilters={handleApplyFilters}
                  onClearFilters={handleClearFilters}
                  isLoading={isLoading || isPending}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop Sidebar Filters */}
        <aside className="hidden lg:block w-80 flex-shrink-0">
          <Card className="sticky top-4">
            <CardContent className="p-6">
              <SearchFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                onApplyFilters={handleApplyFilters}
                onClearFilters={handleClearFilters}
                isLoading={isLoading || isPending}
              />
            </CardContent>
          </Card>
        </aside>

        {/* Main Results Area */}
        <div className="flex-1">
          {/* Results Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <p className="text-sm text-muted-foreground">
                {total > 0 ? (
                  <>
                    Showing <span className="font-medium">{showingStart}-{showingEnd}</span> of{" "}
                    <span className="font-medium">{total}</span> providers
                  </>
                ) : (
                  "No providers found"
                )}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <ViewToggle
                value={viewMode}
                onChange={setViewMode}
                showMapOption={false}
                disabled={isLoading || isPending}
              />
              <SortDropdown
                value={sortBy}
                onChange={(value) => {
                  setSortBy(value);
                  startTransition(() => applyFilters());
                }}
                disabled={isLoading || isPending}
                showDistanceOption={Boolean(filters.location?.city || filters.location?.zipCode)}
              />
            </div>
          </div>

          {/* Provider Results */}
          {isLoading || isPending ? (
            <div className={cn(
              viewMode === "list" 
                ? "space-y-4" 
                : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <ProviderCardSkeleton key={i} viewMode={viewMode} />
              ))}
            </div>
          ) : providers.length > 0 ? (
            <div className={cn(
              viewMode === "list" 
                ? "space-y-4" 
                : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            )}>
              {providers.map((provider) => (
                <ProviderCard 
                  key={provider.id} 
                  provider={provider} 
                  viewMode={viewMode}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <CardContent className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                  <Search className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">No providers found</h3>
                  <p className="text-muted-foreground max-w-md">
                    Try adjusting your filters or search terms to find what you're looking for.
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center mt-8">
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoading || isPending}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {getPaginationRange().map((pageNum, index) => {
                  if (pageNum === "...") {
                    return (
                      <span 
                        key={`dots-${index}`} 
                        className="px-3 text-muted-foreground"
                      >
                        ...
                      </span>
                    );
                  }
                  
                  const page = pageNum as number;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      disabled={isLoading || isPending}
                      className={cn(
                        "min-w-[40px]",
                        currentPage === page && "pointer-events-none"
                      )}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? "page" : undefined}
                    >
                      {page}
                    </Button>
                  );
                })}
                
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages || isLoading || isPending}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          )}

          {/* SEO-friendly provider count text */}
          {total > 0 && (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>
                Browse {total} verified service providers in{" "}
                {filters.location?.city || "your area"}. 
                All providers are background-checked and insured.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}