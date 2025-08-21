"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, Star, Shield, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProviderHeroSectionProps {
  provider: any;
  onBookNow: () => void;
}

export function ProviderHeroSection({ provider, onBookNow }: ProviderHeroSectionProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative">
      {/* Cover Image */}
      <div className="relative h-64 sm:h-80 lg:h-96 bg-gradient-to-br from-blue-600 to-blue-800">
        {provider.coverImageUrl ? (
          <Image
            src={provider.coverImageUrl}
            alt={`${provider.displayName} cover`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800">
            <div className="absolute inset-0 bg-black/20" />
            <motion.div
              className="absolute inset-0 opacity-10"
              initial={{ backgroundPosition: "0% 0%" }}
              animate={{ backgroundPosition: "100% 100%" }}
              transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />
          </div>
        )}
        
        {/* Overlay gradient for better text visibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
      </div>

      {/* Profile Info Container */}
      <div className="relative">
        <div className="container mx-auto px-4">
          <div className="relative -mt-20 sm:-mt-24 lg:-mt-28">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-xl p-6 lg:p-8"
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Profile Image */}
                <div className="relative">
                  <Avatar className="h-32 w-32 lg:h-40 lg:w-40 border-4 border-white shadow-lg">
                    <AvatarImage
                      src={provider.profileImageUrl}
                      alt={provider.displayName}
                    />
                    <AvatarFallback className="text-2xl lg:text-3xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                      {getInitials(provider.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  {provider.isVerified && (
                    <div className="absolute bottom-2 right-2 bg-blue-600 rounded-full p-2 shadow-lg">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Provider Info */}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                          {provider.displayName}
                        </h1>
                        {provider.tagline && (
                          <p className="text-lg text-gray-600 mt-1">
                            {provider.tagline}
                          </p>
                        )}
                      </div>
                      
                      {/* Desktop Book Button */}
                      <div className="hidden sm:block">
                        <Button
                          size="lg"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={onBookNow}
                        >
                          Book Now
                        </Button>
                      </div>
                    </div>

                    {/* Location & Rating */}
                    <div className="flex flex-wrap items-center gap-4 mt-4">
                      {provider.locationCity && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {provider.locationCity}
                            {provider.locationState && `, ${provider.locationState}`}
                          </span>
                        </div>
                      )}
                      
                      {provider.averageRating > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < Math.floor(provider.averageRating)
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="font-medium">
                            {Number(provider.averageRating).toFixed(1)}
                          </span>
                          <span className="text-gray-500">
                            ({provider.totalReviews} reviews)
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {provider.isVerified && (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                          <Shield className="h-3 w-3 mr-1" />
                          Verified Provider
                        </Badge>
                      )}
                      {provider.yearsExperience && provider.yearsExperience >= 5 && (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                          <Award className="h-3 w-3 mr-1" />
                          {provider.yearsExperience}+ Years Experience
                        </Badge>
                      )}
                      {provider.completedBookings >= 100 && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          100+ Completed Bookings
                        </Badge>
                      )}
                      {provider.stripeOnboardingComplete && (
                        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                          Secure Payments
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Mobile Book Button */}
                  <div className="sm:hidden">
                    <Button
                      size="lg"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={onBookNow}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}