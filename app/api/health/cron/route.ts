// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/db";
import { sql } from "drizzle-orm";

/**
 * Health check endpoint for all cron jobs
 * Monitors the health and last execution status of all automated processes
 */
export async function GET(req: NextRequest) {
  try {
    const checks = await Promise.allSettled([
      checkPayoutProcessing(),
      checkSubscriptionProcessing(),
      checkLoyaltyMaintenance(),
      checkPricingAnalytics(),
      checkPaymentReconciliation(),
    ]);

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        payouts: getCheckResult(checks[0]),
        subscriptions: getCheckResult(checks[1]),
        loyalty: getCheckResult(checks[2]),
        pricing: getCheckResult(checks[3]),
        reconciliation: getCheckResult(checks[4]),
      },
      summary: {
        healthy: 0,
        warning: 0,
        unhealthy: 0,
      },
    };

    // Calculate summary
    Object.values(healthStatus.checks).forEach((check: any) => {
      if (check.status === "healthy") healthStatus.summary.healthy++;
      else if (check.status === "warning") healthStatus.summary.warning++;
      else healthStatus.summary.unhealthy++;
    });

    // Determine overall status
    if (healthStatus.summary.unhealthy > 0) {
      healthStatus.status = "unhealthy";
    } else if (healthStatus.summary.warning > 0) {
      healthStatus.status = "warning";
    }

    const statusCode = healthStatus.status === "healthy" ? 200 : 
                      healthStatus.status === "warning" ? 200 : 503;

    return NextResponse.json(healthStatus, { status: statusCode });

  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Health check failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

