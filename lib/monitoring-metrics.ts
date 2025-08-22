/**
 * Comprehensive Monitoring and Metrics System for Booking Platform
 * Tracks performance, business metrics, and system health
 */

import { db } from "@/db/db";
import { bookingsTable, transactionsTable } from "@/db/schema/bookings-schema";
import { providersTable } from "@/db/schema/providers-schema";
import { profilesTable } from "@/db/schema/profiles-schema";
import { sql, eq, and, gte, lte, between, count, avg, sum } from "drizzle-orm";
import { 
  getPlatformMetrics,
  getBookingTrends,
  getTopPerformingProviders,
  getPlatformHealthMetrics,
  getDataQualityReport
} from "@/db/queries/analytics-queries";
import { subDays, subHours, format, startOfDay, endOfDay } from "date-fns";

// ===========================
// METRIC DEFINITIONS
// ===========================

export interface BusinessMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  target?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealthMetric {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  details: string;
  timestamp: Date;
  metrics?: Record<string, number>;
}

// ===========================
// BUSINESS METRICS COLLECTOR
// ===========================

export class BusinessMetricsCollector {
  private metrics: BusinessMetric[] = [];
  
  /**
   * Collect booking success rate metrics
   */
  async collectBookingSuccessRate(period: 'hour' | 'day' | 'week' = 'day'): Promise<BusinessMetric[]> {
    const startDate = this.getStartDate(period);
    const endDate = new Date();
    
    const bookingStats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_bookings
      FROM ${bookingsTable}
      WHERE created_at BETWEEN ${startDate} AND ${endDate}
    `);
    
    const stats = bookingStats.rows[0] as any;
    const totalBookings = parseInt(stats.total_bookings || '0');
    const completedBookings = parseInt(stats.completed_bookings || '0');
    const cancelledBookings = parseInt(stats.cancelled_bookings || '0');
    const noShowBookings = parseInt(stats.no_show_bookings || '0');
    
    const successRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
    const noShowRate = totalBookings > 0 ? (noShowBookings / totalBookings) * 100 : 0;
    
    return [
      {
        name: 'booking_success_rate',
        value: successRate,
        unit: 'percentage',
        timestamp: endDate,
        target: 85,
        threshold: { warning: 80, critical: 70 },
        tags: { period }
      },
      {
        name: 'booking_cancellation_rate',
        value: cancellationRate,
        unit: 'percentage',
        timestamp: endDate,
        target: 10,
        threshold: { warning: 15, critical: 25 },
        tags: { period }
      },
      {
        name: 'booking_no_show_rate',
        value: noShowRate,
        unit: 'percentage',
        timestamp: endDate,
        target: 5,
        threshold: { warning: 8, critical: 15 },
        tags: { period }
      }
    ];
  }

  /**
   * Collect revenue metrics
   */
  async collectRevenueMetrics(period: 'hour' | 'day' | 'week' = 'day'): Promise<BusinessMetric[]> {
    const startDate = this.getStartDate(period);
    const endDate = new Date();
    
    const revenueStats = await db.execute(sql`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(SUM(platform_fee), 0) as platform_fees,
        COALESCE(AVG(total_amount), 0) as avg_order_value,
        COUNT(*) as completed_orders
      FROM ${bookingsTable}
      WHERE status = 'completed' 
        AND completed_at BETWEEN ${startDate} AND ${endDate}
    `);
    
    const stats = revenueStats.rows[0] as any;
    const totalRevenue = parseFloat(stats.total_revenue);
    const platformFees = parseFloat(stats.platform_fees);
    const avgOrderValue = parseFloat(stats.avg_order_value);
    const completedOrders = parseInt(stats.completed_orders);
    
    return [
      {
        name: 'total_revenue',
        value: totalRevenue,
        unit: 'currency',
        timestamp: endDate,
        tags: { period, currency: 'USD' }
      },
      {
        name: 'platform_fees',
        value: platformFees,
        unit: 'currency',
        timestamp: endDate,
        tags: { period, currency: 'USD' }
      },
      {
        name: 'average_order_value',
        value: avgOrderValue,
        unit: 'currency',
        timestamp: endDate,
        target: 100,
        tags: { period, currency: 'USD' }
      },
      {
        name: 'completed_orders',
        value: completedOrders,
        unit: 'count',
        timestamp: endDate,
        tags: { period }
      }
    ];
  }

  /**
   * Collect provider utilization metrics
   */
  async collectProviderUtilization(period: 'day' | 'week' = 'day'): Promise<BusinessMetric[]> {
    const startDate = this.getStartDate(period);
    const endDate = new Date();
    
    const utilizationStats = await db.execute(sql`
      WITH provider_bookings AS (
        SELECT 
          p.id,
          COUNT(b.id) as bookings_count,
          COUNT(DISTINCT DATE(b.booking_date)) as active_days
        FROM ${providersTable} p
        LEFT JOIN ${bookingsTable} b ON p.id = b.provider_id 
          AND b.booking_date BETWEEN ${startDate} AND ${endDate}
          AND b.status IN ('confirmed', 'completed')
        WHERE p.is_active = true
        GROUP BY p.id
      )
      SELECT 
        COUNT(*) as total_providers,
        COUNT(CASE WHEN bookings_count > 0 THEN 1 END) as active_providers,
        AVG(bookings_count) as avg_bookings_per_provider,
        AVG(CASE WHEN bookings_count > 0 THEN bookings_count END) as avg_bookings_active_providers
      FROM provider_bookings
    `);
    
    const stats = utilizationStats.rows[0] as any;
    const totalProviders = parseInt(stats.total_providers || '0');
    const activeProviders = parseInt(stats.active_providers || '0');
    const avgBookingsPerProvider = parseFloat(stats.avg_bookings_per_provider || '0');
    
    const utilizationRate = totalProviders > 0 ? (activeProviders / totalProviders) * 100 : 0;
    
    return [
      {
        name: 'provider_utilization_rate',
        value: utilizationRate,
        unit: 'percentage',
        timestamp: endDate,
        target: 60,
        threshold: { warning: 50, critical: 40 },
        tags: { period }
      },
      {
        name: 'average_bookings_per_provider',
        value: avgBookingsPerProvider,
        unit: 'count',
        timestamp: endDate,
        tags: { period }
      },
      {
        name: 'active_providers_count',
        value: activeProviders,
        unit: 'count',
        timestamp: endDate,
        tags: { period }
      }
    ];
  }

  /**
   * Collect customer engagement metrics
   */
  async collectCustomerEngagement(period: 'day' | 'week' = 'day'): Promise<BusinessMetric[]> {
    const startDate = this.getStartDate(period);
    const endDate = new Date();
    
    const engagementStats = await db.execute(sql`
      WITH customer_activity AS (
        SELECT 
          customer_id,
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings,
          MIN(created_at) as first_booking,
          MAX(created_at) as last_booking
        FROM ${bookingsTable}
        WHERE created_at BETWEEN ${startDate} AND ${endDate}
        GROUP BY customer_id
      )
      SELECT 
        COUNT(DISTINCT customer_id) as active_customers,
        AVG(total_bookings) as avg_bookings_per_customer,
        COUNT(CASE WHEN total_bookings > 1 THEN 1 END) as repeat_customers,
        AVG(completed_bookings::float / total_bookings) as customer_completion_rate
      FROM customer_activity
    `);
    
    const stats = engagementStats.rows[0] as any;
    const activeCustomers = parseInt(stats.active_customers || '0');
    const avgBookingsPerCustomer = parseFloat(stats.avg_bookings_per_customer || '0');
    const repeatCustomers = parseInt(stats.repeat_customers || '0');
    const customerCompletionRate = parseFloat(stats.customer_completion_rate || '0') * 100;
    
    const repeatCustomerRate = activeCustomers > 0 ? (repeatCustomers / activeCustomers) * 100 : 0;
    
    return [
      {
        name: 'active_customers',
        value: activeCustomers,
        unit: 'count',
        timestamp: endDate,
        tags: { period }
      },
      {
        name: 'repeat_customer_rate',
        value: repeatCustomerRate,
        unit: 'percentage',
        timestamp: endDate,
        target: 30,
        threshold: { warning: 25, critical: 20 },
        tags: { period }
      },
      {
        name: 'average_bookings_per_customer',
        value: avgBookingsPerCustomer,
        unit: 'count',
        timestamp: endDate,
        target: 2,
        tags: { period }
      },
      {
        name: 'customer_completion_rate',
        value: customerCompletionRate,
        unit: 'percentage',
        timestamp: endDate,
        target: 90,
        threshold: { warning: 85, critical: 80 },
        tags: { period }
      }
    ];
  }

  private getStartDate(period: 'hour' | 'day' | 'week'): Date {
    switch (period) {
      case 'hour':
        return subHours(new Date(), 1);
      case 'day':
        return subDays(new Date(), 1);
      case 'week':
        return subDays(new Date(), 7);
      default:
        return subDays(new Date(), 1);
    }
  }

  /**
   * Collect all business metrics
   */
  async collectAllMetrics(period: 'day' | 'week' = 'day'): Promise<BusinessMetric[]> {
    const [
      bookingMetrics,
      revenueMetrics,
      utilizationMetrics,
      engagementMetrics
    ] = await Promise.all([
      this.collectBookingSuccessRate(period),
      this.collectRevenueMetrics(period),
      this.collectProviderUtilization(period),
      this.collectCustomerEngagement(period)
    ]);
    
    return [
      ...bookingMetrics,
      ...revenueMetrics,
      ...utilizationMetrics,
      ...engagementMetrics
    ];
  }
}

// ===========================
// PERFORMANCE METRICS COLLECTOR
// ===========================

export class PerformanceMetricsCollector {
  private static instance: PerformanceMetricsCollector;
  private metrics: PerformanceMetric[] = [];

  static getInstance(): PerformanceMetricsCollector {
    if (!this.instance) {
      this.instance = new PerformanceMetricsCollector();
    }
    return this.instance;
  }

  /**
   * Track database query performance
   */
  async trackQuery<T>(
    operation: string,
    queryFunction: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let result: T;

    try {
      result = await queryFunction();
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      this.metrics.push({
        operation,
        duration,
        timestamp: new Date(),
        success,
        errorMessage,
        metadata
      });

      // Keep only last 1000 metrics to prevent memory leaks
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }

      // Log slow queries
      if (duration > 1000) { // More than 1 second
        console.warn(`Slow query detected: ${operation} took ${duration}ms`, metadata);
      }
    }

    return result!;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(operation?: string): {
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    totalQueries: number;
    successRate: number;
    slowQueries: number;
  } {
    const filteredMetrics = operation 
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;

    if (filteredMetrics.length === 0) {
      return {
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        totalQueries: 0,
        successRate: 0,
        slowQueries: 0
      };
    }

    const durations = filteredMetrics.map(m => m.duration);
    const successfulQueries = filteredMetrics.filter(m => m.success).length;
    const slowQueries = filteredMetrics.filter(m => m.duration > 1000).length;

    return {
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      totalQueries: filteredMetrics.length,
      successRate: (successfulQueries / filteredMetrics.length) * 100,
      slowQueries
    };
  }

  /**
   * Get recent slow queries
   */
  getSlowQueries(limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }
}

// ===========================
// SYSTEM HEALTH MONITOR
// ===========================

export class SystemHealthMonitor {
  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<SystemHealthMetric> {
    try {
      const startTime = Date.now();
      
      // Simple query to test database connectivity
      await db.execute(sql`SELECT 1`);
      
      const responseTime = Date.now() - startTime;
      
      // Check for slow response
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let details = 'Database is responding normally';
      
      if (responseTime > 1000) {
        status = 'critical';
        details = `Database response time is very slow: ${responseTime}ms`;
      } else if (responseTime > 500) {
        status = 'warning';
        details = `Database response time is slow: ${responseTime}ms`;
      }

      return {
        component: 'database',
        status,
        details,
        timestamp: new Date(),
        metrics: {
          responseTime,
          connections: 0 // Would get from actual connection pool
        }
      };
    } catch (error) {
      return {
        component: 'database',
        status: 'critical',
        details: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metrics: {
          responseTime: -1,
          connections: 0
        }
      };
    }
  }

  /**
   * Check data quality health
   */
  async checkDataQualityHealth(): Promise<SystemHealthMetric> {
    try {
      const dataQuality = await getDataQualityReport();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let details = 'Data quality is good';
      
      if (dataQuality.orphanedRecords > 100) {
        status = 'critical';
        details = `High number of orphaned records: ${dataQuality.orphanedRecords}`;
      } else if (dataQuality.orphanedRecords > 10 || dataQuality.dataIntegrityIssues.length > 5) {
        status = 'warning';
        details = `Data quality issues detected: ${dataQuality.dataIntegrityIssues.length} issues`;
      }

      return {
        component: 'data_quality',
        status,
        details,
        timestamp: new Date(),
        metrics: {
          orphanedRecords: dataQuality.orphanedRecords,
          missingProviderData: dataQuality.missingProviderData,
          incompleteBookings: dataQuality.incompleteBookings,
          integrityIssues: dataQuality.dataIntegrityIssues.length
        }
      };
    } catch (error) {
      return {
        component: 'data_quality',
        status: 'critical',
        details: `Data quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metrics: {}
      };
    }
  }

  /**
   * Check booking system health
   */
  async checkBookingSystemHealth(): Promise<SystemHealthMetric> {
    try {
      const healthMetrics = await getPlatformHealthMetrics();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let details = 'Booking system is healthy';
      
      if (healthMetrics.pendingBookingsCount > 100) {
        status = 'warning';
        details = `High number of pending bookings: ${healthMetrics.pendingBookingsCount}`;
      }

      if (healthMetrics.activeBookingsToday === 0 && new Date().getHours() > 12) {
        status = 'warning';
        details = 'No bookings today - potential issue with booking flow';
      }

      return {
        component: 'booking_system',
        status,
        details,
        timestamp: new Date(),
        metrics: {
          activeBookingsToday: healthMetrics.activeBookingsToday,
          pendingBookings: healthMetrics.pendingBookingsCount,
          systemLoad: healthMetrics.systemLoad,
          avgResponseTime: healthMetrics.averageResponseTime
        }
      };
    } catch (error) {
      return {
        component: 'booking_system',
        status: 'critical',
        details: `Booking system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        metrics: {}
      };
    }
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck(): Promise<{
    overallStatus: 'healthy' | 'warning' | 'critical';
    components: SystemHealthMetric[];
    timestamp: Date;
  }> {
    const [databaseHealth, dataQualityHealth, bookingSystemHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkDataQualityHealth(),
      this.checkBookingSystemHealth()
    ]);

    const components = [databaseHealth, dataQualityHealth, bookingSystemHealth];
    
    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (components.some(c => c.status === 'critical')) {
      overallStatus = 'critical';
    } else if (components.some(c => c.status === 'warning')) {
      overallStatus = 'warning';
    }

    return {
      overallStatus,
      components,
      timestamp: new Date()
    };
  }
}

// ===========================
// ALERT MANAGER
// ===========================

export class AlertManager {
  private alertThresholds: Record<string, { warning: number; critical: number }> = {
    'booking_success_rate': { warning: 80, critical: 70 },
    'provider_utilization_rate': { warning: 50, critical: 40 },
    'database_response_time': { warning: 500, critical: 1000 },
    'booking_cancellation_rate': { warning: 15, critical: 25 },
    'customer_completion_rate': { warning: 85, critical: 80 }
  };

  /**
   * Check metrics against thresholds and trigger alerts
   */
  checkMetricAlerts(metrics: BusinessMetric[]): Array<{
    level: 'warning' | 'critical';
    metric: string;
    value: number;
    threshold: number;
    message: string;
  }> {
    const alerts = [];

    for (const metric of metrics) {
      const thresholds = metric.threshold || this.alertThresholds[metric.name];
      if (!thresholds) continue;

      if (metric.value <= thresholds.critical) {
        alerts.push({
          level: 'critical' as const,
          metric: metric.name,
          value: metric.value,
          threshold: thresholds.critical,
          message: `${metric.name} is critically low: ${metric.value}${metric.unit === 'percentage' ? '%' : ''} (threshold: ${thresholds.critical})`
        });
      } else if (metric.value <= thresholds.warning) {
        alerts.push({
          level: 'warning' as const,
          metric: metric.name,
          value: metric.value,
          threshold: thresholds.warning,
          message: `${metric.name} is below warning threshold: ${metric.value}${metric.unit === 'percentage' ? '%' : ''} (threshold: ${thresholds.warning})`
        });
      }
    }

    return alerts;
  }

  /**
   * Send alerts (would integrate with actual alerting system)
   */
  async sendAlert(alert: {
    level: 'warning' | 'critical';
    message: string;
    metric: string;
  }): Promise<void> {
    // In a real implementation, this would send to Slack, email, PagerDuty, etc.
    console.log(`${alert.level.toUpperCase()} ALERT: ${alert.message}`);
    
    // Could also store alerts in database for tracking
    // await db.insert(alertsTable).values({
    //   level: alert.level,
    //   message: alert.message,
    //   metric: alert.metric,
    //   createdAt: new Date()
    // });
  }
}

// ===========================
// METRICS DASHBOARD AGGREGATOR
// ===========================

export class MetricsDashboard {
  private businessMetrics = new BusinessMetricsCollector();
  private performanceMetrics = PerformanceMetricsCollector.getInstance();
  private healthMonitor = new SystemHealthMonitor();
  private alertManager = new AlertManager();

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(period: 'day' | 'week' = 'day'): Promise<{
    businessMetrics: BusinessMetric[];
    performanceStats: any;
    healthStatus: any;
    alerts: any[];
    timestamp: Date;
  }> {
    const [businessMetrics, healthStatus] = await Promise.all([
      this.businessMetrics.collectAllMetrics(period),
      this.healthMonitor.runHealthCheck()
    ]);

    const performanceStats = this.performanceMetrics.getPerformanceStats();
    const alerts = this.alertManager.checkMetricAlerts(businessMetrics);

    return {
      businessMetrics,
      performanceStats,
      healthStatus,
      alerts,
      timestamp: new Date()
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(metrics: BusinessMetric[]): string {
    const lines: string[] = [];

    for (const metric of metrics) {
      const metricName = `booking_platform_${metric.name}`;
      const tags = metric.tags ? Object.entries(metric.tags).map(([k, v]) => `${k}="${v}"`).join(',') : '';
      const tagsStr = tags ? `{${tags}}` : '';
      
      lines.push(`# HELP ${metricName} ${metric.name}`);
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${metricName}${tagsStr} ${metric.value} ${metric.timestamp.getTime()}`);
    }

    return lines.join('\n');
  }
}

// Export singleton instances
export const metricsCollector = new BusinessMetricsCollector();
export const performanceTracker = PerformanceMetricsCollector.getInstance();
export const healthMonitor = new SystemHealthMonitor();
export const alertManager = new AlertManager();
export const metricsDashboard = new MetricsDashboard();