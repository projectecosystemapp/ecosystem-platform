"use client";

import React, { useState, useEffect } from "react";
import { CategoryTabs, CategoryType } from "@/components/categories/CategoryTabs";
import { UnifiedListingCard, ListingData } from "@/components/listings/UnifiedListingCard";
import { MarketplaceErrorBoundary } from "@/components/error-boundaries/marketplace-error-boundary";
import { motion, AnimatePresence } from "framer-motion";
import { useProviderSearch, useFeaturedProviders } from "@/hooks/api/useProviders";
import { Provider } from "@/types/api/providers";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

// Transform provider data to listing format for services category
function transformProviderToListing(provider: Provider): ListingData {
  return {
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
    availability: provider.stripeOnboardingComplete ? "available" : "unavailable",
    availabilityText: provider.stripeOnboardingComplete ? "Available Now" : "Setup Pending",
    services: Array.isArray(provider.services) 
      ? provider.services.map(service => 
          typeof service === 'string' ? service : service.name
        ).slice(0, 3)
      : []
  };
}

// Mock data for non-services categories (keeping existing for now)
const mockNonServiceListings: ListingData[] = [
  {
    id: "4",
    category: "wanted",
    title: "Need Wedding Photographer",
    location: "Edmonton",
    requester: {
      name: "Emily Chen",
      avatar: "/api/placeholder/100/100"
    },
    budget: {
      min: 1500,
      max: 2500
    },
    quotesCount: 3,
    urgency: "high",
    description: "Looking for an experienced wedding photographer for June 15th ceremony. Must have portfolio and references."
  },
  {
    id: "5",
    category: "wanted",
    title: "Web Developer for E-commerce Site",
    location: "Remote",
    requester: {
      name: "Tech Startup Inc",
      avatar: "/api/placeholder/100/100"
    },
    budget: {
      min: 3000,
      max: 5000
    },
    quotesCount: 7,
    urgency: "medium",
    description: "Need a skilled developer to build a custom e-commerce platform with payment integration and inventory management."
  },
  // Events
  {
    id: "6",
    category: "events",
    title: "Yoga in the Park",
    image: "/api/placeholder/400/300",
    location: "River Valley Park",
    host: {
      name: "Zen Wellness",
      avatar: "/api/placeholder/100/100"
    },
    startDate: new Date("2024-02-10T09:00:00"),
    price: 20,
    attendees: {
      count: 12,
      max: 30,
      friendsGoing: 2
    },
    type: "Fitness"
  },
  {
    id: "7",
    category: "events",
    title: "Jazz Night at The Blue Note",
    image: "/api/placeholder/400/300",
    location: "The Blue Note Club",
    host: {
      name: "The Blue Note",
      avatar: "/api/placeholder/100/100"
    },
    startDate: new Date("2024-02-11T20:00:00"),
    price: 35,
    attendees: {
      count: 45,
      max: 100,
      friendsGoing: 5
    },
    type: "Music"
  },
  // Spaces
  {
    id: "8",
    category: "spaces",
    title: "Creative Studio Space",
    image: "/api/placeholder/400/300",
    location: "Arts District",
    owner: {
      name: "Creative Hub",
      avatar: "/api/placeholder/100/100",
      rating: 4.8
    },
    price: "50",
    priceUnit: "hour",
    capacity: 20,
    amenities: ["WiFi", "Projector", "Kitchen", "Parking"],
    availability: "available",
    size: "1200 sq ft"
  },
  {
    id: "9",
    category: "spaces",
    title: "Meeting Room Downtown",
    image: "/api/placeholder/400/300",
    location: "Downtown Edmonton",
    owner: {
      name: "Business Center",
      avatar: "/api/placeholder/100/100",
      rating: 4.6
    },
    price: "75",
    priceUnit: "hour",
    capacity: 12,
    amenities: ["TV Screen", "Whiteboard", "Coffee"],
    availability: "available",
    size: "500 sq ft"
  }
];

