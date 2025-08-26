/**
 * Customer Bookings Page
 * 
 * Full booking history and management page for customers
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db/db";
import { profilesTable } from "@/db/schema/profiles-schema";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { eq, desc } from "drizzle-orm";
import { BookingHistory } from "@/components/customer/dashboard/BookingHistory";

async function getCustomerBookings(userId: string) {
  try {
    // Get customer profile
    const [customer] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (!customer) {
      return { customer: null, bookings: [] };
    }

    // Get all customer bookings
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
      .orderBy(desc(bookingsTable.createdAt));

    return {
      customer,
      bookings: bookings.map(booking => ({
        ...booking,
        providerName: booking.metadata?.providerName || 'Provider',
        providerBusinessName: booking.metadata?.providerBusinessName || 'Business',
        providerNotes: null, // This would come from provider response/notes
      }))
    };
  } catch (error) {
    console.error('Error fetching customer bookings:', error);
    return { customer: null, bookings: [] };
  }
}

export default async function CustomerBookingsPage() {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const { customer, bookings } = await getCustomerBookings(userId);

  if (!customer) {
    redirect("/onboarding/customer");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          My Bookings
        </h1>
        <p className="text-gray-600 mt-1">
          View and manage all your service bookings
        </p>
      </div>

      {/* Booking History Component */}
      <BookingHistory 
        customerId={customer.id} 
        initialBookings={bookings}
      />
    </div>
  );
}