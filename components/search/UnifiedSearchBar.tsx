"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "use-debounce";
import { 
  Search, 
  MapPin, 
  Filter, 
  X,
  Mic,
  Clock,
  TrendingUp,
  ChevronDown,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

// Types
interface SearchSuggestion {
  type: "service" | "event" | "space" | "thing" | "category";
  text: string;
  category?: string;
}

interface RecentSearch {
  query: string;
  category?: string;
  timestamp: number;
}

interface UnifiedSearchBarProps {
  onSearch?: (query: string, filters?: any) => void;
  placeholder?: string;
  categories?: Array<{ id: string; name: string; slug: string }>;
  currentLocation?: { lat: number; lng: number; address: string };
  className?: string;
  autoFocus?: boolean;
  showVoiceSearch?: boolean;
  isMobile?: boolean;
}

const VERTICALS = [
  { value: "all", label: "All Categories", icon: "🔍" },
  { value: "services", label: "Services", icon: "🛠️" },
  { value: "events", label: "Events", icon: "📅" },
  { value: "spaces", label: "Spaces", icon: "🏢" },
  { value: "things", label: "Things", icon: "📦" },
];

const TRENDING_SEARCHES = [
  "House cleaning",
  "Yoga classes",
  "Event spaces",
  "Photography",
  "Tutoring",
  "Fitness trainer",
  "Conference rooms",
  "Electronics",
];

export function UnifiedSearchBar({
  onSearch,
  placeholder = "Search for services, events, spaces, or things...",
  categories = [],
  currentLocation,
  className,
  autoFocus = false,
  showVoiceSearch = true,
  isMobile = false,
}: UnifiedSearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // State
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [selectedVertical, setSelectedVertical] = useState(
    searchParams.get("vertical") || "all"
  );
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [location, setLocation] = useState(currentLocation);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMobileOverlay, setShowMobileOverlay] = useState(false);

  // Debounced search query
  const [debouncedQuery] = useDebounce(query, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("recentSearches");
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse recent searches:", e);
      }
    }
  }, []);

  // Initialize voice recognition
  useEffect(() => {
    if (showVoiceSearch && typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        toast({
          title: "Voice search error",
          description: "Please try again or type your search.",
          variant: "destructive",
        });
      };
    }
  }, [showVoiceSearch, toast]);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery]);

  // Fetch search suggestions
  const fetchSuggestions = async (searchQuery: string) => {
    try {
      const response = await fetch("/api/unified-search/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    }
  };

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (!query.trim()) return;

    setIsSearching(true);
    setShowSuggestions(false);

    // Save to recent searches
    const newSearch: RecentSearch = {
      query: query.trim(),
      category: selectedVertical !== "all" ? selectedVertical : undefined,
      timestamp: Date.now(),
    };

    const updatedRecent = [
      newSearch,
      ...recentSearches.filter(s => s.query !== newSearch.query).slice(0, 9),
    ];
    setRecentSearches(updatedRecent);
    localStorage.setItem("recentSearches", JSON.stringify(updatedRecent));

    // Build search params
    const params = new URLSearchParams();
    params.set("q", query.trim());
    if (selectedVertical !== "all") {
      params.set("vertical", selectedVertical);
    }
    if (location) {
      params.set("lat", location.lat.toString());
      params.set("lng", location.lng.toString());
    }

    // Navigate to marketplace with search params
    router.push(`/marketplace?${params.toString()}`);

    // Call onSearch callback if provided
    if (onSearch) {
      onSearch(query.trim(), {
        vertical: selectedVertical,
        location,
      });
    }

    setIsSearching(false);
    
    // Close mobile overlay after search
    if (isMobile) {
      setShowMobileOverlay(false);
    }
  }, [query, selectedVertical, location, recentSearches, router, onSearch, isMobile]);

  // Handle voice search
  const handleVoiceSearch = () => {
    if (!recognitionRef.current) {
      toast({
        title: "Voice search not supported",
        description: "Your browser doesn't support voice search.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
      toast({
        title: "Listening...",
        description: "Speak your search query",
      });
    }
  };

  // Handle location detection
  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: "Current Location",
          });
          toast({
            title: "Location detected",
            description: "Searching near your current location",
          });
        },
        (error) => {
          toast({
            title: "Location error",
            description: "Unable to detect your location",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support location detection",
        variant: "destructive",
      });
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    inputRef.current?.focus();
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
    handleSearch();
  };

  // Handle recent search click
  const handleRecentSearchClick = (search: RecentSearch) => {
    setQuery(search.query);
    if (search.category) {
      setSelectedVertical(search.category);
    }
    handleSearch();
  };

  // Mobile overlay for full-screen search
  if (isMobile && showMobileOverlay) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 z-50 bg-background"
        >
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMobileOverlay(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={placeholder}
                  className="text-lg"
                  autoFocus
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Mobile suggestions and recent searches */}
            <div className="space-y-4">
              {suggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Suggestions
                  </h3>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left p-3 hover:bg-accent rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span>{suggestion.text}</span>
                        {suggestion.category && (
                          <Badge variant="secondary" className="text-xs">
                            {suggestion.category}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {recentSearches.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Recent Searches
                  </h3>
                  {recentSearches.slice(0, 5).map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleRecentSearchClick(search)}
                      className="w-full text-left p-3 hover:bg-accent rounded-lg flex items-center gap-2"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{search.query}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Desktop search bar
  return (
    <div className={cn("relative w-full", className)}>
      <div className="flex items-center gap-2">
        {/* Category selector */}
        <Select value={selectedVertical} onValueChange={setSelectedVertical}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {VERTICALS.map((vertical) => (
              <SelectItem key={vertical.value} value={vertical.value}>
                <span className="flex items-center gap-2">
                  <span>{vertical.icon}</span>
                  <span>{vertical.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search input */}
        <div className="flex-1 relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-5 w-5 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder={placeholder}
              className={cn(
                "pl-10 pr-24",
                isMobile && "cursor-pointer"
              )}
              onClick={() => isMobile && setShowMobileOverlay(true)}
              autoFocus={autoFocus && !isMobile}
            />

            {/* Clear button */}
            {query && (
              <button
                onClick={handleClear}
                className="absolute right-16 p-1 hover:bg-accent rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {/* Voice search button */}
            {showVoiceSearch && (
              <button
                onClick={handleVoiceSearch}
                className={cn(
                  "absolute right-10 p-1 hover:bg-accent rounded",
                  isListening && "text-red-500"
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            {/* Search button */}
            <Button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              size="sm"
              className="absolute right-1 h-8"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Suggestions dropdown */}
          <AnimatePresence>
            {showSuggestions && (query.length >= 2 || recentSearches.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
              >
                <Command>
                  <CommandList>
                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                      <CommandGroup heading="Suggestions">
                        {suggestions.map((suggestion, index) => (
                          <CommandItem
                            key={index}
                            onSelect={() => handleSuggestionClick(suggestion)}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            <span className="flex-1">{suggestion.text}</span>
                            {suggestion.category && (
                              <Badge variant="secondary" className="ml-2">
                                {suggestion.category}
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {suggestions.length > 0 && recentSearches.length > 0 && (
                      <CommandSeparator />
                    )}

                    {/* Recent searches */}
                    {recentSearches.length > 0 && query.length < 2 && (
                      <CommandGroup heading="Recent Searches">
                        {recentSearches.slice(0, 5).map((search, index) => (
                          <CommandItem
                            key={index}
                            onSelect={() => handleRecentSearchClick(search)}
                          >
                            <Clock className="mr-2 h-4 w-4" />
                            <span className="flex-1">{search.query}</span>
                            {search.category && (
                              <Badge variant="outline" className="ml-2">
                                {search.category}
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {/* Trending searches */}
                    {query.length < 2 && recentSearches.length === 0 && (
                      <CommandGroup heading="Trending">
                        {TRENDING_SEARCHES.map((trend, index) => (
                          <CommandItem
                            key={index}
                            onSelect={() => {
                              setQuery(trend);
                              handleSearch();
                            }}
                          >
                            <TrendingUp className="mr-2 h-4 w-4" />
                            <span>{trend}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {suggestions.length === 0 && query.length >= 2 && (
                      <CommandEmpty>No suggestions found.</CommandEmpty>
                    )}
                  </CommandList>
                </Command>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Location button */}
        <Popover open={showLocationPicker} onOpenChange={setShowLocationPicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <MapPin className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Location</h4>
                <p className="text-sm text-muted-foreground">
                  Search near a specific location
                </p>
              </div>
              <div className="space-y-2">
                {location ? (
                  <div className="flex items-center justify-between p-2 bg-accent rounded">
                    <span className="text-sm">{location.address}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setLocation(undefined)}
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleGetLocation}
                    variant="outline"
                    className="w-full"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Use Current Location
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Filter button - will trigger filter panel */}
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}