# Booking & Payments Implementation Guide

## System Overview

The booking system follows a state machine pattern with Stripe Connect for payment processing. Guest users pay an additional 10% surcharge while authenticated customers pay only the service price.

## Database Schema

### Required Tables

```sql
-- Guests table (for non-authenticated users)
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  magic_link_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments table (audit trail)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('CREATED','SUCCEEDED','FAILED')),
  amount_total BIGINT NOT NULL,
  platform_fee_amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook idempotency
CREATE TABLE webhook_events (
  event_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Booking constraints
ALTER TABLE bookings
  ADD COLUMN guest_id UUID REFERENCES guests(id),
  ADD CONSTRAINT bookings_one_party CHECK (
    (guest_id IS NOT NULL AND customer_id IS NULL) OR
    (guest_id IS NULL AND customer_id IS NOT NULL)
  );
```

## API Endpoints

### 1. Guest Checkout
**Path**: `/api/checkout/guest/route.ts`

```typescript
export async function POST(request: Request) {
  const { bookingId, email } = await request.json();
  
  // 1. Validate booking
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: { provider: true, service: true }
  });
  
  if (!booking || booking.state !== 'PAYMENT_PENDING') {
    return Response.json({ error: 'Invalid booking' }, { status: 400 });
  }
  
  // 2. Create/get guest
  const guest = await db.insert(guests)
    .values({ email })
    .onConflictDoUpdate({ target: guests.email, set: { updatedAt: new Date() } })
    .returning();
  
  // 3. Calculate fees (10% surcharge for guests)
  const baseAmount = booking.service.price;
  const platformFee = Math.round(baseAmount * 0.10);
  const guestSurcharge = Math.round(baseAmount * 0.10);
  const totalAmount = baseAmount + guestSurcharge;
  
  // 4. Create Stripe PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency: 'usd',
    application_fee_amount: platformFee + guestSurcharge,
    transfer_data: {
      destination: booking.provider.stripeAccountId,
    },
    metadata: {
      bookingId: booking.id,
      guestId: guest[0].id,
      userType: 'guest'
    }
  });
  
  // 5. Store payment record
  await db.insert(payments).values({
    bookingId: booking.id,
    stripePaymentIntentId: paymentIntent.id,
    status: 'CREATED',
    amountTotal: totalAmount,
    platformFeeAmount: platformFee + guestSurcharge,
  });
  
  return Response.json({ 
    clientSecret: paymentIntent.client_secret 
  });
}
```

### 2. Customer Checkout
**Path**: `/api/checkout/customer/route.ts`

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { bookingId } = await request.json();
  
  // Similar to guest but:
  // - No surcharge (platformFee only)
  // - Use session.user.id instead of guestId
  // - totalAmount = baseAmount (no surcharge)
  
  const baseAmount = booking.service.price;
  const platformFee = Math.round(baseAmount * 0.10);
  const totalAmount = baseAmount; // No surcharge
  
  // Create PaymentIntent with lower fee...
}
```

### 3. Booking Status (Polling)
**Path**: `/api/bookings/[id]/status/route.ts`

```typescript
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, params.id),
    with: {
      payment: {
        columns: { status: true }
      }
    }
  });
  
  if (!booking) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  
  return Response.json({
    state: booking.state,
    payment: booking.payment ? {
      status: booking.payment.status
    } : null
  });
}
```

### 4. Webhook Handler
**Path**: `/api/webhooks/stripe/route.ts`

```typescript
export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  
  // 1. Verify signature
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  // 2. Idempotency check
  const existing = await db.query.webhookEvents.findFirst({
    where: eq(webhookEvents.eventId, event.id)
  });
  
  if (existing) {
    return Response.json({ received: true });
  }
  
  // 3. Store event
  await db.insert(webhookEvents).values({
    eventId: event.id
  });
  
  // 4. Handle event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata.bookingId;
      
      await db.transaction(async (tx) => {
        // Update payment status
        await tx.update(payments)
          .set({ status: 'SUCCEEDED' })
          .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
        
        // Update booking state
        await tx.update(bookings)
          .set({ 
            state: 'COMPLETED',
            completedAt: new Date()
          })
          .where(eq(bookings.id, bookingId));
      });
      break;
      
    case 'payment_intent.payment_failed':
      // Similar but set status to FAILED
      break;
  }
  
  return Response.json({ received: true });
}
```

## Fee Calculation (Centralized)

**Path**: `/lib/fees.ts`

```typescript
export interface FeeCalculation {
  baseAmount: number;
  platformFeeAmount: number;
  guestSurchargeAmount: number;
  totalAmount: number;
  providerPayout: number;
}

