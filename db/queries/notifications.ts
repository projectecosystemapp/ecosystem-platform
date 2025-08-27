/**
 * Notification Database Queries
 * 
 * Efficient queries for notification operations
 * Optimized for performance with proper indexing
 */

import { db } from '@/db/drizzle';
import {
  notificationsTable,
  notificationPreferencesTable,
  notificationTemplatesTable,
  notificationQueueTable,
  priceAlertsTable,
  type Notification,
  type NotificationPreferences
} from '@/db/schema/notifications-schema';
import { profilesTable } from '@/db/schema';
import { eq, and, or, gte, lte, isNull, desc, asc, sql, count, inArray } from 'drizzle-orm';

/**
 * Get user preferences with fallback to defaults
 */
export async function getUserPreferencesWithDefaults(userId: string): Promise<NotificationPreferences> {
  const [preferences] = await db
    .select()
    .from(notificationPreferencesTable)
    .where(eq(notificationPreferencesTable.userId, userId))
    .limit(1);

  if (preferences) {
    return preferences;
  }

  // Create default preferences if none exist
  const [defaultPrefs] = await db
    .insert(notificationPreferencesTable)
    .values({
      userId,
      emailUnsubscribeToken: `unsubscribe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    })
    .returning();

  return defaultPrefs;
}

/**
 * Get unread notification count by channel
 */
export async function getUnreadCountByChannel(userId: string) {
  const result = await db
    .select({
      channel: notificationsTable.channel,
      count: count(notificationsTable.id).as('count')
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        isNull(notificationsTable.readAt),
        or(
          isNull(notificationsTable.expiresAt),
          gte(notificationsTable.expiresAt, new Date())
        )
      )
    )
    .groupBy(notificationsTable.channel);

  return result.reduce((acc, row) => ({
    ...acc,
    [row.channel]: Number(row.count)
  }), {} as Record<string, number>);
}

/**
 * Get notifications with pagination and filtering
 */
export async function getNotificationsWithPagination(
  userId: string,
  options: {
    channel?: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    types?: string[];
  } = {}
) {
  const {
    channel,
    unreadOnly = false,
    limit = 50,
    offset = 0,
    types = []
  } = options;

  const conditions = [
    eq(notificationsTable.userId, userId),
    or(
      isNull(notificationsTable.expiresAt),
      gte(notificationsTable.expiresAt, new Date())
    )
  ];

  if (channel) {
    conditions.push(eq(notificationsTable.channel, channel as any));
  }

  if (unreadOnly) {
    conditions.push(isNull(notificationsTable.readAt));
  }

  if (types.length > 0) {
    conditions.push(inArray(notificationsTable.type, types as any[]));
  }

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ totalCount }] = await db
    .select({ totalCount: count(notificationsTable.id) })
    .from(notificationsTable)
    .where(and(...conditions));

  return {
    notifications,
    pagination: {
      total: Number(totalCount),
      limit,
      offset,
      hasMore: Number(totalCount) > offset + notifications.length,
    }
  };
}

/**
 * Mark notifications as read in bulk
 */
export async function markMultipleAsRead(notificationIds: string[], userId: string) {
  return await db
    .update(notificationsTable)
    .set({
      status: 'read',
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(notificationsTable.id, notificationIds),
        eq(notificationsTable.userId, userId)
      )
    )
    .returning({ id: notificationsTable.id });
}

/**
 * Get notification statistics for a user
 */
export async function getNotificationStats(userId: string, days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await db
    .select({
      channel: notificationsTable.channel,
      type: notificationsTable.type,
      status: notificationsTable.status,
      count: count(notificationsTable.id).as('count')
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        gte(notificationsTable.createdAt, since)
      )
    )
    .groupBy(
      notificationsTable.channel,
      notificationsTable.type,
      notificationsTable.status
    );

  return stats.map(stat => ({
    ...stat,
    count: Number(stat.count)
  }));
}

/**
 * Get pending notifications for queue processing
 */
export async function getPendingQueueItems(limit: number = 100) {
  return await db
    .select({
      queueItem: notificationQueueTable,
      notification: notificationsTable
    })
    .from(notificationQueueTable)
    .innerJoin(
      notificationsTable,
      eq(notificationQueueTable.notificationId, notificationsTable.id)
    )
    .where(
      and(
        eq(notificationQueueTable.status, 'pending'),
        lte(notificationQueueTable.scheduledFor, new Date()),
        eq(notificationsTable.status, 'pending')
      )
    )
    .orderBy(
      asc(notificationQueueTable.priority),
      asc(notificationQueueTable.scheduledFor)
    )
    .limit(limit);
}

/**
 * Get failed notifications for retry
 */
export async function getFailedNotificationsForRetry(limit: number = 50) {
  return await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.status, 'failed'),
        lte(notificationsTable.nextRetryAt, new Date()),
        sql`${notificationsTable.retryCount} < ${notificationsTable.maxRetries}`
      )
    )
    .orderBy(asc(notificationsTable.nextRetryAt))
    .limit(limit);
}

/**
 * Get active price alerts for a service
 */
export async function getActivePriceAlerts(providerId: string, serviceId?: string) {
  const conditions = [
    eq(priceAlertsTable.providerId, providerId as any),
    eq(priceAlertsTable.isActive, true),
    or(
      isNull(priceAlertsTable.expiresAt),
      gte(priceAlertsTable.expiresAt, new Date())
    )
  ];

  if (serviceId) {
    conditions.push(eq(priceAlertsTable.serviceId, serviceId));
  }

  return await db
    .select({
      alert: priceAlertsTable,
      user: {
        userId: profilesTable.userId,
        email: profilesTable.email,
        name: profilesTable.name,
      }
    })
    .from(priceAlertsTable)
    .innerJoin(profilesTable, eq(priceAlertsTable.userId, profilesTable.userId))
    .where(and(...conditions));
}

/**
 * Clean up expired notifications
 */
export async function cleanupExpiredNotifications() {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

  // Delete notifications that are expired or very old and read
  const deleted = await db
    .delete(notificationsTable)
    .where(
      or(
        and(
          isNull(notificationsTable.expiresAt),
          lte(notificationsTable.expiresAt, new Date())
        ),
        and(
          eq(notificationsTable.status, 'read'),
          lte(notificationsTable.readAt, cutoffDate)
        ),
        and(
          eq(notificationsTable.status, 'failed'),
          lte(notificationsTable.failedAt, cutoffDate),
          sql`${notificationsTable.retryCount} >= ${notificationsTable.maxRetries}`
        )
      )
    )
    .returning({ id: notificationsTable.id });

  return deleted.length;
}

/**
 * Get notification template by code
 */
export async function getNotificationTemplate(code: string, channel: string) {
  const [template] = await db
    .select()
    .from(notificationTemplatesTable)
    .where(
      and(
        eq(notificationTemplatesTable.code, code),
        eq(notificationTemplatesTable.channel, channel as any),
        eq(notificationTemplatesTable.isActive, true)
      )
    )
    .limit(1);

  return template;
}

/**
 * Update notification queue item status
 */
export async function updateQueueItemStatus(
  queueItemId: string,
  status: string,
  error?: string
) {
  return await db
    .update(notificationQueueTable)
    .set({
      status,
      lastError: error,
      processedAt: status === 'completed' ? new Date() : undefined,
      attempts: sql`${notificationQueueTable.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(notificationQueueTable.id, queueItemId))
    .returning();
}

/**
 * Get user digest notifications
 */
export async function getUserDigestNotifications(
  userId: string,
  digestType: 'daily' | 'weekly'
) {
  const hours = digestType === 'daily' ? 24 : 168; // 24 hours or 1 week
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.channel, 'in_app'),
        gte(notificationsTable.createdAt, since),
        or(
          eq(notificationsTable.status, 'sent'),
          eq(notificationsTable.status, 'delivered')
        )
      )
    )
    .orderBy(desc(notificationsTable.createdAt));
}

