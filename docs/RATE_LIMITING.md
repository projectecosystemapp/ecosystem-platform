# Rate Limiting Configuration

## Overview

The Ecosystem marketplace implements comprehensive rate limiting to prevent abuse, DDoS attacks, and ensure fair resource usage. The system uses a sliding window algorithm with Redis/Upstash for distributed rate limiting, with an in-memory fallback for local development.

## Rate Limit Configurations

### Payment Endpoints
- **Limit**: 5 requests per minute per IP/user
- **Endpoints**:
  - `/api/stripe/payment` (POST, PUT, DELETE)
  - `/api/stripe/payment-intent`
  - `/api/stripe/refunds`
- **Rationale**: Prevents payment fraud and abuse

### Booking Endpoints
- **Authenticated Users**: 10 requests per minute
- **Guest Users**: 3 requests per minute
- **Endpoints**:
  - `/api/bookings/create`
  - `/api/bookings/guest`
  - `/api/bookings/[bookingId]/*`
- **Rationale**: Higher limits for authenticated users to encourage sign-ups

### Webhook Endpoints
- **Limit**: 100 requests per minute from verified Stripe IPs
- **Endpoints**:
  - `/api/stripe/webhooks`
  - `/api/stripe/webhooks/connect`
  - `/api/stripe/webhooks/marketplace`
- **Features**:
  - IP verification for Stripe webhooks
  - Only counts failed requests against limit
  - Idempotency checks to prevent duplicate processing

### Search & Read Endpoints
- **Limit**: 60 requests per minute
- **Endpoints**:
  - `/api/providers/search`
  - `/api/providers/[providerId]`
  - `/api/providers/[providerId]/availability/*`
- **Rationale**: Allows reasonable browsing while preventing scraping

### Authentication Endpoints
- **Limit**: 5 requests per 15 minutes
- **Endpoints**:
  - `/api/auth/*`
  - Login/signup endpoints
- **Rationale**: Prevents brute force attacks

### Profile & Upload Endpoints
- **Profile Updates**: 20 requests per minute
- **Image Uploads**: 10 requests per minute
- **Endpoints**:
  - `/api/providers/profile/update`
  - `/api/providers/images/upload`
- **Rationale**: Prevents spam and resource exhaustion

## Implementation Details

### Core Infrastructure (`/lib/rate-limit.ts`)

The rate limiting system provides:

1. **Redis/Upstash Integration**: Distributed rate limiting across multiple servers
2. **In-Memory Fallback**: Local rate limiting when Redis is unavailable
3. **Sliding Window Algorithm**: Fair and accurate rate limiting
4. **Custom Key Generation**: Supports user ID and IP-based limiting

### Middleware (`/lib/middleware/rate-limit-middleware.ts`)

Enhanced middleware features:

1. **Guest-Aware Rate Limiting**: Stricter limits for unauthenticated users
2. **Stripe IP Verification**: Validates webhook sources
3. **Monitoring Integration**: Logs violations for security analysis
4. **Pre-flight Checks**: Check rate limit status before operations

## Usage Examples

### Basic API Route Protection

```typescript
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit('payment', async (req: NextRequest) => {
  // Your handler code
});
```

### Guest-Aware Rate Limiting

```typescript
import { createGuestAwareRateLimit } from "@/lib/middleware/rate-limit-middleware";

export const POST = createGuestAwareRateLimit(
  'booking',  // Config for authenticated users
  ENHANCED_RATE_LIMITS.guestEndpoint  // Stricter config for guests
)(async (req: NextRequest) => {
  // Your handler code
});
```

### Server Actions

```typescript
import { applyServerActionRateLimit } from "@/lib/middleware/rate-limit-middleware";

export async function createBookingAction(data: any) {
  const rateLimited = await applyServerActionRateLimit(userId, 'booking');
  if (!rateLimited.success) {
    throw new Error(rateLimited.error);
  }
  // Proceed with booking creation
}
```

