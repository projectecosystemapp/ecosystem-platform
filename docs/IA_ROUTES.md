# Information Architecture & Routes

## Route Tree & Rendering Strategies

### Public Routes (Marketing)

```
/ (homepage)
├── Rendering: ISR (15 minutes)
├── Owner: Marketing Team
├── Data: Featured providers, service categories, platform stats
├── SEO: Critical - meta tags, structured data, og:image
└── Cache: CDN edge cache

/providers
├── Rendering: SSR with search params
├── Owner: Search Team
├── Data: Provider listings with filters, facets
├── SEO: Critical - pagination meta tags, canonical URLs
└── Cache: Short-lived (5 min) for search results

/providers/[slug]
├── Rendering: ISR (1 hour) 
├── Owner: Profile Team
├── Data: Provider profile, services, reviews, availability preview
├── SEO: Critical - rich snippets, breadcrumbs, local business schema
└── Cache: CDN + database query cache

/how-it-works
├── Rendering: Static (SSG)
├── Owner: Marketing Team
├── Data: None (static content)
├── SEO: High - FAQ schema, content keywords
└── Cache: Permanent until redeploy

/become-a-provider
├── Rendering: Static (SSG)
├── Owner: Growth Team
├── Data: None (static content)
├── SEO: High - conversion landing page
└── Cache: Permanent until redeploy

/trust-and-safety
├── Rendering: Static (SSG)
├── Owner: Trust Team
├── Data: Platform statistics (ISR)
├── SEO: Medium - trust signals
└── Cache: Permanent static, ISR for stats

/help
├── Rendering: Static (SSG)
├── Owner: Support Team
├── Data: Help articles (CMS)
├── SEO: Medium - support content indexing
└── Cache: Permanent until redeploy

/pricing
├── Rendering: Static (SSG)
├── Owner: Product Team
├── Data: Pricing tiers, commission rates
├── SEO: High - pricing comparison keywords
└── Cache: Permanent until redeploy
```

### Authentication Routes

```
/login
├── Rendering: CSR (Clerk components)
├── Owner: Auth Team
├── Data: None
├── SEO: None - noindex
└── Cache: None

/signup
├── Rendering: CSR (Clerk components)
├── Owner: Auth Team
├── Data: None
├── SEO: None - noindex
└── Cache: None

/signup/provider
├── Rendering: CSR (Clerk + onboarding flow)
├── Owner: Growth Team
├── Data: Onboarding steps, form data
├── SEO: None - noindex
└── Cache: None

/verify-email
├── Rendering: CSR
├── Owner: Auth Team
├── Data: Verification token
├── SEO: None - noindex
└── Cache: None
```

### Dashboard Routes (Protected)

```
/dashboard
├── Rendering: SSR with auth
├── Owner: Dashboard Team
├── Data: User role redirect logic
├── SEO: None - noindex, protected
└── Cache: None

/dashboard/provider
├── /overview
│   ├── Rendering: SSR
│   ├── Owner: Provider Team
│   ├── Data: Stats, upcoming bookings, recent activity
│   └── Cache: User-specific, 1 minute
│
├── /bookings
│   ├── Rendering: SSR with client hydration
│   ├── Owner: Bookings Team
│   ├── Data: Booking list, calendar view
│   └── Cache: Real-time updates via websocket
│
├── /calendar
│   ├── Rendering: CSR (interactive calendar)
│   ├── Owner: Bookings Team
│   ├── Data: Availability slots, bookings
│   └── Cache: Optimistic updates
│
├── /earnings
│   ├── Rendering: SSR
│   ├── Owner: Finance Team
│   ├── Data: Transaction history, payout schedule
│   └── Cache: 5 minutes for completed transactions
│
├── /profile/edit
│   ├── Rendering: SSR with forms
│   ├── Owner: Profile Team
│   ├── Data: Provider profile data
│   └── Cache: None (live editing)
│
├── /services
│   ├── Rendering: SSR
│   ├── Owner: Services Team
│   ├── Data: Service catalog, pricing
│   └── Cache: On mutation invalidation
│
├── /availability
│   ├── Rendering: CSR (complex UI)
│   ├── Owner: Bookings Team
│   ├── Data: Weekly schedule, blocked dates
│   └── Cache: Optimistic updates
│
├── /reviews
│   ├── Rendering: SSR
│   ├── Owner: Reviews Team
│   ├── Data: Review list, responses
│   └── Cache: 10 minutes
│
└── /settings
    ├── Rendering: SSR
    ├── Owner: Settings Team
    ├── Data: Account settings, payment methods
    └── Cache: None

/dashboard/customer
├── /overview
│   ├── Rendering: SSR
│   ├── Owner: Customer Team
│   ├── Data: Upcoming bookings, favorites
│   └── Cache: User-specific, 1 minute
│
├── /bookings
│   ├── Rendering: SSR
│   ├── Owner: Bookings Team
│   ├── Data: Booking history, upcoming
│   └── Cache: 5 minutes for past bookings
│
├── /bookings/[id]
│   ├── Rendering: SSR
│   ├── Owner: Bookings Team
│   ├── Data: Booking details, provider info
│   └── Cache: Until booking status change
│
├── /saved-providers
│   ├── Rendering: SSR
│   ├── Owner: Customer Team
│   ├── Data: Favorited providers
│   └── Cache: On mutation invalidation
│
├── /reviews
│   ├── Rendering: SSR
│   ├── Owner: Reviews Team
│   ├── Data: Written reviews, pending reviews
│   └── Cache: 10 minutes
│
├── /payment-methods
│   ├── Rendering: CSR (Stripe Elements)
│   ├── Owner: Payments Team
│   ├── Data: Saved cards, billing address
│   └── Cache: None (PCI compliance)
│
└── /settings
    ├── Rendering: SSR
    ├── Owner: Settings Team
    ├── Data: Profile, notifications, privacy
    └── Cache: None
```

