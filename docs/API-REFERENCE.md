# Ecosystem Marketplace API Reference

## Overview

The Ecosystem marketplace backend API is built with Next.js App Router (v14+) using TypeScript. The API provides comprehensive functionality for a service marketplace with provider management, booking system, and payment processing.

### Tech Stack
- **Framework**: Next.js App Router API Routes
- **Database**: PostgreSQL via Supabase
- **ORM**: Drizzle ORM with explicit FOREIGN KEY constraints
- **Authentication**: Clerk
- **Payments**: Stripe Connect
- **Rate Limiting**: Redis-based (partially implemented)

## Critical Security Issues

### 🚨 HIGH PRIORITY ISSUES

1. **No Webhook Idempotency** 
   - **Location**: `/app/api/stripe/webhooks/*`
   - **Risk**: Duplicate webhook processing can cause:
     - Double payments
     - Duplicate bookings
     - Financial discrepancies
   - **Required Fix**: Implement idempotency keys for all webhook handlers

2. **Incomplete Rate Limiting**
   - **Coverage**: Only 9/44 endpoints protected
   - **Protected Endpoints**:
     - `/api/bookings/guest` (payment type)
     - `/api/examples/rate-limited` (example)
     - `/api/stripe/refunds` 
     - `/api/stripe/payouts/release`
     - `/api/stripe/payment-intent`
     - `/api/stripe/connect/checkout`
   - **Unprotected Critical Endpoints**:
     - `/api/stripe/payment` ❌
     - `/api/bookings/create` ❌
     - `/api/stripe/webhooks/*` ❌

## API Endpoints Inventory

### Health & Monitoring

#### `GET /api/health`
- **Auth**: None
- **Purpose**: Basic health check
- **File**: `app/api/health/route.ts`

#### `GET /api/health/redis`
- **Auth**: None
- **Purpose**: Redis connectivity check
- **File**: `app/api/health/redis/route.ts`

#### `POST /api/errors`
- **Auth**: None
- **Purpose**: Client error reporting
- **File**: `app/api/errors/route.ts:23`
- **Request Schema**:
```typescript
{
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  level?: "error" | "warning" | "info";
  errorType?: string;
}
```

### Authentication & User

#### `GET /api/user/status`
- **Auth**: Required (Clerk)
- **Purpose**: Get user profile status
- **File**: `app/api/user/status/route.ts:8`
- **Response**:
```json
{
  "status": "active" | "suspended" | null,
  "timestamp": "ISO 8601 date"
}
```

#### `GET /api/csrf`
- **Auth**: None
- **Purpose**: Get CSRF token
- **File**: `app/api/csrf/route.ts`

### Bookings

#### `POST /api/bookings/create` ⚠️ NO RATE LIMIT
- **Auth**: Optional (supports guest checkout)
- **Purpose**: Create a new booking
- **File**: `app/api/bookings/create/route.ts:25`
- **Request Schema**:
```typescript
{
  providerId: string; // UUID
  serviceName: string;
  servicePrice: number;
  serviceDuration: number; // 15-480 minutes
  bookingDate: string; // ISO 8601
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  customerNotes?: string;
  isGuestBooking?: boolean;
  guestEmail?: string; // Required if guest
  guestPhone?: string;
}
```
- **Fee Structure**:
  - Authenticated users: 10% platform fee
  - Guest users: 20% total (10% base + 10% surcharge)

#### `POST /api/bookings/guest` ✅ RATE LIMITED
- **Auth**: Optional
- **Purpose**: Unified booking for authenticated/guest users
- **File**: `app/api/bookings/guest/route.ts:31`
- **Rate Limit**: `payment` type
- **Guest Info Schema**:
```typescript
{
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}
```

#### `GET /api/bookings/[bookingId]`
- **Auth**: Required
- **Purpose**: Get booking details
- **File**: `app/api/bookings/[bookingId]/route.ts`