### Pre-flight Checks

```typescript
import { isRateLimited, getRemainingRequests } from "@/lib/middleware/rate-limit-middleware";

// Check if user is rate limited
const limited = await isRateLimited(userId, 'payment');
if (limited) {
  // Show error to user
}

// Get remaining requests
const { remaining, resetAt } = await getRemainingRequests(userId, 'booking');
```

## Response Headers

Rate limited responses include the following headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: ISO timestamp when the limit resets
- `Retry-After`: Seconds to wait before retrying (on 429 responses)

## Environment Variables

```env
# Redis/Upstash Configuration (Optional - falls back to in-memory)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Webhook Secrets
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...
STRIPE_MARKETPLACE_WEBHOOK_SECRET=whsec_...
```

## Monitoring & Alerts

### Rate Limit Violations

Violations are logged with the following information:
- Timestamp
- Client identifier (user ID or IP)
- Endpoint accessed
- Request metadata

### Integration with Monitoring Services

```typescript
// Example Sentry integration
import * as Sentry from "@sentry/nextjs";

export function logRateLimitViolation(identifier: string, endpoint: string) {
  Sentry.captureMessage('Rate limit violation', {
    level: 'warning',
    tags: { endpoint },
    extra: { identifier, timestamp: new Date().toISOString() }
  });
}
```

## Security Considerations

1. **IP Spoofing**: The system checks multiple headers for real IP detection
2. **Distributed Attacks**: Redis enables rate limiting across multiple servers
3. **Guest Surcharges**: Economic incentive for users to authenticate
4. **Webhook Verification**: Stripe webhook signatures are validated
5. **Idempotency**: Prevents duplicate payment processing

## Testing Rate Limits

### Manual Testing

```bash
# Test rate limiting on payment endpoint
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/stripe/payment \
    -H "Content-Type: application/json" \
    -d '{"bookingId": "test", "amount": 1000}'
done
```

### Automated Testing

```typescript
// test/rate-limit.test.ts
import { checkRateLimitStatus } from "@/lib/rate-limit";

describe('Rate Limiting', () => {
  it('should enforce payment endpoint limits', async () => {
    const identifier = 'test-user';
    
    // Make 5 requests (should succeed)
    for (let i = 0; i < 5; i++) {
      const status = await checkRateLimitStatus(identifier, 'payment');
      expect(status.allowed).toBe(true);
    }
    
    // 6th request should fail
    const status = await checkRateLimitStatus(identifier, 'payment');
    expect(status.allowed).toBe(false);
  });
});
```

## Troubleshooting

### Common Issues

1. **Redis Connection Failures**: System automatically falls back to in-memory store
2. **Rate Limit Too Strict**: Adjust configurations in `/lib/rate-limit.ts`
3. **Headers Not Set**: Ensure middleware is properly applied to routes
4. **Guest Limits Not Working**: Verify authentication detection logic

### Health Check Endpoint

```typescript
// /api/health/rate-limit
import { checkRateLimitHealth } from "@/lib/rate-limit";

export async function GET() {
  const health = await checkRateLimitHealth();
  return NextResponse.json(health);
}
```

## Future Improvements

1. **Dynamic Rate Limits**: Adjust based on user tier/subscription
2. **Geographic Rate Limiting**: Different limits by region
3. **AI-Based Anomaly Detection**: Identify suspicious patterns
4. **Rate Limit Bypass Tokens**: For trusted partners/services
5. **Detailed Analytics Dashboard**: Visualize rate limit metrics

## Compliance

The rate limiting system helps maintain compliance with:
- PCI DSS (Payment Card Industry Data Security Standard)
- GDPR (General Data Protection Regulation)
- SOC 2 Type II requirements
- Series A security standards

## Support

For rate limit adjustments or issues:
1. Check the health endpoint: `/api/health/rate-limit`
2. Review logs for violation patterns
3. Adjust configurations as needed
4. Contact the security team for persistent issues