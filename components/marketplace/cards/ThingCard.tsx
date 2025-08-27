"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
  MapPin,
  Clock,
  Package,
  Truck,
  Tag,
  Calendar,
  MessageSquare,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Shield,
  HandshakeIcon,
  Star,
  ShoppingBag
} from "lucide-react";
import {
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThingListingData } from "./UniversalListingCard";

interface ThingCardProps {
  listing: ThingListingData;
  view?: "grid" | "list";
}

export function ThingCard({ listing, view = "grid" }: ThingCardProps) {
  const isListView = view === "list";
  
  // Format price
  const formatPrice = () => {
    const currency = listing.currency || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    if (typeof listing.price === "number") {
      return formatter.format(listing.price);
    } else {
      const min = formatter.format(listing.price.min);
      const max = formatter.format(listing.price.max);
      return `${min} - ${max}`;
    }
  };

  // Get condition badge color
  const getConditionColor = () => {
    switch (listing.condition) {
      case "new":
        return "bg-green-100 text-green-700";
      case "like_new":
        return "bg-blue-100 text-blue-700";
      case "good":
        return "bg-yellow-100 text-yellow-700";
      case "fair":
        return "bg-orange-100 text-orange-700";
      case "for_parts":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Format condition label
  const formatCondition = (condition?: string) => {
    if (!condition) return "Unknown";
    return condition.split("_").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  // Format time since posted
  const formatTimeAgo = () => {
    if (!listing.createdAt) return "Recently";
    
    const now = new Date();
    const posted = new Date(listing.createdAt);
    const diffTime = Math.abs(now.getTime() - posted.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    }
  };

  // Check if item is sold or reserved
  const isUnavailable = listing.sold || listing.reserved;

  if (isListView) {
    // List view layout
    return (
      <div className={cn("flex w-full", isUnavailable && "opacity-60")}>
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
            <div className="w-full h-full bg-gradient-to-br from-orange-50 to-orange-100 rounded-l-lg flex items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-orange-300" />
            </div>
          )}
          
          {/* Status Overlay */}
          {listing.sold && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-l-lg">
              <Badge className="bg-red-600 text-white">SOLD</Badge>
            </div>
          )}
          {listing.reserved && !listing.sold && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-l-lg">
              <Badge className="bg-orange-600 text-white">RESERVED</Badge>
            </div>
          )}
          
          {/* Condition Badge */}
          {!isUnavailable && listing.condition && (
            <div className="absolute top-2 left-2">
              <Badge className={cn("text-xs", getConditionColor())}>
                {formatCondition(listing.condition)}
              </Badge>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            {/* Title & Meta */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{listing.title}</h3>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  {listing.brand && (
                    <>
                      <span className="font-medium">{listing.brand}</span>
                      {listing.model && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span>{listing.model}</span>
                        </>
                      )}
                    </>
                  )}
                  {listing.year && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span>{listing.year}</span>
                    </>
                  )}
                </div>
              </div>
              
              {/* Price */}
              <div className="text-right">
                <div className="text-lg font-bold text-orange-600">
                  {formatPrice()}
                </div>
                {listing.negotiable && !isUnavailable && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    <HandshakeIcon className="h-3 w-3 mr-1" />
                    Negotiable
                  </Badge>
                )}
              </div>
            </div>

            {/* Description */}
            {listing.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {listing.description}
              </p>
            )}

            {/* Category & Subcategory */}
            {(listing.category || listing.subcategory) && (
              <div className="flex items-center gap-2 mb-3">
                {listing.category && (
                  <Badge variant="outline" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {listing.category}
                  </Badge>
                )}
                {listing.subcategory && (
                  <Badge variant="outline" className="text-xs">
                    {listing.subcategory}
                  </Badge>
                )}
              </div>
            )}

            {/* Shipping & Location */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {listing.shippingAvailable && (
                <div className="flex items-center gap-1">
                  <Truck className="h-3 w-3" />
                  <span>Shipping available</span>
                </div>
              )}
              {listing.localPickupOnly && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>Local pickup only</span>
                </div>
              )}
              {listing.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {listing.location.city || listing.location.address}
                    {listing.location.distance && ` • ${listing.location.distance}mi`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            {/* Seller Info & Time */}
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={listing.provider?.avatar} />
                <AvatarFallback>
                  {listing.provider?.name?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
              <div className="text-xs">
                <span className="text-gray-600">
                  by <span className="font-medium">{listing.provider?.name}</span>
                </span>
                <span className="text-gray-400 ml-2">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {formatTimeAgo()}
                </span>
              </div>
            </div>
            
            {!isUnavailable && (
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                <MessageSquare className="h-3 w-3 mr-1" />
                Contact Seller
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid view layout
  return (
    <div className={cn(isUnavailable && "opacity-60")}>
      {/* Image Header */}
      <div className="relative h-48 bg-gradient-to-br from-orange-50 to-orange-100">
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
            <ShoppingBag className="h-16 w-16 text-orange-300" />
          </div>
        )}
        
        {/* Status Overlay */}
        {listing.sold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge className="bg-red-600 text-white text-lg px-3 py-1">SOLD</Badge>
          </div>
        )}
        {listing.reserved && !listing.sold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge className="bg-orange-600 text-white text-lg px-3 py-1">RESERVED</Badge>
          </div>
        )}
        
        {/* Condition Badge */}
        {!isUnavailable && listing.condition && (
          <div className="absolute top-2 left-2">
            <Badge className={cn("text-xs", getConditionColor())}>
              {formatCondition(listing.condition)}
            </Badge>
          </div>
        )}
        
        {/* Negotiable Badge */}
        {!isUnavailable && listing.negotiable && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-white/90 backdrop-blur text-xs">
              <HandshakeIcon className="h-3 w-3 mr-1" />
              Negotiable
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Price */}
        <div className="text-lg font-bold text-orange-600 mb-2">
          {formatPrice()}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base mb-1 line-clamp-2">{listing.title}</h3>

        {/* Brand & Model */}
        {(listing.brand || listing.model) && (
          <div className="text-sm text-gray-600 mb-2">
            {listing.brand && <span className="font-medium">{listing.brand}</span>}
            {listing.brand && listing.model && " "}
            {listing.model && <span>{listing.model}</span>}
            {listing.year && <span className="text-gray-500"> ({listing.year})</span>}
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}

        {/* Shipping Options */}
        <div className="flex items-center gap-2 mb-3 text-xs">
          {listing.shippingAvailable && (
            <Badge variant="secondary" className="text-xs">
              <Truck className="h-3 w-3 mr-1" />
              Ships
            </Badge>
          )}
          {listing.localPickupOnly && (
            <Badge variant="secondary" className="text-xs">
              <Package className="h-3 w-3 mr-1" />
              Pickup
            </Badge>
          )}
        </div>

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

        {/* Seller Info & Time */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={listing.provider?.avatar} />
              <AvatarFallback>
                {listing.provider?.name?.charAt(0) || "S"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600">
              {listing.provider?.name}
              {listing.provider?.rating && (
                <>
                  <Star className="h-3 w-3 inline ml-1 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{listing.provider.rating}</span>
                </>
              )}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {formatTimeAgo()}
          </span>
        </div>

        {/* Action Button */}
        {!isUnavailable && (
          <div className="pt-3 border-t">
            <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700">
              <MessageSquare className="h-3 w-3 mr-1" />
              Contact Seller
            </Button>
          </div>
        )}
      </CardContent>
    </div>
  );
}