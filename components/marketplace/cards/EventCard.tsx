"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { 
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  AlertCircle,
  Globe,
  Building,
  Ticket,
  TrendingUp
} from "lucide-react";
import {
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EventListingData } from "./UniversalListingCard";

interface EventCardProps {
  listing: EventListingData;
  view?: "grid" | "list";
}

export function EventCard({ listing, view = "grid" }: EventCardProps) {
  const isListView = view === "list";
  
  // Format date and time
  const formatEventDate = (date: Date) => {
    const eventDate = new Date(date);
    const now = new Date();
    const diffTime = eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // If event is today
    if (diffDays === 0) {
      return {
        date: "Today",
        time: eventDate.toLocaleTimeString("en-US", { 
          hour: "numeric", 
          minute: "2-digit",
          hour12: true 
        }),
        isToday: true,
        daysUntil: 0
      };
    }
    
    // If event is tomorrow
    if (diffDays === 1) {
      return {
        date: "Tomorrow",
        time: eventDate.toLocaleTimeString("en-US", { 
          hour: "numeric", 
          minute: "2-digit",
          hour12: true 
        }),
        isTomorrow: true,
        daysUntil: 1
      };
    }
    
    // For other dates
    return {
      date: eventDate.toLocaleDateString("en-US", { 
        weekday: "short",
        month: "short", 
        day: "numeric" 
      }),
      time: eventDate.toLocaleTimeString("en-US", { 
        hour: "numeric", 
        minute: "2-digit",
        hour12: true 
      }),
      daysUntil: diffDays
    };
  };

  // Format price
  const formatPrice = () => {
    const currency = listing.currency || "USD";
    
    if (typeof listing.price === "number") {
      if (listing.price === 0) return "Free";
      
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return formatter.format(listing.price);
    } else {
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      return `${formatter.format(listing.price.min)} - ${formatter.format(listing.price.max)}`;
    }
  };

  // Calculate capacity percentage
  const getCapacityPercentage = () => {
    if (!listing.capacity || !listing.attendees) return 0;
    return (listing.attendees / listing.capacity) * 100;
  };

  // Check if event is almost full
  const isAlmostFull = () => {
    const percentage = getCapacityPercentage();
    return percentage >= 80;
  };

  // Check if event has limited spots
  const hasLimitedSpots = () => {
    return listing.spotsLeft !== undefined && listing.spotsLeft <= 10;
  };

  const eventDate = formatEventDate(listing.startDate);

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
            <div className="w-full h-full bg-gradient-to-br from-purple-50 to-purple-100 rounded-l-lg flex items-center justify-center">
              <Calendar className="h-12 w-12 text-purple-300" />
            </div>
          )}
          
          {/* Event Type Badge */}
          {listing.eventType && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-purple-500 text-white">
                {listing.eventType}
              </Badge>
            </div>
          )}
          
          {/* Online/Offline Badge */}
          <div className="absolute bottom-2 left-2">
            <Badge variant="secondary" className="bg-white/90 backdrop-blur">
              {listing.isOnline ? (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  Online
                </>
              ) : (
                <>
                  <Building className="h-3 w-3 mr-1" />
                  In-Person
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            {/* Date & Title Row */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{listing.title}</h3>
                <div className="flex items-center gap-2 text-sm text-purple-600 font-medium">
                  <Calendar className="h-4 w-4" />
                  <span>{eventDate.date}</span>
                  <Clock className="h-4 w-4" />
                  <span>{eventDate.time}</span>
                </div>
              </div>
              
              {/* Limited Spots Alert */}
              {hasLimitedSpots() && (
                <Badge variant="destructive" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {listing.spotsLeft} spots left
                </Badge>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {listing.description}
              </p>
            )}

            {/* Tags */}
            {listing.tags && listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {listing.tags.slice(0, 4).map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    <Tag className="h-2 w-2 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {listing.tags.length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{listing.tags.length - 4}
                  </Badge>
                )}
              </div>
            )}

            {/* Location & Capacity */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {listing.location && !listing.isOnline && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {listing.location.city || listing.location.address}
                    {listing.location.distance && ` • ${listing.location.distance}mi`}
                  </span>
                </div>
              )}
              {listing.capacity && (
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{listing.attendees || 0}/{listing.capacity} attending</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            {/* Host Info */}
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={listing.provider?.avatar} />
                <AvatarFallback>
                  {listing.provider?.name?.charAt(0) || "H"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-gray-600">
                Hosted by <span className="font-medium">{listing.provider?.name}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-purple-600">
                {formatPrice()}
              </div>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                <Ticket className="h-3 w-3 mr-1" />
                Get Tickets
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
      <div className="relative h-48 bg-gradient-to-br from-purple-50 to-purple-100">
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
            <Calendar className="h-16 w-16 text-purple-300" />
          </div>
        )}
        
        {/* Event Type Badge */}
        {listing.eventType && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-purple-500 text-white text-xs">
              {listing.eventType}
            </Badge>
          </div>
        )}
        
        {/* Days Until Event */}
        {eventDate.daysUntil <= 7 && eventDate.daysUntil >= 0 && (
          <div className="absolute top-2 right-2">
            <Badge 
              variant="destructive" 
              className={cn(
                "text-xs",
                eventDate.isToday && "bg-red-600",
                eventDate.isTomorrow && "bg-orange-600"
              )}
            >
              {eventDate.isToday ? "Today" : 
               eventDate.isTomorrow ? "Tomorrow" : 
               `In ${eventDate.daysUntil} days`}
            </Badge>
          </div>
        )}
        
        {/* Online/Offline Badge */}
        <div className="absolute bottom-2 left-2">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur text-xs">
            {listing.isOnline ? (
              <>
                <Globe className="h-3 w-3 mr-1" />
                Online Event
              </>
            ) : (
              <>
                <Building className="h-3 w-3 mr-1" />
                In-Person
              </>
            )}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-purple-600 font-medium mb-2">
          <Calendar className="h-4 w-4" />
          <span>{eventDate.date}</span>
          <span className="text-gray-400">•</span>
          <Clock className="h-4 w-4" />
          <span>{eventDate.time}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base mb-2 line-clamp-2">{listing.title}</h3>

        {/* Description */}
        {listing.description && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}

        {/* Location */}
        {listing.location && !listing.isOnline && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {listing.location.city || listing.location.address}
            </span>
            {listing.location.distance && (
              <span className="font-medium">• {listing.location.distance}mi away</span>
            )}
          </div>
        )}

        {/* Tags */}
        {listing.tags && listing.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.tags.slice(0, 2).map((tag, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {listing.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{listing.tags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Capacity Progress */}
        {listing.capacity && listing.attendees !== undefined && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">
                {listing.attendees} attending
              </span>
              {hasLimitedSpots() && (
                <span className="text-red-600 font-medium">
                  Only {listing.spotsLeft} spots left!
                </span>
              )}
            </div>
            <Progress 
              value={getCapacityPercentage()} 
              className={cn(
                "h-2",
                isAlmostFull() && "[&>div]:bg-red-500"
              )}
            />
          </div>
        )}

        {/* Host Info */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={listing.provider?.avatar} />
            <AvatarFallback>
              {listing.provider?.name?.charAt(0) || "H"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-gray-600">
            Hosted by <span className="font-medium">{listing.provider?.name}</span>
          </span>
        </div>

        {/* Price & Action */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="text-lg font-bold text-purple-600">
            {formatPrice()}
          </div>
          <Button 
            size="sm" 
            className="bg-purple-600 hover:bg-purple-700"
            disabled={listing.spotsLeft === 0}
          >
            {listing.spotsLeft === 0 ? "Sold Out" : "Get Tickets"}
          </Button>
        </div>
      </CardContent>
    </>
  );
}