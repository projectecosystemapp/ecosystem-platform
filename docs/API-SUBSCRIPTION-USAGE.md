# Subscription Usage & Bookings API Documentation

This document outlines the API endpoints for tracking and managing subscription service usage in the marketplace platform.

## Overview

The subscription usage system provides:
- Real-time usage tracking for subscription services
- Automatic application of subscription benefits to bookings
- Overage handling and billing
- Comprehensive usage history and analytics
- Admin tools for usage adjustments

## Authentication

All endpoints require authentication via Clerk. Include the user's session token in requests.

## Rate Limiting

- Usage recording: 60 requests per minute per user
- Usage queries: 100 requests per minute per user
- Admin adjustments: 30 requests per minute per admin

## Base URL

All endpoints are prefixed with `/api/subscriptions/`

---

## Usage Tracking Endpoints

### GET /api/subscriptions/usage

Get current usage statistics for a subscription.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| subscriptionId | string | Yes | UUID of the subscription |
| includeHistory | boolean | No | Include usage history (default: false) |
| periodStart | string | No | ISO date for history filtering |
| periodEnd | string | No | ISO date for history filtering |

#### Example Request

```bash
curl -X GET "/api/subscriptions/usage?subscriptionId=123&includeHistory=true" \
  -H "Authorization: Bearer <token>"
```

#### Response

```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "123",
      "status": "active",
      "planName": "Premium Plan",
      "billingCycle": "monthly"
    },
    "currentPeriod": {
      "start": "2025-01-01T00:00:00Z",
      "end": "2025-02-01T00:00:00Z"
    },
    "usage": {
      "includedServices": 10,
      "bonusServices": 2,
      "totalAllowance": 12,
      "servicesUsed": 8,
      "servicesRemaining": 4,
      "overageServices": 0,
      "overageCharges": 0
    },
    "nextResetDate": "2025-02-01T00:00:00Z",
    "history": [
      {
        "id": "usage-1",
        "action": "service_used",
        "quantity": -1,
        "description": "Booking created: House Cleaning",
        "bookingId": "booking-456",
        "isOverage": false,
        "overageCharge": null,
        "createdAt": "2025-01-15T10:00:00Z"
      }
    ],
    "upcomingBookings": [
      {
        "id": "booking-789",
        "serviceName": "House Cleaning",
        "bookingDate": "2025-01-20",
        "startTime": "10:00"
      }
    ]
  }
}
```

### POST /api/subscriptions/usage

Record service usage for a subscription.

#### Request Body

```json
{
  "subscriptionId": "string (UUID, required)",
  "bookingId": "string (UUID, optional)",
  "quantity": "number (default: 1)",
  "description": "string (optional)",
  "metadata": "object (optional)"
}
```

#### Example Request

```bash
curl -X POST "/api/subscriptions/usage" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "subscriptionId": "123",
    "bookingId": "456",
    "quantity": 1,
    "description": "House cleaning service completed"
  }'
```

#### Response

```json
{
  "success": true,
  "data": {
    "usageRecord": {
      "id": "usage-123",
      "action": "service_used",
      "quantity": -1,
      "bookingId": "456"
    },
    "currentUsage": 9,
    "remainingServices": 3,
    "isOverage": false,
    "overageCharge": null
  }
}
```

### PUT /api/subscriptions/usage

Admin usage adjustment (add/remove service credits).

**Requires admin or provider role.**

#### Request Body

```json
{
  "subscriptionId": "string (UUID, required)",
  "quantity": "number (required)", // Positive for credits, negative for deductions
  "reason": "string (required)",
  "metadata": "object (optional)"
}
```

#### Example Request

```bash
curl -X PUT "/api/subscriptions/usage" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "subscriptionId": "123",
    "quantity": 2,
    "reason": "Customer service credit for delayed service"
  }'
```

#### Response

