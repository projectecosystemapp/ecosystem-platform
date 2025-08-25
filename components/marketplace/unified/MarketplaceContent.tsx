"use client";

import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Calendar, Clock, Star, Users, Package, Map, List, Grid3X3 } from 'lucide-react';
import { useMarketplaceData, MarketplaceItem } from '@/lib/hooks/useMarketplaceData';
import { useMarketplaceStore, TabId } from '@/lib/stores/marketplace-store';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useImageOptimization, useSortedItems } from '@/lib/performance/optimizations';

// Dynamically import map component
const LocationMap = dynamic(() => import('@/components/maps/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-current mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
});

/**
 * Client component that handles all interactive marketplace functionality.
 * This includes state management, animations, and user interactions.
 */
export default function MarketplaceContent() {
  const { 
    items, 
    isLoading, 
    error, 
    isEmpty, 
    hasResults,
    currentTab,
    updateSearch
  } = useMarketplaceData();
  
  const { getCurrentTheme, getCurrentTabState, updateTabState } = useMarketplaceStore();
  const theme = getCurrentTheme();
  const tabState = getCurrentTabState();

  const handleItemClick = (item: MarketplaceItem) => {
    if (item.category === 'services' && item.metadata?.slug) {
      // Navigate to provider profile
      window.location.href = `/providers/${item.metadata.slug}`;
    } else {
      console.log('View item:', item.title);
    }
  };

  const toggleViewMode = () => {
    const newMode = tabState.viewMode === 'grid' ? 'list' : 'grid';
    updateTabState(currentTab, { viewMode: newMode });
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error.message || 'Failed to load marketplace data'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {/* View Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            {hasResults ? `${items.length} results found` : 'Browse marketplace'}
          </h2>
          <p className="text-gray-600">
            {currentTab === 'events' && 'Discover local events and activities'}
            {currentTab === 'services' && 'Connect with service professionals'}
            {currentTab === 'spaces' && 'Find spaces for any occasion'}
            {currentTab === 'things' && 'Buy and sell items locally'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleViewMode}
            className="flex items-center gap-2"
          >
            {tabState.viewMode === 'grid' ? (
              <>
                <List className="w-4 h-4" />
                List
              </>
            ) : (
              <>
                <Grid3X3 className="w-4 h-4" />
                Grid
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <LoadingSkeleton key="loading" />
        ) : isEmpty ? (
          <EmptyState key="empty" />
        ) : (
          <ResultsGrid 
            key="results"
            items={items}
            theme={theme}
            tabState={tabState}
            currentTab={currentTab}
            onItemClick={handleItemClick}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Memoized loading skeleton component
const LoadingSkeleton = React.memo(() => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
  >
    {[...Array(8)].map((_, i) => (
      <div key={i} className="bg-white rounded-xl border overflow-hidden">
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    ))}
  </motion.div>
));

LoadingSkeleton.displayName = 'LoadingSkeleton';

// Memoized empty state component
const EmptyState = React.memo(() => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="text-center py-12"
  >
    <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
    <p className="text-gray-500 text-lg mb-2">
      No results found
    </p>
    <p className="text-gray-400 text-sm">
      Try adjusting your search or explore different categories
    </p>
  </motion.div>
));

EmptyState.displayName = 'EmptyState';

// Optimized results grid with memoization
interface ResultsGridProps {
  items: MarketplaceItem[];
  theme: any;
  tabState: any;
  currentTab: TabId;
  onItemClick: (item: MarketplaceItem) => void;
}

const ResultsGrid = React.memo<ResultsGridProps>(({ 
  items, 
  theme, 
  tabState, 
  currentTab, 
  onItemClick 
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className={cn(
      "grid gap-6",
      tabState.viewMode === 'grid' 
        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        : "grid-cols-1"
    )}
  >
    {items.map((item, index) => (
      <motion.div
        key={item.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <CategoryItemCard
          item={item}
          category={currentTab}
          theme={theme}
          onClick={() => onItemClick(item)}
        />
      </motion.div>
    ))}
  </motion.div>
));

ResultsGrid.displayName = 'ResultsGrid';

// Category-specific item renderers with memoization
interface CategoryItemCardProps {
  item: MarketplaceItem; 
  category: TabId;
  theme: any;
  onClick?: () => void;
}

const CategoryItemCard = React.memo<CategoryItemCardProps>(({ item, category, theme, onClick }) => {
  const renderCategorySpecificContent = () => {
    switch (category) {
      case 'events':
        const eventMeta = item.metadata as any;
        return (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Calendar className="w-4 h-4" />
              <span>{eventMeta?.startDate ? new Date(eventMeta.startDate).toLocaleDateString() : 'Date TBD'}</span>
            </div>
            {eventMeta?.attendeeCount && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span>{eventMeta.attendeeCount}/{eventMeta.maxAttendees} attending</span>
              </div>
            )}
          </>
        );
      
      case 'services':
        return (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Clock className="w-4 h-4" />
              <span>{item.availability === 'available' ? 'Available Now' : 'Unavailable'}</span>
            </div>
            {item.provider?.rating && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{item.provider.rating}</span>
                <span className="text-sm text-gray-500">({item.provider.reviewCount})</span>
              </div>
            )}
          </>
        );
      
      case 'spaces':
        const spaceMeta = item.metadata as any;
        return (
          <>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Users className="w-4 h-4" />
              <span>Capacity: {spaceMeta?.capacity || 'Not specified'}</span>
            </div>
            {spaceMeta?.size && (
              <div className="text-sm text-gray-600">
                Size: {spaceMeta.size}
              </div>
            )}
          </>
        );
      
      case 'things':
        const thingMeta = item.metadata as any;
        return (
          <>
            {thingMeta?.condition && (
              <Badge variant="secondary" className="mb-2">
                {thingMeta.condition}
              </Badge>
            )}
            {thingMeta?.posted && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Posted {thingMeta.posted}</span>
              </div>
            )}
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group" onClick={onClick}>
      {/* Image */}
      {item.image && (
        <div className="relative h-48 overflow-hidden bg-gray-100">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      
      <CardHeader className="pb-3">
        <h3 className="font-semibold text-lg line-clamp-2">{item.title}</h3>
        {item.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
        )}
      </CardHeader>
      
      <CardContent className="py-3">
        {/* Category-specific content */}
        {renderCategorySpecificContent()}
        
        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
          <MapPin className="w-4 h-4" />
          <span>{item.location.address || [item.location.city, item.location.state].filter(Boolean).join(', ')}</span>
        </div>
        
        {/* Provider info */}
        {item.provider && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-2">
              {item.provider.avatar ? (
                <img src={item.provider.avatar} alt={item.provider.name} className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs">{item.provider.name[0]}</span>
                </div>
              )}
              <span className="text-sm font-medium">{item.provider.name}</span>
              {item.provider.verified && (
                <Badge variant="secondary" className="text-xs">Verified</Badge>
              )}
            </div>
          </div>
        )}
        
        {/* Price */}
        {item.price && (
          <div className="mt-3">
            <span className="text-2xl font-bold" style={{ color: theme.primary }}>
              ${item.price.amount}
              {item.price.unit && item.price.unit !== 'fixed' && (
                <span className="text-sm text-gray-500 font-normal">/{item.price.unit}</span>
              )}
            </span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button 
          className="w-full" 
          style={{
            backgroundColor: theme.primary,
            borderColor: theme.primary,
          }}
        >
          {category === 'events' ? 'View Event' :
           category === 'services' ? 'Book Service' :
           category === 'spaces' ? 'Book Space' :
           'View Details'}
        </Button>
      </CardFooter>
    </Card>
  );
});

CategoryItemCard.displayName = 'CategoryItemCard';