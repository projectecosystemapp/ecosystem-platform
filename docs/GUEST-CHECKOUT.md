# Guest Checkout System Documentation

## Overview

The guest checkout system allows non-authenticated users to book services on the Ecosystem marketplace with an additional 10% surcharge. This documentation covers the implementation, security measures, and testing procedures.

## Business Rules

### Fee Structure
- **Base Platform Fee**: 10% from all transactions
- **Guest Surcharge**: Additional 10% for non-authenticated users
- **Total Guest Cost**: 110% of base price
- **Provider Payout**: Always 90% of base price (unaffected by guest status)

### Example Calculation
For a $100 service:
- **Authenticated User**: Pays $100, Platform gets $10, Provider gets $90
- **Guest User**: Pays $110, Platform gets $20, Provider gets $90

## API Endpoints

### POST `/api/checkout/guest`

Creates a payment intent for guest checkout.

#### Request Body
```json
{
  "guestEmail": "guest@example.com",
  "guestName": "John Doe",
  "guestPhone": "(555) 123-4567", // Optional
  "providerId": "uuid",
  "serviceId": "uuid",
  "bookingDate": "2024-03-15T00:00:00Z",
  "startTime": "14:00",
  "endTime": "15:00",
  "customerNotes": "Optional notes", // Optional
  "referrer": "google", // Optional tracking
  "utmSource": "search", // Optional
  "utmMedium": "cpc", // Optional
  "utmCampaign": "spring-sale" // Optional
}
```

#### Response
```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "bookingId": "uuid",
  "confirmationCode": "A3B7K9",
  "fees": {
    "baseAmount": "$100.00",
    "guestSurcharge": "$10.00",
    "totalAmount": "$110.00",
    "providerPayout": "$90.00"
  }
}
```

#### Error Responses
- `400 Bad Request`: Invalid input data
- `404 Not Found`: Provider or service not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Security Measures

### 1. Input Validation
- Email format validation and sanitization
- Name length and content validation
- UUID format validation for IDs
- Time slot validation
- XSS prevention through input sanitization

### 2. Rate Limiting
- 10 requests per minute per IP/email combination
- Redis-based rate limiting in production
- Fallback to in-memory rate limiting in development

### 3. Email Security
- Disposable email detection
- Email normalization (lowercase, trim)
- Maximum length enforcement (254 characters)

### 4. Payment Security
- Stripe payment intents with idempotency keys
- Secure token generation for session tracking
- PCI compliance through Stripe
- No sensitive payment data stored

### 5. Database Security
- Prepared statements prevent SQL injection
- Foreign key constraints maintain data integrity
- Transaction isolation for booking creation

## Fee Calculator

The centralized fee calculator (`/lib/payments/fee-calculator.ts`) provides:

### Core Functions
```typescript
// Calculate fees from cents
calculateFees({
  baseAmountCents: 10000, // $100
  isGuest: true,
  providerCommissionRate?: 0.10 // Optional custom rate
})

// Calculate fees from dollars
calculateFeesFromDollars(100.00, true)

// Validate guest pricing
validateGuestPricing(baseAmountCents, customerPaymentCents, isGuest)

// Calculate provider earnings
calculateProviderEarnings(transactions)

// Calculate platform revenue
calculatePlatformRevenue(transactions)
```

### Utility Functions
- `dollarsToCents(dollars)`: Convert with proper rounding
- `centsToDollars(cents)`: Convert for display
- `formatCentsToDisplay(cents)`: Format as currency string
- `parseDisplayToCents(display)`: Parse currency string to cents

## Guest Validation Utilities

The guest validation module (`/lib/payments/guest-validation.ts`) provides:

### Validation Functions
- `validateGuestEmail(email)`: Validate and sanitize email
- `validateGuestName(name)`: Validate and sanitize name
- `validateGuestPhone(phone)`: Validate and format phone
- `validateBookingTime(date, start, end)`: Validate booking slot

