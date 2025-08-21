"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Star, 
  Calendar, 
  Award, 
  Clock, 
  DollarSign,
  Check,
  Shield,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ProviderHeroSection } from "./provider-hero-section";
import { ProviderGallery } from "./provider-gallery";
import { ProviderServices } from "./provider-services";
import { ProviderTestimonials } from "./provider-testimonials";
import { ProviderReviews } from "./provider-reviews";
import { ProviderAvailability } from "./provider-availability";
import { BookingModal } from "./booking-modal";

interface ProviderProfileClientProps {
  provider: any; // Will type this properly based on actual data structure
}

export function ProviderProfileClient({ provider }: ProviderProfileClientProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  const handleBookService = (service?: any) => {
    setSelectedService(service || null);
    setIsBookingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <ProviderHeroSection 
        provider={provider} 
        onBookNow={() => handleBookService()}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 lg:p-8">
                <h2 className="text-2xl font-bold mb-4">About</h2>
                <div 
                  className="prose prose-gray max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: provider.bio || "No description available." 
                  }}
                />
                
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                  {provider.yearsExperience && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {provider.yearsExperience}
                      </div>
                      <div className="text-sm text-gray-600">Years Experience</div>
                    </div>
                  )}
                  {provider.completedBookings > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {provider.completedBookings}
                      </div>
                      <div className="text-sm text-gray-600">Completed Bookings</div>
                    </div>
                  )}
                  {provider.averageRating > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1">
                        {Number(provider.averageRating).toFixed(1)}
                        <Star className="h-5 w-5 fill-current" />
                      </div>
                      <div className="text-sm text-gray-600">Average Rating</div>
                    </div>
                  )}
                  {provider.totalReviews > 0 && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {provider.totalReviews}
                      </div>
                      <div className="text-sm text-gray-600">Reviews</div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Services Section */}
            {provider.services && provider.services.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <ProviderServices 
                  services={provider.services}
                  currency={provider.currency}
                  onBookService={handleBookService}
                />
              </motion.div>
            )}

            {/* Gallery Section */}
            {provider.galleryImages && provider.galleryImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <ProviderGallery images={provider.galleryImages} />
              </motion.div>
            )}

            {/* Testimonials Section */}
            {provider.testimonials && provider.testimonials.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <ProviderTestimonials testimonials={provider.testimonials} />
              </motion.div>
            )}

            {/* Reviews Section */}
            {provider.reviews && provider.reviews.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <ProviderReviews 
                  reviews={provider.reviews}
                  averageRating={provider.averageRating}
                  totalReviews={provider.totalReviews}
                />
              </motion.div>
            )}
          </div>

          {/* Right Column - Booking & Info */}
          <div className="space-y-6">
            {/* Sticky Booking Card */}
            <div className="lg:sticky lg:top-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-6">
                  <div className="space-y-4">
                    {/* Price Display */}
                    {provider.hourlyRate && (
                      <div>
                        <div className="text-3xl font-bold">
                          ${Number(provider.hourlyRate).toFixed(0)}
                          <span className="text-lg font-normal text-gray-600">/hour</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Starting price</p>
                      </div>
                    )}

                    {/* Quick Info */}
                    <div className="space-y-3 py-4 border-y">
                      {provider.locationCity && (
                        <div className="flex items-center gap-3 text-sm">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>
                            {provider.locationCity}
                            {provider.locationState && `, ${provider.locationState}`}
                          </span>
                        </div>
                      )}
                      
                      {provider.averageRating > 0 && (
                        <div className="flex items-center gap-3 text-sm">
                          <Star className="h-4 w-4 text-gray-400" />
                          <span>
                            {Number(provider.averageRating).toFixed(1)} rating 
                            ({provider.totalReviews} reviews)
                          </span>
                        </div>
                      )}

                      {provider.isVerified && (
                        <div className="flex items-center gap-3 text-sm">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-600 font-medium">
                            Verified Provider
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Book Now Button */}
                    <Button 
                      size="lg" 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleBookService()}
                    >
                      Book Now
                    </Button>

                    {/* Response Time */}
                    <p className="text-center text-sm text-gray-500">
                      Usually responds within 2 hours
                    </p>
                  </div>
                </Card>
              </motion.div>

              {/* Availability Preview */}
              {provider.availability && provider.availability.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6"
                >
                  <ProviderAvailability availability={provider.availability} />
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Book Now Button (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t lg:hidden z-40">
        <div className="flex items-center justify-between mb-2">
          {provider.hourlyRate && (
            <div>
              <div className="text-2xl font-bold">
                ${Number(provider.hourlyRate).toFixed(0)}
                <span className="text-sm font-normal text-gray-600">/hour</span>
              </div>
            </div>
          )}
          {provider.averageRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{Number(provider.averageRating).toFixed(1)}</span>
            </div>
          )}
        </div>
        <Button 
          size="lg" 
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={() => handleBookService()}
        >
          Book Now
        </Button>
      </div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setSelectedService(null);
        }}
        provider={provider}
        selectedService={selectedService}
      />
    </div>
  );
}