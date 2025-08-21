import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createMarketplacePaymentIntent } from "@/lib/stripe";
import { db } from "@/db/db";
import { bookingsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
    }

    // Fetch booking with provider and customer details
    const [bookingData] = await db
      .select({
        booking: bookingsTable,
        provider: providersTable,
        customer: profilesTable,
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .leftJoin(profilesTable, eq(bookingsTable.customerId, profilesTable.userId))
      .where(
        and(
          eq(bookingsTable.id, bookingId),
          eq(bookingsTable.customerId, userId) // Ensure customer owns this booking
        )
      )
      .limit(1);

    if (!bookingData || !bookingData.booking || !bookingData.provider) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { booking, provider, customer } = bookingData;

    // Check if provider has completed Stripe onboarding
    if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Provider has not completed payment setup" },
        { status: 400 }
      );
    }

    // Check if booking is in correct status
    if (booking.status !== "pending") {
      return NextResponse.json(
        { error: "Booking cannot be paid - invalid status" },
        { status: 400 }
      );
    }

    // Calculate amounts
    const totalAmountCents = Math.round(parseFloat(booking.totalAmount) * 100);
    const platformFeeCents = Math.round(parseFloat(booking.platformFee) * 100);

    // Create payment intent
    const paymentIntent = await createMarketplacePaymentIntent({
      amount: totalAmountCents,
      currency: "usd", // TODO: Make this configurable
      customerId: customer?.stripeCustomerId || undefined,
      stripeConnectAccountId: provider.stripeConnectAccountId,
      platformFeeAmount: platformFeeCents,
      metadata: {
        bookingId: booking.id,
        providerId: provider.id,
        customerId: userId,
        serviceName: booking.serviceName,
      },
    });

    // Update booking with payment intent ID
    await db
      .update(bookingsTable)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}