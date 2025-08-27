"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  TrendingUp,
  Star,
  Zap,
  Pause,
  Play
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UniversalListingCard } from "@/components/marketplace/cards/UniversalListingCard";
import type { ListingData } from "@/components/marketplace/cards/UniversalListingCard";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

// Types
export interface FeaturedSectionProps {
  items?: ListingData[];
  categories?: Array<{
    value: string;
    label: string;
    items: ListingData[];
  }>;
  title?: string;
  description?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showControls?: boolean;
  showIndicators?: boolean;
  className?: string;
  onItemClick?: (item: ListingData) => void;
  viewAllLink?: string;
}

// Mock featured items for demonstration
const generateMockItems = (type: string, count: number): ListingData[] => {
  const items: ListingData[] = [];
  
  for (let i = 0; i < count; i++) {
    const baseItem = {
      id: `${type}-${i}`,
      type: type as any,
      title: `Featured ${type} ${i + 1}`,
      description: `This is a featured ${type} that provides excellent value`,
      price: Math.floor(Math.random() * 500) + 50,
      thumbnailUrl: `https://source.unsplash.com/400x300/?${type},${i}`,
      location: {
        city: "San Francisco",
        state: "CA",
        distance: Math.floor(Math.random() * 10) + 1,
      },
      provider: {
        id: `provider-${i}`,
        name: `Provider ${i + 1}`,
        verified: Math.random() > 0.5,
        rating: 4 + Math.random(),
        reviewCount: Math.floor(Math.random() * 100) + 10,
      },
      featured: true,
      createdAt: new Date(),
    };

    if (type === "service") {
      items.push({
        ...baseItem,
        type: "service",
        duration: 60,
        priceUnit: "hour",
        instantBooking: true,
        availability: "available",
        categories: ["Home", "Professional"],
      } as ListingData);
    } else if (type === "event") {
      items.push({
        ...baseItem,
        type: "event",
        startDate: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
        capacity: 100,
        attendees: Math.floor(Math.random() * 80),
        eventType: "Workshop",
        isOnline: Math.random() > 0.5,
      } as ListingData);
    } else if (type === "space") {
      items.push({
        ...baseItem,
        type: "space",
        size: Math.floor(Math.random() * 1000) + 200,
        sizeUnit: "sqft",
        capacity: Math.floor(Math.random() * 50) + 10,
        amenities: ["WiFi", "Parking", "AC"],
        priceUnit: "hour",
        availableNow: true,
      } as ListingData);
    } else if (type === "thing") {
      items.push({
        ...baseItem,
        type: "thing",
        condition: ["new", "like_new", "good"][Math.floor(Math.random() * 3)] as any,
        brand: `Brand ${String.fromCharCode(65 + i)}`,
        negotiable: Math.random() > 0.5,
        shippingAvailable: Math.random() > 0.3,
        category: "Electronics",
      } as ListingData);
    }
  }
  
  return items;
};

