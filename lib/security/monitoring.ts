/**
 * Security Monitoring and Alerting Service
 * Tracks and alerts on security events
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export enum SecurityEventType {
  AUTH_FAILURE = 'AUTH_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CSRF_VIOLATION = 'CSRF_VIOLATION',
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',
  PAYMENT_ANOMALY = 'PAYMENT_ANOMALY',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT'
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class SecurityMonitor {
  private alerts: Map<string, number> = new Map();
  private readonly ALERT_THRESHOLD = 5;
  private readonly ALERT_WINDOW = 300000; // 5 minutes

  async logEvent(event: SecurityEvent): Promise<void> {
    // Log to database
    try {
      await db.execute(sql`
        INSERT INTO security_events (
          type, severity, user_id, ip, user_agent, 
          path, method, timestamp, metadata
        ) VALUES (
          ${event.type}, ${event.severity}, ${event.userId || null},
          ${event.ip}, ${event.userAgent}, ${event.path},
          ${event.method}, ${event.timestamp}, ${JSON.stringify(event.metadata || {})}
        )
      `);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }

    // Check for alert conditions
    await this.checkAlertConditions(event);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🚨 Security Event:', event);
    }
  }

  private async checkAlertConditions(event: SecurityEvent): Promise<void> {
    const key = `${event.type}:${event.ip}`;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, time] of this.alerts.entries()) {
      if (now - time > this.ALERT_WINDOW) {
        this.alerts.delete(k);
      }
    }

    // Track this event
    const count = Array.from(this.alerts.entries())
      .filter(([k]) => k === key)
      .length;

    this.alerts.set(`${key}:${now}`, now);

    // Check threshold
    if (count >= this.ALERT_THRESHOLD) {
      await this.sendAlert(event, count);
    }

    // Immediate alert for critical events
    if (event.severity === 'critical') {
      await this.sendAlert(event, 1);
    }
  }

  private async sendAlert(event: SecurityEvent, count: number): Promise<void> {
    // In production, this would send to:
    // - Slack/Discord webhook
    // - PagerDuty
    // - Email to security team
    // - SIEM system

    console.error('🚨🚨🚨 SECURITY ALERT 🚨🚨🚨');
    console.error(`Type: ${event.type}`);
    console.error(`Severity: ${event.severity}`);
    console.error(`IP: ${event.ip}`);
    console.error(`Count: ${count} events in ${this.ALERT_WINDOW / 1000} seconds`);
    console.error('Metadata:', event.metadata);

    // TODO: Implement actual alerting
    // await sendSlackAlert({ ... });
    // await sendEmail({ ... });
  }

  async getRecentEvents(
    minutes: number = 60,
    type?: SecurityEventType
  ): Promise<any[]> {
    const since = new Date(Date.now() - minutes * 60000);
    
    let query = sql`
      SELECT * FROM security_events 
      WHERE timestamp > ${since}
    `;

    if (type) {
      query = sql`
        SELECT * FROM security_events 
        WHERE timestamp > ${since} AND type = ${type}
      `;
    }

    query = sql`${query} ORDER BY timestamp DESC LIMIT 100`;

    const results = await db.execute(query);
    return results.rows;
  }
}

export const securityMonitor = new SecurityMonitor();
