// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db/db";
import { providersTable, transactionsTable, bookingsTable } from "@/db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { z } from "zod";
import Stripe from "stripe";

// Validation schemas
const getPayoutsSchema = z.object({
  providerId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(10),
  startingAfter: z.string().optional(),
});

const createInstantPayoutSchema = z.object({
  providerId: z.string().uuid(),
  amount: z.number().positive().int().optional(), // Amount in cents, optional for full balance
  currency: z.string().default("usd"),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const getPayoutDetailsSchema = z.object({
  providerId: z.string().uuid(),
  payoutId: z.string(),
});

/**
 * GET /api/stripe/payouts
 * Get payout history for a provider
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const params = getPayoutsSchema.parse({
      providerId: searchParams.get("providerId"),
      startDate: searchParams.get("startDate"),
      endDate: searchParams.get("endDate"),
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 10,
      startingAfter: searchParams.get("startingAfter"),
    });

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, params.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    if (!provider.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No Stripe account connected" },
        { status: 400 }
      );
    }

    // Build Stripe query params
    const stripeParams: Stripe.PayoutListParams = {
      limit: params.limit,
    };

    // Build created filter if dates are provided
    const createdFilter: any = {};
    if (params.startDate) {
      createdFilter.gte = Math.floor(new Date(params.startDate).getTime() / 1000);
    }
    if (params.endDate) {
      createdFilter.lte = Math.floor(new Date(params.endDate).getTime() / 1000);
    }
    if (Object.keys(createdFilter).length > 0) {
      stripeParams.created = createdFilter;
    }

    if (params.startingAfter) {
      stripeParams.starting_after = params.startingAfter;
    }

    // Get payouts from Stripe
    const payouts = await stripe.payouts.list(stripeParams, {
      stripeAccount: provider.stripeConnectAccountId,
    });

    // Get account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: provider.stripeConnectAccountId,
    });

    // Get recent transactions from our database for reconciliation
    const dateFilters = [];
    if (params.startDate) {
      dateFilters.push(gte(bookingsTable.completedAt, new Date(params.startDate)));
    }
    if (params.endDate) {
      dateFilters.push(lte(bookingsTable.completedAt, new Date(params.endDate)));
    }

    const recentTransactions = await db
      .select({
        bookingId: bookingsTable.id,
        serviceName: bookingsTable.serviceName,
        amount: transactionsTable.providerPayout,
        processedAt: transactionsTable.processedAt,
        status: transactionsTable.status,
      })
      .from(transactionsTable)
      .innerJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, params.providerId),
          eq(transactionsTable.status, "completed"),
          ...dateFilters
        )
      )
      .orderBy(desc(transactionsTable.processedAt))
      .limit(50);

    // Calculate summary statistics
    const totalEarnings = recentTransactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    return NextResponse.json({
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
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message,
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
        instantAvailable: balance.instant_available?.map(b => ({
          amount: b.amount,
          currency: b.currency,
        })),
      },
      recentTransactions: recentTransactions.map(t => ({
        bookingId: t.bookingId,
        serviceName: t.serviceName,
        amount: Number(t.amount),
        processedAt: t.processedAt?.toISOString(),
        status: t.status,
      })),
      summary: {
        totalEarnings,
        transactionCount: recentTransactions.length,
      },
      hasMore: payouts.has_more,
      nextCursor: payouts.has_more ? payouts.data[payouts.data.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch payouts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stripe/payouts
 * Create an instant payout (if available)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      providerId, 
      amount, 
      currency, 
      description,
      idempotencyKey,
    } = createInstantPayoutSchema.parse(body);

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    if (!provider.stripeConnectAccountId || !provider.stripeOnboardingComplete) {
      return NextResponse.json(
        { error: "Stripe account not fully set up" },
        { status: 400 }
      );
    }

    // Check instant payout availability
    const balance = await stripe.balance.retrieve({
      stripeAccount: provider.stripeConnectAccountId,
    });

    const instantAvailable = balance.instant_available?.find(
      b => b.currency === currency
    );

    if (!instantAvailable || instantAvailable.amount <= 0) {
      return NextResponse.json(
        { error: "No funds available for instant payout" },
        { status: 400 }
      );
    }

    // Check if requested amount is available
    if (amount && amount > instantAvailable.amount) {
      return NextResponse.json(
        { 
          error: "Requested amount exceeds available balance",
          available: instantAvailable.amount,
          requested: amount,
        },
        { status: 400 }
      );
    }

    // Create payout params
    const payoutParams: Stripe.PayoutCreateParams = {
      amount: amount || 0, // Amount is required, 0 means full balance
      currency,
      method: "instant",
      description: description || `Instant payout for ${provider.displayName}`,
      metadata: {
        providerId: provider.id,
        requestedBy: userId,
        requestedAt: new Date().toISOString(),
      },
    };

    // Add idempotency key if provided
    const requestOptions: Stripe.RequestOptions = {
      stripeAccount: provider.stripeConnectAccountId,
    };
    if (idempotencyKey) {
      requestOptions.idempotencyKey = idempotencyKey;
    }

    // Create the instant payout
    const payout = await stripe.payouts.create(payoutParams, requestOptions);

    // Log the payout for auditing
    console.log(`Instant payout created for provider ${provider.id}:`, {
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
    });

    return NextResponse.json({
      success: true,
      payoutId: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
      status: payout.status,
      type: payout.type,
      method: payout.method,
      description: payout.description,
    });
  } catch (error) {
    console.error("Error creating instant payout:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create instant payout" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stripe/payouts/[payoutId]
 * Get details of a specific payout
 */
async function getPayoutDetails(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const params = getPayoutDetailsSchema.parse({
      providerId: searchParams.get("providerId"),
      payoutId: searchParams.get("payoutId"),
    });

    // Get provider and verify ownership
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, params.providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 }
      );
    }

    if (provider.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You don't own this provider profile" },
        { status: 403 }
      );
    }

    if (!provider.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "No Stripe account connected" },
        { status: 400 }
      );
    }

    // Get payout details from Stripe
    const payout = await stripe.payouts.retrieve(
      params.payoutId,
      {
        expand: ["destination", "failure_balance_transaction"],
      },
      {
        stripeAccount: provider.stripeConnectAccountId,
      }
    );

    // Get balance transactions for this payout
    const balanceTransactions = await stripe.balanceTransactions.list(
      {
        payout: params.payoutId,
        limit: 100,
      },
      {
        stripeAccount: provider.stripeConnectAccountId,
      }
    );

    return NextResponse.json({
      success: true,
      payout: {
        id: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        arrivalDate: new Date(payout.arrival_date * 1000).toISOString(),
        created: new Date(payout.created * 1000).toISOString(),
        status: payout.status,
        type: payout.type,
        method: payout.method,
        description: payout.description,
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message,
        destination: payout.destination,
      },
      transactions: balanceTransactions.data.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        fee: tx.fee,
        net: tx.net,
        type: tx.type,
        created: new Date(tx.created * 1000).toISOString(),
        description: tx.description,
        source: tx.source,
      })),
      transactionCount: balanceTransactions.data.length,
    });
  } catch (error) {
    console.error("Error fetching payout details:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch payout details" },
      { status: 500 }
    );
  }
}