"use client";

import React, { useEffect } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Calendar, AlertCircle, ArrowLeft, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

interface BookingErrorBoundaryProps {
  children: React.ReactNode;
  bookingData?: {
    providerId?: string;
    serviceId?: string;
    date?: string;
    time?: string;
  };
  onError?: (error: Error) => void;
}

/**
 * Specialized error boundary for booking flow
 */
export function BookingErrorBoundary({ 
  children, 
  bookingData,
  onError
}: BookingErrorBoundaryProps) {
  const router = useRouter();

  const handleBookingError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Save booking state for recovery
    if (bookingData) {
      try {
        sessionStorage.setItem("booking_recovery", JSON.stringify({
          ...bookingData,
          timestamp: Date.now(),
          error: error.message,
        }));
      } catch (e) {
        console.error("Failed to save booking recovery data:", e);
      }
    }

    // Report to Sentry with booking context
    Sentry.withScope((scope) => {
      scope.setContext("booking", bookingData || {});
      scope.setLevel("error");
      Sentry.captureException(error);
    });

    if (onError) {
      onError(error);
    }
  };

  const attemptRecovery = () => {
    try {
      const recoveryData = sessionStorage.getItem("booking_recovery");
      if (recoveryData) {
        const data = JSON.parse(recoveryData);
        // Redirect to booking with recovery data
        const params = new URLSearchParams(data);
        router.push(`/marketplace?recover=true&${params.toString()}`);
      } else {
        window.location.reload();
      }
    } catch (e) {
      window.location.reload();
    }
  };

  const bookingErrorFallback = (
    <div className="min-h-[600px] flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
            <Calendar className="h-8 w-8 text-amber-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900">
            Booking System Temporarily Unavailable
          </h2>
          <p className="text-gray-600">
            We&apos;re having trouble processing your booking right now. Don&apos;t worry - your selection has been saved and no payment has been processed.
          </p>
        </div>

        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">What happens next?</AlertTitle>
          <AlertDescription className="mt-2 text-amber-800 space-y-2">
            <p>Your booking information has been temporarily saved. You can:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Try again to complete your booking</li>
              <li>Contact the provider directly</li>
              <li>Call our support team for assistance</li>
            </ul>
          </AlertDescription>
        </Alert>

        {bookingData && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-gray-900">Your Selection:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              {bookingData.date && (
                <p>Date: <span className="font-medium">{bookingData.date}</span></p>
              )}
              {bookingData.time && (
                <p>Time: <span className="font-medium">{bookingData.time}</span></p>
              )}
              {bookingData.serviceId && (
                <p>Service ID: <code className="bg-gray-100 px-1 rounded">{bookingData.serviceId}</code></p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={attemptRecovery}
            variant="default"
            className="flex-1"
          >
            <Calendar className="mr-2 h-4 w-4" />
            Retry Booking
          </Button>
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-900">Need immediate help?</p>
          <div className="space-y-2">
            <a
              href="tel:+1-800-ECOSYS"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
            >
              <Phone className="h-4 w-4" />
              <span>Call: 1-800-ECOSYS</span>
            </a>
            <a
              href="mailto:bookings@ecosystem-platform.com"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
            >
              <Mail className="h-4 w-4" />
              <span>Email: bookings@ecosystem-platform.com</span>
            </a>
          </div>
          <p className="text-xs text-gray-500">
            Reference: BOOK_{Date.now().toString(36).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      fallback={bookingErrorFallback}
      onError={handleBookingError}
      resetKeys={[bookingData?.providerId || '', bookingData?.date || '']}
      enableAutoRetry={true}
      maxRetries={3}
      retryDelay={2000}
    >
      {children}
    </ErrorBoundary>
  );
}