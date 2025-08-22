"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  DollarSign,
  Shield,
  Star,
  MessageCircle,
  Phone,
  CheckCircle,
  Info,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import ContactModal from "./ContactModal";
import { BookingModal } from "@/components/provider/booking-modal";

interface BookingCTAProps {
  provider: any;
}

export default function BookingCTA({ provider }: BookingCTAProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Calculate platform fees
  const platformFeePercent = 10; // 10% base fee
  const guestSurchargePercent = 10; // Additional 10% for guests
  
  const formatPrice = (price: number) => {
    const currencySymbol = provider.currency === "usd" ? "$" : provider.currency.toUpperCase();
    return `${currencySymbol}${price.toFixed(0)}`;
  };

  const features = [
    {
      icon: Shield,
      text: "Secure Payment",
      description: "Protected by Ecosystem guarantee",
    },
    {
      icon: Clock,
      text: "Instant Booking",
      description: "Confirm your appointment immediately",
    },
    {
      icon: CheckCircle,
      text: "Free Cancellation",
      description: "Cancel up to 24 hours before",
    },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="overflow-hidden shadow-xl">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold">Book with Confidence</h3>
              {provider.isVerified && (
                <Badge className="bg-white/20 text-white border-white/30">
                  <Shield className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            
            {/* Price Display */}
            {provider.hourlyRate && (
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    {formatPrice(Number(provider.hourlyRate))}
                  </span>
                  <span className="text-lg opacity-90">/hour</span>
                </div>
                <p className="text-sm opacity-80 mt-1">Starting rate • Varies by service</p>
              </div>
            )}

            {/* Rating Summary */}
            {provider.averageRating > 0 && (
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-5 w-5",
                        i < Math.floor(provider.averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-white/30 text-white/30"
                      )}
                    />
                  ))}
                </div>
                <span className="font-medium">
                  {Number(provider.averageRating).toFixed(1)}
                </span>
                <span className="opacity-80">
                  ({provider.totalReviews} reviews)
                </span>
              </div>
            )}
          </div>

          <CardContent className="p-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {provider.completedBookings || 0}
                </div>
                <div className="text-xs text-gray-600">Bookings Completed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {provider.yearsExperience || 0}
                </div>
                <div className="text-xs text-gray-600">Years Experience</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 group"
                onClick={() => setIsBookingModalOpen(true)}
              >
                Book Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => setIsContactModalOpen(true)}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Contact Provider
              </Button>
            </div>

            {/* Response Time */}
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Usually responds within 2 hours
                </span>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Trust Features */}
            <div className="space-y-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {feature.text}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <Separator className="my-6" />

            {/* Fee Information */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Service Fee</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 cursor-help">
                        <span className="font-medium">{platformFeePercent}%</span>
                        <Info className="h-3 w-3 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Platform fee helps us maintain quality service and provide customer support
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <p className="text-xs text-gray-500">
                Guest checkout adds {guestSurchargePercent}% surcharge. 
                <button className="text-blue-600 hover:underline ml-1">
                  Sign up to save
                </button>
              </p>
            </div>

            {/* Money Back Guarantee */}
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900 text-sm">
                    100% Satisfaction Guarantee
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    If you're not satisfied with the service, we'll work with you to make it right
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg lg:hidden z-40">
          <div className="flex items-center justify-between mb-3">
            <div>
              {provider.hourlyRate && (
                <div className="text-2xl font-bold">
                  {formatPrice(Number(provider.hourlyRate))}
                  <span className="text-sm font-normal text-gray-600">/hour</span>
                </div>
              )}
            </div>
            {provider.averageRating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">
                  {Number(provider.averageRating).toFixed(1)}
                </span>
              </div>
            )}
          </div>
          <Button 
            size="lg" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsBookingModalOpen(true)}
          >
            Book Now
          </Button>
        </div>
      </motion.div>

      {/* Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        provider={provider}
        selectedService={null}
      />

      {/* Contact Modal */}
      <ContactModal
        provider={provider}
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />
    </>
  );
}