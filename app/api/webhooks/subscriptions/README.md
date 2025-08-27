# Subscription Webhook Handlers

This module handles Stripe subscription webhook events for recurring billing.

## Webhook Events Handled

### Subscription Lifecycle
- `customer.subscription.created` - New subscription started
- `customer.subscription.updated` - Subscription modified (status change, plan change, etc.)
- `customer.subscription.deleted` - Subscription canceled
- `customer.subscription.paused` - Subscription paused
- `customer.subscription.resumed` - Subscription resumed from pause
- `customer.subscription.trial_will_end` - Trial ending soon (3 days before)

### Billing Events
- `invoice.paid` / `invoice.payment_succeeded` - Successful payment, resets service usage
- `invoice.payment_failed` - Failed payment, marks subscription as past_due
- `invoice.upcoming` - Upcoming charge notification (3 days before)
- `invoice.payment_action_required` - Payment requires additional authentication (3D Secure)

### Payment Events
- `charge.failed` - Direct charge failure
- `payment_method.automatically_updated` - Card updated automatically by issuer

## Key Features

### 1. Idempotency
All webhooks are processed with idempotency guarantees using the `processWebhookWithIdempotency` wrapper which:
- Prevents duplicate processing
- Stores webhook events in database
- Handles retry logic for failed events
- Uses transactions for atomicity

### 2. Service Usage Reset
On successful payment (`invoice.paid`):
- Resets `servicesUsedThisPeriod` to 0
- Updates billing period dates
- Creates usage record for new period
- Sends payment confirmation notification

### 3. Subscription Status Mapping
Maps Stripe statuses to internal statuses:
- `active` → `active`
- `past_due`, `unpaid`, `incomplete` → `past_due`
- `canceled`, `incomplete_expired` → `canceled`
- `trialing` → `trialing`
- `paused` → `paused`

### 4. Notifications
Sends appropriate notifications for:
- New subscriptions (welcome email)
- Payment confirmations
- Payment failures
- Trial ending reminders
- Subscription cancellations
- Payment method updates

## Database Updates

### Tables Updated
- `customer_subscriptions` - Main subscription records
- `subscription_usage` - Usage tracking per billing period
- `subscription_plans` - Subscriber count updates
- `profiles` - Customer profile status

## Configuration

### Environment Variables
```bash
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=whsec_...  # Optional, falls back to STRIPE_WEBHOOK_SECRET
STRIPE_WEBHOOK_SECRET=whsec_...               # Main webhook secret
```

### Webhook Endpoint
```
POST /api/webhooks/subscriptions
```

## Testing Webhooks Locally

1. Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
```

2. Forward webhooks to localhost:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/subscriptions
```

3. Trigger test events:
```bash
# Create subscription
stripe trigger customer.subscription.created

# Process payment
stripe trigger invoice.payment_succeeded

# Fail payment
stripe trigger invoice.payment_failed

# Cancel subscription
stripe trigger customer.subscription.deleted

# Trial ending
stripe trigger customer.subscription.trial_will_end
```

## Security

- Verifies Stripe webhook signatures
- Returns 401 for invalid signatures
- Logs security events for monitoring
- Uses database transactions for consistency
- Returns 200 even on processing failure (prevents retry storms)

## Error Handling

- Gracefully handles missing subscriptions
- Creates records if they don't exist (migration support)
- Logs all errors with context
- Retries failed webhooks up to 3 times
- Non-critical operations (notifications) don't fail the webhook

## Usage with Subscription Manager

The webhook handlers work in conjunction with the `SubscriptionManager` class:

```typescript
import { subscriptionManager } from '@/lib/subscriptions/subscription-manager';

// Check if customer can use service
const { allowed, reason } = await subscriptionManager.canUseService(customerId);

// Record service usage
await subscriptionManager.recordServiceUsage(subscriptionId, bookingId);

// Get current usage
const usage = await subscriptionManager.getCurrentUsage(subscriptionId);

// Cancel subscription
await subscriptionManager.cancelSubscription(subscriptionId, reason);
```

## Monitoring

Monitor webhook health with:
```typescript
import { getWebhookHealthMetrics } from '@/lib/webhook-idempotency';

const metrics = await getWebhookHealthMetrics();
// Returns status counts, recent failures, processing stats
```

## Related Files

- `/lib/subscriptions/subscription-manager.ts` - Subscription management utilities
- `/lib/webhook-idempotency.ts` - Idempotency and retry logic
- `/lib/notifications/notification-service.ts` - Email/SMS notifications
- `/db/schema/subscriptions-schema.ts` - Database schema