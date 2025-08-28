# Component Specifications for New Features
## Detailed Component Documentation Aligned with Design System

**Version**: 1.0  
**Date**: January 2025  
**Status**: Ready for Development Implementation

---

## 1. Search & Discovery Components

### 1.1 SearchInterface Component

#### Component Overview
The main search interface component that orchestrates provider search functionality with filters, results, and map views.

#### TypeScript Interface
```typescript
interface SearchInterfaceProps {
  initialQuery?: string;
  initialLocation?: string;
  initialFilters?: SearchFilters;
  viewMode?: 'list' | 'map' | 'grid';
  isAuthenticated: boolean;
  onProviderSelect?: (providerId: string) => void;
  onSearchStateChange?: (state: SearchState) => void;
}

interface SearchFilters {
  query: string;
  location: string;
  serviceTypes: string[];
  priceRange: { min: number; max: number };
  rating: number;
  distance: number;
  availability: 'today' | 'week' | 'month' | 'any';
  instantBooking: boolean;
  verified: boolean;
  sortBy: 'relevance' | 'price' | 'rating' | 'distance';
}

interface SearchState {
  filters: SearchFilters;
  results: ProviderSearchResult[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  hasMore: boolean;
}
```

#### Component Implementation
```tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchFilters } from './SearchFilters';
import { SearchResults } from './SearchResults';
import { MapView } from './MapView';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ErrorBoundary } from '@/components/error-boundary';

export function SearchInterface({
  initialQuery = '',
  initialLocation = '',
  initialFilters = defaultFilters,
  viewMode = 'list',
  isAuthenticated = false,
  onProviderSelect,
  onSearchStateChange
}: SearchInterfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State management
  const [filters, setFilters] = useState<SearchFilters>({
    ...initialFilters,
    query: initialQuery,
    location: initialLocation,
    ...parseFiltersFromURL(searchParams)
  });
  
  const [searchState, setSearchState] = useState<SearchState>({
    filters,
    results: [],
    loading: false,
    error: null,
    totalCount: 0,
    currentPage: 1,
    hasMore: false
  });
  
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  
  // Debounced search to avoid excessive API calls
  const debouncedFilters = useDebounce(filters, 300);
  
  // Search function
  const performSearch = useCallback(async (searchFilters: SearchFilters, page = 1) => {
    setSearchState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/search/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...searchFilters,
          page,
          limit: 12
        }),
      });
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      
      setSearchState(prev => ({
        ...prev,
        results: page === 1 ? data.providers : [...prev.results, ...data.providers],
        totalCount: data.totalCount,
        currentPage: page,
        hasMore: data.hasMore,
        loading: false
      }));
      
      // Update URL with search parameters
      updateURL(searchFilters);
      
    } catch (error) {
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }));
    }
  }, []);
  
  // Effect to trigger search when filters change
  useEffect(() => {
    performSearch(debouncedFilters, 1);
  }, [debouncedFilters, performSearch]);
  
  // Notify parent of state changes
  useEffect(() => {
    onSearchStateChange?.(searchState);
  }, [searchState, onSearchStateChange]);
  
  // Filter update handler
  const handleFilterChange = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Load more results for infinite scroll
  const handleLoadMore = useCallback(() => {
    if (searchState.hasMore && !searchState.loading) {
      performSearch(filters, searchState.currentPage + 1);
    }
  }, [searchState.hasMore, searchState.loading, searchState.currentPage, filters, performSearch]);
  
  // Provider selection handler
  const handleProviderSelect = useCallback((providerId: string) => {
    onProviderSelect?.(providerId);
    router.push(`/providers/${providerId}`);
  }, [onProviderSelect, router]);
  
  // View mode toggle
  const handleViewModeChange = useCallback((mode: 'list' | 'map' | 'grid') => {
    setCurrentViewMode(mode);
  }, []);
  
  return (
    <ErrorBoundary>
      <div className="search-interface">
        {/* Mobile Filter Toggle */}
        <div className="md:hidden mb-4">
          <SearchFilters
            filters={filters}
            onFiltersChange={handleFilterChange}
            isMobile={true}
            resultCount={searchState.totalCount}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr_400px] gap-6">
          {/* Desktop Filter Sidebar */}
          <div className="hidden md:block">
            <SearchFilters
              filters={filters}
              onFiltersChange={handleFilterChange}
              isMobile={false}
              resultCount={searchState.totalCount}
            />
          </div>
          
          {/* Results Area */}
          <div className="min-w-0">
            {searchState.loading && searchState.results.length === 0 ? (
              <LoadingSpinner className="h-64" />
            ) : searchState.error ? (
              <SearchErrorState 
                error={searchState.error}
                onRetry={() => performSearch(filters, 1)}
              />
            ) : (
              <SearchResults
                results={searchState.results}
                loading={searchState.loading}
                hasMore={searchState.hasMore}
                onLoadMore={handleLoadMore}
                onProviderSelect={handleProviderSelect}
                viewMode={currentViewMode}
                onViewModeChange={handleViewModeChange}
                isAuthenticated={isAuthenticated}
              />
            )}
          </div>
          
          {/* Map View (Desktop) */}
          {currentViewMode === 'map' && (
            <div className="hidden lg:block">
              <MapView
                providers={searchState.results}
                onProviderSelect={handleProviderSelect}
                center={filters.location}
                zoom={12}
              />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Helper functions
function parseFiltersFromURL(searchParams: URLSearchParams): Partial<SearchFilters> {
  return {
    query: searchParams.get('q') || undefined,
    location: searchParams.get('location') || undefined,
    serviceTypes: searchParams.get('services')?.split(',') || undefined,
    priceRange: searchParams.get('price') ? 
      JSON.parse(searchParams.get('price')!) : undefined,
    rating: searchParams.get('rating') ? 
      Number(searchParams.get('rating')) : undefined,
    // ... other filter parsing
  };
}

function updateURL(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.location) params.set('location', filters.location);
  // ... other parameter updates
  
  window.history.replaceState({}, '', `?${params.toString()}`);
}

const defaultFilters: SearchFilters = {
  query: '',
  location: '',
  serviceTypes: [],
  priceRange: { min: 0, max: 1000 },
  rating: 0,
  distance: 25,
  availability: 'any',
  instantBooking: false,
  verified: false,
  sortBy: 'relevance'
};
```

