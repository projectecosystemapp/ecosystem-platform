# Admin Dashboard APIs

This documentation covers the comprehensive admin APIs for managing the advanced marketplace features. All admin endpoints require authentication with admin role privileges.

## Authentication

All admin endpoints use Clerk authentication with role-based access control. Only users with `role: "admin"` in their metadata can access these endpoints.

```typescript
// Middleware automatically validates admin access
const authContext = await requireRole(req, ["admin"]);
```

## 1. Analytics API (`/api/admin/analytics`)

Provides platform-wide metrics, KPIs, revenue analytics, and user growth statistics.

### GET `/api/admin/analytics`

Retrieve comprehensive platform analytics.

#### Query Parameters

```typescript
{
  period?: "day" | "week" | "month" | "quarter" | "year" // Default: "month"
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  groupBy?: "day" | "week" | "month" // For trending data
  includeComparison?: boolean // Default: true
}
```

#### Response

```typescript
{
  period: {
    start: string // ISO date
    end: string // ISO date
  }
  revenue: {
    total: number // Total revenue in cents
    transactions: number // Number of transactions
    avgTransactionValue: number // Average transaction value
    platformFees: number // Platform fees collected
    processingFees: number // Processing fees
    growth: number | null // Growth rate vs comparison period
  }
  users: {
    total: number // Total registered users
    new: number // New users in period
    active: number // Active users (made bookings)
  }
  providers: {
    total: number // Total providers
    new: number // New providers in period
    active: number // Active providers (received bookings)
  }
  bookings: {
    total: number // Total bookings
    completed: number // Completed bookings
    cancelled: number // Cancelled bookings
    avgValue: number // Average booking value
    conversionRate: number // Completion rate percentage
  }
  subscriptions: {
    active: number // Active subscriptions
    trialing: number // Trial subscriptions
    cancelled: number // Cancelled subscriptions
    mrr: number // Monthly recurring revenue
  }
  loyalty: {
    members: number // Loyalty program members
    pointsIssued: number // Total points issued
    pointsRedeemed: number // Total points redeemed
    avgBalance: number // Average points balance
  }
  categoryPerformance: Array<{
    category: string
    bookingCount: number
    revenue: number
    avgRating: number
  }>
  trending: Array<{
    period: string
    bookings: number
    revenue: number
    newUsers: number
  }> | null
}
```

### POST `/api/admin/analytics/export`

Export analytics data (placeholder for future implementation).

## 2. Subscriptions API (`/api/admin/subscriptions`)

Manage all subscriptions, view metrics, handle subscription issues, and generate reports.

### GET `/api/admin/subscriptions`

List all subscriptions with comprehensive filtering and search.

#### Query Parameters

```typescript
{
  status?: "trialing" | "active" | "past_due" | "canceled" | "paused" | "completed" | "all"
  customerId?: string
  providerId?: string
  planId?: string
  search?: string
  sortBy?: "createdAt" | "status" | "currentPeriodEnd" | "totalRevenue"
  sortOrder?: "asc" | "desc"
  page?: number // Default: 1
  limit?: number // Default: 20, max: 100
}
```

#### Response

