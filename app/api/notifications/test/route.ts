// @ts-nocheck
/**
 * Notification System Test Endpoint
 * 
 * Quick test endpoint to verify notification system functionality
 * Only available in development
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/lib/services/notification-service';
import { 
  subscriptionNotifications,
  paymentNotifications,
  loyaltyNotifications,
  bookingNotifications
} from '@/lib/services/marketplace-notifications';

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const { action, userId = 'test_user_123' } = await request.json();

    let result;

    switch (action) {
      case 'simple':
        // Test simple notification
        result = await notificationService.sendNotification({
          userId,
          type: 'test',
          title: '🎉 Test Notification',
          body: 'This is a test notification to verify the system is working!',
          channels: ['in_app'],
          priority: 'medium',
          metadata: { test: true },
        });
        break;

      case 'subscription':
        // Test subscription notification
        result = await subscriptionNotifications.confirmed(userId, {
          planName: 'Premium Test Plan',
          providerName: 'Test Provider',
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          amount: 2999, // $29.99
        });
        break;

      case 'payment':
        // Test payment notification
        result = await paymentNotifications.receipt(userId, {
          amount: 49.99,
          serviceName: 'Personal Training Session',
          transactionId: 'test_txn_123456',
        });
        break;

      case 'loyalty':
        // Test loyalty notification
        result = await loyaltyNotifications.pointsEarned(userId, {
          points: 100,
          activity: 'test booking',
          totalPoints: 1250,
        });
        break;

      case 'booking':
        // Test booking notification
        result = await bookingNotifications.confirmed(userId, {
          serviceName: 'Yoga Class',
          bookingDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          bookingTime: '10:00 AM - 11:00 AM',
          bookingUrl: '/bookings/test_123',
        });
        break;

      case 'template':
        // Test with template
        result = await notificationService.sendNotification({
          userId,
          type: 'subscription_confirmed',
          title: 'Template will override',
          body: 'Template will override',
          channels: ['in_app'],
          templateCode: 'subscription_confirmed',
          templateData: {
            customerName: 'Test User',
            planName: 'Premium Plan',
            providerName: 'Test Studio',
            renewalDate: 'December 27, 2024',
          },
        });
        break;

      case 'preferences':
        // Test creating default preferences
        result = await notificationService.createDefaultPreferences(userId);
        break;

      case 'multi-channel':
        // Test multi-channel notification (won't send email in test)
        result = await notificationService.sendNotification({
          userId,
          type: 'test_multi',
          title: 'Multi-Channel Test',
          body: 'Testing email and in-app delivery',
          channels: ['email', 'in_app'],
          priority: 'high',
          actionUrl: 'https://example.com/test',
          actionText: 'Take Action',
        });
        break;

      case 'get-notifications':
        // Test fetching notifications
        result = await notificationService.getUserNotifications(userId, {
          channel: 'in_app',
          limit: 10,
        });
        break;

      case 'get-count':
        // Test unread count
        result = { unreadCount: await notificationService.getUnreadCount(userId) };
        break;

      case 'mark-read':
        // Get a notification first, then mark as read
        const notifications = await notificationService.getUserNotifications(userId, {
          channel: 'in_app',
          limit: 1,
        });
        if (notifications.length > 0) {
          result = await notificationService.markAsRead(notifications[0].id, userId);
        } else {
          result = { message: 'No notifications to mark as read' };
        }
        break;

      case 'cleanup':
        // Test cleanup (admin only in real app)
        result = await notificationService.deleteExpiredNotifications();
        break;

      default:
        return NextResponse.json(
          { error: 'Unknown action', availableActions: [
            'simple', 'subscription', 'payment', 'loyalty', 'booking', 
            'template', 'preferences', 'multi-channel', 'get-notifications',
            'get-count', 'mark-read', 'cleanup'
          ]},
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Notification test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  // Return available test actions
  return NextResponse.json({
    message: 'Notification System Test Endpoint',
    usage: 'POST with { "action": "test_name", "userId": "optional_user_id" }',
    availableActions: {
      simple: 'Send a basic in-app notification',
      subscription: 'Test subscription confirmation notification',
      payment: 'Test payment receipt notification',
      loyalty: 'Test loyalty points earned notification',
      booking: 'Test booking confirmation notification',
      template: 'Test notification with template processing',
      preferences: 'Create default user preferences',
      'multi-channel': 'Test multi-channel delivery',
      'get-notifications': 'Fetch user notifications',
      'get-count': 'Get unread notification count',
      'mark-read': 'Mark a notification as read',
      cleanup: 'Clean up expired notifications'
    },
    example: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { action: 'simple', userId: 'test_user_123' }
    }
  });
}