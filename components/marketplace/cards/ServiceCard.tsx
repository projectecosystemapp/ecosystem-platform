"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
  Star, 
  MapPin, 
  Clock, 
  CheckCircle2,
  Shield,
  Zap,
  Calendar,
  DollarSign,
  User
} from "lucide-react";
import {
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ServiceListingData } from "./UniversalListingCard";

interface ServiceCardProps {
  listing: ServiceListingData;
  view?: "grid" | "list";
}

export function ServiceCard({ listing, view = "grid" }: ServiceCardProps) {
  const isListView = view === "list";
  
  // Format price with unit
  const formatPrice = () => {
    const currency = listing.currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    if (typeof listing.price === "number") {
      const formattedPrice = formatter.format(listing.price);
      return listing.priceUnit ? `${formattedPrice}/${listing.priceUnit}` : formattedPrice;
    } else {
      const min = formatter.format(listing.price.min);
      const max = formatter.format(listing.price.max);
      return `${min} - ${max}`;
    }
  };

  // Format duration
  const formatDuration = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}min`;
    }
  };

  // Get availability color
  const getAvailabilityColor = () => {
    switch (listing.availability) {
      case "available":
        return "bg-green-100 text-green-700";
      case "busy":
        return "bg-yellow-100 text-yellow-700";
      case "offline":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Format next available date
  const formatNextAvailable = () => {
    if (!listing.nextAvailable) return null;
    const date = new Date(listing.nextAvailable);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric" 
    });
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
            <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-l-lg flex items-center justify-center">
              <User className="h-12 w-12 text-blue-300" />
            </div>
          )}
          
          {/* Instant Booking Badge */}
          {listing.instantBooking && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-blue-500 text-white">
                <Zap className="h-3 w-3 mr-1" />
                Instant Book
              </Badge>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            {/* Provider Info */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={listing.provider?.avatar} />
                  <AvatarFallback>
                    {listing.provider?.name?.charAt(0) || "P"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm">{listing.provider?.name}</span>
                    {listing.provider?.verified && (
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  {listing.provider?.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs font-medium">{listing.provider.rating}</span>
                      <span className="text-xs text-gray-500">
                        ({listing.provider.reviewCount || 0} reviews)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Availability Badge */}
              <Badge variant="secondary" className={cn("text-xs", getAvailabilityColor())}>
                {listing.availability}
              </Badge>
            </div>

            {/* Title & Description */}
            <h3 className="font-semibold text-lg mb-1">{listing.title}</h3>
            {listing.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {listing.description}
              </p>
            )}

            {/* Categories */}
            {listing.categories && listing.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {listing.categories.slice(0, 3).map((category, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {category}
                  </Badge>
                ))}
                {listing.categories.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{listing.categories.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {listing.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {listing.location.city || listing.location.address}
                    {listing.location.distance && ` • ${listing.location.distance}mi`}
                  </span>
                </div>
              )}
              {listing.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(listing.duration)}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-blue-600">
                {formatPrice()}
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                Book Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view layout
  return (
    <>
      {/* Image Header */}
      <div className="relative h-48 bg-gradient-to-br from-blue-50 to-blue-100">
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
            <User className="h-16 w-16 text-blue-300" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {listing.instantBooking && (
            <Badge className="bg-blue-500 text-white">
              <Zap className="h-3 w-3 mr-1" />
              Instant
            </Badge>
          )}
          {listing.provider?.verified && (
            <Badge className="bg-green-500 text-white">
              <Shield className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
        
        {/* Availability Badge */}
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className={cn("text-xs", getAvailabilityColor())}>
            {listing.availability}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Provider Info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={listing.provider?.avatar} />
            <AvatarFallback>
              {listing.provider?.name?.charAt(0) || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm">{listing.provider?.name}</span>
              {listing.provider?.verified && (
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
              )}
            </div>
            {listing.provider?.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium">{listing.provider.rating}</span>
                <span className="text-xs text-gray-500">
                  ({listing.provider.reviewCount || 0})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base mb-2 line-clamp-2">{listing.title}</h3>

        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}

        {/* Categories */}
        {listing.categories && listing.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.categories.slice(0, 2).map((category, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {category}
              </Badge>
            ))}
            {listing.categories.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{listing.categories.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Info Row */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          {listing.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[100px]">
                {listing.location.city || listing.location.address}
              </span>
              {listing.location.distance && (
                <span className="font-medium">• {listing.location.distance}mi</span>
              )}
            </div>
          )}
          {listing.duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(listing.duration)}</span>
            </div>
          )}
        </div>

        {/* Next Available */}
        {listing.nextAvailable && listing.availability !== "available" && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <Calendar className="h-3 w-3" />
            <span>Next available: {formatNextAvailable()}</span>
          </div>
        )}

        {/* Price & Action */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <span className="text-lg font-bold text-blue-600">
              {formatPrice()}
            </span>
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
            Book Now
          </Button>
        </div>
      </CardContent>
    </>
  );
}