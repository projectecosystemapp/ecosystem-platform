import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { paymentsTable } from "@/db/schema/payments-schema";
import { reviewsTable } from "@/db/schema/reviews-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eventsTable } from "@/db/schema/events-schema";
import { spacesTable } from "@/db/schema/spaces-schema";
import { thingsTable } from "@/db/schema/things-schema";
import { eq, and, gte, sql, desc, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EarningsChart } from "@/components/studio/EarningsChart";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Star, 
  Package,
  Calendar,
  MapPin,
  ShoppingBag,
  Download,
  CalendarDays,
  Clock,
  Target
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

async function getProviderAnalytics(providerId: string) {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const ninetyDaysAgo = subDays(now, 90);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  // Overall earnings - join with bookings to get providerId
  const [totalEarnings] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${paymentsTable.providerPayoutCents} / 100.0), 0)::numeric`,
      count: count(),
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(paymentsTable.status, "succeeded")
      )
    );

  // Last 30 days earnings
  const [monthlyEarnings] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${paymentsTable.providerPayoutCents} / 100.0), 0)::numeric`,
      count: count(),
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(paymentsTable.status, "succeeded"),
        gte(paymentsTable.createdAt, thirtyDaysAgo)
      )
    );

  // This week's earnings
  const [weeklyEarnings] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${paymentsTable.providerPayoutCents} / 100.0), 0)::numeric`,
      count: count(),
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(paymentsTable.status, "succeeded"),
        gte(paymentsTable.createdAt, weekStart)
      )
    );

  // Bookings by status
  const bookingsByStatus = await db
    .select({
      status: bookingsTable.status,
      count: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(bookingsTable.status);

  // Popular listings (most booked)
  const popularServices = await db
    .select({
      serviceType: bookingsTable.serviceName,
      count: count(),
      totalRevenue: sql<number>`COALESCE(SUM(${bookingsTable.totalAmount}), 0)::numeric`,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(bookingsTable.status, 'completed'),
        gte(bookingsTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(bookingsTable.serviceName)
    .orderBy(desc(count()))
    .limit(5);

  // Customer demographics (returning vs new)
  const customerStats = await db
    .select({
      customerEmail: sql<string>`COALESCE(${bookingsTable.guestEmail}, profiles.email)`,
      bookingCount: count(),
    })
    .from(bookingsTable)
    .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, ninetyDaysAgo)
      )
    )
    .groupBy(sql`COALESCE(${bookingsTable.guestEmail}, profiles.email)`);

  const returningCustomers = customerStats.filter(c => c.bookingCount > 1).length;
  const uniqueCustomers = customerStats.length;

  // Peak booking times (hour of day)
  const bookingsByHour = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`,
      count: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${bookingsTable.bookingDate})`);

  // Day of week analysis
  const bookingsByDayOfWeek = await db
    .select({
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${bookingsTable.bookingDate})`,
      count: count(),
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`EXTRACT(DOW FROM ${bookingsTable.bookingDate})`)
    .orderBy(sql`EXTRACT(DOW FROM ${bookingsTable.bookingDate})`);

  // Reviews and ratings
  const reviews = await db
    .select({
      averageRating: sql<number>`COALESCE(AVG(${reviewsTable.rating}), 0)::numeric`,
      totalReviews: count(),
      fiveStars: sql<number>`COUNT(CASE WHEN ${reviewsTable.rating} = 5 THEN 1 END)`,
      fourStars: sql<number>`COUNT(CASE WHEN ${reviewsTable.rating} = 4 THEN 1 END)`,
      threeStars: sql<number>`COUNT(CASE WHEN ${reviewsTable.rating} = 3 THEN 1 END)`,
      twoStars: sql<number>`COUNT(CASE WHEN ${reviewsTable.rating} = 2 THEN 1 END)`,
      oneStar: sql<number>`COUNT(CASE WHEN ${reviewsTable.rating} = 1 THEN 1 END)`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.providerId, providerId));

  // Daily earnings for chart (last 30 days)
  const dailyEarnings = await db
    .select({
      date: sql<string>`DATE(${paymentsTable.createdAt})`,
      amount: sql<number>`COALESCE(SUM(${paymentsTable.providerPayoutCents} / 100.0), 0)::numeric`,
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(paymentsTable.status, "succeeded"),
        gte(paymentsTable.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`DATE(${paymentsTable.createdAt})`)
    .orderBy(sql`DATE(${paymentsTable.createdAt})`);

  // Conversion rate (accepted/total requests)
  const conversionStats = await db
    .select({
      total: count(),
      accepted: sql<number>`COUNT(CASE WHEN ${bookingsTable.status} NOT IN ('cancelled', 'no_show') THEN 1 END)`,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.createdAt, thirtyDaysAgo)
      )
    );

  const conversionRate = conversionStats[0]?.total > 0 
    ? (conversionStats[0].accepted / conversionStats[0].total) * 100 
    : 0;

  return {
    earnings: {
      total: totalEarnings.total,
      monthly: monthlyEarnings.total,
      weekly: weeklyEarnings.total,
      dailyAverage: monthlyEarnings.total / 30,
    },
    bookings: {
      byStatus: bookingsByStatus,
      total: bookingsByStatus.reduce((sum, b) => sum + b.count, 0),
      conversionRate,
    },
    popularServices,
    customers: {
      total: uniqueCustomers,
      returning: returningCustomers,
      returnRate: uniqueCustomers > 0 ? (returningCustomers / uniqueCustomers) * 100 : 0,
    },
    peakTimes: {
      byHour: bookingsByHour,
      byDayOfWeek: bookingsByDayOfWeek,
    },
    reviews: reviews[0],
    dailyEarnings,
  };
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function AnalyticsPage() {
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

  const analytics = await getProviderAnalytics(provider.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track your performance and grow your business
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${analytics.earnings.total.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${analytics.earnings.monthly.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.bookings.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">Bookings accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Return Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.customers.returnRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">Returning customers</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Daily earnings over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <EarningsChart data={analytics.dailyEarnings} />
        </CardContent>
      </Card>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="listings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="listings">Popular Listings</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="timing">Peak Times</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Listings</CardTitle>
              <CardDescription>Most booked services in the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.popularServices.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No data available</p>
              ) : (
                <div className="space-y-4">
                  {analytics.popularServices.map((service, index) => (
                    <div key={service.serviceType} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{service.serviceType}</p>
                          <p className="text-sm text-gray-500">{service.count} bookings</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${service.totalRevenue.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">revenue</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <CardTitle>Customer Insights</CardTitle>
              <CardDescription>Understanding your customer base</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 border rounded-lg">
                  <Users className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold">{analytics.customers.total}</p>
                  <p className="text-sm text-gray-500">Total Customers</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <TrendingUp className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-2xl font-bold">{analytics.customers.returning}</p>
                  <p className="text-sm text-gray-500">Returning Customers</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <Target className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <p className="text-2xl font-bold">{analytics.customers.returnRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">Return Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timing">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Peak Booking Days</CardTitle>
                <CardDescription>When customers book most frequently</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.peakTimes.byDayOfWeek.map((day) => (
                    <div key={day.dayOfWeek} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{dayNames[day.dayOfWeek]}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ 
                              width: `${(day.count / Math.max(...analytics.peakTimes.byDayOfWeek.map(d => d.count))) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8">{day.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Peak Booking Hours</CardTitle>
                <CardDescription>Most popular times of day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.peakTimes.byHour.slice(0, 5).map((hour) => (
                    <div key={hour.hour} className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {hour.hour}:00 - {hour.hour + 1}:00
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full"
                            style={{ 
                              width: `${(hour.count / Math.max(...analytics.peakTimes.byHour.map(h => h.count))) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8">{hour.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <CardTitle>Reviews & Ratings</CardTitle>
              <CardDescription>Customer feedback overview</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.reviews && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                        <span className="text-3xl font-bold">
                          {Number(analytics.reviews.averageRating).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Based on {analytics.reviews.totalReviews} reviews
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = analytics.reviews[`${['one', 'two', 'three', 'four', 'five'][stars - 1]}Stars` as keyof typeof analytics.reviews] as number || 0;
                      const percentage = analytics.reviews.totalReviews > 0 
                        ? (count / analytics.reviews.totalReviews) * 100 
                        : 0;
                      
                      return (
                        <div key={stars} className="flex items-center gap-2">
                          <span className="text-sm w-12">{stars} star</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-yellow-500 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 w-12">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}