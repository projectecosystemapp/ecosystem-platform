"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Image from "next/image";
import { 
  Star, 
  MapPin, 
  Clock, 
  Users, 
  DollarSign,
  Calendar,
  MessageSquare,
  CheckCircle,
  TrendingUp
} from "lucide-react";
import { CategoryType } from "@/components/categories/CategoryTabs";
import { PlatformFeeIndicator } from "@/components/booking/PlatformFeeIndicator";

export interface BaseListingData {
  id: string;
  category: CategoryType;
  title: string;
  image?: string;
  location?: string;
  createdAt?: Date;
}

export interface ServiceListingData extends BaseListingData {
  category: "services";
  provider: {
    name: string;
    avatar?: string;
    rating: number;
    reviewCount: number;
    verified?: boolean;
  };
  price: string;
  priceUnit?: "hour" | "job" | "session";
  availability: "available" | "busy" | "offline";
  availabilityText?: string;
  services?: string[];
}

export interface WantedListingData extends BaseListingData {
  category: "wanted";
  requester: {
    name: string;
    avatar?: string;
  };
  budget: {
    min: number;
    max: number;
    currency?: string;
  };
  quotesCount: number;
  urgency?: "low" | "medium" | "high";
  description: string;
}

export interface EventListingData extends BaseListingData {
  category: "events";
  host: {
    name: string;
    avatar?: string;
  };
  startDate: Date;
  endDate?: Date;
  price: number | "free";
  currency?: string;
  attendees: {
    count: number;
    max?: number;
    friendsGoing?: number;
  };
  type?: string;
}

export interface SpaceListingData extends BaseListingData {
  category: "spaces";
  owner: {
    name: string;
    avatar?: string;
    rating?: number;
  };
  price: string;
  priceUnit: "hour" | "day" | "month";
  capacity: number;
  amenities?: string[];
  availability: "available" | "booked";
  size?: string;
}

export type ListingData = 
  | ServiceListingData 
  | WantedListingData 
  | EventListingData 
  | SpaceListingData;

interface UnifiedListingCardProps {
  listing: ListingData;
  onClick?: () => void;
  className?: string;
}

export function UnifiedListingCard({ 
  listing, 
  onClick,
  className 
}: UnifiedListingCardProps) {
  const categoryClass = `category-${listing.category}`;

  return (
    <motion.div
      className={cn(
        "group cursor-pointer card-enter",
        categoryClass,
        className
      )}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className={cn(
        "bg-white rounded-xl border border-gray-200 overflow-hidden",
        "hover:border-[var(--category-primary)] hover:shadow-[var(--category-shadow)]",
        "transition-all duration-200"
      )}>
        {/* Render category-specific card */}
        {listing.category === "services" && (
          <ServiceCard listing={listing as ServiceListingData} />
        )}
        {listing.category === "wanted" && (
          <WantedCard listing={listing as WantedListingData} />
        )}
        {listing.category === "events" && (
          <EventCard listing={listing as EventListingData} />
        )}
        {listing.category === "spaces" && (
          <SpaceCard listing={listing as SpaceListingData} />
        )}
      </div>
    </motion.div>
  );
}