#### `POST /api/bookings/[bookingId]/complete`
- **Auth**: Required
- **Purpose**: Mark booking as complete
- **File**: `app/api/bookings/[bookingId]/complete/route.ts`

#### `POST /api/bookings/[bookingId]/cancel`
- **Auth**: Required
- **Purpose**: Cancel a booking
- **File**: `app/api/bookings/[bookingId]/cancel/route.ts`

### Providers

#### `GET /api/providers`
- **Auth**: None
- **Purpose**: List all providers
- **File**: `app/api/providers/route.ts`

#### `GET /api/providers/[providerId]`
- **Auth**: None
- **Purpose**: Get provider details
- **File**: `app/api/providers/[providerId]/route.ts`

#### `GET /api/providers/check-existing`
- **Auth**: Required
- **Purpose**: Check if user has provider profile
- **File**: `app/api/providers/check-existing/route.ts:13`

#### `POST /api/providers/profile/update`
- **Auth**: Required
- **Purpose**: Update provider profile
- **File**: `app/api/providers/profile/update/route.ts:33`

### Provider Availability

#### `GET /api/providers/[providerId]/availability`
- **Auth**: None
- **Purpose**: Get provider availability
- **File**: `app/api/providers/[providerId]/availability/route.ts`

#### `GET /api/providers/[providerId]/availability/weekly`
- **Auth**: None
- **Purpose**: Get weekly availability schedule
- **File**: `app/api/providers/[providerId]/availability/weekly/route.ts`

#### `GET /api/providers/[providerId]/availability/slots`
- **Auth**: None
- **Purpose**: Get available time slots
- **File**: `app/api/providers/[providerId]/availability/slots/route.ts`

#### `POST /api/providers/[providerId]/availability/check`
- **Auth**: None
- **Purpose**: Check slot availability
- **File**: `app/api/providers/[providerId]/availability/check/route.ts`

#### `GET /api/providers/[providerId]/availability/blocks`
- **Auth**: Required (provider only)
- **Purpose**: Get blocked time slots
- **File**: `app/api/providers/[providerId]/availability/blocks/route.ts`

### Provider Analytics

#### `GET /api/providers/[providerId]/analytics/overview`
- **Auth**: Required (provider only)
- **Purpose**: Analytics dashboard data
- **File**: `app/api/providers/[providerId]/analytics/overview/route.ts`

#### `GET /api/providers/[providerId]/analytics/earnings`
- **Auth**: Required (provider only)
- **Purpose**: Earnings analytics
- **File**: `app/api/providers/[providerId]/analytics/earnings/route.ts`

#### `GET /api/providers/[providerId]/analytics/bookings`
- **Auth**: Required (provider only)
- **Purpose**: Booking analytics
- **File**: `app/api/providers/[providerId]/analytics/bookings/route.ts`

#### `GET /api/providers/[providerId]/analytics/performance`
- **Auth**: Required (provider only)
- **Purpose**: Performance metrics
- **File**: `app/api/providers/[providerId]/analytics/performance/route.ts`

### Stripe Payments

#### `POST /api/stripe/payment` ⚠️ NO RATE LIMIT
- **Auth**: Optional (supports guest)
- **Purpose**: Create payment intent
- **File**: `app/api/stripe/payment/route.ts:72`
- **Request Schema**:
```typescript
{
  bookingId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: object;
  isGuestCheckout?: boolean;
  customerEmail?: string;
  idempotencyKey?: string; // Client-provided but not enforced
}
```

#### `PUT /api/stripe/payment`
- **Auth**: Optional
- **Purpose**: Confirm payment
- **File**: `app/api/stripe/payment/route.ts:242`

#### `DELETE /api/stripe/payment`
- **Auth**: Required
- **Purpose**: Refund payment
- **File**: `app/api/stripe/payment/route.ts:332`

### Stripe Connect

#### `POST /api/stripe/connect`
- **Auth**: Required
- **Purpose**: Create Connect account
- **File**: `app/api/stripe/connect/route.ts`

