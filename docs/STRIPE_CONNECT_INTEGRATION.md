# Stripe Connect Integration Documentation

## Overview

The Ecosystem platform uses **Stripe Connect** to facilitate payments between customers and service providers while collecting platform fees. This implementation follows Series A production standards with robust error handling, idempotency, and comprehensive webhook support.

## Platform Fee Structure

### Fee Breakdown

| User Type | Service Price | Platform Fee | Guest Surcharge | Provider Receives | Customer Pays |
|-----------|--------------|--------------|-----------------|-------------------|---------------|
| Authenticated | $100 | $10 (10%) | $0 | $90 | $100 |
| Guest | $100 | $10 (10%) | $10 (10%) | $90 | $110 |

**Key Points:**
- Providers **always** receive 90% of the service price
- Platform base fee is 10% of service price
- Guests pay an additional 10% surcharge (total 110% of service price)
- All amounts are stored in cents to avoid floating-point errors

## API Endpoints

### 1. Stripe Connect Account Management

#### Create Connected Account
```typescript
POST /api/stripe/connect
Body: {
  providerId: string (uuid)
  accountType: "express" | "standard" (default: "express")
}
Response: {
  success: boolean
  accountId: string
  accountType: string
}
```

#### Generate Onboarding Link
```typescript
PUT /api/stripe/connect
Body: {
  providerId: string (uuid)
  refreshUrl?: string
  returnUrl?: string
}
Response: {
  success: boolean
  url: string
  expiresAt: number
}
```

#### Check Account Status
```typescript
GET /api/stripe/connect?providerId={uuid}
Response: {
  exists: boolean
  accountId?: string
  onboardingComplete: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requirements?: object
  capabilities?: object
}
```

### 2. Payment Processing

#### Create Payment Intent
```typescript
POST /api/stripe/payment
Body: {
  bookingId: string (uuid)
  amount: number (cents)
  currency: string (default: "usd")
  description?: string
  isGuestCheckout: boolean
  customerEmail?: string (for guests)
  idempotencyKey?: string
}
Response: {
  success: boolean
  paymentIntentId: string
  clientSecret: string
  amount: number
  fees: {
    serviceAmount: number
    platformFee: number
    guestSurcharge: number
    providerPayout: number
    totalAmount: number
  }
}
```

#### Confirm Payment
```typescript
PUT /api/stripe/payment
Body: {
  paymentIntentId: string
  bookingId: string (uuid)
}
Response: {
  success: boolean
  status: string
  amount: number
  transferId?: string
  confirmedAt?: string
}
```

#### Process Refund
```typescript
DELETE /api/stripe/payment
Body: {
  bookingId: string (uuid)
  amount?: number (cents, optional for partial refunds)
  reason?: string
  reverseTransfer: boolean (default: true)
  idempotencyKey?: string
}
Response: {
  success: boolean
  refundId: string
  amount: number
  status: string
  reason: string
}
```

### 3. Payout Management

#### Get Payout History
```typescript
GET /api/stripe/payouts?providerId={uuid}&startDate={iso}&endDate={iso}&limit={number}
Response: {
  success: boolean
  payouts: Array<{
    id: string
    amount: number
    currency: string
    arrivalDate: string
    status: string
    type: string
    method: string
  }>
  balance: {
    available: Array<{amount: number, currency: string}>
    pending: Array<{amount: number, currency: string}>
    instantAvailable?: Array<{amount: number, currency: string}>
  }
  recentTransactions: Array<...>
  summary: {
    totalEarnings: number
    transactionCount: number
  }
  hasMore: boolean
  nextCursor?: string
}
```

#### Create Instant Payout
```typescript
POST /api/stripe/payouts
Body: {
  providerId: string (uuid)
  amount?: number (cents, optional for full balance)
  currency: string (default: "usd")
  description?: string
  idempotencyKey?: string
}
Response: {
  success: boolean
  payoutId: string
  amount: number
  currency: string
  arrivalDate: string
  status: string
}
```

## Webhook Events

### Connect Webhooks (`/api/stripe/webhooks/connect`)

The system handles the following Stripe Connect webhook events:

| Event | Purpose | Action |
|-------|---------|--------|
| `account.updated` | Account status changes | Update onboarding status |
| `account.application.authorized` | Account authorized | Activate provider |
| `account.application.deauthorized` | Account disconnected | Deactivate provider |
| `capability.updated` | Payment capability changes | Update provider status |
| `payout.created` | Payout initiated | Log for reconciliation |
| `payout.paid` | Payout completed | Update records |
| `payout.failed` | Payout failed | Alert provider & support |

## Server Actions

### Available Actions

```typescript
import {
  createConnectedAccount,
  getAccountLink,
  checkAccountStatus,
  createPaymentWithFee,
  getPayoutHistory,
  processRefund,
  getProviderEarnings,
  calculatePaymentFees
} from "@/actions/stripe-connect-actions";
```

### Usage Examples

#### 1. Provider Onboarding Flow
```typescript
// Step 1: Create Stripe Connect account
const account = await createConnectedAccount(providerId, "express");

// Step 2: Generate onboarding link
const link = await getAccountLink(providerId);

// Step 3: Redirect to Stripe onboarding
window.location.href = link.url;

// Step 4: Check onboarding status (after return)
const status = await checkAccountStatus(providerId);
if (status.onboardingComplete) {
  // Provider can now accept payments
}
```