// Service Provider Card
function ServiceCard({ listing }: { listing: ServiceListingData }) {
  const availabilityColors = {
    available: "text-green-600 bg-green-50",
    busy: "text-orange-600 bg-orange-50",
    offline: "text-gray-600 bg-gray-50"
  };

  return (
    <>
      {/* Image */}
      {listing.image && (
        <div className="relative h-48 bg-gray-100">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            className="object-cover"
          />
          {/* Availability Badge */}
          <div className={cn(
            "absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium",
            availabilityColors[listing.availability]
          )}>
            {listing.availabilityText || listing.availability}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Provider Info */}
        <div className="flex items-center gap-3 mb-3">
          {listing.provider.avatar && (
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100">
              <Image
                src={listing.provider.avatar}
                alt={listing.provider.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-gray-900">
                {listing.provider.name}
              </h3>
              {listing.provider.verified && (
                <CheckCircle className="w-4 h-4 text-blue-500" />
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{listing.provider.rating}</span>
              <span className="text-gray-500">
                ({listing.provider.reviewCount})
              </span>
            </div>
          </div>
        </div>

        {/* Service Title */}
        <h4 className="font-medium text-gray-900 mb-2">{listing.title}</h4>

        {/* Services List */}
        {listing.services && listing.services.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.services.slice(0, 3).map((service, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600"
              >
                {service}
              </span>
            ))}
          </div>
        )}

        {/* Price & Location */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[var(--category-primary)] font-semibold">
              <DollarSign className="w-4 h-4" />
              <span>{listing.price}</span>
              {listing.priceUnit && (
                <span className="text-sm text-gray-500">/{listing.priceUnit}</span>
              )}
            </div>
            {listing.location && (
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="w-3 h-3" />
                <span>{listing.location}</span>
              </div>
            )}
          </div>
          {/* Platform Fee Indicator */}
          <PlatformFeeIndicator 
            servicePrice={parseFloat(listing.price) * 100} 
            variant="inline" 
            className="justify-start"
          />
        </div>
      </div>
    </>
  );
}

// Wanted Request Card
function WantedCard({ listing }: { listing: WantedListingData }) {
  const urgencyColors = {
    low: "bg-gray-100 text-gray-600",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700"
  };

  return (
    <div className="p-4 border-l-4 border-[var(--category-primary)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[var(--category-primary)]" />
          <span className="text-sm font-medium text-gray-500">Request</span>
        </div>
        {listing.urgency && (
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            urgencyColors[listing.urgency]
          )}>
            {listing.urgency === "high" ? "Urgent" : listing.urgency}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 mb-2">{listing.title}</h3>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {listing.description}
      </p>

      {/* Budget Range */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-500">Budget:</span>
        <span className="font-semibold text-[var(--category-primary)]">
          ${listing.budget.min} - ${listing.budget.max}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-2">
          {listing.requester.avatar && (
            <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-100">
              <Image
                src={listing.requester.avatar}
                alt={listing.requester.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <span className="text-sm text-gray-600">{listing.requester.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-4 h-4 text-[var(--category-primary)]" />
          <span className="text-sm font-medium text-[var(--category-primary)]">
            {listing.quotesCount} quotes
          </span>
        </div>
      </div>
    </div>
  );
}

// Event Card
function EventCard({ listing }: { listing: EventListingData }) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <>
      {/* Image */}
      {listing.image && (
        <div className="relative h-48 bg-gray-100">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            className="object-cover"
          />
          {/* Event Type Badge */}
          {listing.type && (
            <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-sm font-medium">
              {listing.type}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 mb-2">{listing.title}</h3>

        {/* Date & Time */}
        <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(listing.startDate)}</span>
        </div>

        {/* Location */}
        {listing.location && (
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
            <MapPin className="w-4 h-4" />
            <span>{listing.location}</span>
          </div>
        )}

        {/* Social Proof */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-[var(--category-primary)]" />
            <span className="text-sm font-medium">
              {listing.attendees.count}
              {listing.attendees.max && `/${listing.attendees.max}`} going
            </span>
          </div>
          {listing.attendees.friendsGoing && listing.attendees.friendsGoing > 0 && (
            <span className="text-sm text-[var(--category-primary)] font-medium">
              {listing.attendees.friendsGoing} friends
            </span>
          )}
        </div>

        {/* Price & Host */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-2">
            {listing.host.avatar && (
              <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-100">
                <Image
                  src={listing.host.avatar}
                  alt={listing.host.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <span className="text-sm text-gray-600">by {listing.host.name}</span>
          </div>
          <span className="font-semibold text-[var(--category-primary)]">
            {listing.price === "free" ? "Free" : `$${listing.price}`}
          </span>
        </div>
      </div>
    </>
  );
}

// Space Rental Card
function SpaceCard({ listing }: { listing: SpaceListingData }) {
  return (
    <>
      {/* Image */}
      {listing.image && (
        <div className="relative h-48 bg-gray-100">
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            className="object-cover"
          />
          {/* Availability Status */}
          <div className={cn(
            "absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium",
            listing.availability === "available"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          )}>
            {listing.availability}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-semibold text-gray-900 mb-2">{listing.title}</h3>

        {/* Capacity & Size */}
        <div className="flex items-center gap-4 mb-3 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>Up to {listing.capacity}</span>
          </div>
          {listing.size && (
            <span className="text-gray-400">•</span>
          )}
          {listing.size && <span>{listing.size}</span>}
        </div>

        {/* Amenities */}
        {listing.amenities && listing.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {listing.amenities.slice(0, 3).map((amenity, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-[var(--category-light)] text-[var(--category-primary)] rounded-full"
              >
                {amenity}
              </span>
            ))}
            {listing.amenities.length > 3 && (
              <span className="text-xs px-2 py-1 text-gray-500">
                +{listing.amenities.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Price & Location */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="font-semibold text-[var(--category-primary)]">
            {listing.price}
            <span className="text-sm text-gray-500">/{listing.priceUnit}</span>
          </div>
          {listing.location && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="w-3 h-3" />
              <span>{listing.location}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default UnifiedListingCard;
