import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Cron job endpoint for automatic payout processing
 * This should be called by a scheduled job (e.g., Vercel Cron, GitHub Actions, or external service)
 * 
 * Schedule recommendation: Run every 6 hours
 * Cron expression: 0 [asterisk]/6 [asterisk] [asterisk] [asterisk]
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

    // Call the payout release endpoint with system authorization
    const payoutResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/stripe/payouts/release`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${cronSecret}`,
        },
      }
    );

    if (!payoutResponse.ok) {
      const error = await payoutResponse.text();
      throw new Error(`Payout processing failed: ${error}`);
    }

    const result = await payoutResponse.json();

    // Log the results
    console.log("Automatic payout processing completed:", {
      processed: result.processed,
      failed: result.failed,
      totalAmount: result.summary?.totalAmount,
      timestamp: new Date().toISOString(),
    });

    // Clean up expired idempotency keys
    await cleanupIdempotencyKeys();

    return NextResponse.json({
      success: true,
      message: "Payout processing completed",
      ...result,
      timestamp: new Date().toISOString(),
    });

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

async function notifyAdminOfCronFailure(error: any) {
  // TODO: Implement based on your notification system
  console.error("CRON JOB FAILURE - Admin notification needed:", {
    job: "process-payouts",
    error: error.message,
    timestamp: new Date().toISOString(),
  });
  
  // Example implementations:
  // - Send email to admin
  // - Send Slack notification
  // - Create PagerDuty incident
  // - Log to error tracking service (Sentry, etc.)
}