#### 2. Processing a Booking Payment
```typescript
// Calculate fees
const fees = calculatePaymentFees(10000, false); // $100, authenticated user

// Create payment intent
const payment = await createPaymentWithFee(
  bookingId,
  10000, // $100 in cents
  false, // not guest
  undefined, // no email needed for authenticated
  "Plumbing service - 2 hours"
);

// Use payment.clientSecret with Stripe Elements/Payment Element
```

#### 3. Handling Refunds
```typescript
// Full refund
const fullRefund = await processRefund(bookingId);

// Partial refund
const partialRefund = await processRefund(
  bookingId,
  5000, // $50 refund
  "Service partially completed"
);
```

## Database Schema

### Providers Table
```sql
stripeConnectAccountId: text | null
stripeOnboardingComplete: boolean (default: false)
commissionRate: numeric(3,2) (default: 0.10)
```

### Bookings Table
```sql
stripePaymentIntentId: text | null
totalAmount: numeric(10,2)
platformFee: numeric(10,2)
providerPayout: numeric(10,2)
isGuestBooking: boolean (default: false)
```

### Transactions Table
```sql
stripeChargeId: text | null
stripeTransferId: text | null
stripeRefundId: text | null
amount: numeric(10,2)
platformFee: numeric(10,2)
providerPayout: numeric(10,2)
status: "pending" | "completed" | "refunded" | "failed"
```

## Security Considerations

### 1. Authentication & Authorization
- All endpoints require authentication via Clerk
- Provider ownership is verified for all operations
- Guest checkout supported with email verification

### 2. Webhook Security
- Signature verification using `stripe.webhooks.constructEvent()`
- Endpoint secrets stored in environment variables
- Idempotent event processing

### 3. Payment Security
- No raw card data stored
- All payment processing through Stripe
- PCI compliance maintained via Stripe Elements

### 4. Error Handling
- Comprehensive error logging
- User-friendly error messages
- Automatic retry logic for transient failures

## Testing

### Local Development Setup

1. Install Stripe CLI:
```bash
brew install stripe/stripe-cli/stripe
```

2. Login to Stripe:
```bash
stripe login
```

3. Forward webhooks to local:
```bash
# For Connect webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhooks/connect

# Note the webhook signing secret and add to .env.local:
# STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
```

4. Trigger test events:
```bash
# Test account update
stripe trigger account.updated

# Test payment
stripe trigger payment_intent.succeeded
```

### Test Accounts

Use Stripe's test mode with these test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires auth: `4000 0025 0000 3155`

### Unit Tests

Run the test suite:
```bash
npm test -- tests/stripe-connect.test.ts
```

## Monitoring & Debugging

### Key Metrics to Track

1. **Payment Success Rate**
   - Target: > 98%
   - Alert threshold: < 95%

2. **Onboarding Completion Rate**
   - Target: > 80%
   - Alert threshold: < 70%

3. **Payout Success Rate**
   - Target: > 99.9%
   - Alert threshold: < 99%

4. **Average Processing Time**
   - Payment creation: < 500ms
   - Refund processing: < 1000ms

### Debug Queries

```sql
-- Check provider payment status
SELECT 
  p.display_name,
  p.stripe_connect_account_id,
  p.stripe_onboarding_complete,
  COUNT(b.id) as total_bookings,
  SUM(CAST(b.provider_payout AS DECIMAL)) as total_earnings
FROM providers p
LEFT JOIN bookings b ON p.id = b.provider_id
WHERE p.id = 'PROVIDER_ID'
GROUP BY p.id;

-- Recent transaction issues
SELECT 
  t.*,
  b.service_name,
  b.status as booking_status
FROM transactions t
JOIN bookings b ON t.booking_id = b.id
WHERE t.status IN ('failed', 'pending')
  AND t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC;
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Provider has not completed payment setup" | Provider needs to complete Stripe onboarding |
| "No funds available for instant payout" | Wait for funds to settle (usually 2-7 days) |
| "Payment intent mismatch" | Ensure booking ID matches payment intent |
| "Invalid signature" | Check webhook secret in environment variables |
| "Account disabled" | Check Stripe Dashboard for requirements |

### Support Escalation

1. Check application logs
2. Verify webhook events in Stripe Dashboard
3. Review account requirements in Stripe Connect
4. Contact Stripe Support for platform-level issues

## Compliance

### Regulatory Requirements
- KYC/AML handled by Stripe
- 1099 tax reporting for US providers
- GDPR compliance for EU customers
- PCI DSS compliance via Stripe

### Platform Responsibilities
- Maintain Terms of Service
- Provider agreements
- Privacy policy
- Refund policy

## Migration Guide

### From Subscription Model to Connect
1. Create Connect accounts for existing providers
2. Migrate payment methods to Connect
3. Update booking flow to use new endpoints
4. Test with small cohort before full rollout
5. Monitor metrics during transition

## Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Connect Onboarding](https://stripe.com/docs/connect/onboarding)