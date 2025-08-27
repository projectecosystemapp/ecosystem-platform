// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { reconciliationService } from "@/services/reconciliation-service";

/**
 * Cron job for daily payment reconciliation
 * Runs daily at 2 AM to reconcile previous day's transactions
 * 
 * Schedule recommendation: Daily at 2 AM
 * Cron expression: 0 2 * * *
 */

// Verify cron authentication
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = headers().get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.error("CRON_SECRET not configured");
    return false;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const startTime = new Date();
    console.log(`[CRON] Starting reconciliation at ${startTime.toISOString()}`);
    
    // Get reconciliation date (yesterday by default)
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");
    
    const reconciliationDate = dateParam 
      ? new Date(dateParam)
      : getPreviousDay();
    
    // Run daily reconciliation
    const result = await reconciliationService.runDailyReconciliation(reconciliationDate);
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Log results
    console.log(`[CRON] Reconciliation completed:`, {
      runId: result.runId,
      date: result.date.toISOString(),
      matched: result.matched,
      unmatched: result.unmatched,
      discrepancies: result.discrepancies.length,
      totalReconciled: result.totalReconciled,
      duration: `${duration}ms`,
    });
    
    // Send alert if critical discrepancies found
    if (result.discrepancies.length > 0) {
      const criticalCount = result.discrepancies.filter(
        d => d.difference > 10000 || d.status === 'missing_in_db'
      ).length;
      
      if (criticalCount > 0) {
        await sendReconciliationAlert({
          runId: result.runId,
          date: result.date,
          criticalDiscrepancies: criticalCount,
          totalDiscrepancies: result.discrepancies.length,
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      runId: result.runId,
      date: result.date.toISOString(),
      matched: result.matched,
      unmatched: result.unmatched,
      discrepancies: result.discrepancies.length,
      totalReconciled: result.totalReconciled,
      duration: `${duration}ms`,
      nextRun: getNextRunTime(),
    });
    
  } catch (error) {
    console.error("[CRON] Error during reconciliation:", error);
    
    // Send critical error alert
    await sendCronErrorAlert({
      job: "reconcile-payments",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Reconciliation failed",
      },
      { status: 500 }
    );
  }
}

// Get previous day for reconciliation
function getPreviousDay(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date;
}

// Calculate next run time
function getNextRunTime(): string {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(2, 0, 0, 0); // 2 AM tomorrow
  return next.toISOString();
}

// Send reconciliation alert
async function sendReconciliationAlert(alert: {
  runId: string;
  date: Date;
  criticalDiscrepancies: number;
  totalDiscrepancies: number;
}) {
  console.warn("RECONCILIATION ALERT:", alert);
  
  // Send to Slack if configured
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `⚠️ Reconciliation Discrepancies Found`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `*Run ID:* ${alert.runId}`,
                  `*Date:* ${alert.date.toISOString().split('T')[0]}`,
                  `*Critical Issues:* ${alert.criticalDiscrepancies}`,
                  `*Total Discrepancies:* ${alert.totalDiscrepancies}`,
                  ``,
                  `Please review: ${process.env.NEXT_PUBLIC_APP_URL}/admin/reconciliation/${alert.runId}`,
                ].join('\n'),
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Failed to send Slack alert:", e);
    }
  }
  
  // TODO: Send email to finance team
  // TODO: Create task in project management system
}

// Send error alert
async function sendCronErrorAlert(alert: {
  job: string;
  error: string;
  timestamp: string;
}) {
  console.error("[ALERT]", alert);
  
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 Reconciliation Cron Job Failed`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Job:* ${alert.job}\n*Error:* ${alert.error}\n*Time:* ${alert.timestamp}`,
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