#### `GET /api/stripe/connect/link`
- **Auth**: Required
- **Purpose**: Get onboarding link
- **File**: `app/api/stripe/connect/link/route.ts`

#### `POST /api/stripe/connect/accounts/create`
- **Auth**: Required
- **Purpose**: Create new Connect account
- **File**: `app/api/stripe/connect/accounts/create/route.ts`

#### `GET /api/stripe/connect/accounts/[accountId]/status`
- **Auth**: Required
- **Purpose**: Get account status
- **File**: `app/api/stripe/connect/accounts/[accountId]/status/route.ts`

#### `POST /api/stripe/connect/accounts/[accountId]/onboard`
- **Auth**: Required
- **Purpose**: Start onboarding
- **File**: `app/api/stripe/connect/accounts/[accountId]/onboard/route.ts`

### Stripe Payouts

#### `GET /api/stripe/payouts`
- **Auth**: Required
- **Purpose**: Get payout history
- **File**: `app/api/stripe/payouts/route.ts:36`
- **Query Params**:
  - `providerId`: UUID
  - `startDate`: ISO date
  - `endDate`: ISO date
  - `limit`: number (default 10)

#### `POST /api/stripe/payouts`
- **Auth**: Required
- **Purpose**: Create instant payout
- **File**: `app/api/stripe/payouts/route.ts:220`

#### `GET /api/providers/[providerId]/payouts/summary`
- **Auth**: Required
- **Purpose**: Payout summary
- **File**: `app/api/providers/[providerId]/payouts/summary/route.ts`

### Webhooks ⚠️ NO IDEMPOTENCY

#### `POST /api/stripe/webhooks`
- **Auth**: Stripe signature
- **Purpose**: Main Stripe webhooks
- **File**: `app/api/stripe/webhooks/route.ts:29`
- **Events Handled**:
  - `checkout.session.completed`
  - `customer.subscription.*`
  - `invoice.payment_*`
  - `payment_intent.*`
  - `charge.dispute.created`
  - `transfer.*`

#### `POST /api/stripe/webhooks/connect`
- **Auth**: Stripe signature
- **Purpose**: Connect webhooks
- **File**: `app/api/stripe/webhooks/connect/route.ts:78`

#### `POST /api/stripe/webhooks/marketplace`
- **Auth**: Stripe signature
- **Purpose**: Marketplace webhooks
- **File**: `app/api/stripe/webhooks/marketplace/route.ts`

### Maintenance

#### `POST /api/maintenance/cleanup-idempotency-keys`
- **Auth**: Admin only
- **Purpose**: Clean old idempotency keys
- **File**: `app/api/maintenance/cleanup-idempotency-keys/route.ts`

#### `POST /api/cron/process-payouts`
- **Auth**: Cron secret
- **Purpose**: Process scheduled payouts
- **File**: `app/api/cron/process-payouts/route.ts`

## Database Query Patterns

### Optimized Queries Found
- **JOIN Operations**: Used in `/api/stripe/payouts` and `/api/stripe/refunds`
  - Example: `innerJoin(bookingsTable, eq(transactionsTable.bookingId, bookingsTable.id))`
  - Example: `leftJoin` for optional relations

### Potential N+1 Issues
Most queries use single-table selects with proper limits:
```typescript
.select()
.from(table)
.where(condition)
.limit(1)
```

No obvious N+1 patterns detected, but watch for:
1. Loading bookings then fetching provider details separately
2. Loading multiple transactions without joining booking data

## Stripe Integration Points

### Payment Flow
1. **Payment Intent Creation**: `/api/stripe/payment` (POST)
2. **Payment Confirmation**: `/api/stripe/payment` (PUT)
3. **Webhook Processing**: `/api/stripe/webhooks/*`
4. **Refunds**: `/api/stripe/payment` (DELETE)