#### Styling (Tailwind CSS)
```css
.search-interface {
  @apply container mx-auto px-4 py-6;
}

.search-interface .filter-sidebar {
  @apply bg-white rounded-lg shadow-sm border p-6 sticky top-6 h-fit;
}

.search-interface .results-area {
  @apply space-y-4;
}

.search-interface .map-container {
  @apply bg-white rounded-lg shadow-sm border overflow-hidden sticky top-6 h-[600px];
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .search-interface {
    @apply px-2 py-4;
  }
  
  .search-interface .results-area {
    @apply space-y-3;
  }
}
```

### 1.2 SearchFilters Component

#### Component Interface
```typescript
interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: Partial<SearchFilters>) => void;
  isMobile: boolean;
  resultCount: number;
}
```

#### Implementation
```tsx
"use client";

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';

export function SearchFilters({
  filters,
  onFiltersChange,
  isMobile,
  resultCount
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Service Types */}
      <div>
        <Label className="text-sm font-medium">Service Type</Label>
        <div className="mt-2 space-y-2">
          {SERVICE_CATEGORIES.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={category.id}
                checked={filters.serviceTypes.includes(category.id)}
                onCheckedChange={(checked) => {
                  const newTypes = checked
                    ? [...filters.serviceTypes, category.id]
                    : filters.serviceTypes.filter(t => t !== category.id);
                  onFiltersChange({ serviceTypes: newTypes });
                }}
              />
              <Label htmlFor={category.id} className="text-sm">
                {category.name} ({category.count})
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Price Range */}
      <div>
        <Label className="text-sm font-medium">Price Range</Label>
        <div className="mt-2">
          <Slider
            value={[filters.priceRange.min, filters.priceRange.max]}
            onValueChange={([min, max]) => {
              onFiltersChange({ priceRange: { min, max } });
            }}
            max={500}
            min={0}
            step={25}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-500 mt-1">
            <span>${filters.priceRange.min}/hr</span>
            <span>${filters.priceRange.max}/hr</span>
          </div>
        </div>
      </div>
      
      {/* Rating Filter */}
      <div>
        <Label className="text-sm font-medium">Minimum Rating</Label>
        <Select
          value={filters.rating.toString()}
          onValueChange={(value) => onFiltersChange({ rating: Number(value) })}
        >
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Any rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any rating</SelectItem>
            <SelectItem value="3">3+ stars</SelectItem>
            <SelectItem value="4">4+ stars</SelectItem>
            <SelectItem value="4.5">4.5+ stars</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Distance */}
      <div>
        <Label className="text-sm font-medium">Distance</Label>
        <div className="mt-2">
          <Slider
            value={[filters.distance]}
            onValueChange={([distance]) => onFiltersChange({ distance })}
            max={100}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="text-sm text-gray-500 mt-1">
            Within {filters.distance} miles
          </div>
        </div>
      </div>
      
      {/* Quick Filters */}
      <div>
        <Label className="text-sm font-medium">Quick Filters</Label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="verified"
              checked={filters.verified}
              onCheckedChange={(checked) => onFiltersChange({ verified: !!checked })}
            />
            <Label htmlFor="verified" className="text-sm">Verified providers only</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="instant"
              checked={filters.instantBooking}
              onCheckedChange={(checked) => onFiltersChange({ instantBooking: !!checked })}
            />
            <Label htmlFor="instant" className="text-sm">Instant booking</Label>
          </div>
        </div>
      </div>
      
      {/* Clear Filters */}
      <Button
        variant="outline"
        onClick={() => onFiltersChange(defaultFilters)}
        className="w-full"
      >
        Clear All Filters
      </Button>
    </div>
  );
  
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full">
            <Filter className="h-4 w-4 mr-2" />
            Filters {getActiveFilterCount(filters) > 0 && `(${getActiveFilterCount(filters)})`}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filter Results</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <FilterContent />
            <div className="mt-6 flex gap-3">
              <Button onClick={() => setIsOpen(false)} className="flex-1">
                Show {resultCount} Results
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        {getActiveFilterCount(filters) > 0 && (
          <Badge variant="secondary">
            {getActiveFilterCount(filters)} active
          </Badge>
        )}
      </div>
      <FilterContent />
    </div>
  );
}

// Helper functions and constants
const SERVICE_CATEGORIES = [
  { id: 'photography', name: 'Photography', count: 89 },
  { id: 'cleaning', name: 'Home Cleaning', count: 156 },
  { id: 'handyman', name: 'Handyman', count: 234 },
  { id: 'beauty', name: 'Beauty & Wellness', count: 127 },
  // ... more categories
];

function getActiveFilterCount(filters: SearchFilters): number {
  let count = 0;
  if (filters.serviceTypes.length > 0) count++;
  if (filters.priceRange.min > 0 || filters.priceRange.max < 1000) count++;
  if (filters.rating > 0) count++;
  if (filters.distance < 25) count++;
  if (filters.verified) count++;
  if (filters.instantBooking) count++;
  return count;
}
```

