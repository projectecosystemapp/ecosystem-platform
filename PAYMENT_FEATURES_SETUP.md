# Payment Features Implementation Guide

This document outlines the comprehensive payment features implemented for the marketplace, including refunds, escrow/payout system, and idempotency keys.

## Features Implemented

### 1. Refund System (`/api/stripe/refunds`)
- **Full and Partial Refunds**: Support for both complete and partial refund amounts
- **Automatic Fee Reversal**: Platform fees are reversed proportionally (10% for logged-in users, 20% for guests)
- **Status Tracking**: Updates booking status and creates audit trails
- **Idempotency**: Prevents duplicate refund attempts
- **Notifications**: Sends refund confirmations to both customers and providers

#### Usage:
```typescript
POST /api/stripe/refunds
{
  "bookingId": "booking-uuid",
  "amount": 50.00, // Optional - defaults to full refund
  "reason": "Customer requested cancellation"
}
```

### 2. Escrow/Payout Release System (`/api/stripe/payouts/release`)
- **24-Hour Hold Period**: Funds are held for minimum 24 hours after service completion
- **Manual Release**: Providers can manually release available payouts
- **Automatic Release**: Scheduled job processes eligible payouts automatically
- **Batch Processing**: Release all eligible payouts for a provider at once
- **Transfer Tracking**: Full audit trail of all payout operations

#### Usage:
```typescript
// Release single booking payout
POST /api/stripe/payouts/release
{
  "bookingId": "booking-uuid"
}

// Release all eligible payouts for provider
POST /api/stripe/payouts/release
{
  "providerId": "provider-uuid"
}

// Force release (admin only)
POST /api/stripe/payouts/release
{
  "bookingId": "booking-uuid",
  "force": true
}
```

### 3. Idempotency Key System
- **Duplicate Prevention**: All Stripe operations use unique idempotency keys
- **Retry Logic**: Automatic retry with exponential backoff for failed operations
- **Key Storage**: Database tracking of all idempotency keys with expiration
- **Cleanup**: Automatic cleanup of expired keys to prevent table growth

## Database Schema Changes

### New Table: `idempotency_keys`
```sql
CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    operation TEXT NOT NULL,
    resource_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    response TEXT,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### Enhanced Tables:
- **transactions**: Added payout tracking columns
- **bookings**: Added refund tracking columns
- **audit_logs**: New table for financial operation audit trail

## Environment Variables Required

```env
# Existing Stripe variables
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# New marketplace webhook secret (optional - separate endpoint)
STRIPE_MARKETPLACE_WEBHOOK_SECRET=whsec_...

# Cron job authentication
CRON_SECRET=your-secure-random-string

# App URL for internal API calls
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Webhook Configuration

### Required Webhook Events
Set up webhooks in your Stripe Dashboard with these events:

**Payment Processing:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

**Refunds:**
- `charge.refunded`

**Transfers/Payouts:**
- `transfer.created`
- `transfer.failed`

**Platform Fees:**
- `application_fee.created`
- `application_fee.refunded`

### Webhook Endpoints
- Primary: `/api/stripe/webhooks` (existing)
- Marketplace: `/api/stripe/webhooks/marketplace` (new, dedicated)

## Automatic Payout Processing

### Cron Job Setup
Set up a scheduled job to run every 6 hours:

```bash
# Cron expression: 0 */6 * * *
curl -X GET "https://your-domain.com/api/cron/process-payouts" \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

### Vercel Cron (Recommended)
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-payouts",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## Provider Dashboard Integration

### Payout Dashboard Component
```typescript
import { PayoutDashboard } from "@/components/provider/payouts/payout-dashboard";

// In your provider dashboard page
<PayoutDashboard providerId={provider.id} />
```

### Required API Endpoints
- `GET /api/providers/[providerId]/payouts/summary` - Payout summary stats
- `GET /api/providers/[providerId]/bookings?includePayouts=true` - Bookings with payout status

## Security Features

### 1. Authorization Checks
- Customers can only refund their own bookings
- Providers can only release their own payouts
- Admin overrides require proper role verification

### 2. Idempotency Protection
- All payment operations are protected against duplicates
- Retry logic handles network failures gracefully
- Keys expire automatically to prevent replay attacks

### 3. Audit Trail
- All financial operations are logged
- Database triggers capture transaction changes
- Webhook events provide additional verification

## Monitoring and Alerts

### Key Metrics to Monitor
- Failed payout attempts
- Stuck transactions (pending > 48 hours)
- Unusual refund patterns
- Webhook delivery failures

### Health Checks
```bash
# Check cron job status
curl -I "https://your-domain.com/api/cron/process-payouts"

# Check webhook configuration
curl "https://your-domain.com/api/stripe/webhooks/marketplace"
```

## Platform Fee Configuration

The platform takes different fees based on user type:
- **Logged-in users**: 10% platform fee
- **Guest users**: 20% platform fee

This is automatically calculated in the booking creation and properly reversed during refunds.

## Error Handling

### Common Error Scenarios
1. **Payment failures**: Booking status updated to "cancelled"
2. **Transfer failures**: Transaction marked as "failed", admin alerted
3. **Webhook failures**: Retry logic with exponential backoff
4. **Network timeouts**: Idempotency keys prevent duplicate charges

### Error Responses
All endpoints return structured error responses:
```json
{
  "error": "Human readable error message",
  "details": "Technical details for debugging",
  "code": "ERROR_CODE"
}
```

## Testing

### Test Scenarios
1. **Full refund flow**: Create booking, complete service, process refund
2. **Partial refund flow**: Test with different refund amounts
3. **Payout release**: Complete service, wait 24 hours, release payout
4. **Duplicate prevention**: Try creating duplicate payment intents
5. **Webhook reliability**: Test with network interruptions

### Test Cards (Stripe)
```
4000000000000002 - Card declined
4000000000009995 - Insufficient funds
4000000000000119 - Processing error
```

## Deployment Checklist

- [ ] Database migration applied (`0014_idempotency_keys.sql`)
- [ ] Environment variables configured
- [ ] Webhook endpoints configured in Stripe Dashboard
- [ ] Cron job scheduled for automatic payouts
- [ ] Test refund flow in staging environment
- [ ] Test payout flow in staging environment
- [ ] Verify idempotency key cleanup
- [ ] Set up monitoring alerts
- [ ] Document rollback procedures

## Support and Troubleshooting

### Common Issues
1. **"Payout on hold"**: Service must be completed and 24 hours must pass
2. **"Refund failed"**: Check if payment intent supports refunds
3. **"Duplicate operation"**: Idempotency key already used (expected behavior)

### Debug Commands
```bash
# Check pending payouts
psql -c "SELECT * FROM transactions WHERE status = 'pending';"

# Check expired idempotency keys
psql -c "SELECT COUNT(*) FROM idempotency_keys WHERE expires_at < NOW();"

# View recent webhook events
curl "https://api.stripe.com/v1/events" -u "${STRIPE_SECRET_KEY}:"
```

## Future Enhancements

1. **Multi-currency support**: Extend for international markets
2. **Flexible hold periods**: Provider-specific hold configurations
3. **Advanced fee structures**: Tiered pricing based on volume
4. **Dispute management**: Handle chargebacks and disputes
5. **Financial reporting**: Comprehensive revenue analytics
6. **Tax integration**: Automatic tax calculation and reporting

---

For technical support, refer to the inline code documentation or contact the development team.