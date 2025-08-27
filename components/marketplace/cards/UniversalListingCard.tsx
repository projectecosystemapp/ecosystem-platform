"use client";

import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { 
  Heart, 
  Share2, 
  MoreVertical,
  Eye,
  ShoppingCart,
  Calendar,
  MapPin,
  Clock,
  DollarSign
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

// Import specialized cards
import { ServiceCard } from "./ServiceCard";
import { EventCard } from "./EventCard";
import { SpaceCard } from "./SpaceCard";
import { ThingCard } from "./ThingCard";

// Types for each vertical
export type ListingType = "service" | "event" | "space" | "thing";

export interface BaseListingData {
  id: string;
  type: ListingType;
  title: string;
  description?: string;
  images?: string[];
  thumbnailUrl?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    distance?: number; // in miles
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  price: number | { min: number; max: number };
  currency?: string;
  provider?: {
    id: string;
    name: string;
    avatar?: string;
    verified?: boolean;
    rating?: number;
    reviewCount?: number;
  };
  stats?: {
    views?: number;
    favorites?: number;
    bookings?: number;
  };
  isFavorited?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  featured?: boolean;
  boosted?: boolean;
}

export interface ServiceListingData extends BaseListingData {
  type: "service";
  duration?: number; // in minutes
  priceUnit?: "hour" | "session" | "project" | "day";
  instantBooking?: boolean;
  availability?: "available" | "busy" | "offline";
  nextAvailable?: Date;
  categories?: string[];
}

export interface EventListingData extends BaseListingData {
  type: "event";
  startDate: Date;
  endDate?: Date;
  eventType?: string;
  capacity?: number;
  attendees?: number;
  spotsLeft?: number;
  isOnline?: boolean;
  tags?: string[];
}

export interface SpaceListingData extends BaseListingData {
  type: "space";
  size?: number; // square feet
  sizeUnit?: "sqft" | "sqm";
  capacity?: number; // people
  amenities?: string[];
  priceUnit: "hour" | "day" | "week" | "month";
  availableNow?: boolean;
  minRentalPeriod?: number;
  rentalUnit?: string;
}

export interface ThingListingData extends BaseListingData {
  type: "thing";
  condition?: "new" | "like_new" | "good" | "fair" | "for_parts";
  brand?: string;
  model?: string;
  year?: number;
  negotiable?: boolean;
  shippingAvailable?: boolean;
  localPickupOnly?: boolean;
  sold?: boolean;
  reserved?: boolean;
  category?: string;
  subcategory?: string;
}

export type ListingData = 
  | ServiceListingData 
  | EventListingData 
  | SpaceListingData 
  | ThingListingData;

export interface UniversalListingCardProps {
  listing: ListingData;
  view?: "grid" | "list";
  onClick?: (listing: ListingData) => void;
  onFavorite?: (listing: ListingData, isFavorited: boolean) => Promise<void>;
  onShare?: (listing: ListingData) => void;
  onBook?: (listing: ListingData) => void;
  showQuickActions?: boolean;
  className?: string;
  loading?: boolean;
}

export function UniversalListingCard({
  listing,
  view = "grid",
  onClick,
  onFavorite,
  onShare,
  onBook,
  showQuickActions = true,
  className,
  loading = false,
}: UniversalListingCardProps) {
  const [isFavorited, setIsFavorited] = useState(listing.isFavorited || false);
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { toast } = useToast();

  // Handle favorite action
  const handleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const newFavoriteState = !isFavorited;
      setIsFavorited(newFavoriteState);
      
      if (onFavorite) {
        await onFavorite(listing, newFavoriteState);
      }
      
      toast({
        title: newFavoriteState ? "Added to favorites" : "Removed from favorites",
        duration: 2000,
      });
    } catch (error) {
      setIsFavorited(!isFavorited); // Revert on error
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    }
  }, [isFavorited, listing, onFavorite, toast]);

  // Handle share action
  const handleShare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (onShare) {
      onShare(listing);
    } else {
      // Default share behavior - copy to clipboard
      const url = `${window.location.origin}/listing/${listing.type}/${listing.id}`;
      navigator.clipboard.writeText(url);
      toast({
        title: "Link copied to clipboard",
        duration: 2000,
      });
    }
  }, [listing, onShare, toast]);

  // Handle book action
  const handleBook = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBook) {
      onBook(listing);
    }
  }, [listing, onBook]);

  // Handle card click
  const handleCardClick = useCallback(() => {
    if (onClick) {
      onClick(listing);
    }
  }, [listing, onClick]);

  // Format price display
  const formatPrice = (price: number | { min: number; max: number }) => {
    const currency = listing.currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    if (typeof price === "number") {
      return formatter.format(price);
    } else {
      return `${formatter.format(price.min)} - ${formatter.format(price.max)}`;
    }
  };

  // Get theme color based on listing type
  const getThemeColor = () => {
    switch (listing.type) {
      case "service":
        return "blue";
      case "event":
        return "purple";
      case "space":
        return "green";
      case "thing":
        return "orange";
      default:
        return "gray";
    }
  };

  const themeColor = getThemeColor();

  // Render the appropriate specialized card based on type
  const renderSpecializedCard = () => {
    switch (listing.type) {
      case "service":
        return <ServiceCard listing={listing as ServiceListingData} view={view} />;
      case "event":
        return <EventCard listing={listing as EventListingData} view={view} />;
      case "space":
        return <SpaceCard listing={listing as SpaceListingData} view={view} />;
      case "thing":
        return <ThingCard listing={listing as ThingListingData} view={view} />;
      default:
        return null;
    }
  };

  // Common card wrapper with animations and interactions
  return (
    <TooltipProvider>
      <motion.div
        className={cn(
          "relative group",
          view === "list" && "w-full",
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Card
          className={cn(
            "overflow-hidden cursor-pointer transition-all duration-200",
            "hover:shadow-xl hover:border-opacity-0",
            view === "list" && "flex flex-row",
            listing.featured && "ring-2 ring-yellow-400",
            `hover:shadow-${themeColor}-100`
          )}
          onClick={handleCardClick}
        >
          {/* Quick Actions Overlay */}
          {showQuickActions && (
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-2 right-2 z-10 flex gap-1"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 bg-white/90 backdrop-blur"
                        onClick={handleFavorite}
                      >
                        <Heart
                          className={cn(
                            "h-4 w-4",
                            isFavorited && "fill-red-500 text-red-500"
                          )}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{isFavorited ? "Remove from favorites" : "Add to favorites"}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 bg-white/90 backdrop-blur"
                        onClick={handleShare}
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Share</p>
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 bg-white/90 backdrop-blur"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleBook(e as any);
                      }}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Book Now
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        // Handle report
                      }}>
                        Report listing
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Featured Badge */}
          {listing.featured && (
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="default" className="bg-yellow-500 text-white">
                Featured
              </Badge>
            </div>
          )}

          {/* Boosted Badge */}
          {listing.boosted && (
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="default" className="bg-purple-500 text-white">
                Boosted
              </Badge>
            </div>
          )}

          {/* Render the specialized card content */}
          {renderSpecializedCard()}

          {/* Stats Footer (optional) */}
          {listing.stats && (
            <CardFooter className="pt-2 pb-3 px-4 border-t bg-gray-50/50">
              <div className="flex items-center justify-between w-full text-xs text-gray-500">
                {listing.stats.views && (
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>{listing.stats.views} views</span>
                  </div>
                )}
                {listing.stats.favorites && (
                  <div className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    <span>{listing.stats.favorites} saved</span>
                  </div>
                )}
                {listing.stats.bookings && (
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    <span>{listing.stats.bookings} bookings</span>
                  </div>
                )}
              </div>
            </CardFooter>
          )}
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}

export default UniversalListingCard;