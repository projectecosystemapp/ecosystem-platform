"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  Calendar
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Provider } from "@/db/schema/providers-schema";

// Import new dashboard components
import { MetricsGrid } from "./dashboard/MetricsGrid";
import { RecentActivity } from "./dashboard/RecentActivity";
import { BookingsList } from "./dashboard/BookingsList";
import { QuickActions } from "./dashboard/QuickActions";
import { EarningsChart } from "./dashboard/EarningsChart";

interface ProviderDashboardClientProps {
  provider: Provider;
}

export function ProviderDashboardClient({ provider }: ProviderDashboardClientProps) {
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<Error | null>(null);
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch dashboard metrics
  const fetchMetrics = async () => {
    setIsLoadingMetrics(true);
    try {
      const response = await fetch(`/api/providers/${provider.id}/metrics?period=month&includeCharts=false`);
      if (!response.ok) throw new Error("Failed to fetch metrics");
      
      const data = await response.json();
      setMetrics(data);
      setMetricsError(null);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching metrics:", error);
      setMetricsError(error as Error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh metrics every 60 seconds
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, [provider.id]);

  const handleStripeOnboarding = async () => {
    setIsLoadingOnboarding(true);
    try {
      const response = await fetch("/api/stripe/connect/link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ providerId: provider.id }),
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      } else {
        console.error("Failed to create onboarding link");
      }
    } catch (error) {
      console.error("Error creating onboarding link:", error);
    } finally {
      setIsLoadingOnboarding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with Refresh Button */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Provider Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {provider.displayName}! Here&apos;s your business overview.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMetrics}
          disabled={isLoadingMetrics}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMetrics ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stripe Connect Status */}
      {!provider.stripeOnboardingComplete && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Payment setup required:</strong> Complete your Stripe account setup to start receiving payments.
              </div>
              <Button
                onClick={handleStripeOnboarding}
                disabled={isLoadingOnboarding}
                className="ml-4 bg-orange-600 hover:bg-orange-700"
              >
                {isLoadingOnboarding ? "Loading..." : "Complete Setup"}
                <ExternalLink className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {provider.stripeOnboardingComplete && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Payment setup complete!</strong> You&apos;re ready to receive payments from customers.
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      <MetricsGrid 
        metrics={metrics} 
        isLoading={isLoadingMetrics} 
        error={metricsError}
      />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <RecentActivity providerId={provider.id} />
            
            {/* Quick Actions */}
            <QuickActions 
              providerId={provider.id} 
              stripeOnboardingComplete={provider.stripeOnboardingComplete}
            />
          </div>

          {/* Upcoming Bookings */}
          <BookingsList providerId={provider.id} />
        </TabsContent>

        <TabsContent value="bookings">
          {/* Full Bookings List */}
          <BookingsList providerId={provider.id} />
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          {/* Earnings Chart */}
          <EarningsChart providerId={provider.id} />
          
          {/* Additional Earnings Info */}
          {metrics?.overview?.pendingPayouts && metrics.overview.pendingPayouts > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Pending Payouts</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Your earnings are processed automatically
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">
                      ${metrics.overview.pendingPayouts.toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Processing in 2-3 business days
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Quick View */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Display Name</p>
                    <p className="font-medium">{provider.displayName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Location</p>
                    <p className="font-medium">
                      {provider.locationCity ? `${provider.locationCity}, ${provider.locationState}` : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Hourly Rate</p>
                    <p className="font-medium">
                      {provider.hourlyRate ? `$${provider.hourlyRate}/hour` : "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Experience</p>
                    <p className="font-medium">
                      {provider.yearsExperience ? `${provider.yearsExperience} years` : "Not specified"}
                    </p>
                  </div>
                </div>
                <Button className="w-full mt-4" variant="outline">
                  Edit Profile
                </Button>
              </div>
            </motion.div>

            {/* Services Quick View */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold mb-4">Services Offered</h3>
                {provider.services && provider.services.length > 0 ? (
                  <div className="space-y-2">
                    {provider.services.slice(0, 4).map((service: any, index: number) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium text-sm">{service.name}</p>
                          <p className="text-xs text-gray-600">{service.duration} min</p>
                        </div>
                        <p className="font-semibold">${service.price}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm">No services configured yet</p>
                )}
                <Button className="w-full mt-4" variant="outline">
                  Manage Services
                </Button>
              </div>
            </motion.div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}