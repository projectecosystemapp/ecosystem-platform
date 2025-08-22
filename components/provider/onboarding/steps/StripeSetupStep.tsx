/**
 * Stripe Setup Step Component
 * 
 * Handles Stripe Connect onboarding for payment processing
 */

"use client";

import { useState } from "react";
import { useProviderOnboardingStore } from "@/lib/stores/provider-onboarding-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Shield, 
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  InfoIcon
} from "lucide-react";

export default function StripeSetupStep() {
  const { stripeStatus, updateStripeStatus } = useProviderOnboardingStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // TODO: Implement actual Stripe Connect onboarding
      // This would typically:
      // 1. Call your backend to create a Stripe Connect account
      // 2. Get an onboarding link
      // 3. Redirect user to Stripe's hosted onboarding
      
      // Simulated delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulated success
      updateStripeStatus({
        accountId: "acct_mock_" + Date.now(),
        onboardingComplete: true,
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
        requirements: {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Stripe account");
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = stripeStatus.onboardingComplete && 
                      stripeStatus.chargesEnabled && 
                      stripeStatus.payoutsEnabled;

  return (
    <div className="space-y-6">
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Connect your Stripe account to receive payments from customers. Stripe handles all payment processing securely.
        </AlertDescription>
      </Alert>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Payment Account Status</span>
            {isConnected ? (
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Items */}
          <div className="space-y-3">
            <StatusItem
              label="Account Created"
              status={!!stripeStatus.accountId}
              loading={isConnecting && !stripeStatus.accountId}
            />
            <StatusItem
              label="Details Submitted"
              status={stripeStatus.detailsSubmitted}
              loading={isConnecting && stripeStatus.accountId && !stripeStatus.detailsSubmitted}
            />
            <StatusItem
              label="Charges Enabled"
              status={stripeStatus.chargesEnabled}
              loading={isConnecting && stripeStatus.detailsSubmitted && !stripeStatus.chargesEnabled}
            />
            <StatusItem
              label="Payouts Enabled"
              status={stripeStatus.payoutsEnabled}
              loading={isConnecting && stripeStatus.detailsSubmitted && !stripeStatus.payoutsEnabled}
            />
          </div>

          {/* Requirements */}
          {stripeStatus.requirements && (
            stripeStatus.requirements.currentlyDue.length > 0 ||
            stripeStatus.requirements.pastDue.length > 0
          ) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Action Required:</strong> Please complete the following requirements in Stripe:
                <ul className="list-disc list-inside mt-2">
                  {stripeStatus.requirements.pastDue.map((req) => (
                    <li key={req} className="text-sm">{req} (Past Due)</li>
                  ))}
                  {stripeStatus.requirements.currentlyDue.map((req) => (
                    <li key={req} className="text-sm">{req}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Connect Button */}
          {!isConnected && (
            <Button
              onClick={handleConnectStripe}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Connect Stripe Account
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}

          {/* Success Message */}
          {isConnected && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your Stripe account is fully connected and ready to accept payments!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Why Stripe?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-sm">Secure Payments</strong>
                <p className="text-sm text-gray-600">
                  Industry-leading security and fraud protection
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-sm">Fast Payouts</strong>
                <p className="text-sm text-gray-600">
                  Receive payments directly to your bank account
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-sm">Transparent Fees</strong>
                <p className="text-sm text-gray-600">
                  Platform fee: 10% | Payment processing: 2.9% + 30¢
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <strong className="text-sm">Tax Documents</strong>
                <p className="text-sm text-gray-600">
                  Automatic 1099 generation for tax reporting
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// Status Item Component
function StatusItem({ 
  label, 
  status, 
  loading = false 
}: { 
  label: string; 
  status: boolean; 
  loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium">{label}</span>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      ) : status ? (
        <CheckCircle className="w-5 h-5 text-green-600" />
      ) : (
        <XCircle className="w-5 h-5 text-gray-300" />
      )}
    </div>
  );
}