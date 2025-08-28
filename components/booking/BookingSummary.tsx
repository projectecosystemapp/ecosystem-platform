"use client";

import { format, addMinutes, parse } from "date-fns";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  User, 
  MapPin, 
  Star,
  Info,
  Shield,
  CreditCard
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { VerificationBadgeGroup, useProviderVerificationBadges } from "@/components/ui/verification-badge";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { FeeBreakdown } from "./FeeBreakdown";
import { useAuth } from "@clerk/nextjs";

interface BookingSummaryProps {
  provider: {
    id: string;
    displayName: string;
    profileImageUrl?: string;
    location?: string;
    rating?: number;
    reviewCount?: number;
    isVerified?: boolean;
    stripeOnboardingComplete?: boolean;
    hasInsurance?: boolean;
    completedBookings?: number;
    currency?: string;
  };
  service: {
    name: string;
    description?: string;
    price: number;
    duration: number;
  };
  date: Date;
  time: string;
  customerNotes?: string;
  showPriceBreakdown?: boolean;
}

export function BookingSummary({
  provider,
  service,
  date,
  time,
  customerNotes,
  showPriceBreakdown = true,
}: BookingSummaryProps) {
  const { isSignedIn } = useAuth();
  
  const verificationBadges = useProviderVerificationBadges({
    isVerified: provider.isVerified,
    stripeOnboardingComplete: provider.stripeOnboardingComplete,
    hasInsurance: provider.hasInsurance,
    averageRating: provider.rating,
    completedBookings: provider.completedBookings,
  });

  // Format display values
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const endTime = format(
    addMinutes(parse(time, "HH:mm", new Date()), service.duration),
    "HH:mm"
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: provider.currency?.toUpperCase() || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate fees - Fixed 10% platform fee per constitution
  const platformFeeRate = 0.10; // Always 10% platform fee
  const platformFee = service.price * platformFeeRate;
  const subtotal = service.price;
  const total = subtotal; // Customer pays full amount

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    },
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Main Summary Card */}
      <Card className="overflow-hidden">
        {/* Header with Provider Info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
              <AvatarImage src={provider.profileImageUrl} alt={provider.displayName} />
              <AvatarFallback className="bg-blue-600 text-white">
                {provider.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">
                  {provider.displayName}
                </h3>
                <VerificationBadgeGroup 
                  verifications={verificationBadges}
                  size="xs"
                  maxDisplay={3}
                />
              </div>
              {provider.location && (
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {provider.location}
                </p>
              )}
              {provider.rating && provider.reviewCount && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{provider.rating}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    ({provider.reviewCount} reviews)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="p-6 space-y-4">
          {/* Service */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4" />
              Service Details
            </div>
            <div className="pl-6">
              <p className="font-medium text-gray-900">{service.name}</p>
              {service.description && (
                <p className="text-sm text-gray-600 mt-1">{service.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {service.duration} minutes
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <DollarSign className="h-3 w-3 mr-1" />
                  {formatCurrency(service.price)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar className="h-4 w-4" />
              Appointment Details
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Date:</span>
                <span className="font-medium">
                  {format(date, "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Time:</span>
                <span className="font-medium">
                  {formatTime(time)} - {formatTime(endTime)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duration:</span>
                <span className="font-medium">{service.duration} minutes</span>
              </div>
            </div>
          </div>

          {/* Customer Notes */}
          {customerNotes && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Info className="h-4 w-4" />
                  Additional Notes
                </div>
                <div className="pl-6">
                  <p className="text-sm text-gray-600 italic">&ldquo;{customerNotes}&rdquo;</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Price Breakdown with Transparent Fee Display */}
      {showPriceBreakdown && (
        <FeeBreakdown 
          servicePrice={service.price * 100} // Convert to cents for proper display
          isAuthenticated={isSignedIn || false}
        />
      )}

      {/* Payment Security Notice */}
      <Alert className="bg-blue-50 border-blue-200">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm text-blue-800">
          Your payment is secure and protected. You&apos;ll be charged only after 
          confirming your booking.
        </AlertDescription>
      </Alert>

      {/* Cancellation Policy */}
      <Card className="p-4 bg-gray-50 border-gray-200">
        <div className="flex gap-3">
          <Info className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Cancellation Policy</p>
            <p>
              Free cancellation up to 24 hours before your appointment. 
              Cancellations within 24 hours may incur a fee.
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}