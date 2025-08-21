"use client";

import { useState } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface StripePaymentFormProps {
  clientSecret: string;
  booking: {
    id: string;
    serviceName: string;
    totalAmount: string;
    providerName: string;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function StripePaymentForm({
  clientSecret,
  booking,
  onSuccess,
  onError,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/customer/bookings?payment=success`,
        },
        redirect: "if_required",
      });

      if (error) {
        if (error.type === "card_error" || error.type === "validation_error") {
          setErrorMessage(error.message || "Payment failed");
          onError(error.message || "Payment failed");
        } else {
          setErrorMessage("An unexpected error occurred");
          onError("An unexpected error occurred");
        }
        toast.error("Payment failed");
      } else {
        toast.success("Payment successful!");
        onSuccess();
      }
    } catch (err) {
      console.error("Payment error:", err);
      setErrorMessage("An unexpected error occurred");
      onError("An unexpected error occurred");
      toast.error("Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          Complete Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Service:</span>
            <span className="font-medium">{booking.serviceName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Provider:</span>
            <span className="font-medium">{booking.providerName}</span>
          </div>
          <div className="flex justify-between font-semibold text-lg border-t pt-2">
            <span>Total:</span>
            <span>${parseFloat(booking.totalAmount).toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <PaymentElement 
              options={{
                layout: "tabs",
                defaultValues: {
                  billingDetails: {
                    name: "", // Will be filled by Stripe
                    email: "", // Will be filled by Stripe
                  },
                },
              }}
            />
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={!stripe || isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing Payment...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Pay ${parseFloat(booking.totalAmount).toFixed(2)}
              </>
            )}
          </Button>
        </form>

        {/* Security Notice */}
        <div className="text-center text-xs text-gray-500 space-y-1">
          <p>🔒 Your payment information is secure and encrypted</p>
          <p>Powered by Stripe</p>
        </div>
      </CardContent>
    </Card>
  );
}