### 1.3 SearchResultCard Component

#### Component Interface
```typescript
interface SearchResultCardProps {
  provider: ProviderSearchResult;
  viewMode: 'card' | 'list' | 'compact';
  isAuthenticated: boolean;
  onSelect: (providerId: string) => void;
  onSave?: (providerId: string) => void;
  onMessage?: (providerId: string) => void;
  className?: string;
}

interface ProviderSearchResult {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  location: string;
  distance: number;
  startingPrice: number;
  serviceTypes: string[];
  isVerified: boolean;
  isInstantBooking: boolean;
  nextAvailable: Date;
  verificationBadges: VerificationBadge[];
  responseTime: string;
  completedBookings: number;
}
```

#### Implementation
```tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageSquare, Star, MapPin, Clock, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistance, formatPrice } from '@/lib/utils/formatting';

export function SearchResultCard({
  provider,
  viewMode = 'card',
  isAuthenticated,
  onSelect,
  onSave,
  onMessage,
  className
}: SearchResultCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    try {
      await onSave?.(provider.id);
      setIsSaved(!isSaved);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMessage?.(provider.id);
  };
  
  const handleCardClick = () => {
    onSelect(provider.id);
  };
  
  if (viewMode === 'list') {
    return (
      <Card 
        className={cn("cursor-pointer hover:shadow-md transition-shadow", className)}
        onClick={handleCardClick}
      >
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
              <AvatarImage src={provider.avatar} alt={provider.name} />
              <AvatarFallback>{provider.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-lg truncate">{provider.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{provider.rating}</span>
                    <span>({provider.reviewCount} reviews)</span>
                  </div>
                </div>
                
                {isAuthenticated && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSave}
                      disabled={isLoading}
                      className={cn(
                        "p-2",
                        isSaved && "text-red-500"
                      )}
                    >
                      <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMessage}
                      className="p-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{formatDistance(provider.distance)} • {provider.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Available {formatNextAvailable(provider.nextAvailable)}</span>
                </div>
              </div>
              
              <div className="mt-2 flex items-center gap-2">
                {provider.isVerified && (
                  <Badge variant="secondary" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {provider.isInstantBooking && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Instant Booking
                  </Badge>
                )}
                <span className="text-lg font-semibold">
                  {formatPrice(provider.startingPrice)}/hr
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Card view (default)
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden",
        className
      )}
      onClick={handleCardClick}
    >
      {/* Cover Image */}
      <div className="relative h-48 bg-gray-100">
        <Image
          src={provider.coverImage}
          alt={`${provider.name} portfolio`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        
        {/* Save Button Overlay */}
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            className={cn(
              "absolute top-3 right-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 p-2",
              isSaved && "text-red-500"
            )}
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-current")} />
          </Button>
        )}
        
        {/* Verification Badge */}
        {provider.isVerified && (
          <Badge className="absolute top-3 left-3 bg-white/90 text-gray-900">
            <Shield className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
            <AvatarImage src={provider.avatar} alt={provider.name} />
            <AvatarFallback>{provider.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{provider.name}</h3>
            
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{provider.rating}</span>
              <span>({provider.reviewCount})</span>
            </div>
            
            <div className="text-sm text-gray-600 mb-2">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{formatDistance(provider.distance)} away</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {provider.isInstantBooking && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Instant
                  </Badge>
                )}
                <span className="text-sm text-gray-600">
                  {provider.serviceTypes.slice(0, 2).join(', ')}
                </span>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-semibold">
                  {formatPrice(provider.startingPrice)}/hr
                </div>
                <div className="text-xs text-gray-500">
                  starting at
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(provider.id);
            }}
          >
            View Profile
          </Button>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMessage}
              className="px-3"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function formatNextAvailable(date: Date): string {
  const now = new Date();
  const diffInHours = Math.abs(date.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return 'today';
  } else if (diffInHours < 48) {
    return 'tomorrow';
  } else {
    return `in ${Math.ceil(diffInHours / 24)} days`;
  }
}
```

