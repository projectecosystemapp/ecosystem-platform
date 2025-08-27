import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { profilesTable } from "@/db/schema/profiles-schema";
import { BookingsCalendar } from "@/components/studio/BookingsCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, List, Filter, Download } from "lucide-react";
import Link from "next/link";

async function getProviderBookings(providerId: string, startDate: Date, endDate: Date) {
  const bookings = await db
    .select({
      id: bookingsTable.id,
      customerName: sql<string>`COALESCE(profiles.email, ${bookingsTable.guestEmail})`,
      customerEmail: sql<string>`COALESCE(profiles.email, ${bookingsTable.guestEmail})`,
      serviceType: bookingsTable.serviceName,
      scheduledFor: bookingsTable.bookingDate,
      duration: bookingsTable.serviceDuration,
      status: bookingsTable.status,
      totalAmount: bookingsTable.totalAmount,
      notes: bookingsTable.customerNotes,
    })
    .from(bookingsTable)
    .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        gte(bookingsTable.bookingDate, startDate),
        lte(bookingsTable.bookingDate, endDate)
      )
    );

  return bookings;
}

export default async function BookingsPage() {
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

  // Get bookings for current month (can be made dynamic with client-side navigation)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const bookings = await getProviderBookings(provider.id, startOfMonth, endOfMonth);

  // Group bookings by status for stats
  const bookingStats = {
    upcoming: bookings.filter(b => 
      ['confirmed'].includes(b.status) && 
      new Date(b.scheduledFor) > now
    ).length,
    today: bookings.filter(b => {
      const bookingDate = new Date(b.scheduledFor);
      return bookingDate.toDateString() === now.toDateString();
    }).length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => 
      ['cancelled', 'no_show'].includes(b.status)
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings Calendar</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage all your bookings in one place
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bookingStats.today}</p>
            <p className="text-xs text-gray-500">bookings</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bookingStats.upcoming}</p>
            <p className="text-xs text-gray-500">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{bookingStats.completed}</p>
            <p className="text-xs text-gray-500">this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{bookingStats.cancelled}</p>
            <p className="text-xs text-gray-500">this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">
            <Calendar className="mr-2 h-4 w-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="mr-2 h-4 w-4" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardContent className="p-6">
              <BookingsCalendar 
                bookings={bookings}
                providerId={provider.id}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No bookings for this period
                  </p>
                ) : (
                  bookings.map((booking) => (
                    <Link
                      key={booking.id}
                      href={`/studio/bookings/${booking.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {booking.customerName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {booking.serviceType}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-sm font-medium">
                            {new Date(booking.scheduledFor).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(booking.scheduledFor).toLocaleTimeString()}
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                            booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
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
        </TabsContent>
      </Tabs>
    </div>
  );
}