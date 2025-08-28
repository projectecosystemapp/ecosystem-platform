"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle, 
  UserPlus, 
  Ticket, 
  Home, 
  Package,
  Shield,
  Sparkles,
  Info,
  MapPin
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

// Fee calculation
import { calculateFees, formatCurrency } from "@/lib/fees";

// Booking forms for different types
import { ServiceBookingForm } from "./forms/ServiceBookingForm";
import { EventBookingForm } from "./forms/EventBookingForm";
import { SpaceBookingForm } from "./forms/SpaceBookingForm";
import { ThingPurchaseForm } from "./forms/ThingPurchaseForm";

// Shared components
import { GuestInfoForm } from "@/components/booking/GuestInfoForm";
import { FeeBreakdown } from "@/components/booking/FeeBreakdown";
import { StripeWrapper } from "@/components/payment/StripeWrapper";
import { useGuestCheckoutStore } from "@/lib/stores/guest-checkout-store";

export type BookingType = "service" | "event" | "space" | "thing";

export interface UnifiedBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingType: BookingType;
  item: {
    id: string;
    providerId?: string;
    name: string;
    description?: string;
    price: number;
    images?: string[];
    
    // Service specific
    duration?: number; // minutes
    providerName?: string;
    providerImage?: string;
    
    // Event specific
    startDateTime?: Date;
    endDateTime?: Date;
    location?: string;
    locationType?: "in_person" | "virtual" | "hybrid";
    availableSpots?: number;
    maxAttendees?: number;
    
    // Space specific
    capacity?: number;
    amenities?: string[];
    address?: string;
    squareFeet?: number;
    hourlyRate?: number;
    dailyRate?: number;
    weeklyRate?: number;
    
    // Thing specific
    condition?: string;
    sellerId?: string;
    sellerName?: string;
    shippingAvailable?: boolean;
    localPickup?: boolean;
    acceptsOffers?: boolean;
    minOfferAmount?: number;
  };
  onSuccess?: (bookingId: string) => void;
}

type BookingStep = "details" | "guest" | "review" | "payment" | "confirmation";

interface BookingFormData {
  // Common fields
  baseAmount: number;
  notes?: string;
  
  // Service specific
  selectedDate?: Date;
  selectedTime?: string;
  serviceDuration?: number;
  
  // Event specific
  numberOfTickets?: number;
  attendeeInfo?: Array<{ name: string; email: string }>;
  
  // Space specific
  checkInDate?: Date;
  checkOutDate?: Date;
  rentalPeriod?: "hourly" | "daily" | "weekly";
  rentalDuration?: number;
  purpose?: string;
  
  // Thing specific
  offerAmount?: number;
  purchaseType?: "buy_now" | "make_offer";
  deliveryMethod?: "shipping" | "pickup";
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export function UnifiedBookingModal({ 
  open, 
  onOpenChange, 
  bookingType, 
  item, 
  onSuccess 
}: UnifiedBookingModalProps) {
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const { isGuestCheckout, guestInfo, resetGuestCheckout } = useGuestCheckoutStore();
  
  // State management
  const [currentStep, setCurrentStep] = useState<BookingStep>("details");
  const [formData, setFormData] = useState<BookingFormData>({
    baseAmount: item.price || 0,
  });
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate fees based on authentication status
  const fees = useMemo(() => {
    const amount = formData.offerAmount || formData.baseAmount;
    return calculateFees(amount, !isSignedIn);
  }, [formData.baseAmount, formData.offerAmount, isSignedIn]);

  // Determine steps based on auth status
  const steps: BookingStep[] = useMemo(() => {
    const baseSteps: BookingStep[] = ["details"];
    if (!isSignedIn) baseSteps.push("guest");
    baseSteps.push("review", "payment", "confirmation");
    return baseSteps;
  }, [isSignedIn]);

  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Step configuration with icons
  const stepConfig = {
    details: {
      title: bookingType === "service" ? "Select Date & Time" :
             bookingType === "event" ? "Ticket Selection" :
             bookingType === "space" ? "Rental Details" :
             "Purchase Options",
      icon: bookingType === "service" ? <Calendar className="h-5 w-5" /> :
            bookingType === "event" ? <Ticket className="h-5 w-5" /> :
            bookingType === "space" ? <Home className="h-5 w-5" /> :
            <Package className="h-5 w-5" />,
      description: bookingType === "service" ? "Choose your preferred appointment slot" :
                  bookingType === "event" ? "Select number of tickets" :
                  bookingType === "space" ? "Choose rental duration" :
                  "Select purchase or make an offer"
    },
    guest: {
      title: "Contact Information",
      icon: <UserPlus className="h-5 w-5" />,
      description: "Provide your contact details"
    },
    review: {
      title: "Review & Confirm",
      icon: <Shield className="h-5 w-5" />,
      description: "Review your booking details"
    },
    payment: {
      title: "Payment",
      icon: <CreditCard className="h-5 w-5" />,
      description: "Complete your booking"
    },
    confirmation: {
      title: "Confirmation",
      icon: <Sparkles className="h-5 w-5" />,
      description: "Booking confirmed!"
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentStep("details");
      setFormData({ baseAmount: item.price || 0 });
      setBookingId(null);
      setError(null);
      resetGuestCheckout();
    }
  }, [open, item.price, resetGuestCheckout]);