---

## 2. Homepage Discovery Components

### 2.1 LocalGlobalTabs Component

#### Component Interface
```typescript
interface LocalGlobalTabsProps {
  activeTab: 'local' | 'global';
  onTabChange: (tab: 'local' | 'global') => void;
  localLocation?: string;
  onLocationChange?: (location: string) => void;
  className?: string;
}
```

#### Implementation
```tsx
"use client";

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LocalGlobalTabs({
  activeTab,
  onTabChange,
  localLocation = '',
  onLocationChange,
  className
}: LocalGlobalTabsProps) {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocation, setTempLocation] = useState(localLocation);
  
  const handleLocationSubmit = () => {
    onLocationChange?.(tempLocation);
    setIsEditingLocation(false);
  };
  
  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'local' | 'global')}>
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="local" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">Local</div>
              {localLocation && (
                <div className="text-xs text-gray-500 truncate max-w-[80px]">
                  {localLocation}
                </div>
              )}
            </div>
          </TabsTrigger>
          
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">Global</div>
              <div className="text-xs text-gray-500">Anywhere</div>
            </div>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Location Editor */}
      {activeTab === 'local' && (
        <div className="mt-3">
          {isEditingLocation ? (
            <div className="flex gap-2">
              <Input
                value={tempLocation}
                onChange={(e) => setTempLocation(e.target.value)}
                placeholder="Enter your location"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLocationSubmit();
                  if (e.key === 'Escape') setIsEditingLocation(false);
                }}
                autoFocus
              />
              <Button onClick={handleLocationSubmit} size="sm">
                Save
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setIsEditingLocation(true)}
              className="w-full justify-start text-sm text-gray-600"
            >
              <MapPin className="h-4 w-4 mr-2" />
              {localLocation || 'Set your location'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 2.2 CategoryGrid Component

#### Component Interface
```typescript
interface CategoryGridProps {
  categories: ServiceCategory[];
  onCategorySelect: (categoryId: string) => void;
  viewMode: 'local' | 'global';
  className?: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  providerCount: number;
  startingPrice: number;
  isPopular: boolean;
  coverImage: string;
}
```

#### Implementation
```tsx
"use client";

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/utils/formatting';

