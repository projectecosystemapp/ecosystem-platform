import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { loyaltyAccountsTable, pointsTransactionsTable } from "@/db/schema/loyalty-schema";
import { notificationsTable } from "@/db/schema/notifications-schema";
import { favoritesTable } from "@/db/schema/favorites-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, desc, and, gte, or } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Trophy, 
  Heart, 
  ShoppingBag, 
  TrendingUp,
  Clock,
  Star,
  ArrowRight,
  Activity,
  Package,
  MapPin,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { LoyaltyCard } from "@/components/account/LoyaltyCard";
import { BookingCard } from "@/components/account/BookingCard";
import { ActivityFeed } from "@/components/account/ActivityFeed";

export default async function AccountDashboard() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/login");
  }

  // Fetch all necessary data in parallel
  const [
    upcomingBookings,
    loyaltyAccount,
    recentActivity,
    favoritesCount,
    profile,
    recentTransactions
  ] = await Promise.all([
    // Get upcoming bookings
    db.select({
      id: bookingsTable.id,
      serviceName: bookingsTable.serviceName,
      servicePrice: bookingsTable.servicePrice,
      bookingDate: bookingsTable.bookingDate,
      startTime: bookingsTable.startTime,
      status: bookingsTable.status,
      bookingType: bookingsTable.bookingType,
      providerId: bookingsTable.providerId,
      providerName: providersTable.businessName,
    })
    .from(bookingsTable)
    .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
    .where(
      and(
        eq(bookingsTable.customerId, userId),
        gte(bookingsTable.bookingDate, new Date()),
        or(
          eq(bookingsTable.status, "confirmed"),
          eq(bookingsTable.status, "pending")
        )
      )
    )
    .orderBy(bookingsTable.bookingDate)
    .limit(3),

    // Get loyalty account
    db.select()
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.customerId, userId))
    .limit(1),

    // Get recent notifications/activity
    db.select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(5),

    // Get favorites count
    db.select({ count: favoritesTable.id })
    .from(favoritesTable)
    .where(eq(favoritesTable.userId, userId)),

    // Get user profile
    db.select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1),

    // Get recent points transactions if loyalty account exists
    db.select()
    .from(pointsTransactionsTable)
    .leftJoin(loyaltyAccountsTable, eq(pointsTransactionsTable.accountId, loyaltyAccountsTable.id))
    .where(eq(loyaltyAccountsTable.customerId, userId))
    .orderBy(desc(pointsTransactionsTable.createdAt))
    .limit(3),
  ]);

  const stats = {
    upcomingBookings: upcomingBookings.length,
    loyaltyPoints: loyaltyAccount[0]?.pointsBalance || 0,
    loyaltyTier: loyaltyAccount[0]?.tier || "bronze",
    savedItems: favoritesCount.length,
  };

  const quickActions = [
    {
      title: "Browse Marketplace",
      description: "Discover services, events, spaces & more",
      icon: ShoppingBag,
      href: "/marketplace",
      color: "bg-blue-50 text-blue-600",
    },
    {
      title: "View History",
      description: "See your past bookings and purchases",
      icon: Clock,
      href: "/account/bookings?filter=past",
      color: "bg-green-50 text-green-600",
    },
    {
      title: "Saved Items",
      description: `${stats.savedItems} items in your favorites`,
      icon: Heart,
      href: "/account/favorites",
      color: "bg-pink-50 text-pink-600",
    },
    {
      title: "Earn Points",
      description: "Complete bookings to earn rewards",
      icon: Trophy,
      href: "/account/loyalty",
      color: "bg-yellow-50 text-yellow-600",
    },
  ];

  const getBookingTypeIcon = (type: string) => {
    switch(type) {
      case "service": return Package;
      case "event": return Calendar;
      case "space": return MapPin;
      case "thing": return ShoppingBag;
      default: return Package;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back{profile[0]?.email ? `, ${profile[0].email.split('@')[0]}` : ''}!
        </h1>
        <p className="text-blue-100">
          Manage your bookings, track loyalty points, and discover new experiences.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold">{stats.upcomingBookings}</p>
                <p className="text-xs text-gray-500">Bookings</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Points Balance</p>
                <p className="text-2xl font-bold">{stats.loyaltyPoints}</p>
                <Badge variant="secondary" className="mt-1 capitalize">
                  {stats.loyaltyTier}
                </Badge>
              </div>
              <Trophy className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Saved Items</p>
                <p className="text-2xl font-bold">{stats.savedItems}</p>
                <p className="text-xs text-gray-500">Favorites</p>
              </div>
              <Heart className="h-8 w-8 text-pink-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Member Since</p>
                <p className="text-lg font-bold">
                  {profile[0]?.createdAt 
                    ? format(new Date(profile[0].createdAt), 'MMM yyyy')
                    : 'New Member'}
                </p>
                <p className="text-xs text-gray-500">
                  {profile[0]?.membership === 'pro' ? 'Pro Member' : 'Free Member'}
                </p>
              </div>
              <Star className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Upcoming Bookings & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Bookings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Upcoming Bookings</CardTitle>
                <CardDescription>Your next scheduled services and events</CardDescription>
              </div>
              <Link href="/account/bookings">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingBookings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No upcoming bookings</p>
                  <Link href="/marketplace">
                    <Button>Browse Marketplace</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest marketplace activities</CardDescription>
                </div>
                <Activity className="h-5 w-5 text-gray-400" />
              </div>
            </CardHeader>
            <CardContent>
              <ActivityFeed activities={recentActivity} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Loyalty & Quick Actions */}
        <div className="space-y-6">
          {/* Loyalty Status */}
          {loyaltyAccount[0] && (
            <LoyaltyCard 
              account={loyaltyAccount[0]} 
              recentTransactions={recentTransactions}
            />
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <div className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className={cn("p-2 rounded-lg mr-3", action.color)}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{action.title}</p>
                      <p className="text-xs text-gray-500">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Special Offers */}
          <Card className="border-purple-200 bg-purple-50/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <CardTitle className="text-purple-900">Special Offers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg">
                  <p className="font-medium text-sm">Refer a Friend</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Earn 500 points when they complete their first booking
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <p className="font-medium text-sm">Complete 5 Bookings</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Get 1000 bonus points this month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}