```typescript
{
  subscriptions: Array<{
    id: string
    status: string
    customer: {
      id: string
      email: string
      name: string | null
    }
    plan: {
      id: string
      name: string
      billingCycle: string
      price: number
    }
    provider: {
      id: string
      businessName: string
    }
    currentPeriod: {
      start: Date
      end: Date
    }
    usage: {
      servicesUsed: number
      totalUsed: number
    }
    revenue: number
    cancelAtPeriodEnd: boolean
    createdAt: Date
  }>
  metrics: {
    active: number
    trialing: number
    paused: number
    canceled: number
    mrr: number // Monthly recurring revenue
    avgValue: number
    churnRate: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

### PUT `/api/admin/subscriptions`

Update subscription status and properties.

#### Request Body

```typescript
{
  subscriptionId: string
  status?: "active" | "paused" | "canceled"
  cancelAtPeriodEnd?: boolean
  pauseReason?: string
  resumeAt?: string // ISO date string
  notes?: string
}
```

### POST `/api/admin/subscriptions/report`

Generate subscription reports.

#### Request Body

```typescript
{
  reportType: "revenue" | "churn" | "usage"
  startDate?: string // ISO date
  endDate?: string // ISO date
  format?: "json" | "csv" // Default: "json"
}
```

## 3. Loyalty API (`/api/admin/loyalty`)

Manage loyalty programs, adjust point balances, configure campaigns, and view analytics.

### GET `/api/admin/loyalty`

List loyalty accounts and program metrics.

#### Query Parameters

```typescript
{
  customerId?: string
  tier?: "bronze" | "silver" | "gold" | "platinum" | "diamond"
  isActive?: boolean
  search?: string
  sortBy?: "pointsBalance" | "lifetimePointsEarned" | "tier" | "createdAt"
  sortOrder?: "asc" | "desc"
  page?: number
  limit?: number
}
```

### GET `/api/admin/loyalty?analytics=true`

Get detailed loyalty program analytics.

#### Response

```typescript
{
  pointsTrends: Array<{
    date: string
    earned: number
    redeemed: number
    transactions: number
  }>
  referrals: {
    total: number
    completed: number
    conversionRate: number
    totalRewards: number
  }
  campaigns: Array<{
    id: string
    name: string
    type: string
    startDate: Date
    endDate: Date
    redemptions: number
    totalRedemptions: number
    maxRedemptions: number | null
  }>
}
```

### POST `/api/admin/loyalty`

Perform loyalty program actions.

#### Adjust Points

```typescript
{
  action: "adjust_points"
  customerId: string
  points: number // Positive to add, negative to deduct
  description: string
  reason?: "earned_bonus" | "adjusted" | "compensation" | "promotion"
  expiresInDays?: number
}
```

#### Create Campaign

```typescript
{
  action: "create_campaign"
  name: string
  description?: string
  type: string // "double_points", "bonus_points", etc.
  startDate: string // ISO date
  endDate: string // ISO date
  rules?: {
    min_spend?: number
    categories?: string[]
    provider_ids?: string[]
  }
  pointsMultiplier?: number // Default: 1
  bonusPoints?: number // Default: 0
  targetTiers?: string[]
  targetProviders?: string[]
  maxRedemptions?: number
  maxPerCustomer?: number // Default: 1
}
```

### PUT `/api/admin/loyalty/tiers`

Update loyalty tier configuration.

```typescript
{
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond"
  minSpend: number
  minBookings?: number
  pointsMultiplier: number
  discountPercent: number
  benefits: string[]
  displayName: string
  description?: string
}
```

## 4. Pricing API (`/api/admin/pricing`)

Override pricing rules, view pricing performance, manage surge events, and competitor analysis.

### GET `/api/admin/pricing`

List pricing rules and metrics.

#### Query Parameters

```typescript
{
  providerId?: string
  serviceId?: string
  ruleType?: "time_based" | "demand_based" | "seasonal" | "advance_booking" | "loyalty" | "promotional" | "bundle" | "group"
  isActive?: boolean
  search?: string
  sortBy?: "createdAt" | "timesApplied" | "totalRevenueImpactCents" | "priority"
  sortOrder?: "asc" | "desc"
  page?: number
  limit?: number
}
```

### GET `/api/admin/pricing?analytics=true`

Get comprehensive pricing analytics.

#### Query Parameters

```typescript
{
  analytics: true
  period?: "week" | "month" // Default: "month"
  category?: string // Filter by service category
}
```

#### Response

```typescript
{
  period: { start: Date, end: Date }
  priceHistory: Array<{
    date: string
    averageChange: number
    increases: number
    decreases: number
    totalChanges: number
  }>
  demandByCategory: Array<{
    category: string
    avgDemandScore: number
    avgUtilization: number
    totalBookings: number
    avgPrice: number
  }>
  activeSurgeEvents: Array<{
    id: string
    provider: string
    eventName: string
    multiplier: number
    startTime: Date
    endTime: Date
  }>
  competitorAnalysis: Array<{
    category: string
    avgPrice: number
    minPrice: number
    maxPrice: number
    competitorCount: number
  }>
  rulePerformance: Array<{
    ruleType: string
    applications: number
    revenueImpact: number
    avgModifier: number
    activeRules: number
  }>
}
```

### POST `/api/admin/pricing`

Perform pricing management actions.

#### Create Pricing Rule

```typescript
{
  action: "create_rule"
  providerId: string
  serviceId?: string
  ruleType: "time_based" | "demand_based" | "seasonal" | "advance_booking" | "loyalty" | "promotional" | "bundle" | "group"
  name: string
  description?: string
  conditions: object // Rule-specific conditions
  priceModifier: number // 1.5 = 50% increase
  fixedAdjustmentCents?: number
  maxPriceCents?: number
  minPriceCents?: number
  priority?: number // Default: 0
  isStackable?: boolean // Default: false
  validFrom?: string // ISO date
  validUntil?: string // ISO date
}
```

#### Create Surge Event

```typescript
{
  action: "create_surge"
  providerId: string
  eventName: string
  eventType: "automatic" | "manual" | "holiday"
  startTime: string // ISO datetime
  endTime: string // ISO datetime
  surgeMultiplier: number // >= 1.0
  demandScore?: number
  affectedServices?: string[]
  triggerReason?: string
}
```

#### Add Competitor Data

```typescript
{
  action: "add_competitor"
  location: string
  category: string
  subcategory?: string
  competitorName?: string
  serviceName: string
  priceCents: number
  priceUnit?: string
  bookingFeeCents?: number
  dataSource?: "manual" | "scraped" | "api" // Default: "manual"
  sourceUrl?: string
  confidence?: number // 0-1
}
```

## Error Handling

All admin APIs use consistent error handling:

```typescript
// Validation errors
{
  error: "Invalid parameters" | "Invalid data"
  details: ZodError[] // Validation error details
}