### Connect Flow
1. **Account Creation**: `/api/stripe/connect/accounts/create`
2. **Onboarding**: `/api/stripe/connect/accounts/[accountId]/onboard`
3. **Status Check**: `/api/stripe/connect/accounts/[accountId]/status`
4. **Payouts**: `/api/stripe/payouts`

## Missing Critical Features

### 1. Guest Checkout Endpoint ✅ FOUND
- **Status**: EXISTS at `/api/bookings/guest`
- **Implementation**: Fully functional with 20% fee for guests

### 2. Webhook Idempotency ❌ MISSING
- **Status**: NOT IMPLEMENTED
- **Risk**: HIGH - Financial data integrity at risk
- **Required Actions**:
  1. Add idempotency key storage (Redis/DB)
  2. Check key before processing
  3. Store results for replay
  4. Set TTL for cleanup

### 3. Rate Limiting ⚠️ PARTIAL
- **Status**: Only 20% coverage
- **Missing on**:
  - Payment creation endpoints
  - Booking creation (main endpoint)
  - All webhook endpoints
  - Provider updates

## Security Analysis

### ✅ Properly Implemented
1. **Authentication**: Clerk auth() properly checked
2. **Foreign Keys**: CASCADE deletes configured
3. **CSRF**: Token endpoint available
4. **Input Validation**: Zod schemas used

### ❌ Security Vulnerabilities
1. **No webhook replay protection**
2. **Incomplete rate limiting**
3. **No request signing for internal APIs**
4. **Missing audit logs for financial transactions**

## Recommended Immediate Actions

### Priority 1 (Critical)
1. **Implement webhook idempotency**:
   ```typescript
   // Store in Redis or DB
   const idempotencyKey = event.id;
   const processed = await checkIdempotencyKey(idempotencyKey);
   if (processed) return cached_response;
   ```

2. **Add rate limiting to payment endpoints**:
   ```typescript
   export const POST = withRateLimit(
     RATE_LIMIT_CONFIGS.payment,
     async (req) => { /* handler */ }
   );
   ```

### Priority 2 (High)
1. Add rate limiting to all public endpoints
2. Implement audit logging for transactions
3. Add request signing for webhook endpoints
4. Set up monitoring for failed payments

### Priority 3 (Medium)
1. Implement request caching for read endpoints
2. Add database connection pooling metrics
3. Set up alerting for rate limit violations
4. Add API versioning strategy

## Performance Considerations

### Current Optimizations
- Proper use of database indexes (via Drizzle)
- JOIN queries for related data
- Limit clauses on all queries
- Transaction support for financial operations

### Recommended Optimizations
1. Add Redis caching for provider availability
2. Implement database read replicas
3. Add CDN for static provider assets
4. Batch webhook processing
5. Implement connection pooling monitoring

## API Testing Commands

```bash
# Health check
curl http://localhost:3000/api/health

# Get provider list (public)
curl http://localhost:3000/api/providers

# Create booking (requires auth token)
curl -X POST http://localhost:3000/api/bookings/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -d '{
    "providerId": "uuid-here",
    "serviceName": "Test Service",
    "servicePrice": 10000,
    "serviceDuration": 60,
    "bookingDate": "2024-01-01T00:00:00Z",
    "startTime": "10:00",
    "endTime": "11:00"
  }'

# Guest checkout
curl -X POST http://localhost:3000/api/bookings/guest \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "uuid-here",
    "serviceName": "Test Service",
    "servicePrice": 10000,
    "serviceDuration": 60,
    "bookingDate": "2024-01-01T00:00:00Z",
    "startTime": "10:00",
    "endTime": "11:00",
    "guestInfo": {
      "email": "guest@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "1234567890"
    }
  }'
```

## Conclusion

The Ecosystem marketplace API is functionally complete but has critical security gaps that need immediate attention. The lack of webhook idempotency and incomplete rate limiting pose significant financial and operational risks. The guest checkout feature is properly implemented with appropriate fee structures.

**Overall Security Grade**: C+ (Functional but vulnerable)
**Production Readiness**: NO - Fix webhook idempotency first