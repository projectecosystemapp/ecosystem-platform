# CSRF Protection Migration Guide

## Security Fix Applied

**FIXED VULNERABILITY**: The `validateCSRFToken` function in `/lib/server-action-security.ts` was previously returning `true` for all requests, completely bypassing CSRF protection. This HIGH severity vulnerability has been fixed.

## What Changed

### 1. Core CSRF Implementation
- **Before**: `validateCSRFToken` always returned `true` (VULNERABLE)
- **After**: Proper CSRF token validation with:
  - Cryptographically secure token generation using `crypto.randomBytes()`
  - Timing-safe comparison using `crypto.timingSafeEqual()`
  - Signed tokens with HMAC-SHA256
  - Token expiration (24 hours)
  - HTTP-only cookie storage
  - 403 Forbidden responses for invalid tokens

### 2. New Security Features
- Token stored in `__Host-csrf-token` cookie (production) with strict security settings
- Tokens include timestamp for expiration checking
- Full audit logging for CSRF validation failures
- Client-side utilities for token handling

## How to Update Server Actions

### Option 1: Using withSecureAction Wrapper (Recommended)

```typescript
"use server";

import { withSecureAction, SecurityEvent } from "@/lib/server-action-security";
import { z } from "zod";

// Define your input schema
const bookingSchema = z.object({
  providerId: z.string(),
  servicePrice: z.number().positive(),
  bookingDate: z.date(),
});

export async function createBookingAction(
  data: z.infer<typeof bookingSchema> & { csrfToken?: string }
) {
  return withSecureAction(
    async (userId, validatedData) => {
      // Your secure action logic here
      // userId is guaranteed to be authenticated
      // validatedData is validated against schema
      // CSRF is automatically validated
      
      const booking = await createBooking({
        ...validatedData,
        customerId: userId,
      });
      
      return booking;
    },
    {
      actionName: "create_booking",
      input: data,
      schema: bookingSchema,
      csrfToken: data.csrfToken, // Pass the token from client
      requireAuth: true, // Default
      requireCSRF: true, // Default for authenticated actions
      rateLimit: { limit: 10, window: 60000 },
      auditEvent: SecurityEvent.RESOURCE_CREATED,
      resourceType: "booking",
    }
  );
}
```

### Option 2: Manual CSRF Validation

```typescript
"use server";

import { validateCSRFToken } from "@/lib/server-action-security";

export async function updateProfileAction(data: {
  name: string;
  email: string;
  csrfToken?: string;
}) {
  // Manually validate CSRF token
  const csrfValidation = await validateCSRFToken(data.csrfToken);
  
  if (!csrfValidation.valid) {
    return {
      success: false,
      error: csrfValidation.error || "CSRF validation failed"
    };
  }
  
  // Continue with your action logic
  // ...
}
```

## Client-Side Implementation

### Using the CSRF Client Utilities

```typescript
import { callServerAction } from "@/lib/client/csrf-client";
import { createBookingAction } from "@/actions/bookings-actions";

// In your React component
const handleBooking = async (bookingData: BookingData) => {
  try {
    // Automatically adds CSRF token
    const result = await callServerAction(
      createBookingAction,
      bookingData
    );
    
    if (result.isSuccess) {
      // Handle success
    }
  } catch (error) {
    // Handle error (including CSRF failures)
  }
};
```

### Using fetchWithCSRF for API Routes

```typescript
import { fetchWithCSRF } from "@/lib/client/csrf-client";

const response = await fetchWithCSRF('/api/booking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});
```

### Using the React Hook

```typescript
import { useCSRFToken } from "@/lib/client/csrf-client";

function MyComponent() {
  const { token, refreshToken, fetchWithToken } = useCSRFToken();
  
  const handleSubmit = async () => {
    if (!token) {
      await refreshToken();
      return;
    }
    
    const response = await fetchWithToken('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
}
```

## Testing CSRF Protection

Run the test suite to verify CSRF protection:

```bash
npm test lib/__tests__/csrf-protection.test.ts
```

## Security Checklist

- [ ] All state-changing server actions use CSRF protection
- [ ] CSRF_SECRET environment variable is set in production
- [ ] Tokens are transmitted via headers, not URL parameters
- [ ] HTTP-only cookies are used for token storage
- [ ] Timing-safe comparison is used for token validation
- [ ] Token expiration is enforced (24 hours)
- [ ] 403 Forbidden is returned for invalid tokens
- [ ] Audit logs capture CSRF validation failures

## Environment Variables

Add to your `.env` file:

```bash
# REQUIRED in production
CSRF_SECRET=your-random-64-character-secret-key-here
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

## Exempted Routes

The following routes are exempted from CSRF protection:
- `/api/stripe/webhooks/*` - Stripe webhook endpoints
- `/api/clerk/webhooks/*` - Clerk webhook endpoints
- `/api/health` - Health check endpoint
- `/api/public/*` - Public API endpoints

## Migration Priority

1. **HIGH PRIORITY**: Payment and financial transactions
2. **HIGH PRIORITY**: User profile updates
3. **HIGH PRIORITY**: Account settings changes
4. **MEDIUM PRIORITY**: Booking operations
5. **MEDIUM PRIORITY**: Content creation/updates
6. **LOW PRIORITY**: Read-only operations (already safe)

## Monitoring

Monitor for CSRF validation failures in your logs:

```bash
grep "CSRF validation" logs/security.log
grep "SecurityEvent.SUSPICIOUS_ACTIVITY" logs/audit.log
```

## Support

For questions about CSRF implementation, consult:
- OWASP CSRF Prevention Cheat Sheet
- Next.js Security Best Practices
- Your security team lead