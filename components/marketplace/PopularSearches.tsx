"use client";

import React from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketplaceStore } from '@/lib/stores/marketplace-store';
import { Badge } from '@/components/ui/badge';

// Mock popular searches per category (replace with real data)
const POPULAR_SEARCHES = {
  events: ['Concert tonight', 'Free events', 'Weekend activities', 'Kids events'],
  services: ['Home cleaning', 'Plumber near me', 'Personal trainer', 'Photographer'],
  spaces: ['Party venue', 'Meeting room', 'Photo studio', 'Event space'],
  things: ['iPhone', 'Couch', 'Bike', 'Free stuff'],
};

export default function PopularSearches() {
  const { activeTab, setSearchQuery, getCurrentTheme } = useMarketplaceStore();
  const theme = getCurrentTheme();
  const searches = POPULAR_SEARCHES[activeTab] || [];
  
  const handleSearchClick = (query: string) => {
    setSearchQuery(activeTab, query);
  };
  
  if (searches.length === 0) return null;
  
  return (
    <div className="flex items-center space-x-2 overflow-x-auto pb-2">
      <div className="flex items-center text-xs text-gray-500 mr-2 flex-shrink-0">
        <TrendingUp className="w-3 h-3 mr-1" />
        <span>Popular:</span>
      </div>
      {searches.map((search, index) => (
        <Badge
          key={index}
          variant="secondary"
          className={cn(
            "cursor-pointer transition-all duration-200 flex-shrink-0",
            "hover:scale-105"
          )}
          style={{
            backgroundColor: `${theme.primary}10`,
            borderColor: `${theme.primary}30`,
            color: theme.primary,
          }}
          onClick={() => handleSearchClick(search)}
        >
          {search}
        </Badge>
      ))}
    </div>
  );
}