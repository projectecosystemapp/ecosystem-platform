# Non-Goals for Ecosystem Marketplace MVP

## Purpose
This document explicitly defines what we are **NOT** building in the MVP phase to prevent scope creep, maintain focus, and ship faster. Features listed here may be reconsidered in future phases but are explicitly out of scope for initial launch.

## ❌ Payment & Financial Features

### Stripe Connect Implementation
**Not doing**: Full Stripe Connect integration with onboarding flow
**Instead**: Using Stripe Payment Links with manual reconciliation
**Why**: Reduces complexity, faster launch, allows validation before financial commitment
**Revisit**: Phase 2 when we have proven demand

### Automated Payouts
**Not doing**: Automatic provider payouts via Stripe
**Instead**: Manual payout process (bank transfer)
**Why**: Compliance complexity, requires Connect
**Revisit**: Phase 2 with Connect

### Tax Calculations
**Not doing**: VAT/GST/Sales tax calculation and remittance
**Instead**: Prices shown as "provider sets price including any applicable taxes"
**Why**: Complex international tax law, requires Stripe Tax
**Revisit**: Phase 3 for international expansion

### Multi-currency Support
**Not doing**: Dynamic currency conversion, multi-currency pricing
**Instead**: USD only
**Why**: Adds complexity to payments, reporting, and reconciliation
**Revisit**: Phase 3 international

### Subscription Billing
**Not doing**: Recurring bookings, membership tiers, subscription services
**Instead**: One-time bookings only
**Why**: Different business model, complex billing logic
**Revisit**: Phase 3 if market demands

## ❌ Provider Profile Features

### Drag-and-Drop Customization
**Not doing**: Visual page builder, custom layouts, theme selection
**Instead**: Fixed template with content slots
**Why**: Complex frontend, diminishing returns for MVP
**Revisit**: Phase 3 for differentiation

### Custom Domains
**Not doing**: provider.com pointing to their profile
**Instead**: ecosystem.com/providers/provider-name
**Why**: DNS complexity, SSL certificates, infrastructure cost
**Revisit**: Phase 3 enterprise features

### Advanced Media
**Not doing**: Video uploads, 360° photos, virtual tours
**Instead**: Static images only (up to 12)
**Why**: Storage costs, transcoding complexity, bandwidth
**Revisit**: When providers request it

### Dynamic Pricing
**Not doing**: Surge pricing, seasonal rates, promotional codes
**Instead**: Fixed service prices
**Why**: Complex pricing engine, user confusion
**Revisit**: Phase 2 based on provider feedback

## ❌ Communication Features

### Real-time Messaging
**Not doing**: Chat system, WebSocket connections, message threads
**Instead**: Contact form with email relay
**Why**: Real-time infrastructure, moderation needs, storage
**Revisit**: Phase 2 after validating communication patterns

### Video Calls
**Not doing**: Integrated video consultations
**Instead**: Providers share their own Zoom/Meet links
**Why**: WebRTC complexity, HIPAA compliance for some verticals
**Revisit**: Never (use integrations instead)

### SMS Notifications
**Not doing**: SMS reminders and updates
**Instead**: Email only
**Why**: Cost per message, phone verification complexity
**Revisit**: Phase 2 for critical notifications

## ❌ Discovery Features

### AI-Powered Search
**Not doing**: Natural language search, semantic matching, ML ranking
**Instead**: Basic PostgreSQL full-text search
**Why**: ML infrastructure cost, training data needed
**Revisit**: Phase 3 when we have usage data

### Personalization
**Not doing**: Recommended for you, browsing history, preference learning
**Instead**: Same results for all users
**Why**: Requires user tracking, ML models
**Revisit**: Phase 3 for engagement

### Native Mobile Apps
**Not doing**: iOS/Android apps
**Instead**: Mobile-responsive web only
**Why**: App store approval, maintenance overhead, update cycles
**Revisit**: Phase 3 if mobile traffic >50%

### Map View
**Not doing**: Interactive maps, radius search, route planning
**Instead**: Text-based location (city, state)
**Why**: Maps API costs, complex UI
**Revisit**: Phase 2 if location is critical

## ❌ Trust & Safety Features

### Background Checks
**Not doing**: Automated background verification
**Instead**: Self-reported with ToS agreement
**Why**: Cost per check, legal liability, international complexity
**Revisit**: Phase 2 with Stripe Identity