### Booking Flow Routes

```
/book/[provider-slug]
├── Rendering: CSR (interactive flow)
├── Owner: Bookings Team
├── Data: Provider availability, services
├── SEO: None - funnel step
└── Cache: Availability cached 1 minute

/book/[provider-slug]/select-service
├── Rendering: CSR
├── Owner: Bookings Team
├── Data: Service details, pricing
├── SEO: None
└── Cache: Service data cached

/book/[provider-slug]/select-time
├── Rendering: CSR (calendar component)
├── Owner: Bookings Team
├── Data: Real-time availability
├── SEO: None
└── Cache: Polling for updates

/book/[provider-slug]/checkout
├── Rendering: CSR (Stripe)
├── Owner: Payments Team
├── Data: Booking summary, payment form
├── SEO: None
└── Cache: None (security)

/book/confirmation/[booking-id]
├── Rendering: SSR
├── Owner: Bookings Team
├── Data: Booking confirmation details
├── SEO: None - noindex
└── Cache: Permanent for booking
```

### API Routes

```
/api/providers
├── Method: GET
├── Owner: API Team
├── Data Source: PostgreSQL (indexed)
├── Cache: Redis 5 minutes
└── Rate Limit: 100/minute

/api/providers/[slug]
├── Method: GET
├── Owner: API Team
├── Data Source: PostgreSQL
├── Cache: Redis 1 hour
└── Rate Limit: 100/minute

/api/providers/[slug]/availability
├── Method: GET
├── Owner: Bookings Team
├── Data Source: PostgreSQL + Redis
├── Cache: Redis 1 minute
└── Rate Limit: 200/minute

/api/bookings
├── Method: POST
├── Owner: Bookings Team
├── Data Source: PostgreSQL transaction
├── Cache: None
└── Rate Limit: 10/minute per user

/api/bookings/[id]
├── Methods: GET, PATCH, DELETE
├── Owner: Bookings Team
├── Data Source: PostgreSQL
├── Cache: Invalidate on mutation
└── Rate Limit: 50/minute per user

/api/reviews
├── Methods: GET, POST
├── Owner: Reviews Team
├── Data Source: PostgreSQL
├── Cache: CDN for GET
└── Rate Limit: 20/minute per user

/api/webhooks/stripe
├── Method: POST
├── Owner: Payments Team
├── Data Source: Stripe webhook
├── Cache: None
└── Rate Limit: None (Stripe IPs only)

/api/webhooks/clerk
├── Method: POST
├── Owner: Auth Team
├── Data Source: Clerk webhook
├── Cache: None
└── Rate Limit: None (Clerk IPs only)

/api/search
├── Method: GET
├── Owner: Search Team
├── Data Source: PostgreSQL FTS / Algolia
├── Cache: Edge cache 5 minutes
└── Rate Limit: 100/minute

/api/upload
├── Method: POST
├── Owner: Media Team
├── Data Source: Supabase Storage
├── Cache: None
└── Rate Limit: 10/minute per user
```

## Data Requirements by Route Type

### Provider Profile Pages
- Provider details (name, bio, location, verification status)
- Service catalog with pricing
- Gallery images (lazy loaded)
- Reviews aggregate (rating, count)
- Recent reviews (paginated)
- Availability preview (next 7 days)
- Response time statistics
- Completion rate
- Years of experience

### Search/Browse Pages
- Faceted search filters
- Provider cards (optimized payload)
- Pagination metadata
- Search suggestions
- Category taxonomy
- Location data
- Price ranges
- Availability indicators

### Booking Flow
- Real-time availability slots
- Service details and duration
- Pricing calculations
- Provider policies (cancellation, etc.)
- Payment method options
- Booking summary
- Terms and conditions

### Dashboard Pages
- User-specific data only
- Aggregated statistics
- Transaction history
- Upcoming events
- Notification preferences
- Account settings

## SEO Requirements

### Critical SEO Pages
1. **Provider Profiles** - Must have:
   - Unique meta title/description
   - Local business schema
   - Review aggregate schema
   - Breadcrumb schema
   - Open Graph images
   - Canonical URLs

2. **Search/Browse** - Must have:
   - Dynamic meta based on filters
   - Pagination rel=prev/next
   - Faceted navigation best practices
   - Sitemap inclusion

3. **Homepage** - Must have:
   - Organization schema
   - Service catalog schema
   - FAQ schema
   - Rich snippets

### Technical SEO
- XML sitemap generation (daily)
- Robots.txt configuration
- Structured data validation
- Core Web Vitals optimization
- Mobile-first indexing ready
- International targeting (hreflang)

## Performance Targets

### Route Performance SLAs
- Homepage: <1s FCP, <2.5s LCP
- Provider profiles: <1.5s FCP, <3s LCP
- Search results: <2s FCP, <3.5s LCP
- Dashboard: <2s FCP, <4s LCP
- API endpoints: <200ms p50, <500ms p95

### Caching Strategy
- Static content: CDN edge (CloudFlare)
- Dynamic content: Redis cache
- Database queries: Query result cache
- API responses: HTTP cache headers
- User sessions: In-memory store