```json
{
  "success": true,
  "message": "Successfully credited 2 service(s)",
  "data": {
    "usageRecord": {
      "id": "usage-124",
      "action": "service_credited",
      "quantity": 2,
      "adjustedBy": "admin-user-id"
    },
    "currentUsage": 7,
    "remainingServices": 5,
    "adjustment": 2
  }
}
```

### DELETE /api/subscriptions/usage

Reset usage counter for a subscription period (admin only).

**Requires admin role.**

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| subscriptionId | string | Yes | UUID of the subscription to reset |

#### Example Request

```bash
curl -X DELETE "/api/subscriptions/usage?subscriptionId=123" \
  -H "Authorization: Bearer <admin-token>"
```

#### Response

```json
{
  "success": true,
  "message": "Usage counter reset successfully",
  "data": {
    "subscriptionId": "123",
    "previousUsage": 8,
    "resetAt": "2025-01-15T15:30:00Z"
  }
}
```

---

## Subscription Bookings Endpoints

### GET /api/subscriptions/bookings

Get bookings linked to subscriptions.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| subscriptionId | string | No | Filter by subscription |
| customerId | string | No | Filter by customer |
| status | string | No | upcoming, completed, all |
| limit | number | No | Results limit (default: 20) |

#### Example Request

```bash
curl -X GET "/api/subscriptions/bookings?subscriptionId=123&status=upcoming" \
  -H "Authorization: Bearer <token>"
```

#### Response

```json
{
  "success": true,
  "bookings": [
    {
      "id": "link-123",
      "subscriptionId": "123",
      "subscriptionStatus": "active",
      "planName": "Premium Plan",
      "booking": {
        "id": "booking-456",
        "serviceName": "House Cleaning",
        "servicePrice": 0, // Free with subscription
        "bookingDate": "2025-01-20T00:00:00Z",
        "startTime": "10:00",
        "endTime": "12:00",
        "status": "confirmed",
        "totalAmount": 0,
        "isGuestBooking": false
      },
      "scheduledFor": "2025-01-20T10:00:00Z",
      "autoScheduled": true,
      "isCompleted": false,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "count": 1,
  "usageStats": {
    "servicesPerCycle": 10,
    "servicesUsedThisPeriod": 8,
    "servicesRemaining": 2,
    "currentPeriodStart": "2025-01-01T00:00:00Z",
    "currentPeriodEnd": "2025-02-01T00:00:00Z"
  }
}
```

### POST /api/subscriptions/bookings

Create a booking using subscription benefits.

#### Request Body

```json
{
  "subscriptionId": "string (UUID, required)",
  "serviceId": "string (UUID, optional)",
  "serviceName": "string (required)",
  "servicePrice": "number (required)",
  "serviceDuration": "number (required)", // in minutes
  "bookingDate": "string (required)", // ISO date
  "startTime": "string (required)", // "HH:MM"
  "endTime": "string (required)", // "HH:MM"
  "customerNotes": "string (optional)",
  "metadata": "object (optional)"
}
```

#### Example Request

```bash
curl -X POST "/api/subscriptions/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "subscriptionId": "123",
    "serviceName": "House Cleaning",
    "servicePrice": 150.00,
    "serviceDuration": 120,
    "bookingDate": "2025-01-20",
    "startTime": "10:00",
    "endTime": "12:00",
    "customerNotes": "Please focus on kitchen and bathrooms"
  }'
```

#### Response

```json
{
  "success": true,
  "message": "Booking created successfully with subscription benefits (included in subscription)",
  "data": {
    "booking": {
      "id": "booking-456",
      "serviceName": "House Cleaning",
      "servicePrice": "0", // Applied subscription benefit
      "bookingDate": "2025-01-20T00:00:00Z",
      "status": "pending"
    },
    "subscriptionBooking": {
      "id": "link-123",
      "subscriptionId": "123",
      "bookingId": "booking-456"
    },
    "pricing": {
      "originalPrice": 150.00,
      "discountApplied": 0,
      "overageCharge": 0,
      "finalPrice": 0,
      "totalAmount": 0,
      "platformFee": 0,
      "providerPayout": 0
    },
    "subscription": {
      "id": "123",
      "servicesUsed": 9,
      "servicesRemaining": 1,
      "isOverage": false
    }
  }
}
```

