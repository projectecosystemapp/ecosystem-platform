"use server";

import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable, providersTable } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { Stripe } from "stripe";

// Platform fee configuration
const PLATFORM_FEE_PERCENT = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT) || 10;
const GUEST_SURCHARGE_PERCENT = Number(process.env.NEXT_PUBLIC_GUEST_SURCHARGE_PERCENT) || 10;

/**
 * Create a Stripe Connect account for a provider
 */
export async function createConnectedAccount(
  providerId: string,
  accountType: "express" | "standard" = "express"
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return { error: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { error: "Unauthorized - You don't own this provider profile" };
    }

    // Check if account already exists
    if (provider.stripeConnectAccountId) {
      return { 
        error: "Stripe account already exists",
        accountId: provider.stripeConnectAccountId 
      };
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: accountType,
      country: provider.locationCountry || "US",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        providerId: provider.id,
        userId: userId,
        platformName: "Ecosystem",
      },
      settings: {
        payouts: {
          schedule: {
            interval: "daily",
            delay_days: 2,
          },
        },
      },
    });

    // Update provider with Stripe account ID
    await db
      .update(providersTable)
      .set({
        stripeConnectAccountId: account.id,
        updatedAt: new Date(),
      })
      .where(eq(providersTable.id, providerId));

    return {
      success: true,
      accountId: account.id,
      accountType: accountType,
    };
  } catch (error) {
    console.error("Error creating Stripe Connect account:", error);
    return { error: "Failed to create Stripe Connect account" };
  }
}

/**
 * Generate an account link for Stripe Connect onboarding
 */
export async function getAccountLink(
  providerId: string,
  refreshUrl?: string,
  returnUrl?: string
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return { error: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { error: "Unauthorized - You don't own this provider profile" };
    }

    if (!provider.stripeConnectAccountId) {
      return { error: "No Stripe account found. Please create one first." };
    }

    // Generate account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: provider.stripeConnectAccountId,
      refresh_url: refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL}/providers/${providerId}/settings?refresh=true`,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/providers/${providerId}/settings?success=true`,
      type: "account_onboarding",
    });

    return {
      success: true,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    };
  } catch (error) {
    console.error("Error generating account link:", error);
    return { error: "Failed to generate account link" };
  }
}

/**
 * Check the status of a Stripe Connect account
 */