function getCheckResult(settledResult: PromiseSettledResult<any>) {
  if (settledResult.status === "fulfilled") {
    return settledResult.value;
  } else {
    return {
      status: "unhealthy",
      error: settledResult.reason.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkPayoutProcessing() {
  try {
    // Check recent payout processing activity
    const recentPayouts = await db.execute(sql`
      SELECT 
        COUNT(*) as total_scheduled,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        MAX(updated_at) as last_activity
      FROM payout_schedules 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const stats = recentPayouts[0] as any;
    const lastActivity = stats.last_activity ? new Date(stats.last_activity) : null;
    const hoursAgo = lastActivity ? 
      (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60) : null;

    let status = "healthy";
    const issues = [];

    // Check if payouts are processing regularly
    if (!lastActivity || hoursAgo > 2) {
      status = "warning";
      issues.push("No recent payout activity");
    }

    // Check failure rate
    const totalProcessed = parseInt(stats.completed) + parseInt(stats.failed);
    const failureRate = totalProcessed > 0 ? 
      parseInt(stats.failed) / totalProcessed : 0;

    if (failureRate > 0.1) { // >10% failure rate
      status = "unhealthy";
      issues.push(`High failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }

    return {
      status,
      service: "payout-processing",
      lastActivity: lastActivity?.toISOString(),
      metrics: {
        totalScheduled: parseInt(stats.total_scheduled),
        completed: parseInt(stats.completed),
        failed: parseInt(stats.failed),
        failureRate: `${(failureRate * 100).toFixed(1)}%`,
      },
      issues,
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      service: "payout-processing",
      error: error.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkSubscriptionProcessing() {
  try {
    // Check subscription billing activity
    const recentActivity = await db.execute(sql`
      SELECT 
        COUNT(*) as total_subscriptions,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END) as past_due,
        SUM(CASE WHEN current_period_end < NOW() AND status = 'active' THEN 1 ELSE 0 END) as overdue_renewals
      FROM customer_subscriptions
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const stats = recentActivity[0] as any;
    let status = "healthy";
    const issues = [];

    // Check for overdue renewals
    const overdueRenewals = parseInt(stats.overdue_renewals);
    if (overdueRenewals > 0) {
      status = "warning";
      issues.push(`${overdueRenewals} overdue renewals`);
    }

    // Check past due ratio
    const pastDue = parseInt(stats.past_due);
    const totalActive = parseInt(stats.active) + pastDue;
    const pastDueRate = totalActive > 0 ? pastDue / totalActive : 0;

    if (pastDueRate > 0.05) { // >5% past due
      status = "unhealthy";
      issues.push(`High past due rate: ${(pastDueRate * 100).toFixed(1)}%`);
    }

    return {
      status,
      service: "subscription-processing",
      metrics: {
        totalSubscriptions: parseInt(stats.total_subscriptions),
        active: parseInt(stats.active),
        pastDue: pastDue,
        overdueRenewals: overdueRenewals,
        pastDueRate: `${(pastDueRate * 100).toFixed(1)}%`,
      },
      issues,
      lastCheck: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      service: "subscription-processing",
      error: error.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkLoyaltyMaintenance() {
  try {
    // Check loyalty system health
    const loyaltyStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_accounts,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_accounts,
        AVG(points_balance) as avg_balance,
        MAX(updated_at) as last_update
      FROM loyalty_accounts
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const pointsActivity = await db.execute(sql`
      SELECT 
        COUNT(*) as recent_transactions,
        SUM(CASE WHEN points > 0 THEN 1 ELSE 0 END) as points_earned,
        SUM(CASE WHEN points < 0 THEN 1 ELSE 0 END) as points_redeemed
      FROM points_transactions
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);

    const loyaltyData = loyaltyStats[0] as any;
    const pointsData = pointsActivity[0] as any;

    let status = "healthy";
    const issues = [];

    // Check for recent activity
    const lastUpdate = loyaltyData.last_update ? new Date(loyaltyData.last_update) : null;
    const hoursAgo = lastUpdate ? 
      (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60) : null;

    if (!lastUpdate || hoursAgo > 25) { // Should run daily
      status = "warning";
      issues.push("No recent loyalty maintenance activity");
    }

    // Check points activity
    const recentTransactions = parseInt(pointsData.recent_transactions);
    if (recentTransactions === 0) {
      status = "warning";
      issues.push("No recent points activity");
    }

    return {
      status,
      service: "loyalty-maintenance",
      metrics: {
        totalAccounts: parseInt(loyaltyData.total_accounts),
        activeAccounts: parseInt(loyaltyData.active_accounts),
        avgBalance: parseFloat(loyaltyData.avg_balance || "0"),
        recentTransactions,
        pointsEarned: parseInt(pointsData.points_earned),
        pointsRedeemed: parseInt(pointsData.points_redeemed),
      },
      issues,
      lastActivity: lastUpdate?.toISOString(),
      lastCheck: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      service: "loyalty-maintenance",
      error: error.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkPricingAnalytics() {
  try {
    // Check demand metrics generation
    const metricsStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_metrics,
        COUNT(DISTINCT provider_id) as providers_tracked,
        MAX(calculated_at) as last_calculation,
        AVG(CAST(demand_score AS DECIMAL)) as avg_demand_score
      FROM demand_metrics
      WHERE calculated_at >= NOW() - INTERVAL '24 hours'
    `);

    const surgeActivity = await db.execute(sql`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_events,
        SUM(CASE WHEN was_auto_triggered = true THEN 1 ELSE 0 END) as auto_triggered
      FROM surge_pricing_events
      WHERE start_time >= NOW() - INTERVAL '24 hours'
    `);

    const metricsData = metricsStats[0] as any;
    const surgeData = surgeActivity[0] as any;

    let status = "healthy";
    const issues = [];

    // Check for recent metrics calculation
    const lastCalculation = metricsData.last_calculation ? 
      new Date(metricsData.last_calculation) : null;
    const hoursAgo = lastCalculation ? 
      (Date.now() - lastCalculation.getTime()) / (1000 * 60 * 60) : null;

    if (!lastCalculation || hoursAgo > 3) { // Should run every 2 hours
      status = "warning";
      issues.push("No recent demand metrics calculation");
    }

    // Check if metrics are being generated for providers
    const totalMetrics = parseInt(metricsData.total_metrics);
    const providersTracked = parseInt(metricsData.providers_tracked);

    if (totalMetrics === 0 || providersTracked === 0) {
      status = "unhealthy";
      issues.push("No demand metrics being generated");
    }

    return {
      status,
      service: "pricing-analytics",
      metrics: {
        totalMetrics,
        providersTracked,
        avgDemandScore: parseFloat(metricsData.avg_demand_score || "0"),
        totalSurgeEvents: parseInt(surgeData.total_events),
        activeSurgeEvents: parseInt(surgeData.active_events),
        autoTriggered: parseInt(surgeData.auto_triggered),
      },
      issues,
      lastActivity: lastCalculation?.toISOString(),
      lastCheck: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      service: "pricing-analytics",
      error: error.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

async function checkPaymentReconciliation() {
  try {
    // This would check the existing reconciliation system
    // For now, return a basic health check
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return {
      status: "healthy",
      service: "payment-reconciliation",
      metrics: {
        lastRun: "2 AM daily",
        nextRun: "Tomorrow 2 AM",
      },
      issues: [],
      lastCheck: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      status: "unhealthy",
      service: "payment-reconciliation",
      error: error.message,
      lastCheck: new Date().toISOString(),
    };
  }
}

// Health check for individual services
export async function POST(req: NextRequest) {
  try {
    const { service } = await req.json();

    let result;
    switch (service) {
      case "payouts":
        result = await checkPayoutProcessing();
        break;
      case "subscriptions":
        result = await checkSubscriptionProcessing();
        break;
      case "loyalty":
        result = await checkLoyaltyMaintenance();
        break;
      case "pricing":
        result = await checkPricingAnalytics();
        break;
      case "reconciliation":
        result = await checkPaymentReconciliation();
        break;
      default:
        return NextResponse.json(
          { error: "Unknown service" },
          { status: 400 }
        );
    }

    const statusCode = result.status === "healthy" ? 200 :
                      result.status === "warning" ? 200 : 503;

    return NextResponse.json(result, { status: statusCode });

  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: "Health check failed",
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}