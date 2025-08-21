"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripePaymentForm } from "./StripePaymentForm";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeWrapperProps {
  bookingId: string;
  booking: {
    id: string;
    serviceName: string;
    totalAmount: string;
    providerName: string;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function StripeWrapper({ bookingId, booking, onSuccess, onError }: StripeWrapperProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        const response = await fetch("/api/stripe/payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bookingId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create payment intent");
        }

        const data = await response.json();
        setClientSecret(data.clientSecret);
      } catch (err) {
        console.error("Error creating payment intent:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize payment");
        onError(err instanceof Error ? err.message : "Failed to initialize payment");
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, [bookingId, onError]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-gray-600">Initializing payment...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !clientSecret) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="text-center py-8">
          <p className="text-red-600">{error || "Failed to initialize payment"}</p>
        </CardContent>
      </Card>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#2563eb",
        colorBackground: "#ffffff",
        colorText: "#1f2937",
        fontFamily: "Inter, system-ui, sans-serif",
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripePaymentForm
        clientSecret={clientSecret}
        booking={booking}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}