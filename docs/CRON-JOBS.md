# Cron Jobs & Automated Billing System

This document describes the automated billing and maintenance system for the marketplace platform. All cron jobs are configured to run automatically via Vercel Cron and include comprehensive error handling, monitoring, and alerting.

## 📋 Overview

The system includes five main automated processes:

1. **Process Payouts** - Automated provider payouts via Stripe Connect
2. **Process Subscriptions** - Recurring subscription billing and management  
3. **Loyalty Maintenance** - Points expiration, tier updates, and benefits
4. **Pricing Analytics** - Demand analysis and surge pricing automation
5. **Payment Reconciliation** - Daily payment reconciliation and fraud detection

## 🔧 Configuration

### Environment Variables Required

```bash
# Core Configuration
CRON_SECRET=your-secret-key-here
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ANALYTICS_ENDPOINT=https://analytics.example.com/events
```

### Vercel Cron Schedule

The cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-payouts",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/process-subscriptions", 
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/loyalty-maintenance",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/pricing-analytics",
      "schedule": "0 6-22/2 * * *"
    },
    {
      "path": "/api/cron/reconcile-payments",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## 💰 Process Payouts (`/api/cron/process-payouts`)

**Schedule**: Every hour (`0 * * * *`)  
**Purpose**: Automated provider payouts after service completion

### What it does:
- Processes scheduled payouts that have completed escrow period (7 days default)
- Retries failed payouts with exponential backoff (max 3 attempts)
- Handles Stripe Connect transfers to provider accounts
- Sends payout notifications to providers
- Cleans up old cancelled/failed payout records (30+ days)

### Key Features:
- **Escrow Protection**: Holds funds for configurable period before payout
- **Retry Logic**: Automatic retry with 1h, 4h, 24h delays
- **Batch Processing**: Handles up to 50 payouts per run
- **Fraud Detection**: Integrates with existing fraud detection system
- **Notifications**: Email/SMS notifications for payout status

### Monitoring:
```bash
# Health check
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/health/cron

# Manual trigger (testing)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/process-payouts
```

## 📱 Process Subscriptions (`/api/cron/process-subscriptions`)

**Schedule**: Daily at 2 AM (`0 2 * * *`)  
**Purpose**: Handle recurring subscription billing and lifecycle management

### What it does:
- Processes subscriptions due for renewal
- Charges customers via Stripe subscription billing
- Handles failed payment retries (max 3 over 7 days)
- Updates subscription periods and usage counters
- Processes subscription cancellations at period end
- Resumes paused subscriptions when scheduled
- Sends renewal reminders (3 days before renewal)

### Key Features:
- **Automatic Billing**: Integrated with Stripe subscription system
- **Grace Period**: 3 retry attempts over 7 days for failed payments
- **Usage Tracking**: Tracks service usage per billing period
- **Flexible Billing Cycles**: Weekly, bi-weekly, monthly, quarterly, annual
- **Pause/Resume**: Temporary subscription pausing with auto-resume
- **Cancellation Management**: Honors cancellation-at-period-end requests

### Subscription States:
- `trialing` → `active` (when trial ends)
- `active` → `past_due` (payment failed)
- `past_due` → `active` (payment recovered)
- `past_due` → `canceled` (after max retries)
- `active` → `canceled` (at period end if requested)
- `paused` → `active` (when resume date reached)

## 🏆 Loyalty Maintenance (`/api/cron/loyalty-maintenance`)

**Schedule**: Daily at 3 AM (`0 3 * * *`)  
**Purpose**: Maintain loyalty program integrity and process benefits

### What it does:
- Expires points older than 12 months
- Updates customer tier status based on annual spending
- Processes tier benefits (birthday bonuses, monthly credits)
- Sends tier upgrade/downgrade notifications
- Cleans up expired referrals and campaigns
- Calculates tier progress percentages

### Key Features:
- **Point Expiration**: 12-month rolling expiration with notifications
- **Dynamic Tiers**: Bronze → Silver → Gold → Platinum → Diamond
- **Automatic Benefits**: Birthday bonuses, monthly credits for premium tiers
- **Tier Calculations**: Based on annual spend, booking count, and points earned
- **Personalized Offers**: Quarterly special offers based on tier and behavior
- **Referral Management**: Tracks and expires referral campaigns

### Tier Requirements:
```typescript
const TIER_THRESHOLDS = {
  bronze: { minSpend: 0 },      // $0 (default)
  silver: { minSpend: 50000 },  // $500 annually  
  gold: { minSpend: 150000 },   // $1,500 annually
  platinum: { minSpend: 300000 }, // $3,000 annually
  diamond: { minSpend: 500000 }  // $5,000+ annually
};
```

## 📈 Pricing Analytics (`/api/cron/pricing-analytics`)

**Schedule**: Every 2 hours during business hours (`0 6-22/2 * * *`)  
**Purpose**: Optimize pricing through demand analysis and surge pricing

### What it does:
- Calculates demand metrics (bookings, searches, utilization rates)
- Triggers automatic surge pricing during high demand
- Updates competitor pricing intelligence
- Processes customer price alerts
- Generates pricing insights and recommendations
- Cleans up old analytics data (90+ days)

### Key Features:
- **Demand Scoring**: 0-10 scale based on bookings, utilization, conversions
- **Automatic Surge**: 1.5x-3x pricing during high demand periods
- **Competitor Tracking**: Market pricing intelligence and comparisons
- **Price Alerts**: Customer notifications for price drops/changes
- **Smart Insights**: AI-powered pricing recommendations for providers

### Demand Levels:
- `very_low` (0-2): Consider price reductions
- `low` (2-4): Standard pricing
- `normal` (4-6): Optimal range
- `high` (6-8): Monitor for surge opportunities
- `very_high` (8-9): Automatic surge pricing
- `extreme` (9-10): Maximum surge pricing

### Surge Pricing Logic:
```typescript
const SURGE_CONDITIONS = {
  minDemandScore: 7.0,      // Minimum demand score to trigger
  minUtilization: 0.8,      // 80%+ capacity utilization
  maxMultiplier: 3.0,       // Maximum 3x price increase
  duration: 2,              // Hours to maintain surge
  cooldown: 4               // Hours before next surge
};
```

## 🔍 Health Monitoring

### Health Check Endpoint
```bash
GET /api/health/cron
```

Returns comprehensive health status for all cron jobs:

```json
{
  "status": "healthy|warning|unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "payouts": {
      "status": "healthy",
      "metrics": {
        "completed": 45,
        "failed": 2,
        "failureRate": "4.3%"
      }
    },
    "subscriptions": {
      "status": "healthy", 
      "metrics": {
        "active": 1250,
        "pastDue": 23,
        "pastDueRate": "1.8%"
      }
    }
  }
}
```

### Individual Service Health
```bash
POST /api/health/cron
Content-Type: application/json

{
  "service": "payouts|subscriptions|loyalty|pricing|reconciliation"
}
```

## 🚨 Error Handling & Alerting

### Slack Notifications
Automatic Slack alerts for:
- Cron job failures
- High failure rates (>10% for payouts, >5% past due for subscriptions)
- System anomalies

### Retry Strategies
- **Payouts**: 3 attempts with 1h, 4h, 24h delays
- **Subscriptions**: 3 attempts over 7 days  
- **Analytics**: No retries (non-critical)
- **Loyalty**: No retries (daily execution)

### Logging
All cron jobs log to console with structured data:
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "job": "process-payouts",
  "duration": "1250ms",
  "processed": 45,
  "succeeded": 43,
  "failed": 2
}
```

## 🔒 Security

### Authentication
All cron endpoints require `CRON_SECRET` authentication:
```bash
Authorization: Bearer your-cron-secret
```

### Rate Limiting
- Cron endpoints exempt from standard rate limits
- Internal rate limiting prevents abuse
- Idempotency keys prevent duplicate processing

### Data Protection
- All sensitive data encrypted in transit and at rest
- PCI compliance for payment processing
- Audit logging for all financial transactions

## 📊 Metrics & Monitoring

### Key Performance Indicators

**Payouts:**
- Processing time: <5 minutes per batch
- Failure rate: <5%
- Retry success rate: >80%

**Subscriptions:** 
- Renewal success rate: >95%
- Past due rate: <5%
- Churn prevention: Email recovery >20%

**Loyalty:**
- Point expiration rate: <10%/month
- Tier progression rate: >15%/year
- Engagement improvement: >25% for upgraded tiers

**Pricing:**
- Surge accuracy: >85% precision
- Revenue optimization: >12% increase
- Provider adoption: >60% enable auto-surge

### Dashboards
- Grafana dashboards for real-time monitoring
- Weekly automated reports via email
- Monthly business intelligence summaries

## 🛠️ Development & Testing

### Local Testing
```bash
# Set up environment
export CRON_SECRET="test-secret"
export STRIPE_SECRET_KEY="sk_test_..."

# Test individual endpoints
curl -H "Authorization: Bearer test-secret" \
  http://localhost:3000/api/cron/process-payouts

# Test with dry-run mode
curl -H "Authorization: Bearer test-secret" \
  -H "X-Dry-Run: true" \
  http://localhost:3000/api/cron/process-subscriptions
```

### Staging Validation
1. Deploy to staging environment
2. Run manual tests with test data
3. Verify Slack notifications work
4. Check health endpoints respond correctly
5. Validate database changes are correct

### Production Deployment
1. Update `CRON_SECRET` in production environment
2. Deploy via Vercel with cron configurations
3. Monitor first few executions closely
4. Verify all integrations work correctly

## 📚 Related Documentation

- [Payment Processing Architecture](./PAYMENT-ARCHITECTURE.md)
- [Subscription Management](./SUBSCRIPTION-SYSTEM.md)
- [Loyalty Program Design](./LOYALTY-PROGRAM.md)
- [Pricing Strategy](./DYNAMIC-PRICING.md)
- [Security Guidelines](./SECURITY-AUDIT.md)

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0