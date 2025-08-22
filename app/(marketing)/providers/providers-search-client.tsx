"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { searchProvidersAction } from "@/actions/providers-actions";
import { Provider } from "@/db/schema/providers-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  MapPin, 
  Star, 
  DollarSign, 
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

interface ProvidersSearchClientProps {
  initialProviders: Provider[];
  totalCount: number;
  initialFilters: {
    query?: string;
    city?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sortBy?: string;
    page: number;
    pageSize: number;
  };
}

export default function ProvidersSearchClient({ 
  initialProviders, 
  totalCount, 
  initialFilters 
}: ProvidersSearchClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  // State for filters
  const [query, setQuery] = useState(initialFilters.query || "");
  const [city, setCity] = useState(initialFilters.city || "");
  const [state, setState] = useState(initialFilters.state || "");
  const [priceRange, setPriceRange] = useState<[number, number]>([
    initialFilters.minPrice || 0,
    initialFilters.maxPrice || 500,
  ]);
  const [minRating, setMinRating] = useState(initialFilters.minRating || 0);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy || "relevance");
  const [currentPage, setCurrentPage] = useState(initialFilters.page);
  
  // State for results
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [total, setTotal] = useState(totalCount);
  const [isLoading, setIsLoading] = useState(false);
  
  const totalPages = Math.ceil(total / initialFilters.pageSize);

  // Update URL with filters
  const updateURL = useCallback((filters: Record<string, any>) => {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== 0) {
        params.set(key, String(value));
      }
    });
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router]);

  // Perform search
  const performSearch = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    
    const filters = {
      query: query || undefined,
      city: city || undefined,
      state: state || undefined,
      minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
      maxPrice: priceRange[1] < 500 ? priceRange[1] : undefined,
      minRating: minRating > 0 ? minRating : undefined,
      sortBy: sortBy as any,
      page,
      pageSize: initialFilters.pageSize,
    };
    
    // Update URL
    updateURL({ ...filters, sort: sortBy });
    
    try {
      const result = await searchProvidersAction(filters);
      
      if (result.isSuccess && result.data) {
        setProviders(result.data.providers);
        setTotal(result.data.total);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [query, city, state, priceRange, minRating, sortBy, initialFilters.pageSize, updateURL]);

  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      performSearch(1);
    });
  };

  // Handle filter changes
  const handleFilterChange = () => {
    startTransition(() => {
      performSearch(1);
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setQuery("");
    setCity("");
    setState("");
    setPriceRange([0, 500]);
    setMinRating(0);
    setSortBy("relevance");
    startTransition(() => {
      performSearch(1);
    });
  };

  // Check if any filters are active
  const hasActiveFilters = query || city || state || 
    priceRange[0] > 0 || priceRange[1] < 500 || minRating > 0;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Mobile Filter Button */}
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Filter className="mr-2 h-4 w-4" />
              Filters {hasActiveFilters && <Badge className="ml-2" variant="secondary">Active</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Filter Providers</SheetTitle>
              <SheetDescription>
                Narrow down your search to find the perfect provider
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <FilterSidebar
                city={city}
                state={state}
                priceRange={priceRange}
                minRating={minRating}
                sortBy={sortBy}
                onCityChange={setCity}
                onStateChange={setState}
                onPriceRangeChange={setPriceRange}
                onMinRatingChange={setMinRating}
                onSortByChange={setSortBy}
                onFilterChange={handleFilterChange}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-80 flex-shrink-0">
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle>Filter Providers</CardTitle>
            <CardDescription>
              Narrow down your search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilterSidebar
              city={city}
              state={state}
              priceRange={priceRange}
              minRating={minRating}
              sortBy={sortBy}
              onCityChange={setCity}
              onStateChange={setState}
              onPriceRangeChange={setPriceRange}
              onMinRatingChange={setMinRating}
              onSortByChange={setSortBy}
              onFilterChange={handleFilterChange}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
            />
          </CardContent>
        </Card>
      </aside>

      {/* Main Content */}
      <div className="flex-1">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search for providers, services..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-4 h-12 text-base"
            />
            <Button 
              type="submit" 
              className="absolute right-2 top-1/2 -translate-y-1/2"
              disabled={isPending || isLoading}
            >
              Search
            </Button>
          </div>
        </form>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            {total > 0 ? (
              <>
                Showing {((currentPage - 1) * initialFilters.pageSize) + 1}-
                {Math.min(currentPage * initialFilters.pageSize, total)} of {total} providers
              </>
            ) : (
              "No providers found"
            )}
          </p>
          
          <Select value={sortBy} onValueChange={(value) => {
            setSortBy(value);
            startTransition(() => performSearch(1));
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="price">Price: Low to High</SelectItem>
              <SelectItem value="recent">Recently Added</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Provider Grid */}
        {isLoading || isPending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProviderCardSkeleton key={i} />
            ))}
          </div>
        ) : providers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <CardContent className="space-y-4">
              <div className="w-20 h-20 bg-muted rounded-full mx-auto flex items-center justify-center">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No providers found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Try adjusting your filters or search terms to find what you&apos;re looking for.
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="icon"
              onClick={() => startTransition(() => performSearch(currentPage - 1))}
              disabled={currentPage <= 1 || isLoading || isPending}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNumber = i + 1;
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => startTransition(() => performSearch(pageNumber))}
                  disabled={isLoading || isPending}
                >
                  {pageNumber}
                </Button>
              );
            })}
            
            {totalPages > 5 && <span className="px-2">...</span>}
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => startTransition(() => performSearch(currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading || isPending}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Filter Sidebar Component
function FilterSidebar({
  city,
  state,
  priceRange,
  minRating,
  sortBy,
  onCityChange,
  onStateChange,
  onPriceRangeChange,
  onMinRatingChange,
  onSortByChange,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
}: any) {
  return (
    <div className="space-y-6">
      {/* Location */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Location</Label>
        <Input
          placeholder="City"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          onBlur={onFilterChange}
        />
        <Input
          placeholder="State"
          value={state}
          onChange={(e) => onStateChange(e.target.value)}
          onBlur={onFilterChange}
          maxLength={2}
        />
      </div>

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Price Range: ${priceRange[0]} - ${priceRange[1]}
        </Label>
        <Slider
          value={priceRange}
          onValueChange={onPriceRangeChange}
          onValueCommit={onFilterChange}
          min={0}
          max={500}
          step={10}
          className="mt-2"
        />
      </div>

      {/* Minimum Rating */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Minimum Rating</Label>
        <div className="flex gap-2">
          {[0, 3, 4, 4.5].map((rating) => (
            <Button
              key={rating}
              variant={minRating === rating ? "default" : "outline"}
              size="sm"
              onClick={() => {
                onMinRatingChange(rating);
                onFilterChange();
              }}
            >
              {rating === 0 ? "Any" : `${rating}+`}
            </Button>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={onClearFilters}
        >
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Provider Card Component
function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <Link href={`/providers/${provider.slug}`}>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            {provider.profileImageUrl ? (
              <Image
                src={provider.profileImageUrl}
                alt={provider.displayName}
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="line-clamp-1">{provider.displayName}</CardTitle>
              <CardDescription className="line-clamp-2 mt-1">
                {provider.tagline || "Service Provider"}
              </CardDescription>
            </div>
            {provider.isVerified && (
              <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pb-4">
          {/* Location */}
          {(provider.locationCity || provider.locationState) && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" />
              <span>
                {provider.locationCity}
                {provider.locationCity && provider.locationState && ", "}
                {provider.locationState}
              </span>
            </div>
          )}
          
          {/* Rating */}
          {provider.averageRating && Number(provider.averageRating) > 0 && (
            <div className="flex items-center gap-1 mb-3">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(provider.averageRating).toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">
                ({provider.totalReviews} reviews)
              </span>
            </div>
          )}
          
          {/* Services */}
          {provider.services && provider.services.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {provider.services.slice(0, 3).map((service: any, index: number) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {service.name}
                </Badge>
              ))}
              {provider.services.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{provider.services.length - 3} more
                </Badge>
              )}
            </div>
          )}
          
          {/* Experience */}
          {provider.yearsExperience && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{provider.yearsExperience} years experience</span>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="pt-0">
          <div className="flex items-center justify-between w-full">
            {provider.hourlyRate && (
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">${provider.hourlyRate}/hr</span>
              </div>
            )}
            <Button size="sm">View Profile</Button>
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}

// Loading Skeleton
function ProviderCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-9 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}