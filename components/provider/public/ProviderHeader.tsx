"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  MapPin,
  Star,
  Shield,
  Award,
  Clock,
  Calendar,
  Share2,
  Heart,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProviderHeaderProps {
  provider: any;
}

export default function ProviderHeader({ provider }: ProviderHeaderProps) {
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(false);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: provider.displayName,
          text: provider.tagline || `Check out ${provider.displayName} on Ecosystem`,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Error sharing:", error);
      }
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href);
      // You could show a toast here
    }
  };

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800">
        {provider.coverImageUrl ? (
          <Image
            src={provider.coverImageUrl}
            alt={`${provider.displayName} cover`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        )}

        {/* Overlay gradient for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Navigation Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-10">
          <div className="container mx-auto">
            <div className="flex items-center justify-between">
              {/* Back Button */}
              <Button
                variant="ghost"
                size="icon"
                className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
                onClick={() => router.back()}
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
                  onClick={handleShare}
                  aria-label="Share provider profile"
                >
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "bg-white/10 backdrop-blur-sm hover:bg-white/20",
                    isFavorited ? "text-red-500" : "text-white"
                  )}
                  onClick={() => setIsFavorited(!isFavorited)}
                  aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                  aria-pressed={isFavorited}
                >
                  <Heart className={cn("h-5 w-5", isFavorited && "fill-current")} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Info Card */}
      <div className="relative -mt-20 md:-mt-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-xl p-6 md:p-8"
          >
            <div className="flex flex-col md:flex-row gap-6">
              {/* Profile Image */}
              <div className="flex-shrink-0">
                <Avatar className="h-24 w-24 md:h-32 md:w-32 ring-4 ring-white shadow-xl">
                  <AvatarImage
                    src={provider.profileImageUrl}
                    alt={provider.displayName}
                  />
                  <AvatarFallback className="text-2xl md:text-3xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    {provider.displayName
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Provider Details */}
              <div className="flex-grow">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    {/* Name and Verification */}
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900">
                        {provider.displayName}
                      </h1>
                      {provider.isVerified && (
                        <div className="flex items-center" title="Verified Provider">
                          <Shield className="h-6 w-6 text-blue-600" aria-hidden="true" />
                          <span className="sr-only">Verified Provider</span>
                        </div>
                      )}
                    </div>

                    {/* Tagline */}
                    {provider.tagline && (
                      <p className="text-lg text-gray-600 mb-3">{provider.tagline}</p>
                    )}

                    {/* Location and Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      {provider.locationCity && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          <span>
                            {provider.locationCity}
                            {provider.locationState && `, ${provider.locationState}`}
                          </span>
                        </div>
                      )}

                      {provider.yearsExperience && (
                        <div className="flex items-center gap-1">
                          <Award className="h-4 w-4" aria-hidden="true" />
                          <span>{provider.yearsExperience} years experience</span>
                        </div>
                      )}

                      {provider.averageRating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                          <span className="font-medium">
                            {Number(provider.averageRating).toFixed(1)}
                          </span>
                          <span className="text-gray-500">
                            ({provider.totalReviews} {provider.totalReviews === 1 ? "review" : "reviews"})
                          </span>
                        </div>
                      )}

                      {provider.completedBookings > 0 && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          <span>{provider.completedBookings} bookings completed</span>
                        </div>
                      )}
                    </div>

                    {/* Categories/Services Tags */}
                    {provider.services && provider.services.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {provider.services.slice(0, 3).map((service: any, index: number) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                          >
                            {service.name}
                          </Badge>
                        ))}
                        {provider.services.length > 3 && (
                          <Badge variant="outline">
                            +{provider.services.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  {provider.hourlyRate && (
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">
                        ${Number(provider.hourlyRate).toFixed(0)}
                        <span className="text-lg font-normal text-gray-600">/hr</span>
                      </div>
                      <p className="text-sm text-gray-500">Starting rate</p>
                    </div>
                  )}
                </div>

                {/* Bio */}
                {provider.bio && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-gray-700 leading-relaxed line-clamp-3 md:line-clamp-none">
                      {provider.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (Mobile) */}
            <div className="mt-6 pt-6 border-t md:hidden">
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Book Now
                </Button>
                <Button size="lg" variant="outline">
                  Contact
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 mt-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/providers">Providers</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{provider.displayName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}