import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { payoutService } from "@/lib/payments/payout-service";
import { db } from "@/db/db";
import { payoutSchedulesTable } from "@/db/schema/enhanced-booking-schema";
import { eq, and, lte, or } from "drizzle-orm";

/**
 * Cron job endpoint for automatic payout processing
 * This should be called by a scheduled job (e.g., Vercel Cron, GitHub Actions, or external service)
 * 
 * Schedule recommendation: Run every hour for timely payouts
 * Cron expression: 0 * * * *
 */
export async function GET(req: NextRequest) {
  try {
    // Verify the request is from an authorized source
    const authHeader = headers().get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron job not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const startTime = new Date();
    console.log(`[CRON] Starting payout processing at ${startTime.toISOString()}`);
    
    // Process scheduled payouts directly
    const processedCount = await payoutService.processScheduledPayouts();
    
    // Retry failed payouts (with retry limits)
    const retriedCount = await payoutService.retryFailedPayouts();
    
    // Clean up old cancelled/failed payouts (older than 30 days)
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() - 30);
    
    const cleanedUp = await db
      .delete(payoutSchedulesTable)
      .where(
        and(
          or(
            eq(payoutSchedulesTable.status, "cancelled"),
            eq(payoutSchedulesTable.status, "failed")
          ),
          lte(payoutSchedulesTable.createdAt, cleanupDate)
        )
      )
      .returning();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Log the results
    const result = {
      success: true,
      timestamp: startTime.toISOString(),
      duration: `${duration}ms`,
      processed: processedCount,
      retried: retriedCount,
      cleaned: cleanedUp.length,
      nextRun: getNextRunTime(),
    };
    
    console.log(`[CRON] Payout processing completed:`, result);

    // Clean up expired idempotency keys
    await cleanupIdempotencyKeys();

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Cron job error:", error);
    
    // Send alert to admin (implement based on your notification system)
    await notifyAdminOfCronFailure(error);
    
    return NextResponse.json(
      { 
        error: "Cron job failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint for monitoring
export async function HEAD(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}

async function cleanupIdempotencyKeys() {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/maintenance/cleanup-idempotency-keys`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.CRON_SECRET}`,
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(`Cleaned up ${result.deleted} expired idempotency keys`);
    }
  } catch (error) {
    console.error("Failed to cleanup idempotency keys:", error);
  }
}

// Helper function to calculate next run time
function getNextRunTime(): string {
  const next = new Date();
  next.setHours(next.getHours() + 1); // Runs every hour
  return next.toISOString();
}

async function notifyAdminOfCronFailure(error: any) {
  console.error("CRON JOB FAILURE - Admin notification needed:", {
    job: "process-payouts",
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  
  // Send alert to Slack webhook if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 Payout Cron Job Failed`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Job:* process-payouts\n*Error:* ${error.message}\n*Time:* ${new Date().toISOString()}`,
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Failed to send Slack alert:", e);
    }
  }
}