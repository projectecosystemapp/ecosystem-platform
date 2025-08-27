# Notification System Documentation

## Overview

The comprehensive notification system supports email, in-app, SMS, and push notifications for all marketplace events. It includes user preference management, real-time delivery status tracking, and template-based messaging.

## Architecture

### Core Components

1. **Database Schema** (`/db/schema/notifications-schema.ts`)
   - `notifications`: Main notification records
   - `notification_preferences`: User notification settings
   - `notification_templates`: Reusable message templates
   - `notification_queue`: Scheduled/delayed notifications
   - `price_alerts`: User-defined price monitoring

2. **Services**
   - `NotificationService`: Core notification processing
   - `MarketplaceNotifications`: High-level helpers for common scenarios
   - `EmailService`: Email delivery (Resend integration)

3. **API Routes**
   - `GET /api/notifications`: Fetch notifications and preferences
   - `POST /api/notifications`: Send notifications and manage actions
   - `PUT /api/notifications`: Update user preferences
   - `DELETE /api/notifications`: Mark as read/cleanup

## Quick Start

### 1. Database Setup

```bash
# Generate and run migration
npm run db:generate
npm run db:migrate
```

### 2. Environment Variables

```env
# Email service (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_REPLY_TO=support@yourdomain.com

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Send Your First Notification

```typescript
import { notificationService } from '@/lib/services/notification-service';

// Simple notification
await notificationService.sendNotification({
  userId: 'user_123',
  type: 'booking_confirmed',
  title: 'Booking Confirmed!',
  body: 'Your booking has been confirmed.',
  channels: ['email', 'in_app'],
  priority: 'medium',
});

// Using marketplace helpers
import { bookingNotifications } from '@/lib/services/marketplace-notifications';

await bookingNotifications.confirmed('user_123', {
  serviceName: 'Personal Training',
  bookingDate: new Date('2024-12-01'),
  bookingTime: '2:00 PM - 3:00 PM',
  bookingUrl: '/bookings/123',
});
```

## Notification Types

### Subscription Notifications
- `subscription_confirmed`: Welcome to new subscription
- `subscription_renewed`: Successful renewal
- `subscription_expiring`: Expiration warning
- `subscription_failed`: Payment failure

### Payment Notifications
- `payment_received`: Payment confirmation/receipt
- `payment_failed`: Payment failure with retry
- `payment_refunded`: Refund processed

### Loyalty Notifications
- `points_earned`: Points awarded
- `points_redeemed`: Points used for rewards
- `points_expiring`: Expiration warning
- `tier_upgraded`: Loyalty tier promotion

### Group Booking Notifications
- `group_booking_invitation`: Invite to join group
- `group_booking_confirmed`: Group booking success
- `group_member_joined`: New member notification

### Price Alert Notifications
- `price_drop_alert`: Price decreased
- `flash_sale`: Limited-time discount
- `limited_availability`: Low stock warning

### Referral Notifications
- `referral_success`: Successful referral reward
- `referral_reward_earned`: Reward credited

### Booking Notifications
- `booking_confirmed`: Booking confirmation (in-app)
- `booking_reminder`: Appointment reminder
- `booking_cancelled`: Cancellation notice

### Review Notifications
- `review_request`: Request for review
- `review_response`: Response to review

### System Notifications
- `welcome`: New user onboarding
- `special_offer`: Personalized offers
- `security_alert`: Account security
- `maintenance`: System maintenance
- `announcement`: Important updates

## Channels

### Email (`email`)
- Uses Resend service
- HTML templates with responsive design
- Automatic retry on failure
- Delivery tracking via webhooks

### In-App (`in_app`)
- Immediate delivery to user dashboard
- Real-time unread counts
- Mark as read functionality
- Rich content support

### SMS (`sms`)
- Integration ready for Twilio
- Character limit optimization
- Link shortening support

### Push (`push`)
- Integration ready for Firebase
- Device token management
- Rich notifications with actions

## User Preferences

Users can control notification delivery through comprehensive preferences:

```typescript
// Get user preferences
const preferences = await notificationService.getUserPreferences(userId);

