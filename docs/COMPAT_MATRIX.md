# External Systems Compatibility Matrix

## Overview
This document defines all external system integrations, their current status, and planned evolution across the three phases of Ecosystem marketplace development.

## 🎯 Current State (MVP)

### Authentication
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Clerk** | ✅ Active | Latest | User auth, profiles | Primary auth provider |

**Configuration**:
- Publishable Key: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Secret Key: `CLERK_SECRET_KEY`
- Providers: Email, Google, GitHub
- Webhooks: User creation/update

**Rate Limits**: 10,000 MAU (free tier)
**SLA**: 99.9% uptime
**Fallback**: None (single point of failure accepted for MVP)

### Payments
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Stripe** | ✅ Active | 2023-10-16 | Payment processing | Payment Links only |

**Configuration**:
- Secret Key: `STRIPE_SECRET_KEY`
- Webhook Secret: `STRIPE_WEBHOOK_SECRET`
- Products: Created via Stripe Dashboard
- Mode: Test (switch to live for production)

**Rate Limits**: 100/second (standard)
**SLA**: 99.95% uptime
**Fallback**: Manual payment collection

### Database
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Supabase** | ✅ Active | PostgreSQL 15 | Primary database | Managed PostgreSQL |

**Configuration**:
- Connection String: `DATABASE_URL`
- Max Connections: 60 (free tier)
- Storage: 500MB (free tier)

**Rate Limits**: None enforced
**SLA**: 99.9% uptime
**Backup**: Daily automatic backups

### Email
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Console Logging** | ⚠️ Stub | N/A | Dev notifications | MVP placeholder |

**Configuration**: None required
**Rate Limits**: N/A
**SLA**: N/A (dev only)
**Production Plan**: Migrate to Resend

### File Storage
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Supabase Storage** | ✅ Active | Latest | Provider images | Object storage |

**Configuration**:
- Bucket: `provider-images`
- Max File Size: 5MB
- CDN: Built-in

**Rate Limits**: 60 requests/minute
**SLA**: Same as Supabase
**Storage Limit**: 1GB (free tier)

## 📈 Growth Phase (Phase 2)

### Payments Upgrade
| System | Status | Version | Purpose | Changes |
|--------|--------|---------|---------|---------|
| **Stripe Connect** | 🔄 Planned | 2023-10-16 | Marketplace payments | Add Express accounts |

**New Configuration**:
- Connect Client ID: `STRIPE_CONNECT_CLIENT_ID`
- Platform Fee: Configurable per provider
- Payout Schedule: Daily/Weekly options
- KYC: Required for providers >$20K/year

**Integration Points**:
- Onboarding flow in `/dashboard/provider/payments`
- Webhook handlers for account updates
- Fee splitting logic in booking creation

### Email Service
| System | Status | Version | Purpose | Changes |
|--------|--------|---------|---------|---------|
| **Resend** | 🔄 Planned | Latest | Transactional email | Replace console stub |

**Configuration**:
- API Key: `RESEND_API_KEY`
- Domain: `noreply@ecosystem.com`
- Templates: Booking confirmation, reminders

**Rate Limits**: 100/day (free tier)
**SLA**: 99.9% uptime

### Search Enhancement
| System | Status | Version | Purpose | Changes |
|--------|--------|---------|---------|---------|
| **Typesense** | 🔄 Planned | 0.25+ | Enhanced search | Replace PostgreSQL FTS |

**Configuration**:
- API Key: `TYPESENSE_API_KEY`
- Cluster: Cloud hosted
- Index: Providers, services, reviews

**Rate Limits**: 1M searches/month
**SLA**: 99.95% uptime

### Analytics
| System | Status | Version | Purpose | Changes |
|--------|--------|---------|---------|---------|
| **PostHog** | 🔄 Planned | Latest | Product analytics | Add event tracking |

**Configuration**:
- Project API Key: `POSTHOG_KEY`
- Host: US Cloud
- Events: Page views, bookings, searches

**Rate Limits**: 1M events/month (free)
**GDPR**: Cookie consent required

## 🚀 Scale Phase (Phase 3)

### Monitoring & Observability
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Sentry** | 🔄 Future | Latest | Error tracking | Production readiness |
| **Datadog** | 🔄 Future | Latest | APM, logs | Full observability |
| **PagerDuty** | 🔄 Future | Latest | Incident management | On-call rotation |

