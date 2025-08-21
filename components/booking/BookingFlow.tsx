"use client";

import { useState } from "react";
import { format, addMinutes, parse } from "date-fns";
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  CheckCircle, 
  ChevronRight, 
  ChevronLeft,
  ShieldCheck,
  Lock,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { BookingCalendar } from "./BookingCalendar";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { BookingSummary } from "./BookingSummary";
import { StripeWrapper } from "@/components/payment/StripeWrapper";
import { createBookingAction } from "@/actions/bookings-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

interface BookingFlowProps {
  provider: {
    id: string;
    displayName: string;
    profileImageUrl?: string;
    services?: Array<{
      name: string;
      description: string;
      price: number;
      duration: number;
    }>;
    commissionRate?: number;
    currency?: string;
  };
  selectedService?: {
    name: string;
    description: string;
    price: number;
    duration: number;
  };
  onServiceSelect?: (service: any) => void;
}

type BookingStep = "service" | "date" | "time" | "confirm" | "payment";

export function BookingFlow({ 
  provider, 
  selectedService: initialService,
  onServiceSelect 
}: BookingFlowProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  
  // Booking state
  const [currentStep, setCurrentStep] = useState<BookingStep>(
    initialService ? "date" : "service"
  );
  const [selectedService, setSelectedService] = useState(initialService);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | undefined>();
  const [customerNotes, setCustomerNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  // Calculate step progress
  const steps: BookingStep[] = selectedService 
    ? ["date", "time", "confirm", "payment"]
    : ["service", "date", "time", "confirm", "payment"];
    
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Step configuration
  const stepConfig = {
    service: {
      title: "Select Service",
      icon: <CheckCircle className="h-5 w-5" />,
      description: "Choose the service you need",
    },
    date: {
      title: "Choose Date",
      icon: <Calendar className="h-5 w-5" />,
      description: "Pick your preferred date",
    },
    time: {
      title: "Select Time",
      icon: <Clock className="h-5 w-5" />,
      description: "Choose an available time slot",
    },
    confirm: {
      title: "Review & Confirm",
      icon: <CheckCircle className="h-5 w-5" />,
      description: "Review your booking details",
    },
    payment: {
      title: "Payment",
      icon: <CreditCard className="h-5 w-5" />,
      description: "Complete your booking",
    },
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    if (onServiceSelect) {
      onServiceSelect(service);
    }
    handleNext();
  };

  const handleNext = () => {
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1]);
    }
  };

  const handleBack = () => {
    const stepIndex = steps.indexOf(currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case "service":
        return !!selectedService;
      case "date":
        return !!selectedDate;
      case "time":
        return !!selectedTime;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  const handleCreateBooking = async () => {
    if (!isSignedIn) {
      toast.error("Please sign in to complete your booking");
      router.push("/login");
      return;
    }

    if (!selectedService || !selectedDate || !selectedTime) {
      setBookingError("Please complete all booking details");
      return;
    }

    setIsBooking(true);
    setBookingError(null);

    try {
      // Calculate end time
      const startTime = selectedTime;
      const endTime = format(
        addMinutes(
          parse(selectedTime, "HH:mm", new Date()),
          selectedService.duration
        ),
        "HH:mm"
      );

      const result = await createBookingAction({
        providerId: provider.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        serviceDuration: selectedService.duration,
        bookingDate: selectedDate,
        startTime,
        endTime,
        customerNotes: customerNotes || undefined,
      });

      if (result.isSuccess && result.data) {
        toast.success("Booking created! Proceeding to payment...");
        setCreatedBookingId(result.data.id);
        handleNext(); // Move to payment step
      } else {
        setBookingError(result.message || "Failed to create booking");
        toast.error(result.message || "Failed to create booking");
      }
    } catch (error) {
      console.error("Booking error:", error);
      setBookingError("An unexpected error occurred");
      toast.error("Failed to create booking");
    } finally {
      setIsBooking(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success("Payment successful! Your booking is confirmed.");
    router.push("/dashboard/customer/bookings?payment=success");
  };

  const handlePaymentError = (error: string) => {
    setBookingError(error);
    console.error("Payment error:", error);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
          <span className="text-gray-500">
            {stepConfig[currentStep].title}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Header */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            {stepConfig[currentStep].icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {stepConfig[currentStep].title}
            </h3>
            <p className="text-sm text-gray-600">
              {stepConfig[currentStep].description}
            </p>
          </div>
        </div>
      </Card>

      {/* Step Content */}
      <AnimatePresence mode="wait" custom={currentStepIndex}>
        <motion.div
          key={currentStep}
          custom={currentStepIndex}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {/* Service Selection */}
          {currentStep === "service" && provider.services && (
            <Card className="p-6">
              <h4 className="font-semibold mb-4">Available Services</h4>
              <div className="space-y-3">
                {provider.services.map((service) => (
                  <button
                    key={service.name}
                    onClick={() => handleServiceSelect(service)}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      "hover:border-blue-300 hover:bg-blue-50",
                      selectedService?.name === service.name
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">
                          {service.name}
                        </h5>
                        <p className="text-sm text-gray-600 mt-1">
                          {service.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {service.duration} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-semibold text-blue-600">
                          ${service.price}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Date Selection */}
          {currentStep === "date" && (
            <BookingCalendar
              providerId={provider.id}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedService={selectedService}
            />
          )}

          {/* Time Selection */}
          {currentStep === "time" && (
            <TimeSlotPicker
              providerId={provider.id}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
              serviceDuration={selectedService?.duration}
            />
          )}

          {/* Confirmation */}
          {currentStep === "confirm" && selectedService && selectedDate && selectedTime && (
            <div className="space-y-4">
              <BookingSummary
                provider={provider}
                service={selectedService}
                date={selectedDate}
                time={selectedTime}
                customerNotes={customerNotes}
              />
              
              {/* Customer Notes */}
              <Card className="p-6">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Additional Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requirements or notes for the provider..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </Card>

              {/* Trust Signals */}
              <div className="flex items-center justify-center gap-6 py-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <span>Secure Booking</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Lock className="h-4 w-4 text-green-600" />
                  <span>Safe Payment</span>
                </div>
              </div>

              {bookingError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{bookingError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Payment Step */}
          {currentStep === "payment" && createdBookingId && selectedService && (
            <div className="space-y-4">
              <StripeWrapper
                bookingId={createdBookingId}
                booking={{
                  id: createdBookingId,
                  serviceName: selectedService.name,
                  totalAmount: selectedService.price.toString(),
                  providerName: provider.displayName,
                }}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {currentStepIndex > 0 && currentStep !== "payment" && (
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isBooking}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        )}
        
        {currentStep === "confirm" ? (
          <Button
            onClick={handleCreateBooking}
            disabled={isBooking}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {isBooking ? (
              <>Processing...</>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Proceed to Payment
              </>
            )}
          </Button>
        ) : currentStep === "payment" ? (
          // Payment step - no navigation buttons, handled by Stripe form
          null
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed() || isBooking}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}