// Update preferences
await notificationService.updatePreferences(userId, {
  emailEnabled: true,
  bookingNotifications: false,
  quietHoursEnabled: true,
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 8,    // 8 AM
});
```

### Preference Categories
- **Channel Settings**: Enable/disable email, in-app, SMS, push
- **Content Categories**: Subscription, payment, loyalty, booking, etc.
- **Frequency Controls**: Instant, daily digest, weekly digest
- **Quiet Hours**: Respect user's preferred notification times
- **Contact Info**: Alternative email/phone for notifications

## Templates

### Using Pre-defined Templates

```typescript
await notificationService.sendNotification({
  userId: 'user_123',
  type: 'subscription_confirmed',
  title: 'Template will override this',
  body: 'Template will override this',
  templateCode: 'subscription_confirmed',
  templateData: {
    customerName: 'John Doe',
    planName: 'Premium Plan',
    providerName: 'Fitness Studio',
    renewalDate: '2024-12-01',
  },
});
```

### Template Variables

Templates support variable substitution with `{{variableName}}` syntax:

```html
<!-- Email template -->
<h1>Welcome to {{planName}}!</h1>
<p>Hi {{customerName}}, your subscription has been confirmed.</p>
<p>Next renewal: {{renewalDate}}</p>
```

### Creating Custom Templates

```typescript
// Add to notification-templates.ts
{
  code: 'custom_welcome',
  name: 'Custom Welcome',
  type: 'welcome',
  channel: 'email',
  subjectTemplate: 'Welcome {{userName}}!',
  titleTemplate: 'Welcome to Our Platform',
  bodyTemplate: 'Hi {{userName}}, thanks for joining {{platformName}}!',
  variables: [
    { name: 'userName', type: 'string', required: true },
    { name: 'platformName', type: 'string', required: true },
  ],
}
```

## API Usage

### Fetch Notifications

```typescript
// Get in-app notifications
const response = await fetch('/api/notifications?channel=in_app&limit=20');
const { notifications, pagination } = await response.json();

// Get unread count
const countResponse = await fetch('/api/notifications?action=count');
const { count } = await countResponse.json();

// Get user preferences
const prefResponse = await fetch('/api/notifications?action=preferences');
const { preferences } = await prefResponse.json();
```

### Send Notifications

```typescript
// Send custom notification
await fetch('/api/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'custom_alert',
    title: 'Important Update',
    body: 'Please update your payment method.',
    priority: 'high',
    channels: ['email', 'in_app'],
    actionUrl: '/settings/payment',
    actionText: 'Update Payment',
  }),
});

// Mark notification as read
await fetch('/api/notifications?action=mark-read', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ notificationId: 'notif_123' }),
});

// Mark all as read
await fetch('/api/notifications?action=mark-all-read', {
  method: 'POST',
});

// Create price alert
await fetch('/api/notifications?action=create-price-alert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    providerId: 'provider_123',
    serviceId: 'service_456',
    targetPrice: 5000, // $50.00 in cents
  }),
});
```

### Update Preferences

```typescript
await fetch('/api/notifications', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    emailEnabled: true,
    bookingNotifications: false,
    quietHoursEnabled: true,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    dailyDigest: true,
  }),
});
```

## Integration Examples

### Stripe Webhook Integration

```typescript
// In your Stripe webhook handler
import { PaymentIntegration } from '@/lib/integrations/notification-integrations';

export async function POST(request: Request) {
  const event = await stripe.webhooks.constructEvent(/* ... */);
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      await PaymentIntegration.onPaymentSucceeded({
        userId: event.data.object.metadata.userId,
        paymentIntentId: event.data.object.id,
        amount: event.data.object.amount,
        serviceName: event.data.object.metadata.serviceName,
        bookingId: event.data.object.metadata.bookingId,
      });
      break;
      
    case 'payment_intent.payment_failed':
      await PaymentIntegration.onPaymentFailed({
        userId: event.data.object.metadata.userId,
        serviceName: event.data.object.metadata.serviceName,
        errorMessage: event.data.object.last_payment_error?.message || 'Payment failed',
        retryUrl: `/checkout/retry/${event.data.object.id}`,
      });
      break;
  }
}
```

### Booking Lifecycle Integration

```typescript
// In your booking creation logic
import { SubscriptionIntegration } from '@/lib/integrations/notification-integrations';

// After subscription is created
await SubscriptionIntegration.onSubscriptionCreated({
  userId: booking.userId,
  subscriptionId: subscription.id,
  planName: subscription.planName,
  providerName: provider.name,
  renewalDate: subscription.currentPeriodEnd,
  amount: subscription.amount,
});