// Authorization errors
{
  error: "Authentication required" | "Insufficient permissions"
}

// Not found errors
{
  error: "Resource not found"
}

// Server errors
{
  error: "Internal server error" | "Failed to perform operation"
}
```

## Rate Limiting

Admin APIs are subject to higher rate limits than public APIs:
- 1000 requests per minute per admin user
- Surge pricing and bulk operations have separate limits

## Audit Logging

All admin actions are automatically logged with:
- Admin user ID
- Action performed
- Timestamp
- Resource affected
- Changes made

## Security Considerations

1. **Admin Role Verification**: Every request validates admin role through Clerk metadata
2. **Input Validation**: All inputs validated with Zod schemas
3. **SQL Injection Prevention**: Uses Drizzle ORM with prepared statements
4. **Audit Trail**: All admin actions are logged
5. **Rate Limiting**: Prevents abuse of admin endpoints
6. **CSRF Protection**: Automatic CSRF protection for state-changing operations

## Usage Examples

### Get Platform Analytics

```bash
curl -H "Authorization: Bearer <admin-token>" \
  "https://api.example.com/api/admin/analytics?period=month&includeComparison=true"
```

### Adjust Customer Points

```bash
curl -X POST -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "adjust_points",
    "customerId": "user_123",
    "points": 500,
    "description": "Compensation for service issue",
    "reason": "compensation"
  }' \
  "https://api.example.com/api/admin/loyalty"
```

### Create Surge Pricing Event

```bash
curl -X POST -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_surge",
    "providerId": "provider_123",
    "eventName": "Holiday Weekend Surge",
    "eventType": "manual",
    "startTime": "2024-07-04T18:00:00Z",
    "endTime": "2024-07-05T06:00:00Z",
    "surgeMultiplier": 1.5,
    "triggerReason": "Independence Day weekend high demand"
  }' \
  "https://api.example.com/api/admin/pricing"
```

## Implementation Status

- ✅ Analytics API - Complete
- ✅ Subscriptions API - Complete 
- ✅ Loyalty API - Complete
- ✅ Pricing API - Complete
- ⏳ CSV Export functionality - Coming soon
- ⏳ Advanced reporting features - Coming soon
- ⏳ Real-time notifications - Coming soon