export function CategoryGrid({
  categories,
  onCategorySelect,
  viewMode,
  className
}: CategoryGridProps) {
  const filteredCategories = categories.filter(category => {
    // Filter categories based on local/global context
    if (viewMode === 'local') {
      return !['digital-design', 'virtual-consulting', 'online-tutoring'].includes(category.id);
    } else {
      return ['digital-design', 'virtual-consulting', 'online-tutoring', 'photography'].includes(category.id);
    }
  });
  
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCategories.map((category) => (
          <Card
            key={category.id}
            className="cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden group"
            onClick={() => onCategorySelect(category.id)}
          >
            <CardContent className="p-0">
              {/* Category Image */}
              <div className="relative h-32 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
                <div className="text-4xl">{category.icon}</div>
                
                {category.isPopular && (
                  <Badge className="absolute top-2 right-2 bg-orange-500 text-white">
                    <Flame className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                )}
              </div>
              
              {/* Category Info */}
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-1 group-hover:text-blue-600 transition-colors">
                  {category.name}
                </h3>
                
                <div className="text-xs text-gray-600 mb-2">
                  {category.providerCount} providers
                </div>
                
                <div className="text-sm font-medium text-gray-900">
                  From {formatPrice(category.startingPrice)}/hr
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* View All Categories Card */}
        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-dashed border-2">
          <CardContent className="p-0 h-full flex flex-col items-center justify-center text-center min-h-[200px]">
            <div className="text-2xl mb-2">➕</div>
            <div className="font-medium text-gray-700">View All</div>
            <div className="text-xs text-gray-500">Browse all services</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 3. Customer Account Components

### 3.1 AccountDashboard Component

#### Component Interface
```typescript
interface AccountDashboardProps {
  user: User;
  dashboardData: CustomerDashboard;
  onQuickAction: (action: string, data?: any) => void;
}

interface CustomerDashboard {
  upcomingBookings: BookingSummary[];
  recentActivity: ActivityItem[];
  quickStats: {
    upcomingCount: number;
    savedProvidersCount: number;
    reviewsGiven: number;
    totalSpent: number;
  };
  recommendations: ProviderRecommendation[];
}
```

#### Implementation
```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, Heart, Star, DollarSign, ArrowRight, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/formatting';

export function AccountDashboard({
  user,
  dashboardData,
  onQuickAction
}: AccountDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {user.firstName}! 👋
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your bookings and saved providers.
        </p>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Upcoming Bookings"
          value={dashboardData.quickStats.upcomingCount}
          color="blue"
        />
        <StatCard
          icon={<Heart className="h-5 w-5" />}
          label="Saved Providers"
          value={dashboardData.quickStats.savedProvidersCount}
          color="red"
        />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Reviews Given"
          value={dashboardData.quickStats.reviewsGiven}
          color="yellow"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Spent"
          value={formatCurrency(dashboardData.quickStats.totalSpent)}
          color="green"
        />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Upcoming Bookings</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onQuickAction('viewAllBookings')}
            >
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.upcomingBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No upcoming bookings</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => onQuickAction('browseProviders')}
                >
                  Find Providers
                </Button>
              </div>
            ) : (
              dashboardData.upcomingBookings.slice(0, 3).map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  onAction={(action) => onQuickAction(action, booking)}
                />
              ))
            )}
          </CardContent>
        </Card>
        
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.recentActivity.slice(0, 5).map((activity, index) => (
                <ActivityItem
                  key={index}
                  activity={activity}
                  onClick={() => onQuickAction('viewActivity', activity)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recommendations */}
      {dashboardData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommended for You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.recommendations.slice(0, 3).map((rec) => (
                <RecommendationCard
                  key={rec.provider.id}
                  recommendation={rec}
                  onSelect={() => onQuickAction('viewProvider', rec.provider)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Sub-components
function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-${color}-100 text-${color}-600`}>
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm text-gray-600">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookingCard({ booking, onAction }: {
  booking: BookingSummary;
  onAction: (action: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
      <Avatar className="h-12 w-12">
        <AvatarImage src={booking.provider.avatar} />
        <AvatarFallback>{booking.provider.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{booking.service.name}</div>
        <div className="text-sm text-gray-600">
          with {booking.provider.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          {formatDate(booking.scheduledDate)} at {booking.scheduledTime}
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onAction('viewBooking')}
        >
          Details
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAction('messageProvider')}
        >
          Message
        </Button>
      </div>
    </div>
  );
}
```

---

## 4. Styling and Theme Integration

### 4.1 Component Styling Guidelines

All components follow the existing design system with consistent:

```css
/* Base component styles following the design system */
.search-interface {
  /* Use design system spacing */
  @apply space-y-6;
}