### Security Functions
- `createGuestSessionToken(email, bookingId)`: Generate secure token
- `verifyGuestSessionToken(token)`: Verify token validity
- `getGuestRateLimitKey(email, ip)`: Generate rate limit key
- `maskGuestEmail(email)`: Mask email for privacy

## Database Schema

### Bookings Table Updates
```sql
ALTER TABLE "bookings" ADD COLUMN "guest_email" text;
ALTER TABLE "bookings" ADD COLUMN "is_guest_booking" boolean DEFAULT false;
```

### Guest Booking Record
```typescript
{
  id: uuid,
  customerId: hashedEmail, // Hashed guest identifier
  guestEmail: string, // Actual email for receipts
  isGuestBooking: true,
  totalAmount: customerTotal, // Includes surcharge
  platformFee: platformRevenue, // Includes surcharge
  providerPayout: baseAmount * 0.9,
  metadata: {
    guestName: string,
    guestPhone?: string,
    guestSurcharge: string,
    referrer?: string,
    utmSource?: string,
    utmMedium?: string,
    utmCampaign?: string
  }
}
```

## Testing

### Unit Tests
Run the test suite:
```bash
npm test -- fee-calculator.test.ts
npm test -- route.test.ts
```

### Test Coverage
- Fee calculations with various amounts
- Guest vs authenticated pricing
- Input validation edge cases
- Rate limiting behavior
- Error handling scenarios

### Manual Testing Checklist
1. ✅ Guest can complete checkout without authentication
2. ✅ Correct fees are calculated (110% for guest)
3. ✅ Provider receives correct payout (90% of base)
4. ✅ Confirmation email sent to guest
5. ✅ Booking appears in provider dashboard
6. ✅ Rate limiting prevents abuse
7. ✅ Invalid inputs are rejected
8. ✅ Payment failures are handled gracefully

## Stripe Integration

### Payment Intent Creation
```typescript
const paymentIntent = await createPaymentIntentWithIdempotency({
  amount: fees.customerTotalCents,
  currency: "usd",
  stripeConnectAccountId: provider.stripeConnectAccountId,
  platformFeeAmount: fees.platformTotalRevenueCents,
  bookingId, // For idempotency
  metadata: {
    type: "guest_booking",
    bookingId,
    guestEmail,
    isGuest: "true"
  }
});
```

### Webhook Handling
The system listens for Stripe webhooks to:
- Confirm payment success
- Update booking status
- Send confirmation emails
- Handle payment failures

## Monitoring and Analytics

### Metrics to Track
- Guest conversion rate
- Average guest transaction value
- Guest surcharge revenue
- Failed payment rate
- Rate limit violations

### Logging
All guest checkouts are logged with:
- Booking ID
- Guest email (hashed)
- Provider and service IDs
- Transaction amount
- Timestamp
- UTM parameters for marketing attribution

## Future Enhancements

### Planned Features
1. **Guest Account Conversion**: Allow guests to create accounts post-booking
2. **Loyalty Discounts**: Reduce surcharge for repeat guests
3. **A/B Testing**: Test different surcharge rates
4. **Multi-currency Support**: Handle international payments
5. **Progressive Checkout**: Save progress for abandoned carts

### Security Improvements
1. **CAPTCHA Integration**: Prevent automated abuse
2. **Fraud Detection**: ML-based risk scoring
3. **Email Verification**: Optional email confirmation
4. **IP Geolocation**: Regional pricing and restrictions

## Troubleshooting

### Common Issues

#### Payment Intent Creation Fails
- Check Stripe API keys
- Verify provider has completed onboarding
- Ensure service price meets minimum ($0.50)

#### Rate Limiting Issues
- Check Redis connection
- Verify rate limit configuration
- Clear rate limit cache if needed

#### Guest Email Not Received
- Check email service configuration
- Verify email is not marked as spam
- Check email queue for failures

## Support

For technical issues or questions:
- Review error logs in production
- Check Stripe dashboard for payment details
- Contact platform support team

---

Last Updated: 2025-08-24
Version: 1.0.0