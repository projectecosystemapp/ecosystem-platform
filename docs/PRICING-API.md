# Dynamic Pricing API Documentation

## Overview

The Dynamic Pricing Engine provides intelligent, rule-based pricing for marketplace services. It supports time-based pricing, demand-based surge pricing, seasonal adjustments, and advance booking discounts.

## Key Features

- **Dynamic Price Calculation**: Real-time price adjustments based on multiple factors
- **Surge Pricing**: Automatic or manual surge pricing during high-demand periods
- **Rule-Based Pricing**: Flexible rules for time-based, seasonal, and promotional pricing
- **Price History Tracking**: Complete audit trail of all price changes
- **Demand Analytics**: Track and predict demand patterns

## API Endpoints

### 1. Calculate Dynamic Price

Calculate the current dynamic price for a service.

**Endpoint**: `POST /api/pricing/calculate`

**Request Body**:
```json
{
  "serviceId": "uuid",
  "providerId": "uuid",
  "requestedDate": "2025-08-27T18:00:00Z",
  "duration": 60,
  "groupSize": 1,
  "customerId": "string (optional)",
  "includeBreakdown": true
}
```

**Response**:
```json
{
  "basePrice": 100,
  "finalPrice": 125,
  "currency": "USD",
  "modifiers": [
    {
      "ruleId": "uuid",
      "ruleName": "Peak Hours",
      "ruleType": "time_based",
      "modifier": 1.25,
      "priority": 10
    }
  ],
  "surgeActive": false,
  "surgeMultiplier": null,
  "demandLevel": "high",
  "totalModifier": 1.25,
  "savingsAmount": null,
  "savingsPercent": null
}
```

### 2. Pricing Rules Management

Manage pricing rules for dynamic pricing.

**List Rules**: `GET /api/pricing/rules?providerId=uuid&isActive=true`

**Create Rule**: `POST /api/pricing/rules`

```json
{
  "providerId": "uuid",
  "serviceId": "uuid (optional)",
  "ruleType": "time_based",
  "name": "Weekend Premium",
  "description": "25% premium on weekends",
  "conditions": {
    "days_of_week": [0, 6],
    "timezone": "America/Los_Angeles"
  },
  "priceModifier": 1.25,
  "priority": 10,
  "isStackable": false,
  "validFrom": "2025-08-01T00:00:00Z",
  "validUntil": "2025-12-31T23:59:59Z",
  "isActive": true
}
```

**Update Rule**: `PUT /api/pricing/rules`

**Delete Rule**: `DELETE /api/pricing/rules?id=uuid&providerId=uuid`

### 3. Surge Pricing Management

Control surge pricing events.

**List Surge Events**: `GET /api/pricing/surge?providerId=uuid&isActive=true`

**Activate Surge**: `POST /api/pricing/surge`

```json
{
  "providerId": "uuid",
  "eventName": "High Demand Surge",
  "eventType": "manual",
  "startTime": "2025-08-27T18:00:00Z",
  "endTime": "2025-08-27T20:00:00Z",
  "surgeMultiplier": 1.5,
  "affectedServices": ["service-id-1", "service-id-2"],
  "triggerReason": "Concert event nearby"
}
```

**Auto-Trigger Surge**: `POST /api/pricing/surge`

```json
{
  "providerId": "uuid",
  "autoTrigger": true,
  "demandThreshold": 7.5,
  "minBookingsPerHour": 5,
  "lookbackHours": 2,
  "durationMinutes": 60,
  "maxMultiplier": 2.0
}
```

**Update Surge**: `PUT /api/pricing/surge`

**Deactivate Surge**: `DELETE /api/pricing/surge?id=uuid`

## Pricing Rule Types

### 1. Time-Based Pricing

Adjust prices based on time of day or day of week.

```json
{
  "ruleType": "time_based",
  "conditions": {
    "days_of_week": [0, 6],  // Sunday, Saturday
    "hours": [[18, 20], [8, 10]],  // 6-8 PM, 8-10 AM
    "timezone": "America/Los_Angeles"
  },
  "priceModifier": 1.25  // 25% increase
}
```

