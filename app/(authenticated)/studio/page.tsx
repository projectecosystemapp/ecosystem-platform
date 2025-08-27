import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { paymentsTable } from "@/db/schema/payments-schema";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
import { MetricsCard } from "@/components/studio/MetricsCard";
import { EarningsChart } from "@/components/studio/EarningsChart";
import { BookingsCalendar } from "@/components/studio/BookingsCalendar";
import { 
  DollarSign, 
  Calendar, 
  Eye, 
  Star, 
  TrendingUp, 
  Package,
  Users,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

async function getProviderMetrics(providerId: string) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get provider details
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);

  // Get earnings for last 30 days
  const earnings = await db
    .select({
      total: sql<number>`COALESCE(SUM(${paymentsTable.providerAmount}), 0)::numeric`,
      count: count()
    })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.providerId, providerId),
        eq(paymentsTable.status, "succeeded"),
        gte(paymentsTable.createdAt, thirtyDaysAgo)
      )
    );

  // Get bookings count for last 30 days
  const bookings = await db
    .select({
      total: count(),
      completed: sql<number>`COUNT(CASE WHEN ${bookingsTable.status} = 'COMPLETED' THEN 1 END)`,
      upcoming: sql<number>`COUNT(CASE WHEN ${bookingsTable.status} IN ('ACCEPTED', 'PAYMENT_SUCCEEDED') AND ${bookingsTable.scheduledFor} > NOW() THEN 1 END)`,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, thirtyDaysAgo)
      )
    );

  // Get recent bookings
  const recentBookings = await db
    .select({
      id: bookingsTable.id,
      status: bookingsTable.status,
      totalAmount: bookingsTable.totalAmount,
      scheduledFor: bookingsTable.scheduledFor,
      customerName: bookingsTable.customerName,
      serviceType: bookingsTable.serviceType,
      createdAt: bookingsTable.createdAt,
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.providerId, providerId))
    .orderBy(desc(bookingsTable.createdAt))
    .limit(5);

  // Get daily earnings for chart (last 30 days)
  const dailyEarnings = await db
    .select({
      date: sql<string>`DATE(${paymentsTable.createdAt})`,
      amount: sql<number>`COALESCE(SUM(${paymentsTable.providerAmount}), 0)::numeric`,
    })
    .from(paymentsTable)
    .where(
      and(
        eq(paymentsTable.providerId, providerId),
        eq(paymentsTable.status, "succeeded"),
        gte(paymentsTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`DATE(${paymentsTable.createdAt})`)
    .orderBy(sql`DATE(${paymentsTable.createdAt})`);

  return {
    provider,
    earnings: {
      total: earnings[0]?.total || 0,
      count: earnings[0]?.count || 0,
    },
    bookings: {
      total: bookings[0]?.total || 0,
      completed: bookings[0]?.completed || 0,
      upcoming: bookings[0]?.upcoming || 0,
    },
    recentBookings,
    dailyEarnings,
    averageRating: provider?.averageRating || 0,
    totalReviews: provider?.totalReviews || 0,
  };
}

export default async function StudioDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.userId, userId))
    .limit(1);

  if (!provider) {
    redirect("/become-a-provider");
  }

  const metrics = await getProviderMetrics(provider.id);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {provider.displayName}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here's what's happening with your business today.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Link href="/studio/listings/create">
            <Button>
              <Package className="mr-2 h-4 w-4" />
              Create Listing
            </Button>
          </Link>
          <Link href="/studio/bookings">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              View Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Total Earnings (30d)"
          value={`$${metrics.earnings.total.toFixed(2)}`}
          icon={DollarSign}
          description={`${metrics.earnings.count} transactions`}
          trend={15} // You can calculate actual trend
        />
        <MetricsCard
          title="Total Bookings (30d)"
          value={metrics.bookings.total.toString()}
          icon={Calendar}
          description={`${metrics.bookings.completed} completed`}
        />
        <MetricsCard
          title="Upcoming Bookings"
          value={metrics.bookings.upcoming.toString()}
          icon={Clock}
          description="Next 7 days"
        />
        <MetricsCard
          title="Average Rating"
          value={metrics.averageRating.toFixed(1)}
          icon={Star}
          description={`${metrics.totalReviews} reviews`}
        />
      </div>

      {/* Revenue Chart and Recent Bookings */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <div className="lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <EarningsChart data={metrics.dailyEarnings} />
            </CardContent>
          </Card>
        </div>

        {/* Recent Bookings */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Bookings</CardTitle>
              <Link href="/studio/bookings">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentBookings.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No recent bookings
                  </p>
                ) : (
                  metrics.recentBookings.map((booking) => (
                    <Link
                      key={booking.id}
                      href={`/studio/bookings/${booking.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {booking.customerName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {booking.serviceType} • {new Date(booking.scheduledFor).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-medium">
                            ${booking.totalAmount}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            booking.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            booking.status === 'PAYMENT_SUCCEEDED' ? 'bg-blue-100 text-blue-800' :
                            booking.status === 'ACCEPTED' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {booking.status.toLowerCase().replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/studio/settings/availability">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="mr-2 h-4 w-4" />
                Update Availability
              </Button>
            </Link>
            <Link href="/studio/analytics">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Analytics
              </Button>
            </Link>
            <Link href="/studio/settings/payouts">
              <Button variant="outline" className="w-full justify-start">
                <DollarSign className="mr-2 h-4 w-4" />
                Payout Settings
              </Button>
            </Link>
            <Link href="/studio/settings/profile">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}