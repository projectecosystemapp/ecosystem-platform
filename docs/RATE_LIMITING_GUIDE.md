# Rate Limiting Infrastructure Guide

## Overview

The Ecosystem Platform implements a comprehensive rate limiting infrastructure using **Upstash Redis** for production environments with automatic fallback to in-memory rate limiting for development. This ensures API stability, prevents abuse, and maintains fair usage across all users.

## Key Features

- ✅ **Redis-based sliding window algorithm** for accurate rate limiting
- ✅ **Automatic fallback** to in-memory when Redis is unavailable
- ✅ **Multiple rate limit strategies** for different operation types
- ✅ **Support for both API routes and Server Actions**
- ✅ **User-based and IP-based identification**
- ✅ **Proper HTTP headers** (429 status, Retry-After, X-RateLimit-*)
- ✅ **Health monitoring and analytics**

## Configuration

### Environment Variables

Add the following to your `.env.local`:

```env
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

Get your credentials from [Upstash Console](https://console.upstash.com/).

### Rate Limit Tiers

| Tier | Requests | Window | Use Cases |
|------|----------|--------|-----------|
| **Auth** | 5 | 15 minutes | Login, signup, password reset |
| **Payment** | 5 | 1 minute | Stripe operations, payment intents |
| **Booking** | 10 | 1 minute | Create/cancel bookings |
| **Search** | 100 | 1 minute | Provider search, availability check |
| **API** | 100 | 1 minute | General API endpoints |
| **Webhook** | 10 | 1 second | Stripe webhooks, external integrations |
| **Server Action** | 30 | 1 minute | Server-side form submissions |

## Implementation

### API Routes

#### Basic Usage

```typescript
import { withRateLimit } from "@/lib/rate-limit";

// Using predefined configuration
export const POST = withRateLimit(
  'payment', // Uses RATE_LIMIT_CONFIGS.payment
  async (req: NextRequest) => {
    // Your handler logic
    return NextResponse.json({ success: true });
  }
);
```

#### Custom Configuration

```typescript
import { withRateLimit } from "@/lib/rate-limit";

export const POST = withRateLimit(
  {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    message: "Custom rate limit message",
    keyGenerator: (req) => {
      // Custom identifier logic
      const apiKey = req.headers.get('x-api-key');
      return apiKey ? `api:${apiKey}` : getClientIdentifier(req);
    }
  },
  async (req: NextRequest) => {
    // Your handler logic
  }
);
```

### Server Actions

#### Basic Protection

```typescript
"use server";

import { enforceRateLimit } from "@/lib/server-action-rate-limit";

export async function createBooking(data: BookingData) {
  // Apply rate limiting
  await enforceRateLimit('booking');
  
  // Your action logic
  const booking = await db.insert(bookings).values(data);
  return booking;
}
```

#### With Error Handling

```typescript
"use server";

import { 
  enforceRateLimit, 
  RateLimitError,
  handleRateLimitError 
} from "@/lib/server-action-rate-limit";

export async function sensitiveAction(data: any) {
  try {
    await enforceRateLimit('payment');
    
    // Your action logic
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: error.message,
        retryAfter: formatRetryAfter(error.retryAfter)
      };
    }
    
    // Handle other errors
    return { success: false, error: "Operation failed" };
  }
}
```

#### Using Decorators

```typescript
"use server";

import { withRateLimitAction } from "@/lib/server-action-rate-limit";

export const searchProviders = withRateLimitAction(
  'search',
  async (query: string, filters: SearchFilters) => {
    // Your search logic
    return await db.select().from(providers).where(/* ... */);
  }
);
```

### Middleware Integration

The rate limiting is automatically applied via middleware for all routes:

```typescript
// middleware.ts
import { rateLimit, getRateLimitConfig } from "@/lib/security/rate-limit";

export default async function middleware(req: NextRequest) {
  // Rate limiting (except webhooks)
  if (!isWebhookRoute(req)) {
    const config = getRateLimitConfig(req.pathname);
    const result = await rateLimit(req, config);
    
    if (!result.success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: result.headers,
      });
    }
  }
  
  // ... rest of middleware
}
```

## Client-Side Handling

### React Hook for Rate Limit Status

```typescript
// hooks/use-rate-limit.ts
import { useState, useEffect } from 'react';

export function useRateLimitStatus() {
  const [status, setStatus] = useState<{
    remaining: number;
    resetAt: Date;
  } | null>(null);

  useEffect(() => {
    fetch('/api/examples/rate-limited')
      .then(res => res.json())
      .then(data => {
        setStatus({
          remaining: data.rateLimits.api.remaining,
          resetAt: new Date(data.rateLimits.api.resetAt)
        });
      });
  }, []);

  return status;
}
```

### Display Rate Limit Warning

```tsx
import { Alert } from "@/components/ui/alert";

