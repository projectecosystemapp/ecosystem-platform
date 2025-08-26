/**
 * Customer Bookings API
 * 
 * Fetch all bookings for a specific customer
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, desc, and } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";

export const GET = withRateLimitRedis(
  { type: "api" },
  async (req: NextRequest, { params }: { params: { customerId: string } }) => {
    try {
      const { userId } = await auth();
      
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      const { customerId } = params;

      // Verify that the requesting user owns this customer profile
      const [customerProfile] = await db
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.id, customerId),
            eq(profilesTable.userId, userId)
          )
        )
        .limit(1);

      if (!customerProfile) {
        return NextResponse.json(
          { error: "Customer profile not found or access denied" },
          { status: 404 }
        );
      }

      // Fetch all bookings for this customer
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
        .where(eq(bookingsTable.customerId, customerId))
        .orderBy(desc(bookingsTable.createdAt));

      // Transform bookings to include provider information from metadata
      const transformedBookings = bookings.map(booking => ({
        ...booking,
        providerName: booking.metadata?.providerName || 'Provider',
        providerBusinessName: booking.metadata?.providerBusinessName || 'Business',
        providerNotes: null, // This would come from provider updates
      }));

      return NextResponse.json({
        success: true,
        bookings: transformedBookings,
        total: bookings.length
      });

    } catch (error) {
      console.error("Error fetching customer bookings:", error);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }
  }
);

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}