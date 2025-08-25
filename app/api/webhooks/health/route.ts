import { NextRequest, NextResponse } from "next/server";
import { getWebhookHealthMetrics, cleanupOldWebhookEvents } from "@/lib/webhook-idempotency";
import { db } from "@/db/db";
import { webhookEventsTable } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/webhooks/health
 * Get webhook processing health metrics
 * This endpoint provides monitoring data for webhook processing
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authorization (implement your auth logic here)
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.WEBHOOK_HEALTH_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get health metrics
    const metrics = await getWebhookHealthMetrics();
    
    if (!metrics) {
      return NextResponse.json(
        { error: "Failed to retrieve metrics" },
        { status: 500 }
      );
    }

    // Get additional statistics
    const additionalStats = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at > NOW() - INTERVAL '1 hour') as completed_last_hour,
        COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour') as failed_last_hour,
        COUNT(*) FILTER (WHERE status = 'processing' AND created_at < NOW() - INTERVAL '10 minutes') as stuck_processing,
        AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) FILTER (WHERE status = 'completed' AND processed_at IS NOT NULL) as avg_processing_time_seconds,
        MAX(created_at) as last_webhook_received
      FROM ${webhookEventsTable}
    `);

    const stats = additionalStats.rows[0] || {};

    return NextResponse.json({
      timestamp: metrics.timestamp,
      status: {
        healthy: stats.failed_last_hour === 0 && stats.stuck_processing === 0,
        warnings: []
      },
      metrics: {
        statusCounts: metrics.statusCounts,
        lastHour: {
          completed: parseInt(stats.completed_last_hour || '0'),
          failed: parseInt(stats.failed_last_hour || '0')
        },
        stuckProcessing: parseInt(stats.stuck_processing || '0'),
        avgProcessingTimeSeconds: parseFloat(stats.avg_processing_time_seconds || '0'),
        lastWebhookReceived: stats.last_webhook_received,
        recentFailures: metrics.recentFailures.map(f => ({
          eventId: f.eventId,
          eventType: f.eventType,
          errorMessage: f.errorMessage,
          retryCount: f.retryCount,
          createdAt: f.createdAt
        })),
        byEventType: metrics.processingStats
      }
    });
  } catch (error) {
    console.error("Error getting webhook health metrics:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/webhooks/health/cleanup
 * Clean up old webhook events (older than 30 days)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.WEBHOOK_HEALTH_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const deletedCount = await cleanupOldWebhookEvents();
    
    return NextResponse.json({
      message: "Cleanup completed",
      deletedEvents: deletedCount
    });
  } catch (error) {
    console.error("Error cleaning up webhook events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/health/alerts
 * Get webhook processing alerts
 */
export async function getAlerts(req: NextRequest) {
  try {
    const alerts = [];
    
    // Check for high failure rate
    const failureRate = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / NULLIF(COUNT(*), 0) as failure_rate
      FROM ${webhookEventsTable}
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);
    
    const rate = parseFloat(failureRate.rows[0]?.failure_rate || '0');
    if (rate > 5) {
      alerts.push({
        level: rate > 10 ? 'critical' : 'warning',
        message: `High webhook failure rate: ${rate.toFixed(2)}% in the last hour`,
        metric: 'failure_rate',
        value: rate
      });
    }
    
    // Check for stuck webhooks
    const stuckWebhooks = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${webhookEventsTable}
      WHERE status = 'processing' 
      AND created_at < NOW() - INTERVAL '10 minutes'
    `);
    
    const stuckCount = parseInt(stuckWebhooks.rows[0]?.count || '0');
    if (stuckCount > 0) {
      alerts.push({
        level: 'warning',
        message: `${stuckCount} webhook(s) stuck in processing state`,
        metric: 'stuck_webhooks',
        value: stuckCount
      });
    }
    
    // Check for repeated failures
    const repeatedFailures = await db.execute(sql`
      SELECT event_type, COUNT(*) as failure_count
      FROM ${webhookEventsTable}
      WHERE status = 'failed' 
      AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY event_type
      HAVING COUNT(*) >= 3
    `);
    
    for (const failure of repeatedFailures.rows) {
      alerts.push({
        level: 'warning',
        message: `Event type '${failure.event_type}' has failed ${failure.failure_count} times in the last hour`,
        metric: 'repeated_failures',
        eventType: failure.event_type,
        value: failure.failure_count
      });
    }
    
    return NextResponse.json({
      alerts,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error getting webhook alerts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}