export async function checkAccountStatus(providerId: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return { error: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { error: "Unauthorized - You don't own this provider profile" };
    }

    if (!provider.stripeConnectAccountId) {
      return {
        exists: false,
        onboardingComplete: false,
      };
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(provider.stripeConnectAccountId);

    // Check if onboarding is complete
    const onboardingComplete = 
      account.charges_enabled && 
      account.payouts_enabled &&
      account.details_submitted;

    // Update database if onboarding status changed
    if (onboardingComplete !== provider.stripeOnboardingComplete) {
      await db
        .update(providersTable)
        .set({
          stripeOnboardingComplete: onboardingComplete,
          updatedAt: new Date(),
        })
        .where(eq(providersTable.id, providerId));
    }

    return {
      exists: true,
      accountId: account.id,
      onboardingComplete,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: account.requirements,
      capabilities: account.capabilities,
      accountType: account.type,
      country: account.country,
      createdAt: account.created ? new Date(account.created * 1000).toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error checking account status:", error);
    return { error: "Failed to check account status" };
  }
}

/**
 * Calculate payment fees
 */
export function calculatePaymentFees(serviceAmount: number, isGuest: boolean) {
  // Base platform fee (10% of service amount)
  const basePlatformFee = Math.round(serviceAmount * (PLATFORM_FEE_PERCENT / 100));
  
  // Guest surcharge (additional 10% of service amount)
  const guestSurcharge = isGuest ? Math.round(serviceAmount * (GUEST_SURCHARGE_PERCENT / 100)) : 0;
  
  // Total platform fee
  const totalPlatformFee = basePlatformFee + guestSurcharge;
  
  // Provider always receives service amount minus base platform fee
  const providerPayout = serviceAmount - basePlatformFee;
  
  // Total amount customer pays
  const totalAmount = serviceAmount + guestSurcharge;
  
  return {
    serviceAmount,
    basePlatformFee,
    guestSurcharge,
    totalPlatformFee,
    providerPayout,
    totalAmount,
  };
}

/**
 * Create a payment with platform fee
 */
export async function createPaymentWithFee(
  bookingId: string,
  amount: number,
  isGuestCheckout: boolean = false,
  customerEmail?: string,
  description?: string
) {
  try {
    const { userId } = await auth();

    // Get booking details
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return { error: "Booking not found" };
    }

    // Verify ownership if not guest
    if (!isGuestCheckout && userId && booking.customerId !== userId) {
      return { error: "Unauthorized - You don't own this booking" };
    }

    // Get provider details
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, booking.providerId))
      .limit(1);

    if (!provider) {
      return { error: "Provider not found" };
    }

    // Check if provider has completed Stripe onboarding
    if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
      return { error: "Provider has not completed payment setup" };
    }

    // Calculate fees
    const fees = calculatePaymentFees(amount, isGuestCheckout);

    // Create payment intent with application fee
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: fees.totalAmount,
      currency: "usd",
      description: description || `Booking for ${booking.serviceName}`,
      metadata: {
        bookingId,
        providerId: provider.id,
        customerId: booking.customerId,
        isGuestCheckout: String(isGuestCheckout),
        serviceAmount: String(fees.serviceAmount),
        platformFee: String(fees.totalPlatformFee),
        providerPayout: String(fees.providerPayout),
      },
      application_fee_amount: fees.totalPlatformFee,
      transfer_data: {
        destination: provider.stripeConnectAccountId,
      },
      capture_method: "automatic",
      statement_descriptor_suffix: "ECOSYSTEM",
    };

    // Add customer email for guests
    if (isGuestCheckout && customerEmail) {
      paymentIntentParams.receipt_email = customerEmail;
    }

    // Create the payment intent
    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // Create transaction record
    await db.insert(transactionsTable).values({
      bookingId: bookingId,
      stripeChargeId: paymentIntent.id,
      amount: String(fees.totalAmount),
      platformFee: String(fees.totalPlatformFee),
      providerPayout: String(fees.providerPayout),
      status: "pending",
    });

    // Update booking with payment intent ID and amounts
    await db
      .update(bookingsTable)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        totalAmount: String(fees.totalAmount),
        platformFee: String(fees.totalPlatformFee),
        providerPayout: String(fees.providerPayout),
        isGuestBooking: isGuestCheckout,
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    return {
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      fees,
    };
  } catch (error) {
    console.error("Error creating payment:", error);
    return { error: "Failed to create payment" };
  }
}

/**
 * Get payout history for a provider
 */
export async function getPayoutHistory(
  providerId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return { error: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { error: "Unauthorized - You don't own this provider profile" };
    }

    if (!provider.stripeConnectAccountId) {
      return { error: "No Stripe account connected" };
    }

    // Build Stripe query params
    const stripeParams: Stripe.PayoutListParams = {
      limit: options?.limit || 10,
    };

    if (options?.startDate) {
      stripeParams.created = {
        ...(stripeParams.created as any || {}),
        gte: Math.floor(new Date(options.startDate).getTime() / 1000),
      };
    }

    if (options?.endDate) {
      stripeParams.created = {
        ...(stripeParams.created as any || {}),
        lte: Math.floor(new Date(options.endDate).getTime() / 1000),
      };
    }

    // Get payouts from Stripe
    const payouts = await stripe.payouts.list(stripeParams, {
      stripeAccount: provider.stripeConnectAccountId,
    });

    // Get account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: provider.stripeConnectAccountId,
    });

    return {
      success: true,
      payouts: payouts.data.map(payout => ({
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
        created: new Date(payout.created * 1000).toISOString(),
        status: payout.status,
        type: payout.type,
        method: payout.method,
        description: payout.description,
      })),
      balance: {
        available: balance.available.map(b => ({
          amount: b.amount,
          currency: b.currency,
        })),
        pending: balance.pending.map(b => ({
          amount: b.amount,
          currency: b.currency,
        })),
      },
      hasMore: payouts.has_more,
    };
  } catch (error) {
    console.error("Error fetching payout history:", error);
    return { error: "Failed to fetch payout history" };
  }
}

