"use client";

import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { AlertCircle, CreditCard, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

interface PaymentErrorBoundaryProps {
  children: React.ReactNode;
  onPaymentError?: (error: Error) => void;
}

/**
 * Specialized error boundary for payment-related components
 * Provides payment-specific error messages and recovery options
 */
export function PaymentErrorBoundary({ 
  children, 
  onPaymentError 
}: PaymentErrorBoundaryProps) {
  const router = useRouter();

  const handlePaymentError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log payment errors with additional context
    console.error("Payment Error:", {
      error: error.toString(),
      errorInfo,
      timestamp: new Date().toISOString(),
      // Don't log sensitive payment data
    });

    // Call custom error handler if provided
    if (onPaymentError) {
      onPaymentError(error);
    }

    // Track payment errors for analytics
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "payment_error", {
        error_message: error.message,
        error_type: "component_error",
      });
    }
  };

  const paymentErrorFallback = (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <Alert variant="destructive" className="border-red-200">
          <CreditCard className="h-5 w-5" />
          <AlertTitle className="text-lg">Payment System Error</AlertTitle>
          <AlertDescription className="mt-3 space-y-4">
            <p>
              We encountered an issue with the payment system. Your payment has not
              been processed and you have not been charged.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
              <p className="font-medium text-red-900 mb-1">What happened?</p>
              <ul className="list-disc list-inside text-red-800 space-y-1">
                <li>The payment component failed to load properly</li>
                <li>No charges have been made to your account</li>
                <li>Your payment information is secure</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">What can you do?</h3>
          <div className="grid gap-2">
            <Button
              onClick={() => window.location.reload()}
              variant="default"
              className="w-full"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Try Payment Again
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600">
            If this problem persists, please contact our support team at{" "}
            <a
              href="mailto:support@ecosystem-platform.com"
              className="text-blue-600 hover:underline"
            >
              support@ecosystem-platform.com
            </a>{" "}
            with error code: <code className="bg-gray-100 px-1 rounded">PMT_ERR_001</code>
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="section"
      fallback={paymentErrorFallback}
      onError={handlePaymentError}
      resetKeys={["payment"]}
      resetOnPropsChange={false}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Specialized error boundary for Stripe Elements
 */
export function StripeElementsErrorBoundary({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const stripeErrorFallback = (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Payment Form Error</AlertTitle>
      <AlertDescription className="mt-2">
        <p>
          The payment form could not be loaded. This might be due to:
        </p>
        <ul className="list-disc list-inside mt-2 text-sm">
          <li>Network connectivity issues</li>
          <li>Ad blockers or browser extensions blocking Stripe</li>
          <li>Outdated browser version</li>
        </ul>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          Reload Page
        </Button>
      </AlertDescription>
    </Alert>
  );

  return (
    <ErrorBoundary
      level="component"
      fallback={stripeErrorFallback}
      isolate={true}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for checkout flow
 */
export function CheckoutErrorBoundary({ 
  children,
  bookingId
}: { 
  children: React.ReactNode;
  bookingId?: string;
}) {
  const router = useRouter();

  const handleCheckoutError = (error: Error) => {
    // Save checkout state to localStorage for recovery
    if (bookingId) {
      localStorage.setItem("failed_checkout_booking", bookingId);
    }
  };

  const checkoutErrorFallback = (
    <div className="container max-w-2xl mx-auto py-12 px-4">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              Checkout Unavailable
            </h2>
            <p className="text-gray-600">
              We&apos;re having trouble processing your checkout. Don&apos;t worry - no payment
              has been made.
            </p>
          </div>

          {bookingId && (
            <Alert className="text-left">
              <AlertTitle>Booking Information Saved</AlertTitle>
              <AlertDescription>
                Your booking selection has been saved. You can retry the checkout or
                contact support with booking reference: <code>{bookingId}</code>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => {
                // Attempt to recover from saved state
                const savedBooking = localStorage.getItem("failed_checkout_booking");
                if (savedBooking) {
                  router.push(`/checkout?recover=${savedBooking}`);
                } else {
                  window.location.reload();
                }
              }}
              variant="default"
            >
              Retry Checkout
            </Button>
            <Button
              onClick={() => router.push("/")}
              variant="outline"
            >
              Return to Homepage
            </Button>
          </div>

          <div className="text-sm text-gray-500">
            Error Code: CHK_ERR_{new Date().getTime().toString(36).toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary
      level="page"
      fallback={checkoutErrorFallback}
      onError={handleCheckoutError}
      resetKeys={[bookingId || "checkout"]}
    >
      {children}
    </ErrorBoundary>
  );
}

// Type augmentation for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      action: string,
      parameters?: Record<string, any>
    ) => void;
  }
}