/**
 * Batch create notifications
 */
export async function batchCreateNotifications(notifications: any[]) {
  if (notifications.length === 0) return [];

  return await db
    .insert(notificationsTable)
    .values(notifications)
    .returning({ 
      id: notificationsTable.id,
      status: notificationsTable.status,
      channel: notificationsTable.channel 
    });
}

/**
 * Get notification delivery stats
 */
export async function getDeliveryStats(days: number = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stats = await db
    .select({
      date: sql<string>`date(${notificationsTable.createdAt})`,
      channel: notificationsTable.channel,
      status: notificationsTable.status,
      count: count(notificationsTable.id).as('count')
    })
    .from(notificationsTable)
    .where(gte(notificationsTable.createdAt, since))
    .groupBy(
      sql`date(${notificationsTable.createdAt})`,
      notificationsTable.channel,
      notificationsTable.status
    )
    .orderBy(sql`date(${notificationsTable.createdAt})`);

  return stats.map(stat => ({
    ...stat,
    count: Number(stat.count)
  }));
}

/**
 * Get user engagement metrics
 */
export async function getUserEngagementMetrics(userId: string, days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const metrics = await db
    .select({
      total_sent: count(sql`case when ${notificationsTable.status} = 'sent' then 1 end`).as('total_sent'),
      total_delivered: count(sql`case when ${notificationsTable.status} = 'delivered' then 1 end`).as('total_delivered'),
      total_read: count(sql`case when ${notificationsTable.status} = 'read' then 1 end`).as('total_read'),
      avg_read_time: sql<number>`avg(extract(epoch from (${notificationsTable.readAt} - ${notificationsTable.sentAt})))`.as('avg_read_time'),
    })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        gte(notificationsTable.createdAt, since)
      )
    );

  return metrics[0];
}