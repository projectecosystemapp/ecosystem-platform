// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { eq, and, isNull, sql } from "drizzle-orm";

interface RouteParams {
  params: {
    providerId: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { providerId } = params;

    // Verify provider exists and user has access
    const [provider] = await db
      .select()
      .from(providersTable)
      .where(eq(providersTable.id, providerId))
      .limit(1);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Check if user is the provider or an admin
    if (provider.userId !== userId) {
      // TODO: Add admin check here
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Calculate total earnings (all completed bookings)
    const totalEarningsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed")
        )
      );

    const totalEarnings = parseFloat(totalEarningsResult[0]?.total?.toString() || "0");

    // Calculate pending payouts (completed bookings in hold period)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const pendingPayoutsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
      })
      .from(bookingsTable)
      .leftJoin(transactionsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed"),
          sql`${bookingsTable.completedAt} > ${twentyFourHoursAgo}`,
          isNull(transactionsTable.stripeTransferId)
        )
      );

    const pendingPayouts = parseFloat(pendingPayoutsResult[0]?.total?.toString() || "0");

    // Calculate available for payout (completed bookings past hold period)
    const availablePayoutsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${bookingsTable.providerPayout}), 0)`,
      })
      .from(bookingsTable)
      .leftJoin(transactionsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed"),
          sql`${bookingsTable.completedAt} <= ${twentyFourHoursAgo}`,
          isNull(transactionsTable.stripeTransferId)
        )
      );

    const availableForPayout = parseFloat(availablePayoutsResult[0]?.total?.toString() || "0");

    // Calculate completed payouts (already transferred)
    const completedPayoutsResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${transactionsTable.providerPayout}), 0)`,
      })
      .from(transactionsTable)
      .innerJoin(bookingsTable, eq(bookingsTable.id, transactionsTable.bookingId))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          sql`${transactionsTable.stripeTransferId} IS NOT NULL`,
          eq(transactionsTable.status, "completed")
        )
      );

    const completedPayouts = parseFloat(completedPayoutsResult[0]?.total?.toString() || "0");

    // Get last and next payout dates
    const lastPayoutResult = await db
      .select({
        processedAt: transactionsTable.processedAt,
      })
      .from(transactionsTable)
      .innerJoin(bookingsTable, eq(bookingsTable.id, transactionsTable.bookingId))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          sql`${transactionsTable.stripeTransferId} IS NOT NULL`,
          eq(transactionsTable.status, "completed")
        )
      )
      .orderBy(sql`${transactionsTable.processedAt} DESC`)
      .limit(1);

    const lastPayoutDate = lastPayoutResult[0]?.processedAt?.toISOString() || null;

    // Calculate next payout date (oldest eligible booking + 24 hours)
    const nextPayoutResult = await db
      .select({
        completedAt: bookingsTable.completedAt,
      })
      .from(bookingsTable)
      .leftJoin(transactionsTable, eq(transactionsTable.bookingId, bookingsTable.id))
      .where(
        and(
          eq(bookingsTable.providerId, providerId),
          eq(bookingsTable.status, "completed"),
          isNull(transactionsTable.stripeTransferId)
        )
      )
      .orderBy(bookingsTable.completedAt)
      .limit(1);

    let nextPayoutDate = null;
    if (nextPayoutResult[0]?.completedAt) {
      const completedAt = new Date(nextPayoutResult[0].completedAt);
      const payoutDate = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
      nextPayoutDate = payoutDate.toISOString();
    }

    return NextResponse.json({
      totalEarnings,
      pendingPayouts,
      availableForPayout,
      completedPayouts,
      lastPayoutDate,
      nextPayoutDate,
    });

  } catch (error) {
    console.error("Error fetching payout summary:", error);
    
    return NextResponse.json(
      { error: "Failed to fetch payout summary" },
      { status: 500 }
    );
  }
}