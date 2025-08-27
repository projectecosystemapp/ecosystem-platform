// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Provider } from "@/db/schema/providers-schema";
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, DollarSign, CreditCard } from "lucide-react";

interface PayoutsClientProps {
  provider: Provider;
}

export default function PayoutsClient({ provider }: PayoutsClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check for return parameters from Stripe
  const isReturn = searchParams.get("return") === "1";
  const isRefresh = searchParams.get("refresh") === "1";

  useEffect(() => {
    // Clear URL parameters after reading them
    if (isReturn || isRefresh) {
      router.replace("/dashboard/payouts");
    }
  }, [isReturn, isRefresh, router]);

  const handleConnectPayouts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/stripe/connect/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: provider.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create onboarding link");
      }

      const { url } = await response.json();

      // Redirect to Stripe Connect onboarding
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  };

  const isConnected = !!provider.stripeConnectAccountId;
  const isOnboardingComplete = provider.stripeOnboardingComplete;

  return (
    <div className="space-y-6">
      {/* Success message when returning from Stripe */}
      {isReturn && isConnected && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Successfully connected your Stripe account! You may need to complete additional verification steps.
          </AlertDescription>
        </Alert>
      )}

      {/* Refresh message */}
      {isRefresh && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Your onboarding session expired. Click &ldquo;Connect Payouts&rdquo; to continue.
          </AlertDescription>
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Payout Account Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payout Account Status
          </CardTitle>
          <CardDescription>
            Connect your Stripe account to receive payouts from bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-gray-300"
                }`}
              />
              <div>
                <p className="font-medium text-sm">
                  {isConnected ? "Account Connected" : "Not Connected"}
                </p>
                {isConnected && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Account ID: {provider.stripeConnectAccountId}
                  </p>
                )}
              </div>
            </div>
            
            {!isOnboardingComplete && isConnected && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                Verification Required
              </span>
            )}
          </div>

          {!isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                To receive payouts from customer bookings, you need to connect a Stripe account. 
                This allows us to securely transfer your earnings directly to your bank account.
              </p>
              
              <Button
                onClick={handleConnectPayouts}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect Payouts
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {isOnboardingComplete ? (
                <p className="text-sm text-green-600">
                  ✓ Your payout account is fully set up and ready to receive payments.
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Your account is connected but may require additional verification. 
                    Click below to complete the setup process.
                  </p>
                  <Button
                    onClick={handleConnectPayouts}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Platform Commission
          </CardTitle>
          <CardDescription>
            Your earnings after platform fees
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Platform Fee</span>
              <span className="font-medium">{(Number(provider.commissionRate) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Your Earnings</span>
              <span className="font-medium">{(100 - Number(provider.commissionRate) * 100).toFixed(0)}%</span>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500">
                For every $100 booking, you receive ${(100 * (1 - Number(provider.commissionRate))).toFixed(2)} after fees.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for future features */}
      {isConnected && isOnboardingComplete && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-gray-400">Coming Soon</CardTitle>
            <CardDescription className="text-gray-400">
              View your earnings history, pending payouts, and transaction details
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}