### Infrastructure
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **Vercel** | ✅ Current | Latest | Hosting | Evaluate AWS migration |
| **CloudFlare** | 🔄 Future | Latest | CDN, DDoS protection | Performance enhancement |
| **AWS** | 🔄 Future | Latest | Full cloud migration | If Vercel limits reached |

### Compliance
| System | Status | Version | Purpose | Notes |
|--------|--------|---------|---------|-------|
| **OneTrust** | 🔄 Future | Latest | Privacy management | GDPR compliance |
| **TrustArc** | 🔄 Future | Latest | Security assessments | SOC 2 preparation |

## 🔧 Development Dependencies

### Required for MVP
```bash
# Core Framework
Next.js 14+
React 18+
TypeScript 5+

# Database
Drizzle ORM
PostgreSQL 15+

# UI/UX
Tailwind CSS 3+
ShadCN UI
Framer Motion

# Authentication
@clerk/nextjs

# Payments
stripe

# Development
eslint
prettier
tsx
```

### Environment Variables
```env
# Required for MVP
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Required for Growth
STRIPE_CONNECT_CLIENT_ID=ca_...
RESEND_API_KEY=re_...
TYPESENSE_API_KEY=xyz...
POSTHOG_KEY=phc_...

# Required for Scale
SENTRY_DSN=https://...
DATADOG_API_KEY=...
PAGERDUTY_INTEGRATION_KEY=...
```

## 🔄 Migration Plans

### Stripe Payment Links → Connect
**Timeline**: Week 5-6 of development
**Process**:
1. Set up Connect application in Stripe Dashboard
2. Implement Express onboarding flow
3. Update booking creation to use Connect charges
4. Migrate existing providers (manual process)
5. Sunset payment links

**Rollback Plan**: Keep payment links as fallback

### Console Logging → Resend
**Timeline**: Week 3-4 of development
**Process**:
1. Set up Resend account and domain
2. Create email templates
3. Implement sending service
4. A/B test with console logging
5. Full migration

**Rollback Plan**: Toggle back to console via env var

### PostgreSQL FTS → Typesense
**Timeline**: Phase 2, Month 2
**Process**:
1. Set up Typesense cluster
2. Create indexing pipeline
3. Implement search API layer
4. A/B test search quality
5. Migrate frontend

**Rollback Plan**: Keep PostgreSQL search as fallback

## 📊 Vendor Evaluation Criteria

### Must Have
- [ ] 99.9%+ uptime SLA
- [ ] Comprehensive documentation
- [ ] Webhook/API reliability
- [ ] GDPR compliance options
- [ ] Reasonable rate limits

### Nice to Have
- [ ] Free tier for development
- [ ] Usage-based pricing
- [ ] Multi-region availability
- [ ] 24/7 support
- [ ] Migration assistance

### Deal Breakers
- [ ] No API access
- [ ] Vendor lock-in without export
- [ ] Poor security track record
- [ ] No webhook reliability
- [ ] Pricing unpredictability

## 🚨 Risk Assessment

### High Risk Integrations
1. **Stripe Connect**: Complex onboarding, KYC requirements
2. **Supabase Scale**: May hit limits at 10K+ users
3. **Email Deliverability**: Critical for booking confirmations

### Medium Risk Integrations
1. **Search Migration**: Data sync complexity
2. **Analytics Privacy**: GDPR compliance overhead
3. **Monitoring Setup**: Alert fatigue potential

### Low Risk Integrations
1. **Clerk**: Proven reliability
2. **Vercel**: Solid Next.js support
3. **File Storage**: Simple object storage

## 📝 Integration Testing

### Webhook Testing
- Use `ngrok` for local webhook testing
- Stripe CLI for payment webhook simulation
- Automated webhook replay for reliability testing

### API Testing
- Contract tests for all external APIs
- Circuit breaker patterns for resilience
- Exponential backoff for retry logic

### Performance Testing
- Load test with realistic external API latency
- Test rate limit handling
- Cache invalidation scenarios

## 📞 Support Contacts

### Primary Vendors
- **Stripe**: Premium support (24/7)
- **Clerk**: Email support (business hours)
- **Supabase**: Community + paid support
- **Vercel**: Email support

### Emergency Escalation
1. Check vendor status pages
2. Engage vendor support
3. Implement fallback procedures
4. Communicate with users

---

*This matrix is reviewed monthly and updated when adding new integrations.*

*Last updated: 2024-01-15*
*Next review: 2024-02-15*