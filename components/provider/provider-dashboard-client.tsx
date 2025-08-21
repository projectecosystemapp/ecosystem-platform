"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock,
  Star,
  CreditCard,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Provider } from "@/db/schema/providers-schema";

interface ProviderDashboardClientProps {
  provider: Provider;
}

export function ProviderDashboardClient({ provider }: ProviderDashboardClientProps) {
  const [dashboardData, setDashboardData] = useState({
    totalEarnings: 0,
    monthlyEarnings: 0,
    completedBookings: 0,
    upcomingBookings: 0,
    averageRating: 0,
    pendingPayouts: 0,
  });
  const [isLoadingOnboarding, setIsLoadingOnboarding] = useState(false);

  // Mock data for now - in production, this would come from API calls
  useEffect(() => {
    // Simulate API call
    setDashboardData({
      totalEarnings: 2450.75,
      monthlyEarnings: 890.25,
      completedBookings: provider.completedBookings || 0,
      upcomingBookings: 3,
      averageRating: parseFloat(provider.averageRating || "0"),
      pendingPayouts: 340.50,
    });
  }, [provider]);

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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Provider Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back, {provider.displayName}! Here&apos;s your business overview.
        </p>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${dashboardData.monthlyEarnings.toFixed(2)}</div>
              <p className="text-xs text-gray-600">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                +12% from last month
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${dashboardData.totalEarnings.toFixed(2)}</div>
              <p className="text-xs text-gray-600">All-time earnings</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.completedBookings}</div>
              <p className="text-xs text-gray-600">
                {dashboardData.upcomingBookings} upcoming
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData.averageRating > 0 ? dashboardData.averageRating.toFixed(1) : "N/A"}
              </div>
              <p className="text-xs text-gray-600">
                From {provider.totalReviews || 0} reviews
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

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
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm">Booking confirmed with Sarah J.</p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>
                    <Badge variant="secondary">$85</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm">New 5-star review received</p>
                      <p className="text-xs text-gray-500">1 day ago</p>
                    </div>
                    <Badge variant="outline">Review</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm">Payout of $340.50 processed</p>
                      <p className="text-xs text-gray-500">3 days ago</p>
                    </div>
                    <Badge variant="secondary">Payout</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Calendar className="h-4 w-4 mr-2" />
                    Manage Availability
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Clock className="h-4 w-4 mr-2" />
                    Update Services
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payment Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bookings">
          <Card>
            <CardHeader>
              <CardTitle>Booking Management</CardTitle>
              <p className="text-sm text-gray-600">
                Manage your upcoming and completed bookings
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Booking management coming soon</h3>
                <p className="text-gray-600">
                  You&apos;ll be able to view and manage all your bookings here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle>Earnings & Payouts</CardTitle>
              <p className="text-sm text-gray-600">
                Track your earnings and payout history
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Pending Payouts */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Pending Payouts</h4>
                      <p className="text-sm text-gray-600">Available for next payout</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        ${dashboardData.pendingPayouts.toFixed(2)}
                      </div>
                      <p className="text-xs text-gray-500">Next payout in 2 days</p>
                    </div>
                  </div>
                </div>

                {/* Earnings Chart Placeholder */}
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">Detailed analytics coming soon</h3>
                  <p className="text-gray-600">
                    You&apos;ll see charts and detailed breakdowns of your earnings here.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Management</CardTitle>
              <p className="text-sm text-gray-600">
                Update your provider profile and settings
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Profile editor coming soon</h3>
                <p className="text-gray-600">
                  You&apos;ll be able to edit your profile, services, and pricing here.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}