/**
 * Stripe Connect Embedded Onboarding Component
 * 
 * This component renders Stripe's embedded onboarding flow that:
 * 1. Guides providers through KYC/identity verification
 * 2. Collects bank account information for payouts
 * 3. Handles compliance requirements automatically
 * 4. Provides a seamless, white-labeled experience
 */

'use client';

import { useEffect, useState } from 'react';
import { loadConnectAndInitialize, StripeConnectInstance } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface StripeConnectOnboardingProps {
  onComplete?: () => void;
  onExit?: () => void;
  className?: string;
}

export function StripeConnectOnboarding({
  onComplete,
  onExit,
  className = '',
}: StripeConnectOnboardingProps) {
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [accountCreatePending, setAccountCreatePending] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<'loading' | 'ready' | 'complete' | 'error'>('loading');

  // Initialize Stripe Connect
  useEffect(() => {
    const initializeStripeConnect = async () => {
      try {
        setAccountCreatePending(true);
        setError(null);
        
        // Fetch account session from our API
        const response = await fetch('/api/connect/account-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'onboarding',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create account session');
        }

        setClientSecret(data.client_secret);
        setAccountCreated(true);
        
        // Get publishable key
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          throw new Error('Stripe publishable key not configured');
        }

        // Initialize Stripe Connect
        const instance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => data.client_secret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#3b82f6', // Blue-500
              colorBackground: '#ffffff',
              colorText: '#1f2937',
              colorDanger: '#ef4444',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontSizeBase: '14px',
              spacingUnit: '4px',
              borderRadius: '8px',
            },
          },
        });

        setStripeConnectInstance(instance);
        setOnboardingStatus('ready');
        
      } catch (err) {
        console.error('Error initializing Stripe Connect:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment onboarding');
        setOnboardingStatus('error');
        toast.error('Failed to load payment onboarding');
      } finally {
        setAccountCreatePending(false);
      }
    };

    initializeStripeConnect();
  }, []);

  // Check onboarding status
  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/connect/account-session', {
        method: 'GET',
      });

      const data = await response.json();

      if (data.onboardingComplete) {
        setOnboardingStatus('complete');
        toast.success('Payment setup completed successfully!');
        onComplete?.();
      } else if (data.requiresAction) {
        toast.warning('Additional information required for payment setup');
      }

      return data;
    } catch (err) {
      console.error('Error checking onboarding status:', err);
      return null;
    }
  };

  // Handle retry
  const handleRetry = () => {
    window.location.reload();
  };

  // Loading state
  if (accountCreatePending) {
    return (
      <Card className={`p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Setting up your payment account...</p>
        </div>
      </Card>
    );
  }

  // Error state
  if (error || onboardingStatus === 'error') {
    return (
      <Card className={`p-8 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Failed to initialize payment setup'}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Button onClick={handleRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // Complete state
  if (onboardingStatus === 'complete') {
    return (
      <Card className={`p-8 ${className}`}>
        <div className="flex flex-col items-center justify-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-green-600" />
          <h3 className="text-lg font-semibold">Payment Setup Complete!</h3>
          <p className="text-gray-600 text-center">
            Your account is ready to accept payments. You can start listing your services now.
          </p>
          {onComplete && (
            <Button onClick={onComplete} className="mt-4">
              Continue to Dashboard
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Render Stripe Connect components
  if (!stripeConnectInstance || !accountCreated) {
    return null;
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <Card className={`${className}`}>
        <ConnectAccountOnboarding
          onExit={() => {
            console.log('User exited onboarding');
            // Check if onboarding is actually complete
            checkOnboardingStatus().then(status => {
              if (status?.onboardingComplete) {
                onComplete?.();
              } else {
                onExit?.();
              }
            });
          }}
          collectionOptions={{
            fields: 'eventually_due',
            futureRequirements: 'include',
          }}
        />
      </Card>
    </ConnectComponentsProvider>
  );
}

/**
 * Stripe Connect Account Management Component
 * For providers to manage their payment settings after onboarding
 */
export function StripeConnectManagement({ className = '' }: { className?: string }) {
  const [stripeConnectInstance, setStripeConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeManagement = async () => {
      try {
        // Fetch management session
        const response = await fetch('/api/connect/account-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mode: 'management',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load account management');
        }

        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          throw new Error('Stripe publishable key not configured');
        }

        // Initialize Stripe Connect for management
        const instance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => data.client_secret,
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#3b82f6',
            },
          },
        });

        setStripeConnectInstance(instance);
        setLoading(false);
      } catch (err) {
        console.error('Error loading account management:', err);
        setError(err instanceof Error ? err.message : 'Failed to load account management');
        setLoading(false);
      }
    };

    initializeManagement();
  }, []);

  if (loading) {
    return (
      <Card className={`p-8 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          <span className="ml-2 text-gray-600">Loading payment settings...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-8 ${className}`}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </Card>
    );
  }

  if (!stripeConnectInstance) {
    return null;
  }

  return (
    <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
      <div className={className}>
        {/* Account management component would go here */}
        {/* Stripe will provide specific components in their SDK */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Account Settings</h3>
          <p className="text-gray-600">
            Manage your payment settings, bank account, and payout schedule.
          </p>
          {/* The actual management components from Stripe would be rendered here */}
        </Card>
      </div>
    </ConnectComponentsProvider>
  );
}