### PUT /api/subscriptions/bookings

Link an existing booking to a subscription.

#### Request Body

```json
{
  "subscriptionId": "string (UUID, required)",
  "bookingId": "string (UUID, required)",
  "autoApply": "boolean (default: true)"
}
```

#### Example Request

```bash
curl -X PUT "/api/subscriptions/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "subscriptionId": "123",
    "bookingId": "456",
    "autoApply": true
  }'
```

#### Response

```json
{
  "success": true,
  "message": "Booking successfully linked to subscription",
  "data": {
    "subscriptionBooking": {
      "id": "link-124",
      "subscriptionId": "123",
      "bookingId": "456"
    },
    "booking": {
      "id": "456",
      "serviceName": "House Cleaning"
    },
    "benefitsApplied": {
      "originalPrice": 150.00,
      "discount": 30.00,
      "newPrice": 120.00,
      "servicesUsedAfter": 9
    }
  }
}
```

### DELETE /api/subscriptions/bookings

Unlink a booking from a subscription.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| linkId | string | No | UUID of the subscription booking link |
| bookingId | string | No | UUID of the booking (alternative to linkId) |

#### Example Request

```bash
curl -X DELETE "/api/subscriptions/bookings?linkId=link-123" \
  -H "Authorization: Bearer <token>"
```

#### Response

```json
{
  "success": true,
  "message": "Booking unlinked from subscription",
  "data": {
    "unlinkedBookingId": "booking-456",
    "subscriptionId": "123",
    "usageReversed": true
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": {} // Additional error details (validation errors, etc.)
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors, missing parameters)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (subscription, booking not found)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Usage Patterns

### 1. Check Subscription Benefits Before Booking

```javascript
// Check if customer has subscription benefits
const eligibility = await fetch('/api/subscriptions/usage', {
  method: 'GET',
  params: { subscriptionId: 'customer-subscription-id' }
});

if (eligibility.data.usage.servicesRemaining > 0) {
  // Create booking with subscription benefits
  await createSubscriptionBooking({...});
}
```

### 2. Record Usage After Service Completion

```javascript
// After booking is completed
await fetch('/api/subscriptions/usage', {
  method: 'POST',
  body: JSON.stringify({
    subscriptionId: 'subscription-id',
    bookingId: 'completed-booking-id',
    description: 'Service completed'
  })
});
```

### 3. Handle Overage Scenarios

```javascript
// Check for overages and handle billing
const usage = await getUsageStats(subscriptionId);
if (usage.data.usage.overageServices > 0) {
  // Process overage billing
  console.log(`Overage charges: $${usage.data.usage.overageCharges}`);
}
```

### 4. Admin Usage Management

```javascript
// Credit services to customer account
await fetch('/api/subscriptions/usage', {
  method: 'PUT',
  body: JSON.stringify({
    subscriptionId: 'subscription-id',
    quantity: 3, // Add 3 service credits
    reason: 'Customer service credit for service delay'
  })
});
```

---

## Integration Notes

### Automatic Integration

The subscription usage system automatically integrates with:
- Existing booking creation via `createBookingAction`
- Stripe webhook processing for subscription renewals
- Fee calculation system for discounts and overages

### Manual Integration

For custom booking flows:
1. Check subscription eligibility before creating bookings
2. Apply pricing adjustments based on subscription benefits
3. Record usage when services are consumed
4. Handle overage billing through Stripe

### Testing

Use these test scenarios:
- Create subscription with 5 services per month
- Create 3 bookings (should be free/discounted)
- Create 2 more bookings (should consume remaining allowance)
- Create 6th booking (should trigger overage handling)
- Use admin endpoints to adjust usage and verify calculations