### 2. Demand-Based Pricing

Adjust prices based on current demand levels.

```json
{
  "ruleType": "demand_based",
  "conditions": {
    "demand_threshold": "high",
    "min_bookings": 5,
    "time_window_hours": 2
  },
  "priceModifier": 1.5
}
```

### 3. Seasonal Pricing

Apply special pricing for holidays or date ranges.

```json
{
  "ruleType": "seasonal",
  "conditions": {
    "dates": ["2025-12-25", "2025-01-01"],
    "date_ranges": [["2025-12-20", "2025-12-26"]]
  },
  "priceModifier": 2.0  // Double price
}
```

### 4. Advance Booking Pricing

Incentivize early bookings or charge premium for last-minute.

```json
{
  "ruleType": "advance_booking",
  "conditions": {
    "min_hours": 48,  // At least 48 hours in advance
    "max_hours": 168  // Up to 7 days in advance
  },
  "priceModifier": 0.9  // 10% discount
}
```

## Fee Structure

The marketplace applies the following fees:

- **Platform Fee**: 10% of service price
- **Guest Surcharge**: Additional 10% for non-authenticated users
- **Stripe Processing**: 2.9% + $0.30

### Fee Calculation Example

For a $100 service:

**Authenticated Customer**:
- Service Price: $100
- Platform Fee: $10 (provider pays)
- Stripe Fee: $3.20 (provider pays)
- Customer Pays: $100
- Provider Receives: $86.80

**Guest Customer**:
- Service Price: $100
- Guest Surcharge: $10 (customer pays)
- Platform Fee: $10 (provider pays)
- Stripe Fee: $3.49 (on $110 total)
- Customer Pays: $110
- Provider Receives: $86.51

## Demand Levels

Demand is categorized into six levels:

1. **Very Low** (0-2): Significant discounts may apply
2. **Low** (2-4): Small discounts possible
3. **Normal** (4-6): Standard pricing
4. **High** (6-7.5): Moderate surge pricing
5. **Very High** (7.5-9): Significant surge pricing
6. **Extreme** (9-10): Maximum surge pricing

## Implementation Examples

### Example 1: Enable Weekend Surge

```javascript
// Create weekend surge rule
const response = await fetch('/api/pricing/rules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    providerId: 'provider-123',
    ruleType: 'time_based',
    name: 'Weekend Rush',
    conditions: {
      days_of_week: [5, 6], // Friday, Saturday
      hours: [[18, 23]], // 6 PM - 11 PM
    },
    priceModifier: 1.5,
    priority: 10,
    isActive: true,
  }),
});
```

### Example 2: Calculate Price with Breakdown

```javascript
const response = await fetch('/api/pricing/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    serviceId: 'service-456',
    providerId: 'provider-123',
    requestedDate: new Date().toISOString(),
    duration: 120, // 2 hours
    groupSize: 3,
    includeBreakdown: true,
  }),
});

const pricing = await response.json();
console.log(`Base: $${pricing.basePrice}`);
console.log(`Final: $${pricing.finalPrice}`);
console.log(`Surge Active: ${pricing.surgeActive}`);
```

## Best Practices

1. **Rule Priority**: Use priority values (0-1000) to control rule precedence
2. **Stackability**: Only allow rule stacking when it makes business sense
3. **Price Limits**: Always set min/max price constraints to prevent extreme prices
4. **Testing**: Test pricing rules in off-peak hours before enabling
5. **Monitoring**: Track rule performance via `timesApplied` and `totalRevenueImpactCents`

## Rate Limiting

All pricing APIs are rate-limited:
- **Calculate**: 100 requests per minute
- **Rules CRUD**: 50 requests per minute
- **Surge Management**: 20 requests per minute

## Error Handling

Common error responses:

- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Conflicting surge events
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Security

- All endpoints require authentication (except guest checkout calculation)
- Provider can only manage their own pricing rules
- CSRF protection on all mutation endpoints
- Input validation using Zod schemas
- Audit trail for all price changes