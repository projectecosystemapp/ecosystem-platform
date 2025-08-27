/**
 * Marketplace Test Page
 * 
 * This page provides a complete test environment for:
 * 1. Provider onboarding with Stripe Connect
 * 2. Service creation and management
 * 3. Customer booking and payment flow
 * 4. End-to-end marketplace functionality
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StripeConnectOnboarding, StripeConnectManagement } from '@/components/stripe/StripeConnectOnboarding';
import { BookingPaymentFlow } from '@/components/booking/BookingPaymentFlow';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  CreditCard, 
  Store, 
  ShoppingCart,
  TestTube,
  User,
  DollarSign,
  Info,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function TestMarketplacePage() {
  const { isSignedIn, userId } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [onboardingStatus, setOnboardingStatus] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testProvider, setTestProvider] = useState<any>(null);

  // Check onboarding status
  const checkOnboardingStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/connect/account-session', {
        method: 'GET',
      });
      const data = await response.json();
      setOnboardingStatus(data);
      toast.success('Onboarding status checked');
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to check onboarding status');
    } finally {
      setIsLoading(false);
    }
  };

  // Load provider services
  const loadServices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/providers/services');
      const data = await response.json();
      setServices(data.services || []);
      toast.success(`Loaded ${data.count} services`);
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  // Create test service
  const createTestService = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/providers/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Consultation Service',
          description: 'A 1-hour professional consultation service for testing the marketplace',
          priceInCents: 10000, // $100
          duration: 60, // 60 minutes
          currency: 'usd',
          active: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create service');
      }

      const data = await response.json();
      toast.success('Test service created successfully!');
      await loadServices();
    } catch (error) {
      console.error('Error creating service:', error);
      toast.error('Failed to create service. Complete onboarding first.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load test provider for booking
  const loadTestProvider = async () => {
    try {
      // For testing, we'll use the current user's provider profile
      const response = await fetch('/api/providers/me');
      if (response.ok) {
        const data = await response.json();
        setTestProvider(data.provider);
      }
    } catch (error) {
      console.error('Error loading provider:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TestTube className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Marketplace Test Environment</h1>
        </div>
        <p className="text-gray-600">
          Test the complete marketplace flow: Provider onboarding → Service creation → Customer payment
        </p>
      </div>

      {/* Authentication Check */}
      {!isSignedIn && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            Please sign in to test the marketplace features. Provider features require authentication.
          </AlertDescription>
        </Alert>
      )}

      {/* Test Flow Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="provider" disabled={!isSignedIn}>
            Provider Setup
          </TabsTrigger>
          <TabsTrigger value="services" disabled={!isSignedIn}>
            Services
          </TabsTrigger>
          <TabsTrigger value="customer">Customer Flow</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>How Your Marketplace Works</CardTitle>
              <CardDescription>Complete flow from provider onboarding to customer payment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <Store className="w-8 h-8 text-blue-600 mb-2" />
                    <h3 className="font-semibold mb-1">1. Provider Joins</h3>
                    <p className="text-sm text-gray-600">
                      Providers sign up and complete Stripe Connect onboarding for KYC and bank setup
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <DollarSign className="w-8 h-8 text-green-600 mb-2" />
                    <h3 className="font-semibold mb-1">2. List Services</h3>
                    <p className="text-sm text-gray-600">
                      Providers create services with pricing that get synced to their Stripe account
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <ShoppingCart className="w-8 h-8 text-purple-600 mb-2" />
                    <h3 className="font-semibold mb-1">3. Customers Book</h3>
                    <p className="text-sm text-gray-600">
                      Customers book and pay directly. Platform takes 10% fee (20% for guests)
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-semibold">Fee Structure</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Registered Customer Pays:</span>
                      <span className="font-medium">100%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guest Customer Pays:</span>
                      <span className="font-medium">110% (10% surcharge)</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Provider Receives:</span>
                      <span className="font-medium">90% (after platform fee)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Receives:</span>
                      <span className="font-medium">10% (20% from guests)</span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Test Mode:</strong> All transactions use Stripe test mode. Use card number{' '}
                  <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">4242 4242 4242 4242</code>{' '}
                  with any future expiry and CVC.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Provider Setup Tab */}
        <TabsContent value="provider" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Provider Onboarding</CardTitle>
              <CardDescription>Complete Stripe Connect setup to start accepting payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium">Onboarding Status</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Check your current Stripe Connect status
                  </p>
                </div>
                <Button onClick={checkOnboardingStatus} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Check Status'
                  )}
                </Button>
              </div>

              {onboardingStatus && (
                <Alert className={onboardingStatus.onboardingComplete ? 'border-green-500' : 'border-orange-500'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {onboardingStatus.onboardingComplete ? 'Onboarding Complete' : 'Onboarding Required'}
                  </AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        {onboardingStatus.chargesEnabled ? 
                          <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                        }
                        <span>Charges: {onboardingStatus.chargesEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {onboardingStatus.payoutsEnabled ? 
                          <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                        }
                        <span>Payouts: {onboardingStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      {onboardingStatus.requirements?.currentlyDue?.length > 0 && (
                        <div className="mt-2 text-orange-600">
                          Requirements needed: {onboardingStatus.requirements.currentlyDue.join(', ')}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <div>
                <h4 className="font-medium mb-4">Start Onboarding</h4>
                <StripeConnectOnboarding
                  onComplete={() => {
                    toast.success('Onboarding completed!');
                    checkOnboardingStatus();
                  }}
                  onExit={() => {
                    toast.info('Onboarding exited');
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Management</CardTitle>
              <CardDescription>Create and manage services that customers can book</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Button onClick={loadServices} variant="outline" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load Services'}
                </Button>
                <Button onClick={createTestService} disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Test Service'}
                </Button>
              </div>

              {services.length > 0 ? (
                <div className="space-y-3">
                  {services.map((service) => (
                    <Card key={service.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{service.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <Badge variant={service.active ? 'default' : 'secondary'}>
                                {service.active ? 'Active' : 'Inactive'}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {service.duration} minutes
                              </span>
                              <span className="text-sm text-gray-500">
                                ID: {service.stripeProductId}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">${service.price}</div>
                            <div className="text-xs text-gray-500">{service.currency?.toUpperCase()}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No services found. Create a test service to get started.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customer Flow Tab */}
        <TabsContent value="customer" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Booking Test</CardTitle>
              <CardDescription>Test the customer booking and payment flow</CardDescription>
            </CardHeader>
            <CardContent>
              {!testProvider ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    Load a test provider to simulate customer booking
                  </p>
                  <Button onClick={loadTestProvider}>
                    Load Test Provider
                  </Button>
                </div>
              ) : (
                <BookingPaymentFlow
                  provider={{
                    id: testProvider.id,
                    displayName: testProvider.displayName || 'Test Provider',
                    stripeConnectAccountId: testProvider.stripeConnectAccountId,
                    locationCity: testProvider.locationCity,
                    locationState: testProvider.locationState,
                    services: testProvider.services || [],
                  }}
                  onComplete={(bookingId) => {
                    toast.success(`Booking completed! ID: ${bookingId}`);
                  }}
                  onCancel={() => {
                    toast.info('Booking cancelled');
                  }}
                />
              )}

              <Alert className="mt-4">
                <CreditCard className="h-4 w-4" />
                <AlertDescription>
                  <strong>Test Cards:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Success: <code>4242 4242 4242 4242</code></li>
                    <li>• Requires auth: <code>4000 0027 6000 3184</code></li>
                    <li>• Declined: <code>4000 0000 0000 9995</code></li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}