export function FeaturedSection({
  items,
  categories = [
    { value: "all", label: "All", items: generateMockItems("service", 8) },
    { value: "services", label: "Services", items: generateMockItems("service", 6) },
    { value: "events", label: "Events", items: generateMockItems("event", 6) },
    { value: "spaces", label: "Spaces", items: generateMockItems("space", 6) },
    { value: "things", label: "Things", items: generateMockItems("thing", 6) },
  ],
  title = "Featured Listings",
  description = "Discover top-rated and trending items in your area",
  autoPlay = true,
  autoPlayInterval = 5000,
  showControls = true,
  showIndicators = true,
  className,
  onItemClick,
  viewAllLink = "/marketplace?featured=true",
}: FeaturedSectionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const carouselRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isHovered, setIsHovered] = useState(false);
  const [visibleItems, setVisibleItems] = useState(4);

  // Get current items based on selected category
  const currentItems = items || 
    categories.find(cat => cat.value === selectedCategory)?.items || 
    categories[0]?.items || 
    [];

  // Calculate visible items based on screen size
  useEffect(() => {
    const updateVisibleItems = () => {
      const width = window.innerWidth;
      if (width < 640) setVisibleItems(1);
      else if (width < 1024) setVisibleItems(2);
      else if (width < 1536) setVisibleItems(3);
      else setVisibleItems(4);
    };

    updateVisibleItems();
    window.addEventListener("resize", updateVisibleItems);
    return () => window.removeEventListener("resize", updateVisibleItems);
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && !isHovered && currentItems.length > visibleItems) {
      intervalRef.current = setInterval(() => {
        handleNext();
      }, autoPlayInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, isHovered, currentIndex, currentItems.length, visibleItems, autoPlayInterval]);

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      if (prev === 0) {
        return Math.max(0, currentItems.length - visibleItems);
      }
      return Math.max(0, prev - 1);
    });
  }, [currentItems.length, visibleItems]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const maxIndex = Math.max(0, currentItems.length - visibleItems);
      if (prev >= maxIndex) {
        return 0;
      }
      return prev + 1;
    });
  }, [currentItems.length, visibleItems]);

  // Handle item click
  const handleItemClick = (item: ListingData) => {
    if (onItemClick) {
      onItemClick(item);
    } else {
      router.push(`/listing/${item.type}/${item.id}`);
    }
  };

  // Handle favorite
  const handleFavorite = async (item: ListingData, isFavorited: boolean) => {
    try {
      // API call to toggle favorite
      console.log("Toggle favorite:", item.id, isFavorited);
      toast({
        title: isFavorited ? "Added to favorites" : "Removed from favorites",
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    }
  };

  // Handle share
  const handleShare = (item: ListingData) => {
    const url = `${window.location.origin}/listing/${item.type}/${item.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Listing link copied to clipboard",
      duration: 2000,
    });
  };

  // Calculate transform for carousel
  const getCarouselTransform = () => {
    const itemWidth = 100 / visibleItems;
    return `translateX(-${currentIndex * itemWidth}%)`;
  };

  // Check if navigation is needed
  const showNavigation = currentItems.length > visibleItems;
  const maxIndex = Math.max(0, currentItems.length - visibleItems);

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {autoPlay && showControls && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(viewAllLink)}>
              View All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Category Tabs */}
        {categories.length > 1 && (
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {categories.map((category) => (
                <TabsTrigger 
                  key={category.value} 
                  value={category.value}
                  className="flex items-center gap-2"
                >
                  {category.label}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {category.items.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Carousel Container */}
        <div
          className="relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Previous Button */}
          {showNavigation && showControls && (
            <AnimatePresence>
              {(isHovered || currentIndex > 0) && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
                >
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="rounded-full shadow-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Next Button */}
          {showNavigation && showControls && (
            <AnimatePresence>
              {(isHovered || currentIndex < maxIndex) && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
                >
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleNext}
                    disabled={currentIndex >= maxIndex}
                    className="rounded-full shadow-lg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Items Container */}
          <div className="overflow-hidden">
            <motion.div
              ref={carouselRef}
              className="flex gap-4"
              animate={{ x: getCarouselTransform() }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              style={{ width: `${(currentItems.length / visibleItems) * 100}%` }}
            >
              {currentItems.map((item, index) => (
                <div
                  key={item.id}
                  className="relative"
                  style={{ width: `${100 / currentItems.length}%` }}
                >
                  {/* Featured Badge */}
                  {item.featured && (
                    <div className="absolute top-2 left-2 z-20">
                      <Badge className="bg-yellow-500 text-white">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Featured
                      </Badge>
                    </div>
                  )}
                  
                  {/* Trending Indicator */}
                  {index < 3 && (
                    <div className="absolute top-2 right-2 z-20">
                      <Badge variant="secondary">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        Trending
                      </Badge>
                    </div>
                  )}

                  <UniversalListingCard
                    listing={item}
                    onClick={handleItemClick}
                    onFavorite={handleFavorite}
                    onShare={handleShare}
                    className="h-full"
                  />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Indicators */}
          {showIndicators && showNavigation && (
            <div className="flex justify-center gap-1 mt-4">
              {Array.from({ length: maxIndex + 1 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    index === currentIndex
                      ? "w-8 bg-primary"
                      : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold">{currentItems.length}</div>
            <div className="text-sm text-muted-foreground">Featured Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold flex items-center justify-center">
              <Star className="h-5 w-5 mr-1 text-yellow-500" />
              4.8
            </div>
            <div className="text-sm text-muted-foreground">Avg Rating</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              <Zap className="h-5 w-5 mx-auto text-blue-500" />
            </div>
            <div className="text-sm text-muted-foreground">Instant Book</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">24/7</div>
            <div className="text-sm text-muted-foreground">Available</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}