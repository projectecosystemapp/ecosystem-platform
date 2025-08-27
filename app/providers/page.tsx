/**
 * Providers Listing Page
 * Main marketplace page for browsing all service providers
 */

'use client';

import { useState, useEffect } from "react";
import { useProviderSearch, useFeaturedProviders } from "@/hooks/api/useProviders";
import { ProvidersList } from "@/components/providers/ProvidersList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  MapPin, 
  DollarSign,
  Star,
  Loader2,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Popular service categories
const POPULAR_SERVICES = [
  "Photography",
  "Personal Training", 
  "Home Services",
  "Tutoring",
  "Beauty & Wellness",
  "Business Consulting",
  "Event Planning",
  "Pet Services",
];

export default function ProvidersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [location, setLocation] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("rating");
  const [showFilters, setShowFilters] = useState(false);

  // Use provider hooks
  const {
    providers,
    isLoading: isSearching,
    error: searchError,
    searchProviders,
    loadMore,
    pagination,
  } = useProviderSearch();

  const {
    providers: featuredProviders,
    isLoading: isFeaturedLoading,
    error: featuredError,
  } = useFeaturedProviders(12);

  // Display providers based on search
  const displayProviders = searchQuery || selectedService || location
    ? providers
    : featuredProviders;

  // Handle search
  const handleSearch = async () => {
    const params: any = {
      query: searchQuery,
      limit: 20,
      page: 1,
    };

    if (selectedService) {
      params.services = [selectedService];
    }

    if (location) {
      params.location = location;
    }

    if (priceRange !== "all") {
      const [min, max] = priceRange.split("-").map(Number);
      params.minPrice = min;
      params.maxPrice = max;
    }

    if (sortBy) {
      params.sortBy = sortBy;
    }

    await searchProviders(params);
  };

  // Handle search on Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedService("");
    setPriceRange("all");
    setLocation("");
    setSortBy("rating");
  };

  const hasActiveFilters = searchQuery || selectedService || location || priceRange !== "all";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary/90 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Find Trusted Service Providers
            </h1>
            <p className="text-xl opacity-90 mb-8">
              Browse verified professionals ready to help with any service you need
            </p>

            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-xl p-2 flex flex-col md:flex-row gap-2">
              <div className="flex-1 flex items-center px-3">
                <Search className="h-5 w-5 text-gray-400 mr-2" />
                <Input
                  type="text"
                  placeholder="Search for services or providers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border-0 focus:ring-0 text-gray-900"
                />
              </div>

              <div className="flex items-center px-3 border-l">
                <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                <Input
                  type="text"
                  placeholder="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border-0 focus:ring-0 text-gray-900 w-full md:w-40"
                />
              </div>

              <Button
                size="lg"
                onClick={handleSearch}
                disabled={isSearching}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {isSearching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="py-8 border-b">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600 mr-2">Popular:</span>
            {POPULAR_SERVICES.map((service) => (
              <Badge
                key={service}
                variant={selectedService === service ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary hover:text-white transition-colors"
                onClick={() => {
                  setSelectedService(service);
                  handleSearch();
                }}
              >
                {service}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className={`lg:w-64 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Filters
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      Clear all
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Category */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Service Category
                  </label>
                  <Select value={selectedService} onValueChange={setSelectedService}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      {POPULAR_SERVICES.map((service) => (
                        <SelectItem key={service} value={service}>
                          {service}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Price Range (per hour)
                  </label>
                  <Select value={priceRange} onValueChange={setPriceRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any price</SelectItem>
                      <SelectItem value="0-50">$0 - $50</SelectItem>
                      <SelectItem value="50-100">$50 - $100</SelectItem>
                      <SelectItem value="100-200">$100 - $200</SelectItem>
                      <SelectItem value="200-500">$200+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Sort By
                  </label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rating">Highest Rated</SelectItem>
                      <SelectItem value="reviews">Most Reviews</SelectItem>
                      <SelectItem value="price_low">Price: Low to High</SelectItem>
                      <SelectItem value="price_high">Price: High to Low</SelectItem>
                      <SelectItem value="experience">Most Experienced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  Apply Filters
                </Button>
              </CardContent>
            </Card>
          </aside>

          {/* Results Section */}
          <div className="flex-1">
            {/* Mobile Filter Toggle */}
            <Button
              variant="outline"
              className="lg:hidden mb-4 w-full"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
              <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>

            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {hasActiveFilters ? "Search Results" : "Featured Providers"}
                </h2>
                <p className="text-muted-foreground">
                  {displayProviders.length} provider{displayProviders.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>

            {/* Error State */}
            {(searchError || featuredError) && (
              <Card className="bg-red-50 border-red-200 mb-6">
                <CardContent className="pt-6">
                  <p className="text-red-600">
                    {searchError || featuredError}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Providers Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={searchQuery + selectedService + location}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <ProvidersList
                  providers={displayProviders}
                  isLoading={isSearching || isFeaturedLoading}
                  columns={3}
                />
              </motion.div>
            </AnimatePresence>

            {/* Load More */}
            {!isSearching && pagination.hasMore && (
              <div className="text-center mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={loadMore}
                  disabled={isSearching}
                >
                  Load More Providers
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}