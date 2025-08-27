// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUpcomingBookings } from "@/db/queries/bookings-queries";
import { db } from "@/db/db";
import { providersTable } from "@/db/schema/providers-schema";
import { eq } from "drizzle-orm";

// GET /api/providers/[providerId]/bookings/upcoming - Get upcoming bookings for a provider
export async function GET(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Verify the provider exists and belongs to the user
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, params.providerId));
    
    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }
    
    // Only the provider owner can view their bookings
    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized to view these bookings" },
        { status: 403 }
      );
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    
    // Get upcoming bookings
    const bookings = await getUpcomingBookings(params.providerId, limit);
    
    // Enhance bookings with customer information
    const enhancedBookings = await Promise.all(
      bookings.map(async (booking) => {
        // For guest bookings, extract email from customerId
        if (booking.isGuestBooking) {
          const guestEmail = booking.customerId.replace("guest_", "");
          return {
            ...booking,
            customerName: "Guest",
            customerEmail: guestEmail,
          };
        }
        
        // For authenticated bookings, get user profile
        // You might want to fetch from profiles table here
        return {
          ...booking,
          customerName: booking.customerId, // Replace with actual name lookup
          customerEmail: null, // Replace with actual email lookup
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      bookings: enhancedBookings,
      count: enhancedBookings.length,
    });
  } catch (error) {
    console.error("Error fetching upcoming bookings:", error);
    
    return NextResponse.json(
      { error: "Failed to fetch upcoming bookings" },
      { status: 500 }
    );
  }
}