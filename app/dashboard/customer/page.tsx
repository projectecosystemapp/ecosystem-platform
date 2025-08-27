/**
 * Customer Dashboard Page
 * 
 * Main dashboard for authenticated customers showing:
 * - Booking history and upcoming bookings
 * - Quick actions and metrics
 * - Payment history
 * - Profile management
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingHistory } from "@/components/customer/dashboard/BookingHistory";
import { CustomerMetrics } from "@/components/customer/dashboard/CustomerMetrics";
import { QuickActions } from "@/components/customer/dashboard/QuickActions";
import LoyaltyWidget from "@/components/loyalty/loyalty-widget";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  User, 
  Plus, 
  Search,
  Star,
  TrendingUp,
  Sparkles
} from "lucide-react";
import Link from "next/link";

async function getCustomerData(userId: string) {
  try {
    // Get customer profile
    const [customer] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!customer) {
      return { customer: null, bookings: [], metrics: null };
    }

    // Get customer bookings
    const bookings = await db
      .select({
        id: bookingsTable.id,
        providerId: bookingsTable.providerId,
        serviceName: bookingsTable.serviceName,
        servicePrice: bookingsTable.servicePrice,
        serviceDuration: bookingsTable.serviceDuration,
        bookingDate: bookingsTable.bookingDate,
        startTime: bookingsTable.startTime,
        endTime: bookingsTable.endTime,
        status: bookingsTable.status,
        totalAmount: bookingsTable.totalAmount,
        platformFee: bookingsTable.platformFee,
        providerPayout: bookingsTable.providerPayout,
        confirmationCode: bookingsTable.confirmationCode,
        customerNotes: bookingsTable.customerNotes,
        isGuestBooking: bookingsTable.isGuestBooking,
        createdAt: bookingsTable.createdAt,
        updatedAt: bookingsTable.updatedAt,
        metadata: bookingsTable.metadata,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.customerId, customer.id))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(50);

    // Calculate metrics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const totalSpent = bookings
      .filter(b => ['completed', 'confirmed'].includes(b.status))
      .reduce((sum, b) => sum + parseFloat(b.totalAmount), 0);
    const upcomingBookings = bookings.filter(b => 
      new Date(b.bookingDate) >= new Date() && 
      ['pending', 'confirmed'].includes(b.status)
    ).length;

    return {
      customer,
      bookings: bookings.map(booking => ({
        ...booking,
        providerName: 'Provider', // This would come from a JOIN in a real implementation
        providerBusinessName: booking.metadata?.providerName || 'Business',
        providerNotes: null,
      })),
      metrics: {
        totalBookings,
        completedBookings,
        totalSpent,
        upcomingBookings,
        avgBookingValue: totalBookings > 0 ? totalSpent / totalBookings : 0,
      }
    };
  } catch (error) {
    console.error('Error fetching customer data:', error);
    return { customer: null, bookings: [], metrics: null };
  }
}

export default async function CustomerDashboardPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const { customer, bookings, metrics } = await getCustomerData(userId);

  if (!customer) {
    // Redirect to profile setup if customer profile doesn't exist
    redirect("/onboarding/customer");
  }

  // Get recent bookings for quick view
  const recentBookings = bookings.slice(0, 3);
  const upcomingBookings = bookings
    .filter(b => 
      new Date(b.bookingDate) >= new Date() && 
      ['pending', 'confirmed'].includes(b.status)
    )
    .slice(0, 3);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {customer.firstName}!
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your bookings and discover new services
          </p>
        </div>
        <div className="flex space-x-3">
          <Button asChild>
            <Link href="/marketplace">
              <Search className="h-4 w-4 mr-2" />
              Find Services
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Bookings
                  </p>
                  <p className="text-2xl font-bold">{metrics.totalBookings}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Upcoming
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.upcomingBookings}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Spent
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    ${metrics.totalSpent.toFixed(2)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Completed
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {metrics.completedBookings}
                  </p>
                </div>
                <Star className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loyalty Points Widget */}
      <div className="mb-8">
        <LoyaltyWidget compact className="shadow-sm" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Upcoming Bookings */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Bookings</CardTitle>
              <CardDescription>
                Your next scheduled services
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/customer/bookings">
                View All
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No upcoming bookings
                </h3>
                <p className="text-gray-500 mb-4">
                  Book a service to see it here
                </p>
                <Button asChild>
                  <Link href="/marketplace">
                    <Search className="h-4 w-4 mr-2" />
                    Browse Services
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{booking.serviceName}</h4>
                      <p className="text-sm text-gray-600">
                        {booking.providerBusinessName}
                      </p>
                      <div className="flex items-center mt-1 text-sm text-blue-600">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(booking.bookingDate).toLocaleDateString()} at {booking.startTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="mb-2">
                        {booking.status}
                      </Badge>
                      <p className="text-sm font-medium">
                        ${booking.totalAmount}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" asChild>
              <Link href="/marketplace">
                <Search className="h-4 w-4 mr-2" />
                Find New Services
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/customer/bookings">
                <Calendar className="h-4 w-4 mr-2" />
                View All Bookings
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/customer/payments">
                <DollarSign className="h-4 w-4 mr-2" />
                Payment History
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/loyalty">
                <Sparkles className="h-4 w-4 mr-2" />
                Loyalty Program
              </Link>
            </Button>
            
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/dashboard/settings">
                <User className="h-4 w-4 mr-2" />
                Account Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Bookings</CardTitle>
            <CardDescription>
              Your latest booking activity
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/customer/bookings">
              View All History
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No booking history yet
              </h3>
              <p className="text-gray-500 mb-4">
                Your booking history will appear here
              </p>
              <Button asChild>
                <Link href="/marketplace">
                  <Plus className="h-4 w-4 mr-2" />
                  Book Your First Service
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{booking.serviceName}</h4>
                    <p className="text-sm text-gray-600">
                      {booking.providerBusinessName}
                    </p>
                    <div className="flex items-center mt-1 text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {new Date(booking.bookingDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      className={
                        booking.status === 'completed' 
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-800'  
                          : 'bg-yellow-100 text-yellow-800'
                      }
                    >
                      {booking.status}
                    </Badge>
                    <p className="text-sm font-medium mt-1">
                      ${booking.totalAmount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}