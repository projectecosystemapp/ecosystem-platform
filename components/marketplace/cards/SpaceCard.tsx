"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
  MapPin,
  Users,
  Square,
  Calendar,
  CheckCircle2,
  Wifi,
  Car,
  Coffee,
  Monitor,
  Zap,
  Home,
  DollarSign,
  Clock,
  Star
} from "lucide-react";
import {
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SpaceListingData } from "./UniversalListingCard";

interface SpaceCardProps {
  listing: SpaceListingData;
  view?: "grid" | "list";
}

// Icon map for amenities
const amenityIcons: Record<string, React.ElementType> = {
  wifi: Wifi,
  parking: Car,
  coffee: Coffee,
  monitors: Monitor,
  "power outlets": Zap,
  kitchen: Coffee,
  "air conditioning": Home,
  heating: Home,
  projector: Monitor,
  whiteboard: Square,
};

export function SpaceCard({ listing, view = "grid" }: SpaceCardProps) {
  const isListView = view === "list";
  
  // Format price with unit
  const formatPrice = () => {
    const currency = listing.currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    if (typeof listing.price === "number") {
      return `${formatter.format(listing.price)}/${listing.priceUnit}`;
    } else {
      const min = formatter.format(listing.price.min);
      const max = formatter.format(listing.price.max);
      return `${min}-${max}/${listing.priceUnit}`;
    }
  };

  // Format size
  const formatSize = () => {
    if (!listing.size) return null;
    const unit = listing.sizeUnit || "sqft";
    return `${listing.size.toLocaleString()} ${unit}`;
  };

  // Format minimum rental period
  const formatMinRental = () => {
    if (!listing.minRentalPeriod) return null;
    const unit = listing.rentalUnit || listing.priceUnit;
    if (listing.minRentalPeriod === 1) {
      return `Min. 1 ${unit}`;
    }
    return `Min. ${listing.minRentalPeriod} ${unit}s`;
  };

  // Get amenity icon
  const getAmenityIcon = (amenity: string) => {
    const lowerAmenity = amenity.toLowerCase();
    for (const [key, Icon] of Object.entries(amenityIcons)) {
      if (lowerAmenity.includes(key)) {
        return Icon;
      }
    }
    return CheckCircle2;
  };

  if (isListView) {
    // List view layout
    return (
      <div className="flex w-full">
        {/* Image Section */}
        <div className="relative w-48 h-36 flex-shrink-0">
          {listing.thumbnailUrl || listing.images?.[0] ? (
            <Image
              src={listing.thumbnailUrl || listing.images![0]}
              alt={listing.title}
              fill
              className="object-cover rounded-l-lg"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-green-50 to-green-100 rounded-l-lg flex items-center justify-center">
              <Home className="h-12 w-12 text-green-300" />
            </div>
          )}
          
          {/* Availability Badge */}
          {listing.availableNow && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-green-500 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Available Now
              </Badge>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            {/* Title & Owner */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{listing.title}</h3>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={listing.provider?.avatar} />
                    <AvatarFallback>
                      {listing.provider?.name?.charAt(0) || "O"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-600">
                    by <span className="font-medium">{listing.provider?.name}</span>
                  </span>
                  {listing.provider?.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{listing.provider.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {listing.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {listing.description}
              </p>
            )}

            {/* Space Details */}
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
              {listing.size && (
                <div className="flex items-center gap-1">
                  <Square className="h-3 w-3" />
                  <span>{formatSize()}</span>
                </div>
              )}
              {listing.capacity && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>Up to {listing.capacity} people</span>
                </div>
              )}
              {listing.minRentalPeriod && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatMinRental()}</span>
                </div>
              )}
            </div>

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {listing.amenities.slice(0, 5).map((amenity, idx) => {
                  const Icon = getAmenityIcon(amenity);
                  return (
                    <Badge key={idx} variant="outline" className="text-xs">
                      <Icon className="h-3 w-3 mr-1" />
                      {amenity}
                    </Badge>
                  );
                })}
                {listing.amenities.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{listing.amenities.length - 5} more
                  </Badge>
                )}
              </div>
            )}

            {/* Location */}
            {listing.location && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-3 w-3" />
                <span>
                  {listing.location.city || listing.location.address}
                  {listing.location.distance && ` • ${listing.location.distance}mi away`}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-lg font-bold text-green-600">
              {formatPrice()}
            </div>
            <Button size="sm" className="bg-green-600 hover:bg-green-700">
              View & Book
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Grid view layout
  return (
    <>
      {/* Image Header */}
      <div className="relative h-48 bg-gradient-to-br from-green-50 to-green-100">
        {listing.thumbnailUrl || listing.images?.[0] ? (
          <Image
            src={listing.thumbnailUrl || listing.images![0]}
            alt={listing.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="h-16 w-16 text-green-300" />
          </div>
        )}
        
        {/* Availability Badge */}
        {listing.availableNow && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-green-500 text-white text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Available Now
            </Badge>
          </div>
        )}
        
        {/* Price Badge */}
        <div className="absolute bottom-2 right-2">
          <Badge className="bg-black/70 text-white backdrop-blur">
            {formatPrice()}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-base mb-2 line-clamp-2">{listing.title}</h3>

        {/* Space Details */}
        <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
          {listing.size && (
            <div className="flex items-center gap-1">
              <Square className="h-3 w-3 text-green-600" />
              <span className="font-medium">{formatSize()}</span>
            </div>
          )}
          {listing.capacity && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-green-600" />
              <span className="font-medium">{listing.capacity} people</span>
            </div>
          )}
        </div>

        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}

        {/* Top Amenities */}
        {listing.amenities && listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.amenities.slice(0, 3).map((amenity, idx) => {
              const Icon = getAmenityIcon(amenity);
              return (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <Icon className="h-3 w-3 mr-1" />
                  {amenity}
                </Badge>
              );
            })}
            {listing.amenities.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{listing.amenities.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Location */}
        {listing.location && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {listing.location.city || listing.location.address}
            </span>
            {listing.location.distance && (
              <span className="font-medium">• {listing.location.distance}mi</span>
            )}
          </div>
        )}

        {/* Minimum Rental */}
        {listing.minRentalPeriod && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <Calendar className="h-3 w-3" />
            <span>{formatMinRental()}</span>
          </div>
        )}

        {/* Owner Info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={listing.provider?.avatar} />
            <AvatarFallback>
              {listing.provider?.name?.charAt(0) || "O"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <span className="text-xs text-gray-600">
              <span className="font-medium">{listing.provider?.name}</span>
            </span>
            {listing.provider?.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs">{listing.provider.rating}</span>
                <span className="text-xs text-gray-500">
                  ({listing.provider.reviewCount || 0})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t">
          <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
            View Details & Book
          </Button>
        </div>
      </CardContent>
    </>
  );
}