// After booking is confirmed
await bookingNotifications.confirmed(booking.userId, {
  serviceName: booking.serviceName,
  bookingDate: booking.date,
  bookingTime: booking.timeSlot,
  bookingUrl: `/bookings/${booking.id}`,
});
```

### Price Monitoring Integration

```typescript
// In your price update logic
import { PriceMonitoringIntegration } from '@/lib/integrations/notification-integrations';

// Check for price alerts when prices change
await PriceMonitoringIntegration.checkPriceChanges({
  providerId: service.providerId,
  serviceId: service.id,
  oldPrice: service.previousPrice,
  newPrice: service.currentPrice,
  serviceName: service.name,
  providerName: service.provider.name,
});
```

### Scheduled Tasks

```typescript
// Set up cron jobs or scheduled functions
import { 
  SubscriptionIntegration,
  LoyaltyIntegration,
  BookingReminderIntegration,
} from '@/lib/integrations/notification-integrations';

// Daily tasks
export async function dailyNotificationTasks() {
  await SubscriptionIntegration.checkExpiringSubscriptions();
  await BookingReminderIntegration.sendBookingReminders();
}

// Weekly tasks
export async function weeklyNotificationTasks() {
  await LoyaltyIntegration.checkExpiringPoints();
  // Send weekly digests
}
```

## Frontend Components

### Notification Bell (Example)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Fetch unread count
    fetch('/api/notifications?action=count')
      .then(res => res.json())
      .then(data => setUnreadCount(data.count));

    // Fetch recent notifications
    fetch('/api/notifications?channel=in_app&limit=10')
      .then(res => res.json())
      .then(data => setNotifications(data.notifications));
  }, []);

  const markAsRead = async (notificationId: string) => {
    await fetch('/api/notifications?action=mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId }),
    });
    
    // Update local state
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? {...n, readAt: new Date()} : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="relative">
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
      
      {/* Dropdown with notifications */}
      <div className="absolute right-0 top-8 w-80 bg-white shadow-lg rounded-lg max-h-96 overflow-y-auto">
        {notifications.map(notification => (
          <div 
            key={notification.id}
            className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
              !notification.readAt ? 'bg-blue-50' : ''
            }`}
            onClick={() => !notification.readAt && markAsRead(notification.id)}
          >
            <h4 className="font-medium">{notification.title}</h4>
            <p className="text-sm text-gray-600">{notification.body}</p>
            <span className="text-xs text-gray-400">
              {new Date(notification.createdAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Notification Preferences (Example)

```tsx
'use client';

import { useEffect, useState } from 'react';

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications?action=preferences')
      .then(res => res.json())
      .then(data => {
        setPreferences(data.preferences);
        setLoading(false);
      });
  }, []);

  const updatePreferences = async (updates: any) => {
    const response = await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    if (response.ok) {
      const { preferences: updated } = await response.json();
      setPreferences(updated);
    }
  };

  if (loading || !preferences) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Notification Preferences</h2>
      
      {/* Channel Preferences */}
      <div>
        <h3 className="font-medium mb-3">Delivery Methods</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.emailEnabled}
              onChange={e => updatePreferences({ emailEnabled: e.target.checked })}
            />
            <span className="ml-2">Email notifications</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.inAppEnabled}
              onChange={e => updatePreferences({ inAppEnabled: e.target.checked })}
            />
            <span className="ml-2">In-app notifications</span>
          </label>
        </div>
      </div>

      {/* Category Preferences */}
      <div>
        <h3 className="font-medium mb-3">Notification Types</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.bookingNotifications}
              onChange={e => updatePreferences({ bookingNotifications: e.target.checked })}
            />
            <span className="ml-2">Booking updates</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.loyaltyNotifications}
              onChange={e => updatePreferences({ loyaltyNotifications: e.target.checked })}
            />
            <span className="ml-2">Loyalty points & rewards</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={preferences.priceAlertNotifications}
              onChange={e => updatePreferences({ priceAlertNotifications: e.target.checked })}
            />
            <span className="ml-2">Price drop alerts</span>
          </label>
        </div>
      </div>

      {/* Quiet Hours */}
      <div>
        <h3 className="font-medium mb-3">Quiet Hours</h3>
        <label className="flex items-center mb-2">
          <input
            type="checkbox"
            checked={preferences.quietHoursEnabled}
            onChange={e => updatePreferences({ quietHoursEnabled: e.target.checked })}
          />
          <span className="ml-2">Enable quiet hours</span>
        </label>
        
        {preferences.quietHoursEnabled && (
          <div className="flex space-x-4">
            <div>
              <label className="block text-sm">Start</label>
              <select
                value={preferences.quietHoursStart || 22}
                onChange={e => updatePreferences({ quietHoursStart: parseInt(e.target.value) })}
                className="border rounded px-2 py-1"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm">End</label>
              <select
                value={preferences.quietHoursEnd || 8}
                onChange={e => updatePreferences({ quietHoursEnd: parseInt(e.target.value) })}
                className="border rounded px-2 py-1"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## Performance Considerations

### Database Optimization
- Notifications table is indexed on user_id, status, and created_at
- Automatic cleanup of old read/expired notifications
- Batch processing for high-volume notifications

### Email Delivery
- Rate limiting prevents abuse
- Automatic retry with exponential backoff
- Bounce and complaint handling via webhooks

### Scalability
- Queue system for delayed/scheduled notifications
- Batch processing for digest notifications
- Redis-based rate limiting for production

## Monitoring & Analytics

### Key Metrics
- Delivery rates by channel
- Open/read rates
- User engagement with notifications
- Failed delivery tracking

### Database Queries
```typescript
import { getDeliveryStats, getUserEngagementMetrics } from '@/db/queries/notifications';

// Get delivery stats for last 7 days
const deliveryStats = await getDeliveryStats(7);

// Get user engagement metrics
const engagement = await getUserEngagementMetrics('user_123', 30);
```

## Error Handling

The system includes comprehensive error handling:

1. **Graceful Degradation**: Failed email delivery doesn't block in-app notifications
2. **Retry Logic**: Automatic retry with exponential backoff
3. **Dead Letter Queue**: Failed notifications after max retries are logged
4. **User Feedback**: Delivery status tracking for transparency

## Security & Privacy

### Data Protection
- User preferences stored securely with encryption
- Unsubscribe tokens for email opt-out
- GDPR compliance with data deletion capabilities

### Rate Limiting
- API endpoints protected against abuse
- Per-user sending limits
- Provider-level rate limiting for bulk notifications

### Content Security
- Template validation prevents XSS
- Input sanitization for user-generated content
- Content filtering for spam prevention

## Testing

### Unit Tests
```typescript
import { notificationService } from '@/lib/services/notification-service';

describe('NotificationService', () => {
  test('should send notification with correct parameters', async () => {
    const result = await notificationService.sendNotification({
      userId: 'test_user',
      type: 'test_notification',
      title: 'Test Title',
      body: 'Test Body',
      channels: ['in_app'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
  });
});
```

### Integration Tests
```bash
# Test email delivery
npm run test:notifications:email

# Test webhook handling
npm run test:notifications:webhooks

# Test rate limiting
npm run test:notifications:rate-limit
```

## Deployment

### Environment Setup
```env
# Production settings
NODE_ENV=production
RESEND_API_KEY=your_production_key
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Health Checks
```typescript
// Add to your health check endpoint
import { notificationService } from '@/lib/services/notification-service';

export async function GET() {
  const health = {
    notifications: 'ok',
    email: 'ok',
    database: 'ok',
  };

  try {
    // Test database connection
    await notificationService.getUserPreferences('health_check');
  } catch (error) {
    health.database = 'error';
  }

  return NextResponse.json(health);
}
```

## Support & Troubleshooting

### Common Issues

1. **Notifications not sending**
   - Check API key configuration
   - Verify user preferences allow the notification type
   - Check rate limiting status

2. **Email delivery issues**
   - Verify Resend API key and domain setup
   - Check email blacklist status
   - Monitor webhook events

3. **High notification volume**
   - Enable Redis for rate limiting
   - Configure queue processing
   - Monitor database performance

### Debug Mode
```typescript
// Enable debug logging
process.env.NOTIFICATION_DEBUG = 'true';

// This will log all notification processing steps
```

### Contact Support
For issues with the notification system:
1. Check the health endpoint
2. Review server logs
3. Test with a minimal example
4. Contact the development team with error details

---

**Last Updated**: 2024-08-27
**Version**: 1.0.0