function RateLimitWarning({ remaining, resetAt }: { 
  remaining: number; 
  resetAt: Date;
}) {
  if (remaining > 10) return null;
  
  const minutesUntilReset = Math.ceil(
    (resetAt.getTime() - Date.now()) / 60000
  );
  
  return (
    <Alert variant={remaining === 0 ? "destructive" : "warning"}>
      {remaining === 0 
        ? `Rate limit exceeded. Try again in ${minutesUntilReset} minutes.`
        : `Warning: Only ${remaining} requests remaining.`
      }
    </Alert>
  );
}
```

## Monitoring

### Health Check Endpoint

```bash
# Check rate limiting health
curl http://localhost:3000/api/health/redis

# Response includes:
{
  "rateLimit": {
    "healthy": true,
    "usingRedis": true,
    "analytics": {
      "auth": { "configured": true, "prefix": "@ecosystem/ratelimit:auth" },
      "payment": { "configured": true, "prefix": "@ecosystem/ratelimit:payment" },
      // ... other limiters
    }
  }
}
```

### Metrics and Analytics

```typescript
import { getRateLimitAnalytics } from "@/lib/rate-limit";

// Get analytics for all rate limiters
const analytics = await getRateLimitAnalytics();

// Get analytics for specific limiter
const paymentAnalytics = await getRateLimitAnalytics('payment');
```

## Testing

### Unit Tests

```typescript
// __tests__/lib/rate-limit.test.ts
import { checkRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const result = await checkRateLimit('test-user', 'api');
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it('should block requests over limit', async () => {
    // Make 100 requests
    for (let i = 0; i < 100; i++) {
      await checkRateLimit('test-user-2', 'api');
    }
    
    // 101st request should fail
    const result = await checkRateLimit('test-user-2', 'api');
    expect(result.success).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
```

### Load Testing

```bash
# Using k6 for load testing
k6 run scripts/rate-limit-test.js
```

## Best Practices

### 1. Choose Appropriate Limits

- **Authentication**: Very strict (5 per 15 min) to prevent brute force
- **Payments**: Strict (5 per min) to prevent fraud
- **Search**: Loose (100 per min) for good UX
- **Webhooks**: Count only failures to allow retries

### 2. User-Specific Limits

Prioritize authenticated users over anonymous:

```typescript
const identifier = userId 
  ? `user:${userId}` 
  : `ip:${getClientIP(req)}`;
```

### 3. Graceful Degradation

Always handle rate limit errors gracefully:

```typescript
try {
  await enforceRateLimit('booking');
  // ... action
} catch (error) {
  if (error instanceof RateLimitError) {
    // Show user-friendly message with retry time
    return {
      error: `Please wait ${error.retryAfter} seconds before trying again.`
    };
  }
  throw error;
}
```

### 4. Monitor and Adjust

- Track rate limit hits in your analytics
- Adjust limits based on actual usage patterns
- Consider different limits for different user tiers

### 5. Bypass for Trusted Sources

```typescript
// Skip rate limiting for internal services
if (req.headers.get('x-internal-service-key') === process.env.INTERNAL_KEY) {
  return handler(req);
}
```

## Troubleshooting

### Redis Not Connecting

```bash
# Check environment variables
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN

# Test connection
curl $UPSTASH_REDIS_REST_URL/ping \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

### In-Memory Fallback Active

If you see "Redis not configured - using in-memory rate limiting" in logs:

1. Check environment variables are set
2. Verify Upstash credentials are correct
3. Check network connectivity to Upstash
4. Review error logs for connection issues

### Rate Limits Not Working

1. Verify middleware is properly configured
2. Check identifier generation logic
3. Ensure Redis is healthy: `/api/health/redis`
4. Review rate limit configuration

## Migration from In-Memory to Redis

1. **Development**: Works with in-memory automatically
2. **Staging**: Add Upstash credentials to test Redis
3. **Production**: Ensure Redis is configured and healthy

```bash
# Verify production setup
npm run check:redis
```

## Security Considerations

1. **Never expose rate limit bypass keys in client code**
2. **Use HTTPS to prevent header spoofing**
3. **Log rate limit violations for security monitoring**
4. **Consider implementing CAPTCHA after multiple violations**
5. **Use different Redis databases for different environments**

## Performance Impact

- **Redis latency**: ~1-5ms per check
- **In-memory**: < 1ms but not distributed
- **Negligible impact** on overall request time
- **Sliding window** provides accurate limiting

## Future Enhancements

- [ ] Distributed rate limiting across regions
- [ ] Dynamic rate limits based on user tier
- [ ] Rate limit quotas and usage dashboard
- [ ] Advanced analytics and alerting
- [ ] GraphQL rate limiting by complexity
- [ ] WebSocket connection rate limiting

## Support

For issues or questions:
1. Check the health endpoint: `/api/health/redis`
2. Review logs for rate limit errors
3. Contact the platform team with details

---

Last Updated: August 2025
Version: 1.0.0