  // Navigation handlers
  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "details":
        if (bookingType === "service") {
          return !!(formData.selectedDate && formData.selectedTime);
        }
        if (bookingType === "event") {
          return !!formData.numberOfTickets && formData.numberOfTickets > 0;
        }
        if (bookingType === "space") {
          return !!(formData.checkInDate && formData.checkOutDate && formData.rentalPeriod);
        }
        if (bookingType === "thing") {
          return !!(formData.purchaseType && 
                   (formData.purchaseType === "buy_now" || formData.offerAmount) &&
                   formData.deliveryMethod);
        }
        return false;
      case "guest":
        return isGuestCheckout && !!guestInfo;
      case "review":
        return true;
      default:
        return false;
    }
  };

  // Create booking handler
  const handleCreateBooking = async () => {
    if (!isSignedIn && !isGuestCheckout) {
      setCurrentStep("guest");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Determine API endpoint based on booking type
      const endpoint = bookingType === "service" ? "/api/bookings/customer" :
                      bookingType === "event" ? "/api/events/bookings" :
                      bookingType === "space" ? "/api/spaces/bookings" :
                      "/api/things/purchase";

      const isGuest = !isSignedIn;
      const finalEndpoint = isGuest ? endpoint.replace("/customer", "/guest") : endpoint;

      // Prepare request body based on booking type
      let requestBody: any = {
        itemId: item.id,
        notes: formData.notes,
        guestInfo: isGuest ? guestInfo : undefined,
      };

      // Add type-specific fields
      if (bookingType === "service") {
        requestBody = {
          ...requestBody,
          providerId: item.providerId,
          serviceName: item.name,
          servicePrice: item.price,
          serviceDuration: item.duration,
          bookingDate: formData.selectedDate?.toISOString(),
          startTime: formData.selectedTime,
        };
      } else if (bookingType === "event") {
        requestBody = {
          ...requestBody,
          eventId: item.id,
          numberOfTickets: formData.numberOfTickets,
          attendeeInfo: formData.attendeeInfo,
        };
      } else if (bookingType === "space") {
        requestBody = {
          ...requestBody,
          spaceId: item.id,
          checkInDate: formData.checkInDate?.toISOString(),
          checkOutDate: formData.checkOutDate?.toISOString(),
          rentalPeriod: formData.rentalPeriod,
          rentalDuration: formData.rentalDuration,
          purpose: formData.purpose,
        };
      } else if (bookingType === "thing") {
        requestBody = {
          ...requestBody,
          thingId: item.id,
          purchaseType: formData.purchaseType,
          offerAmount: formData.offerAmount,
          deliveryMethod: formData.deliveryMethod,
          shippingAddress: formData.deliveryMethod === "shipping" ? formData.shippingAddress : undefined,
        };
      }

      const response = await fetch(finalEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (response.ok && result.booking) {
        setBookingId(result.booking.id);
        
        // Show appropriate message
        const message = isGuest 
          ? `Booking created! (10% guest surcharge applied)` 
          : "Booking created! Proceeding to payment...";
        toast.success(message);
        
        handleNext(); // Move to payment step
      } else {
        throw new Error(result.error || "Failed to create booking");
      }
    } catch (err) {
      console.error("Booking error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      toast.error(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setIsProcessing(false);
    }
  };

  // Payment success handler
  const handlePaymentSuccess = () => {
    setCurrentStep("confirmation");
    toast.success("Payment successful! Your booking is confirmed.");
    
    // Call success callback if provided
    if (onSuccess && bookingId) {
      onSuccess(bookingId);
    }
    
    // Redirect after delay
    setTimeout(() => {
      onOpenChange(false);
      router.push(isSignedIn ? "/dashboard/customer/bookings" : "/bookings/confirmation");
    }, 3000);
  };

  // Payment error handler
  const handlePaymentError = (error: string) => {
    setError(error);
    console.error("Payment error:", error);
    toast.error(error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stepConfig[currentStep].icon}
            {stepConfig[currentStep].title}
          </DialogTitle>
          <DialogDescription>
            {stepConfig[currentStep].description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-muted-foreground">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Guest surcharge notice */}
        {!isSignedIn && currentStep === "details" && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Guest Checkout:</strong> A 10% guest surcharge will be applied. 
              <Button 
                variant="link" 
                className="px-1 h-auto font-medium"
                onClick={() => router.push("/sign-in")}
              >
                Sign in
              </Button> 
              to avoid this fee.
            </AlertDescription>
          </Alert>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            {/* Details step - booking type specific forms */}
            {currentStep === "details" && (
              <>
                {bookingType === "service" && (
                  <ServiceBookingForm
                    provider={{
                      id: item.providerId || "",
                      displayName: item.providerName || "",
                      profileImageUrl: item.providerImage,
                    }}
                    service={{
                      name: item.name,
                      description: item.description || "",
                      price: item.price,
                      duration: item.duration || 60,
                    }}
                    formData={formData}
                    onUpdate={setFormData}
                  />
                )}
                
                {bookingType === "event" && (
                  <EventBookingForm
                    event={{
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      price: item.price,
                      startDateTime: item.startDateTime,
                      endDateTime: item.endDateTime,
                      location: item.location,
                      locationType: item.locationType,
                      availableSpots: item.availableSpots,
                      maxAttendees: item.maxAttendees,
                    }}
                    formData={formData}
                    onUpdate={setFormData}
                  />
                )}
                
                {bookingType === "space" && (
                  <SpaceBookingForm
                    space={{
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      address: item.address,
                      capacity: item.capacity,
                      amenities: item.amenities,
                      squareFeet: item.squareFeet,
                      hourlyRate: item.hourlyRate,
                      dailyRate: item.dailyRate,
                      weeklyRate: item.weeklyRate,
                    }}
                    formData={formData}
                    onUpdate={setFormData}
                  />
                )}
                
                {bookingType === "thing" && (
                  <ThingPurchaseForm
                    thing={{
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      price: item.price,
                      condition: item.condition,
                      sellerName: item.sellerName,
                      shippingAvailable: item.shippingAvailable,
                      localPickup: item.localPickup,
                      acceptsOffers: item.acceptsOffers,
                      minOfferAmount: item.minOfferAmount,
                    }}
                    formData={formData}
                    onUpdate={setFormData}
                  />
                )}
              </>
            )}

            {/* Guest information step */}
            {currentStep === "guest" && (
              <GuestInfoForm 
                onSubmit={() => handleNext()}
              />
            )}

            {/* Review step */}
            {currentStep === "review" && (
              <div className="space-y-6">
                {/* Booking summary */}
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Booking Summary</h3>
                  
                  <div className="space-y-3">
                    {/* Item details */}
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Type-specific details */}
                    {bookingType === "service" && formData.selectedDate && (
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(formData.selectedDate, "EEEE, MMMM d, yyyy")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{formData.selectedTime}</span>
                        </div>
                      </div>
                    )}

                    {bookingType === "event" && (
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-muted-foreground" />
                          <span>{formData.numberOfTickets} ticket(s)</span>
                        </div>
                        {item.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{item.location}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {bookingType === "space" && formData.checkInDate && formData.checkOutDate && (
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {format(formData.checkInDate, "MMM d")} - {format(formData.checkOutDate, "MMM d, yyyy")}
                          </span>
                        </div>
                        <Badge variant="secondary">
                          {formData.rentalPeriod} rental
                        </Badge>
                      </div>
                    )}

                    {bookingType === "thing" && (
                      <div className="text-sm space-y-1">
                        <Badge variant={formData.purchaseType === "buy_now" ? "default" : "secondary"}>
                          {formData.purchaseType === "buy_now" ? "Buy Now" : "Make Offer"}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {formData.deliveryMethod === "shipping" ? "Shipping" : "Local Pickup"}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Additional notes */}
                    {formData.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground">Notes:</p>
                        <p className="text-sm mt-1">{formData.notes}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Fee breakdown */}
                <FeeBreakdown 
                  servicePrice={formData.offerAmount || formData.baseAmount}
                  isAuthenticated={!!isSignedIn}
                />

                {/* Trust signals */}
                <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-green-600" />
                    <span>Safe & Encrypted</span>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Payment step */}
            {currentStep === "payment" && bookingId && (
              <div className="space-y-4">
                <StripeWrapper
                  bookingId={bookingId}
                  booking={{
                    id: bookingId,
                    serviceName: item.name,
                    totalAmount: fees.totalAmount.toString(),
                    providerName: item.providerName || item.sellerName || "Provider",
                  }}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </div>
            )}

            {/* Confirmation step */}
            {currentStep === "confirmation" && (
              <div className="text-center space-y-6 py-8">
                <div className="flex justify-center">
                  <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Booking Confirmed!</h3>
                  <p className="text-muted-foreground mt-2">
                    Your booking has been successfully confirmed. 
                    {!isSignedIn && " Check your email for confirmation details."}
                  </p>
                </div>
                {bookingId && (
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Confirmation Code</p>
                    <p className="font-mono font-semibold text-lg mt-1">{bookingId.slice(0, 8).toUpperCase()}</p>
                  </div>
                )}
                <Button 
                  onClick={() => {
                    onOpenChange(false);
                    router.push(isSignedIn ? "/dashboard/customer/bookings" : "/");
                  }}
                  className="w-full"
                >
                  {isSignedIn ? "View My Bookings" : "Continue Shopping"}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        {currentStep !== "payment" && currentStep !== "confirmation" && (
          <div className="flex gap-3 mt-6">
            {currentStepIndex > 0 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isProcessing}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            
            {currentStep === "review" ? (
              <Button
                onClick={handleCreateBooking}
                disabled={isProcessing || !canProceed()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  "Processing..."
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Proceed to Payment
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed() || isProcessing}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}