import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { cleanupExpiredIdempotencyKeys } from "@/lib/stripe-enhanced";

/**
 * Maintenance endpoint for cleaning up expired idempotency keys
 * This prevents the idempotency_keys table from growing indefinitely
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the request is from an authorized source (cron job or admin)
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Clean up expired keys
    const deletedCount = await cleanupExpiredIdempotencyKeys();

    console.log(`Cleaned up ${deletedCount} expired idempotency keys`);

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Error cleaning up idempotency keys:", error);
    
    return NextResponse.json(
      { 
        error: "Cleanup failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking status
export async function GET(req: NextRequest) {
  try {
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get count of expired keys without deleting
    const { db } = await import("@/db/db");
    const { idempotencyKeysTable } = await import("@/lib/stripe-enhanced");
    const { lt, sql } = await import("drizzle-orm");

    const [result] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(idempotencyKeysTable)
      .where(lt(idempotencyKeysTable.expiresAt, new Date()));

    const expiredCount = parseInt(result?.count?.toString() || "0");

    return NextResponse.json({
      expiredKeys: expiredCount,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Error checking idempotency keys:", error);
    
    return NextResponse.json(
      { 
        error: "Status check failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}