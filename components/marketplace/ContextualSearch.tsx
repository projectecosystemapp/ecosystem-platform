"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, TrendingUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMarketplaceStore, TAB_CONFIG } from '@/lib/stores/marketplace-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PopularSearches from './PopularSearches';
import { useDebounce } from '@/lib/hooks/use-debounce';

export default function ContextualSearch() {
  const { 
    activeTab, 
    getCurrentTabState, 
    setSearchQuery,
    getCurrentTheme 
  } = useMarketplaceStore();
  
  const [localQuery, setLocalQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const tabState = getCurrentTabState();
  const tabConfig = TAB_CONFIG[activeTab];
  const theme = getCurrentTheme();
  const debouncedQuery = useDebounce(localQuery, 300);
  
  // Sync local query with tab state
  useEffect(() => {
    setLocalQuery(tabState.searchQuery || '');
  }, [activeTab, tabState.searchQuery]);
  
  // Update store when debounced query changes
  useEffect(() => {
    if (debouncedQuery !== tabState.searchQuery) {
      setSearchQuery(activeTab, debouncedQuery);
    }
  }, [debouncedQuery, activeTab]);
  
  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery(activeTab, '');
  }, [activeTab, setSearchQuery]);
  
  const handleFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };
  
  // Mock search suggestions (replace with real data)
  const getSuggestions = () => {
    const suggestions = {
      events: [
        'Live music tonight',
        'Weekend workshops',
        'Yoga classes',
        'Food festivals',
        'Art exhibitions',
      ],
      services: [
        'House cleaning',
        'Personal training',
        'Photography',
        'Web development',
        'Dog walking',
      ],
      spaces: [
        'Event venues',
        'Photo studios',
        'Meeting rooms',
        'Party spaces',
        'Coworking desks',
      ],
      things: [
        'Furniture',
        'Electronics',
        'Sports equipment',
        'Tools',
        'Books',
      ],
    };
    
    return suggestions[activeTab] || [];
  };
  
  const suggestions = getSuggestions();
  const filteredSuggestions = localQuery 
    ? suggestions.filter(s => s.toLowerCase().includes(localQuery.toLowerCase()))
    : suggestions;
  
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Search Input Container */}
      <div className="relative">
        <div className="relative flex items-center">
          {/* Search Icon */}
          <div 
            className="absolute left-4 text-gray-400 pointer-events-none"
            style={{ color: isFocused ? theme.primary : undefined }}
          >
            <Search className="w-5 h-5" />
          </div>
          
          {/* Input Field */}
          <Input
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={tabConfig.placeholder}
            className={cn(
              "w-full pl-12 pr-12 h-12 text-base rounded-xl border-2 transition-all duration-200",
              "placeholder:text-gray-400 focus:outline-none",
              isFocused && "ring-2 ring-offset-1"
            )}
            style={{
              borderColor: isFocused ? theme.primary : theme.border,
              ringColor: theme.primary,
            }}
            aria-label={`Search ${tabConfig.label.toLowerCase()}`}
          />
          
          {/* Clear Button */}
          <AnimatePresence>
            {localQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={handleClear}
                className="absolute right-4 p-1 rounded-md hover:bg-gray-100 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-gray-500" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        
        {/* Category Indicator */}
        <div 
          className="absolute -top-2 left-4 px-2 bg-white text-xs font-medium"
          style={{ 
            color: theme.primary,
            backgroundColor: theme.surface,
          }}
        >
          Searching in {tabConfig.label}
        </div>
      </div>
      
      {/* Search Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && (isFocused || localQuery) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border overflow-hidden z-50"
            )}
            style={{ borderColor: theme.border }}
          >
            {/* Suggestions List */}
            {filteredSuggestions.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-2 text-xs font-medium text-gray-500 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Popular searches
                </div>
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setLocalQuery(suggestion)}
                    className={cn(
                      "w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors",
                      "flex items-center space-x-2"
                    )}
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            ) : localQuery ? (
              <div className="px-4 py-8 text-center text-gray-500">
                No suggestions found for "{localQuery}"
              </div>
            ) : null}
            
            {/* Quick Actions */}
            <div className="border-t px-4 py-3 bg-gray-50" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Press Enter to search</span>
                <span>ESC to close</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Popular Searches (shown when not focused and no query) */}
      {!isFocused && !localQuery && (
        <div className="mt-4">
          <PopularSearches />
        </div>
      )}
    </div>
  );
}