/**
 * Process a refund for a booking
 */
export async function processRefund(
  bookingId: string,
  amount?: number,
  reason?: string
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Get booking
    const [booking] = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) {
      return { error: "Booking not found" };
    }

    if (!booking.stripePaymentIntentId) {
      return { error: "No payment found for this booking" };
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: booking.stripePaymentIntentId,
      amount: amount,
      reason: reason as Stripe.RefundCreateParams.Reason || "requested_by_customer",
      reverse_transfer: true,
      metadata: {
        bookingId,
        refundedBy: userId,
        refundedAt: new Date().toISOString(),
      },
    });

    // Update transaction record
    await db
      .update(transactionsTable)
      .set({
        stripeRefundId: refund.id,
        status: "refunded",
      })
      .where(eq(transactionsTable.bookingId, bookingId));

    // Update booking status
    await db
      .update(bookingsTable)
      .set({
        status: "cancelled",
        cancellationReason: reason || "Customer requested refund",
        cancelledBy: userId,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, bookingId));

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
    };
  } catch (error) {
    console.error("Error processing refund:", error);
    return { error: "Failed to process refund" };
  }
}

/**
 * Get provider's earnings summary
 */
export async function getProviderEarnings(providerId: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return { error: "Provider not found" };
    }

    if (provider.userId !== userId) {
      return { error: "Unauthorized - You don't own this provider profile" };
    }

    // Get completed bookings with transactions
    const earnings = await db
      .select({
        bookingId: bookingsTable.id,
        serviceName: bookingsTable.serviceName,
        bookingDate: bookingsTable.bookingDate,
        servicePrice: bookingsTable.servicePrice,
        platformFee: bookingsTable.platformFee,
        providerPayout: bookingsTable.providerPayout,
        status: bookingsTable.status,
        completedAt: bookingsTable.completedAt,
        transactionStatus: transactionsTable.status,
      })
      .from(bookingsTable)
      .leftJoin(transactionsTable, eq(bookingsTable.id, transactionsTable.bookingId))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed")
        )
      )
      .orderBy(desc(bookingsTable.completedAt))
      .limit(100);

    // Calculate totals
    const totalEarnings = earnings.reduce(
      (sum, e) => sum + Number(e.providerPayout || 0),
      0
    );

    const totalPlatformFees = earnings.reduce(
      (sum, e) => sum + Number(e.platformFee || 0),
      0
    );

    const completedBookings = earnings.filter(
      e => e.transactionStatus === "completed"
    ).length;

    return {
      success: true,
      earnings: earnings.map(e => ({
        bookingId: e.bookingId,
        serviceName: e.serviceName,
        bookingDate: e.bookingDate.toISOString(),
        servicePrice: Number(e.servicePrice),
        platformFee: Number(e.platformFee),
        providerPayout: Number(e.providerPayout),
        status: e.status,
        completedAt: e.completedAt?.toISOString(),
        transactionStatus: e.transactionStatus,
      })),
      summary: {
        totalEarnings,
        totalPlatformFees,
        completedBookings,
        averageBookingValue: completedBookings > 0 ? totalEarnings / completedBookings : 0,
      },
    };
  } catch (error) {
    console.error("Error fetching provider earnings:", error);
    return { error: "Failed to fetch earnings" };
  }
}