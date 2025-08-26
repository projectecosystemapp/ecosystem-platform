import { NextRequest, NextResponse } from 'next/server';
import { reconciliationService } from '@/services/reconciliation-service';
import { headers } from 'next/headers';

// This endpoint should be called by a cron job service like:
// - Vercel Cron Jobs
// - GitHub Actions
// - External cron services (cron-job.org, etc.)
// - Self-hosted cron

/**
 * POST /api/cron/reconciliation
 * Run daily financial reconciliation
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is authorized
    // In production, use a secret token or verify the source
    const authHeader = headers().get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get date from request or use yesterday
    const body = await request.json().catch(() => ({}));
    const targetDate = body.date ? new Date(body.date) : getPreviousDay();

    console.log(`Starting reconciliation for ${targetDate.toISOString()}`);

    // Run reconciliation
    const result = await reconciliationService.runDailyReconciliation(targetDate);

    // Log results
    console.log(`Reconciliation completed:`, {
      date: targetDate.toISOString(),
      matched: result.matched,
      unmatched: result.unmatched,
      discrepancies: result.discrepancies.length,
      totalReconciled: result.totalReconciled,
    });

    // Send alerts if there are critical discrepancies
    if (result.discrepancies.length > 0) {
      await sendReconciliationAlert(result);
    }

    return NextResponse.json({
      success: true,
      runId: result.runId,
      date: targetDate.toISOString(),
      summary: {
        matched: result.matched,
        unmatched: result.unmatched,
        discrepancies: result.discrepancies.length,
        totalReconciled: result.totalReconciled,
      },
      criticalIssues: result.discrepancies.filter(
        d => d.difference > 10000 || d.status === 'missing_in_db'
      ),
    });

  } catch (error) {
    console.error('Reconciliation cron job failed:', error);
    
    // Send error notification
    await sendErrorNotification(error);

    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Reconciliation failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/reconciliation
 * Get reconciliation status and recent runs
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = headers().get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get recent reconciliation runs
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch recent runs from database
    const recentRuns = await getRecentReconciliationRuns(limit);

    return NextResponse.json({
      success: true,
      runs: recentRuns,
      nextScheduledRun: getNextScheduledRun(),
    });

  } catch (error) {
    console.error('Failed to get reconciliation status:', error);
    return NextResponse.json(
      { error: 'Failed to get reconciliation status' },
      { status: 500 }
    );
  }
}

// Helper functions

function getPreviousDay(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getNextScheduledRun(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0); // Run at 2 AM
  return tomorrow;
}

async function sendReconciliationAlert(result: any) {
  // Implement notification logic
  // This could be email, Slack, SMS, etc.
  
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ Reconciliation Alert`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Reconciliation completed with discrepancies*\n` +
                      `• Matched: ${result.matched}\n` +
                      `• Unmatched: ${result.unmatched}\n` +
                      `• Total Discrepancies: ${result.discrepancies.length}\n` +
                      `• Critical Issues: ${result.discrepancies.filter((d: any) => d.difference > 10000).length}`,
              },
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  // Log to monitoring service (e.g., Sentry, DataDog, etc.)
  console.warn('Reconciliation discrepancies found:', result.discrepancies);
}

async function sendErrorNotification(error: any) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  if (process.env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Reconciliation Cron Job Failed`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Error:* ${errorMessage}\n*Time:* ${new Date().toISOString()}`,
              },
            },
          ],
        }),
      });
    } catch (slackError) {
      console.error('Failed to send error notification:', slackError);
    }
  }

  // Log to error tracking service
  console.error('Reconciliation cron job error:', error);
}

async function getRecentReconciliationRuns(limit: number) {
  const { db } = await import('@/db/db');
  const { desc, sql } = await import('drizzle-orm');

  const runs = await db
    .select({
      id: sql`id`,
      runDate: sql`run_date`,
      runType: sql`run_type`,
      status: sql`status`,
      totalTransactions: sql`total_transactions`,
      matchedTransactions: sql`matched_transactions`,
      unmatchedTransactions: sql`unmatched_transactions`,
      discrepanciesFound: sql`discrepancies_found`,
      totalAmountReconciled: sql`total_amount_reconciled`,
      startTime: sql`start_time`,
      endTime: sql`end_time`,
      errorMessage: sql`error_message`,
    })
    .from(sql`reconciliation_runs`)
    .orderBy(desc(sql`run_date`))
    .limit(limit);

  return runs.map(run => ({
    ...run,
    duration: run.endTime && run.startTime 
      ? new Date(run.endTime).getTime() - new Date(run.startTime).getTime()
      : null,
    successRate: run.totalTransactions > 0
      ? (run.matchedTransactions / run.totalTransactions * 100).toFixed(2)
      : 0,
  }));
}