export function calculateFees(
  baseAmountCents: number,
  isGuest: boolean
): FeeCalculation {
  // Platform always takes 10% base fee
  const platformFeeAmount = Math.round(baseAmountCents * 0.10);
  
  // Guests pay additional 10% surcharge
  const guestSurchargeAmount = isGuest 
    ? Math.round(baseAmountCents * 0.10) 
    : 0;
  
  // Total amount customer pays
  const totalAmount = baseAmountCents + guestSurchargeAmount;
  
  // Provider always receives base minus platform fee
  const providerPayout = baseAmountCents - platformFeeAmount;
  
  return {
    baseAmount: baseAmountCents,
    platformFeeAmount,
    guestSurchargeAmount,
    totalAmount,
    providerPayout
  };
}

// Usage examples:
// Guest booking $100 service:
// - Guest pays: $110 (100 + 10% surcharge)
// - Platform keeps: $20 (10% base + 10% surcharge)
// - Provider receives: $90

// Customer booking $100 service:
// - Customer pays: $100
// - Platform keeps: $10 (10% base)
// - Provider receives: $90
```

## Client Implementation

### Payment Component
```tsx
'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PaymentForm({ 
  bookingId, 
  isGuest 
}: { 
  bookingId: string; 
  isGuest: boolean;
}) {
  const [clientSecret, setClientSecret] = useState<string>();
  
  useEffect(() => {
    // Get payment intent
    fetch(isGuest ? '/api/checkout/guest' : '/api/checkout/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, email: guestEmail }),
    })
      .then(res => res.json())
      .then(data => setClientSecret(data.clientSecret));
  }, [bookingId]);
  
  if (!clientSecret) return <div>Loading...</div>;
  
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm bookingId={bookingId} />
    </Elements>
  );
}

function CheckoutForm({ bookingId }: { bookingId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Poll for status
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/bookings/${bookingId}/status`);
      const data = await res.json();
      
      if (data.state === 'COMPLETED') {
        clearInterval(interval);
        router.push(`/bookings/${bookingId}/confirmation`);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [bookingId]);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    
    setIsProcessing(true);
    
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/bookings/${bookingId}/processing`,
      },
    });
    
    if (error) {
      setError(error.message);
      setIsProcessing(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={isProcessing}>
        {isProcessing ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}
```

## Security Controls

### Rate Limiting
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'),
});

// In guest checkout endpoint:
const identifier = request.headers.get('x-forwarded-for') || 'unknown';
const { success } = await ratelimit.limit(identifier);

if (!success) {
  return Response.json(
    { error: 'Too many requests' }, 
    { status: 429 }
  );
}
```

### Bot Protection
```typescript
// Add Turnstile/hCaptcha validation
const captchaToken = request.headers.get('x-captcha-token');
const isValid = await verifyCaptcha(captchaToken);

if (!isValid) {
  return Response.json(
    { error: 'Failed captcha verification' }, 
    { status: 403 }
  );
}
```

## Testing Checklist

### Unit Tests
- [ ] Fee calculation (guest vs customer)
- [ ] State transitions
- [ ] Webhook idempotency

### Integration Tests
- [ ] Guest checkout creates correct PaymentIntent
- [ ] Customer checkout has no surcharge
- [ ] Webhook updates booking state
- [ ] Status polling returns current state

### E2E Tests
- [ ] Complete guest booking flow
- [ ] Complete customer booking flow
- [ ] Payment failure handling
- [ ] Webhook delay resilience

## Stripe CLI Commands

```bash
# Start webhook forwarding
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# View events
stripe events list --limit 10
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook not received | Check `stripe listen` is running, verify endpoint URL |
| Payment stuck pending | Check webhook_events table for duplicates |
| Wrong fee amount | Verify calculateFees() is used consistently |
| Guest can't pay | Check guest email is valid, rate limits not exceeded |

## Production Checklist

- [ ] Enable Stripe webhook endpoint in dashboard
- [ ] Set production webhook secret
- [ ] Configure rate limiting (Redis/Upstash)
- [ ] Add captcha to guest checkout
- [ ] Enable Stripe Radar for fraud detection
- [ ] Set up monitoring for failed payments
- [ ] Create admin tool for payment reconciliation