.provider-card {
  /* Consistent shadow and border styles */
  @apply border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow;
}

.filter-sidebar {
  /* Sticky positioning with design system colors */
  @apply bg-white border border-gray-200 rounded-lg p-6 sticky top-6;
}

/* Mobile-first responsive breakpoints */
@media (max-width: 640px) {
  .search-grid {
    @apply grid-cols-1 gap-4;
  }
}

@media (min-width: 768px) {
  .search-grid {
    @apply grid-cols-2 gap-6;
  }
}

@media (min-width: 1024px) {
  .search-grid {
    @apply grid-cols-3 gap-6;
  }
}
```

### 4.2 Accessibility Implementation

```tsx
// Example accessibility patterns used in components
<div
  role="search"
  aria-label="Provider search interface"
  aria-describedby="search-instructions"
>
  <input
    type="search"
    aria-label="Search for service providers"
    aria-autocomplete="list"
    aria-expanded={showSuggestions}
  />
  
  <div id="search-instructions" className="sr-only">
    Enter a service type like photography or cleaning to find providers
  </div>
  
  <div
    role="region"
    aria-label="Search results"
    aria-live="polite"
    aria-atomic="false"
  >
    {/* Results content */}
  </div>
</div>
```

---

*Component Specifications Document Version 1.0*  
*Ready for development implementation*  
*All components aligned with existing design system*  
*TypeScript interfaces defined for type safety*