export default function MarketplacePage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<CategoryType>("services");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  // Use real provider APIs for services category
  const {
    providers,
    isLoading: isProvidersLoading,
    error: providersError,
    searchProviders,
    loadMore,
    pagination,
  } = useProviderSearch();
  
  const {
    providers: featuredProviders,
    isLoading: isFeaturedLoading,
    error: featuredError,
  } = useFeaturedProviders(8);

  // Transform providers to listings for services category
  const serviceListings = activeCategory === "services" 
    ? (searchQuery ? providers : featuredProviders).map(transformProviderToListing)
    : [];

  // Get non-service listings for other categories
  const filteredNonServiceListings = mockNonServiceListings.filter(
    listing => listing.category === activeCategory
  );

  // Combine listings based on category
  const filteredListings = activeCategory === "services" 
    ? serviceListings 
    : filteredNonServiceListings;

  // Loading state
  const isLoading = activeCategory === "services" 
    ? (searchQuery ? isProvidersLoading : isFeaturedLoading)
    : false;

  // Error state
  const error = activeCategory === "services" 
    ? (searchQuery ? providersError : featuredError)
    : null;

  // Handle category change
  const handleCategoryChange = (category: CategoryType) => {
    setActiveCategory(category);
    setSearchQuery(""); // Clear search when changing categories
  };

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (activeCategory === "services" && query.trim()) {
      setIsSearching(true);
      try {
        await searchProviders({ 
          query: query.trim(),
          limit: 20,
          page: 1 
        });
      } finally {
        setIsSearching(false);
      }
    }
  };

  // Handle provider click
  const handleProviderClick = (listing: ListingData) => {
    if (listing.category === "services") {
      // Find the original provider to get the slug
      const provider = (searchQuery ? providers : featuredProviders)
        .find(p => p.id === listing.id);
      if (provider) {
        router.push(`/providers/${provider.slug}`);
      }
    }
  };

  // Handle load more
  const handleLoadMore = () => {
    if (activeCategory === "services" && pagination.hasMore) {
      loadMore();
    }
  };

  return (
    <MarketplaceErrorBoundary
      filters={{
        category: activeCategory,
      }}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">ECOSYSTEM</h1>
            <nav className="flex items-center gap-4">
              <button className="text-gray-600 hover:text-gray-900">
                How it works
              </button>
              <button className="text-gray-600 hover:text-gray-900">
                Become a provider
              </button>
              <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
                Sign In
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      <CategoryTabs
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        className="bg-white shadow-sm"
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Title and Search */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                {activeCategory === "services" && "Find Service Providers"}
                {activeCategory === "wanted" && "Browse Opportunities"}
                {activeCategory === "events" && "Discover Events"}
                {activeCategory === "spaces" && "Book Spaces"}
              </h2>
              <p className="text-gray-600 mt-2">
                {activeCategory === "services" && "Connect with trusted professionals in your area"}
                {activeCategory === "wanted" && "Find requests that match your skills"}
                {activeCategory === "events" && "Join exciting events happening near you"}
                {activeCategory === "spaces" && "Rent unique spaces for any occasion"}
              </p>
            </div>
            
            {/* Search for services category */}
            {activeCategory === "services" && (
              <div className="flex gap-2 min-w-[300px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search providers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSearch(searchQuery);
                      }
                    }}
                    className="pl-10"
                  />
                </div>
                <Button 
                  onClick={() => handleSearch(searchQuery)}
                  disabled={isSearching}
                  className="px-4"
                >
                  {isSearching ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Search className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Search Results Info */}
        {activeCategory === "services" && searchQuery && (
          <div className="mb-4 text-sm text-gray-600">
            {isLoading ? (
              "Searching..."
            ) : (
              `Found ${filteredListings.length} provider${filteredListings.length !== 1 ? 's' : ''} for "${searchQuery}"`
            )}
          </div>
        )}

        {/* Listings Grid */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <Skeleton className="h-48 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeCategory + searchQuery}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filteredListings.map((listing, index) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <UnifiedListingCard
                    listing={listing}
                    onClick={() => handleProviderClick(listing)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load More */}
        {!isLoading && filteredListings.length > 0 && (
          <div className="flex justify-center mt-12">
            {activeCategory === "services" && pagination.hasMore ? (
              <Button 
                variant="outline" 
                onClick={handleLoadMore}
                disabled={isProvidersLoading}
                className="px-6 py-3"
              >
                {isProvidersLoading ? "Loading..." : "Load More Providers"}
              </Button>
            ) : activeCategory !== "services" ? (
              <Button 
                variant="outline" 
                className="px-6 py-3"
                disabled
              >
                Load More
              </Button>
            ) : null}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredListings.length === 0 && (
          <div className="text-center py-12">
            {activeCategory === "services" && searchQuery ? (
              <div>
                <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg mb-2">
                  No providers found for "{searchQuery}"
                </p>
                <p className="text-gray-400 text-sm">
                  Try adjusting your search terms or browse featured providers
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              <p className="text-gray-500">
                {activeCategory === "services" 
                  ? "No featured providers available at the moment."
                  : "No listings found in this category."}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">ECOSYSTEM</h3>
              <p className="text-gray-400">
                The universal platform for real-world services and bookings.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Platform</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">How it works</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>© 2024 ECOSYSTEM. All rights reserved.</p>
          </div>
        </div>
      </footer>
      </div>
    </MarketplaceErrorBoundary>
  );
}
