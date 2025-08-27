// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, lte, isNull, or } from "drizzle-orm";
import { withRateLimitRedis } from "@/lib/rate-limit-redis";
import crypto from "crypto";

interface PayoutReleaseRequest {
  bookingId?: string; // For manual single payout
  providerId?: string; // For releasing all eligible payouts for a provider
  force?: boolean; // Override 24-hour hold period (admin only)
}

// Minimum hold period for funds (24 hours)
const MINIMUM_HOLD_PERIOD_MS = 24 * 60 * 60 * 1000;

// Generate idempotency key for payout operation
const generateIdempotencyKey = (bookingId: string, operation: string) => {
  const timestamp = Date.now();
  const data = `payout-${operation}-${bookingId}-${timestamp}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

export const POST = withRateLimitRedis(
  { type: "payment" },
  async (req: NextRequest) => {
    try {
      const { userId } = auth();
      
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body: PayoutReleaseRequest = await req.json();
      const { bookingId, providerId, force } = body;

      if (!bookingId && !providerId) {
        return NextResponse.json(
          { error: "Either bookingId or providerId is required" },
          { status: 400 }
        );
      }

      // Check if user is admin for force release
      const isAdmin = await checkAdminRole(userId);
      if (force && !isAdmin) {
        return NextResponse.json(
          { error: "Only administrators can force release payouts" },
          { status: 403 }
        );
      }

      if (bookingId) {
        // Release single booking payout
        const result = await releaseSinglePayout(bookingId, userId, force);
        return NextResponse.json(result);
      } else if (providerId) {
        // Release all eligible payouts for provider
        const results = await releaseProviderPayouts(providerId, userId, force);
        return NextResponse.json(results);
      }

      // This should never be reached due to validation above, but needed for TypeScript
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 }
      );

    } catch (error: any) {
      console.error("Error releasing payout:", error);
      
      return NextResponse.json(
        { error: error.message || "Failed to release payout" },
        { status: error.status || 500 }
      );
    }
  }
);

// Release payout for a single booking
async function releaseSinglePayout(
  bookingId: string, 
  userId: string, 
  force?: boolean
) {
  return await db.transaction(async (tx) => {
    // Fetch booking with provider and transaction details
    const [bookingData] = await tx
      .select({
        booking: bookingsTable,
        provider: providersTable,
        transaction: transactionsTable,
      })
      .from(bookingsTable)
      .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
      .leftJoin(transactionsTable, and(
        eq(transactionsTable.bookingId, bookingsTable.id),
        eq(transactionsTable.status, "pending")
      ))
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!bookingData || !bookingData.booking) {
      throw new Error("Booking not found");
    }

    const { booking, provider, transaction } = bookingData;

    // Verify provider owns this booking or user is admin
    const isProvider = provider?.userId === userId;
    const isAdmin = await checkAdminRole(userId);
    
    if (!isProvider && !isAdmin) {
      throw new Error("Not authorized to release this payout");
    }

    // Check if provider has completed Stripe onboarding
    if (!provider?.stripeConnectAccountId || !provider?.stripeOnboardingComplete) {
      throw new Error("Provider has not completed payment setup");
    }

    // Validate booking status
    if (booking.status !== "completed") {
      throw new Error(`Cannot release payout for booking with status: ${booking.status}`);
    }

    // Check if payout was already processed
    if (transaction?.stripeTransferId) {
      throw new Error("Payout has already been released for this booking");
    }

    // Check minimum hold period (unless forced by admin)
    if (!force) {
      const completedAt = booking.completedAt || booking.updatedAt;
      const holdPeriodEnd = new Date(completedAt.getTime() + MINIMUM_HOLD_PERIOD_MS);
      
      if (new Date() < holdPeriodEnd) {
        const hoursRemaining = Math.ceil((holdPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60));
        throw new Error(`Payout is on hold. ${hoursRemaining} hours remaining before release.`);
      }
    }

    if (!booking.stripePaymentIntentId) {
      throw new Error("No payment found for this booking");
    }

    // Calculate payout amount (total minus platform fee)
    const providerPayoutCents = Math.round(parseFloat(booking.providerPayout) * 100);

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(bookingId, "transfer");

    // Create transfer to connected account
    const transfer = await stripe.transfers.create({
      amount: providerPayoutCents,
      currency: "usd",
      destination: provider.stripeConnectAccountId,
      transfer_group: `booking_${bookingId}`,
      description: `Payout for booking ${bookingId}`,
      metadata: {
        bookingId: booking.id,
        providerId: provider.id,
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate.toISOString(),
      },
    }, {
      idempotencyKey: idempotencyKey,
    });

    // Update or create transaction record
    if (transaction) {
      await tx
        .update(transactionsTable)
        .set({
          stripeTransferId: transfer.id,
          status: "completed",
          processedAt: new Date(),
        })
        .where(eq(transactionsTable.id, transaction.id));
    } else {
      await tx.insert(transactionsTable).values({
        bookingId: booking.id,
        stripeTransferId: transfer.id,
        amount: booking.totalAmount,
        platformFee: booking.platformFee,
        providerPayout: booking.providerPayout,
        status: "completed",
        processedAt: new Date(),
      });
    }

    // Send payout notification
    await sendPayoutNotification({
      provider,
      booking,
      payoutAmount: providerPayoutCents / 100,
    });

    return {
      success: true,
      payout: {
        transferId: transfer.id,
        amount: providerPayoutCents / 100,
        currency: transfer.currency,
        status: transfer.created ? "completed" : "pending",
        bookingId: booking.id,
        providerId: provider.id,
      },
    };
  });
}

// Release all eligible payouts for a provider
async function releaseProviderPayouts(
  providerId: string, 
  userId: string, 
  force?: boolean
) {
  // Verify provider authorization
  const [provider] = await db
    .select()
    .from(providersTable)
    .where(eq(providersTable.id, providerId))
    .limit(1);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const isProvider = provider.userId === userId;
  const isAdmin = await checkAdminRole(userId);
  
  if (!isProvider && !isAdmin) {
    throw new Error("Not authorized to release payouts for this provider");
  }

  // Find all eligible bookings for payout
  const eligibleBookings = await db
    .select({
      booking: bookingsTable,
      transaction: transactionsTable,
    })
    .from(bookingsTable)
    .leftJoin(transactionsTable, eq(transactionsTable.bookingId, bookingsTable.id))
    .where(
      and(
        eq(bookingsTable.providerId, providerId),
        eq(bookingsTable.status, "completed"),
        or(
          isNull(transactionsTable.stripeTransferId),
          eq(transactionsTable.status, "pending")
        ),
        force ? undefined : lte(
          bookingsTable.completedAt,
          new Date(Date.now() - MINIMUM_HOLD_PERIOD_MS)
        )
      )
    );

  if (eligibleBookings.length === 0) {
    return {
      success: true,
      message: "No eligible bookings for payout",
      payouts: [],
    };
  }

  const results = [];
  const errors = [];

  // Process each eligible booking
  for (const { booking } of eligibleBookings) {
    try {
      const result = await releaseSinglePayout(booking.id, userId, force);
      results.push(result.payout);
    } catch (error: any) {
      errors.push({
        bookingId: booking.id,
        error: error.message,
      });
    }
  }

  return {
    success: errors.length === 0,
    message: `Released ${results.length} payouts, ${errors.length} failed`,
    payouts: results,
    errors: errors.length > 0 ? errors : undefined,
    summary: {
      totalReleased: results.length,
      totalAmount: results.reduce((sum, p) => sum + p.amount, 0),
      failed: errors.length,
    },
  };
}

// GET endpoint for automatic payout processing (can be called by cron job)
export const GET = withRateLimitRedis(
  { type: "api" }, // Use predefined rate limit for API calls
  async (req: NextRequest) => {
    try {
      // Verify this is being called by an authorized cron job
      const authHeader = req.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Find all bookings eligible for automatic payout
      const eligibleBookings = await db
        .select({
          booking: bookingsTable,
          provider: providersTable,
        })
        .from(bookingsTable)
        .leftJoin(providersTable, eq(bookingsTable.providerId, providersTable.id))
        .leftJoin(transactionsTable, eq(transactionsTable.bookingId, bookingsTable.id))
        .where(
          and(
            eq(bookingsTable.status, "completed"),
            lte(
              bookingsTable.completedAt,
              new Date(Date.now() - MINIMUM_HOLD_PERIOD_MS)
            ),
            isNull(transactionsTable.stripeTransferId)
          )
        );

      const results = [];
      const errors = [];

      // Process each eligible booking
      for (const { booking, provider } of eligibleBookings) {
        if (!provider?.stripeConnectAccountId || !provider?.stripeOnboardingComplete) {
          errors.push({
            bookingId: booking.id,
            error: "Provider not properly onboarded",
          });
          continue;
        }

        try {
          // Use system user ID for automatic payouts
          const result = await releaseSinglePayout(booking.id, "system", false);
          results.push(result.payout);
        } catch (error: any) {
          errors.push({
            bookingId: booking.id,
            error: error.message,
          });
        }
      }

      console.log(`Automatic payout processing: ${results.length} succeeded, ${errors.length} failed`);

      return NextResponse.json({
        success: true,
        processed: results.length,
        failed: errors.length,
        summary: {
          totalReleased: results.length,
          totalAmount: results.reduce((sum, p) => sum + p.amount, 0),
          errors: errors.length > 0 ? errors : undefined,
        },
      });

    } catch (error: any) {
      console.error("Error in automatic payout processing:", error);
      
      return NextResponse.json(
        { error: "Failed to process automatic payouts" },
        { status: 500 }
      );
    }
  }
);

// Helper function to check admin role
async function checkAdminRole(userId: string): Promise<boolean> {
  // TODO: Implement based on your RBAC system
  // For now, return false
  return userId === "system"; // Allow system user for automatic payouts
}

// Helper function to send payout notification
async function sendPayoutNotification(params: {
  provider: any;
  booking: any;
  payoutAmount: number;
}) {
  // TODO: Implement your notification system
  console.log("Sending payout notification:", params);
  
  // Example structure:
  // - Send email to provider confirming payout
  // - Create in-app notification
  // - Update provider dashboard with payout info
}