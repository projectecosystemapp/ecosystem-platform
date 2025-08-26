import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { customersTable } from "@/db/schema/customers-schema";
import { eq } from "drizzle-orm";
import { generateConfirmationCode } from "@/lib/utils";
import { calculateFees } from "@/lib/payments/fee-calculator";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      providerId,
      serviceName,
      servicePrice,
      serviceDuration,
      bookingDate,
      startTime,
      endTime,
      customerNotes,
    } = body;

    // Validate required fields
    if (!providerId || !serviceName || !servicePrice || !serviceDuration || !bookingDate || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create customer record
    let [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.userId, userId))
      .limit(1);

    if (!customer) {
      // Create customer record if doesn't exist
      [customer] = await db
        .insert(customersTable)
        .values({
          userId,
          email: "", // Will be updated from Clerk
          createdAt: new Date(),
        })
        .returning();
    }

    // Get provider details
    const [provider] = await db
      .select({
        id: providersTable.id,
        displayName: providersTable.displayName,
        email: providersTable.email,
        commissionRate: providersTable.commissionRate,
        currency: providersTable.currency,
      })
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    // Calculate fees for authenticated customer (no guest surcharge)
    const baseAmountCents = Math.round(servicePrice * 100);
    const fees = calculateFees({
      baseAmountCents,
      isGuest: false, // Authenticated customer
      providerCommissionRate: provider.commissionRate ? parseFloat(provider.commissionRate) : undefined
    });

    // Create booking
    const confirmationCode = generateConfirmationCode();
    
    const [booking] = await db
      .insert(bookingsTable)
      .values({
        customerId: customer.id,
        providerId: provider.id,
        serviceName,
        serviceDescription: serviceName, // Use service name as description if not provided
        serviceDuration,
        bookingDate: new Date(bookingDate),
        startTime,
        endTime,
        totalAmount: (fees.totalAmountCents / 100).toFixed(2),
        platformFee: (fees.platformFeeCents / 100).toFixed(2),
        providerPayout: (fees.providerPayoutCents / 100).toFixed(2),
        guestSurcharge: (fees.guestSurchargeCents / 100).toFixed(2), // Will be 0 for authenticated
        currency: provider.currency || 'usd',
        status: 'initiated',
        paymentStatus: 'pending',
        confirmationCode,
        customerNotes,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        status: booking.status,
        totalAmount: booking.totalAmount,
        fees: {
          platformFee: booking.platformFee,
          providerPayout: booking.providerPayout,
          guestSurcharge: booking.guestSurcharge,
        },
      },
    });

  } catch (error) {
    console.error("Error creating customer booking:", error);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}