### Review Moderation
**Not doing**: AI moderation, sentiment analysis, review disputes
**Instead**: All reviews published, manual flagging only
**Why**: Moderation overhead, false positives
**Revisit**: Phase 2 when volume justifies

### Insurance Integration
**Not doing**: Platform-provided insurance, coverage verification
**Instead**: Providers handle own insurance
**Why**: Regulatory complexity, underwriting
**Revisit**: Phase 3 partnership opportunity

## ❌ Operational Features

### Advanced Analytics
**Not doing**: Provider dashboards with insights, trend analysis
**Instead**: Basic stats only (bookings, revenue)
**Why**: Analytics infrastructure, data pipeline
**Revisit**: Phase 2 for provider retention

### A/B Testing Framework
**Not doing**: Feature flags, experiment framework
**Instead**: Single experience for all users
**Why**: Additional complexity, statistical significance needs traffic
**Revisit**: Phase 2 when optimizing conversion

### Internationalization (i18n)
**Not doing**: Multi-language support, RTL layouts
**Instead**: English only
**Why**: Translation cost, maintenance overhead
**Revisit**: Phase 3 based on market opportunity

### API for Third Parties
**Not doing**: Public API, OAuth, rate limiting, developer portal
**Instead**: Internal API only
**Why**: Documentation, versioning, support burden
**Revisit**: Phase 3 for partnerships

## ❌ Technical Decisions

### Microservices Architecture
**Not doing**: Service mesh, multiple deployments, message queues
**Instead**: Monolithic Next.js app
**Why**: Operational complexity, premature optimization
**Revisit**: When team >10 engineers

### Real-time Updates
**Not doing**: WebSockets, Server-Sent Events, live availability
**Instead**: Page refresh for updates
**Why**: Infrastructure complexity, scaling challenges
**Revisit**: Phase 2 for specific features

### Native Database Replication
**Not doing**: Read replicas, multi-region deployment
**Instead**: Single database instance
**Why**: Cost, complexity, premature optimization
**Revisit**: When scale demands

### Elasticsearch/Algolia
**Not doing**: Dedicated search infrastructure
**Instead**: PostgreSQL full-text search
**Why**: Additional service to maintain, cost
**Revisit**: Phase 2 when search is bottleneck

## ❌ Compliance Features

### GDPR Data Portability
**Not doing**: Automated data export, right to be forgotten API
**Instead**: Manual process via support
**Why**: Low EU user expectation initially
**Revisit**: When EU traffic >10%

### DAC7 Reporting
**Not doing**: EU tax reporting for platforms
**Instead**: Not applicable (no EU entity)
**Why**: Only required for EU-established platforms
**Revisit**: Phase 3 EU expansion

### Accessibility (Full WCAG AAA)
**Not doing**: AAA compliance, screen reader optimization for everything
**Instead**: AA compliance for critical paths
**Why**: Significant additional effort for edge cases
**Revisit**: Based on user feedback

## ❌ Legacy/Deprecated Features

### Whop Integration
**Not doing**: Any Whop-related code or references
**Instead**: Stripe only
**Why**: Deprecated, removed from codebase
**Revisit**: Never

### Alternative Payment Methods
**Not doing**: PayPal, crypto, buy-now-pay-later
**Instead**: Credit/debit cards via Stripe only
**Why**: Integration complexity, reconciliation
**Revisit**: Based on customer demand

### Social Login Beyond Clerk
**Not doing**: Custom OAuth, additional providers
**Instead**: Clerk's built-in providers only
**Why**: Clerk handles this well already
**Revisit**: Never (Clerk is sufficient)

## Decision Framework

When evaluating whether to add a feature to MVP, ask:

1. **Is it required for a provider to get their first booking?** If no, defer.
2. **Will its absence prevent launch?** If no, defer.
3. **Can we validate the business without it?** If yes, defer.
4. **Is there a manual workaround?** If yes, use that instead.
5. **Will it add >1 week to timeline?** If yes, defer.

## Escalation Process

If someone requests a non-goal feature:

1. Reference this document
2. Document the request in BACKLOG.md
3. Tag for future phase
4. If critical, requires CEO + CTO approval to add to MVP

## Living Document

This document is updated when:
- New feature requests arise
- Scope creep is detected
- Phase planning begins
- Post-mortems reveal premature optimization

---

*Remember: The goal is to launch and learn, not to build the perfect platform.*

*Last updated: 2024-01-15*
*Next review: End of MVP phase*