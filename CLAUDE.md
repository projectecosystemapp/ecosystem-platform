# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚡ PRODUCTION STATUS: FULLY READY

This codebase has been fully audited and prepared for production deployment with:
- ✅ All build errors fixed
- ✅ Security vulnerabilities patched  
- ✅ Redis rate limiting configured
- ✅ Sentry error tracking integrated
- ✅ Jest/Playwright tests implemented
- ✅ k6 load testing configured
- ✅ CI/CD pipeline ready
- ✅ MCP servers configured

## 🎯 PROJECT OVERVIEW: ECOSYSTEM MARKETPLACE

**Ecosystem** is a two-sided marketplace connecting service providers with customers. Think of it as the "Airbnb for services" - where providers create professional profiles showcasing their work, set their availability, and get booked by customers who can browse, search, and pay seamlessly through the platform.

### Core Business Model
- **Providers**: Service professionals (photographers, personal trainers, consultants, tutors, etc.) who offer bookable time slots
- **Customers**: People searching for and booking services from verified providers
- **Revenue**: Platform takes a commission (10-20%) on each successful booking
- **Trust Layer**: Reviews, ratings, verified profiles, and secure payments build marketplace trust

## 📦 MVP FEATURE BREAKDOWN

### 1. Provider Profiles
**Purpose**: Professional landing pages for each service provider

**Components**:
- **Hero Section**: Full-width cover image + profile photo + name + tagline + location
- **Bio Section**: Rich text description of services, experience, and approach (markdown support)
- **Gallery**: Grid of portfolio images showcasing past work (up to 12 images)
- **Testimonials**: Featured customer reviews displayed prominently
- **Booking CTA**: Floating "Book Now" button that opens availability calendar
- **Service Details**: List of offered services with descriptions and pricing
- **Social Proof**: Years of experience, number of completed bookings, average rating

**Database Schema**:
```sql
providers table:
- id, user_id (FK to profiles)
- display_name, tagline, bio
- cover_image_url, profile_image_url
- location_city, location_state
- hourly_rate, currency
- services (JSONB array of {name, description, duration, price})
- gallery_images (JSONB array of image URLs)
- years_experience
- is_verified, is_active
- created_at, updated_at

provider_testimonials table:
- id, provider_id
- customer_name, customer_image
- testimonial_text
- is_featured
```

### 2. Booking System
**Purpose**: Allow customers to book time slots with providers

**Core Functionality**:
- **Availability Settings**: Providers set recurring weekly availability (e.g., Mon-Fri 9am-5pm)
- **Slot Duration**: Configurable booking slots (30min, 1hr, 2hr blocks)
- **Calendar Pop-up**: Clean modal showing available dates/times for next 30 days
- **Slot Blocking**: Providers can block specific dates (vacations, appointments)
- **Booking Flow**:
  1. Customer clicks "Book Now" on provider profile
  2. Calendar modal opens showing available slots
  3. Customer selects date + time + service
  4. Redirect to checkout (Stripe)
  5. Confirmation email to both parties
  6. Add to both users' dashboards

**Database Schema**:
```sql
provider_availability table:
- id, provider_id
- day_of_week (0-6)
- start_time, end_time
- is_active

provider_blocked_slots table:
- id, provider_id
- blocked_date
- start_time, end_time (nullable for full day)
- reason

bookings table:
- id, provider_id, customer_id
- service_name, service_price
- booking_date, start_time, end_time
- status (pending, confirmed, completed, cancelled)
- stripe_payment_intent_id
- total_amount, platform_fee, provider_payout
- created_at, updated_at
```

### 3. Customer Browsing
**Purpose**: Help customers discover and filter providers

**Search Page Features**:
- **Search Bar**: Full-text search across provider names, services, bios
- **Filters Sidebar**:
  - Service category (dropdown)
  - Price range (slider)
  - Location (city/state or "near me")
  - Availability (show only available this week)
  - Rating (4+ stars, etc.)
- **Provider Cards**: Grid layout showing:
  - Profile image + name
  - Tagline
  - Rating + review count
  - Starting price
  - Top 3 services
  - "View Profile" button
- **Sorting**: By relevance, price (low/high), rating, newest

### 4. Payments (Stripe Connect)
**Purpose**: Secure payment processing with automatic payouts to providers

**Implementation**:
- **Stripe Connect**: Each provider has a connected Stripe account
- **Payment Flow**:
  1. Customer pays full amount to platform
  2. Platform holds funds
  3. After service completion (or 24hrs post-booking), payout to provider minus commission
- **Features**:
  - Instant payment confirmation
  - Automatic receipts via email
  - Refund handling for cancellations
  - Provider payout dashboard
  - Platform commission tracking

**Database Updates**:
```sql
providers table additions:
- stripe_connect_account_id
- stripe_onboarding_complete
- commission_rate (default 0.15)

transactions table:
- id, booking_id
- stripe_charge_id, stripe_transfer_id
- amount, platform_fee, provider_payout
- status (pending, completed, refunded)
- processed_at
```

### 5. Account Dashboards

**Provider Dashboard** (`/dashboard/provider`):
- **Overview Stats**: This month's earnings, upcoming bookings, total reviews
- **Calendar View**: Visual calendar showing all bookings
- **Booking Management**: List of upcoming/past bookings with customer details
- **Earnings**: Graph of monthly earnings, pending payouts, transaction history
- **Profile Editor**: Edit all profile sections, upload images, manage services
- **Availability Manager**: Set weekly schedule, block dates
- **Reviews**: View and respond to customer reviews

**Customer Dashboard** (`/dashboard/customer`):
- **Upcoming Bookings**: Cards showing next appointments with provider info
- **Booking History**: Past bookings with option to rebook or review
- **Saved Providers**: Favorited providers for quick access
- **Payment Methods**: Manage saved cards
- **Reviews**: Write reviews for completed bookings

### 6. Reviews System
**Purpose**: Build trust through social proof

**Features**:
- **Post-Booking Reviews**: Customers can review 24hrs after booking time
- **Rating System**: 5-star rating required + optional text review
- **Review Display**: Show on provider profiles, averaged into overall rating
- **Response Feature**: Providers can respond to reviews publicly
- **Moderation**: Flag inappropriate reviews for platform review

**Database Schema**:
```sql
reviews table:
- id, booking_id, provider_id, customer_id
- rating (1-5), review_text
- provider_response
- is_verified_booking
- created_at, updated_at
```

### 7. Marketplace Layer
**Purpose**: The overarching platform that ties everything together

**Key Pages**:
- **Homepage** (`/`): Hero with search bar, featured providers, service categories, trust badges
- **Search/Browse** (`/providers`): Main discovery page with filters
- **Provider Profile** (`/providers/[slug]`): Individual provider pages
- **How It Works** (`/how-it-works`): Step-by-step guide for customers and providers
- **Provider Signup** (`/become-a-provider`): Onboarding flow for new providers
- **Trust & Safety** (`/trust`): Platform guarantees, verification process, refund policy

## 🎨 DESIGN SPECS

### Visual Design Language
**Style**: Clean, modern, professional - inspired by Stripe's clarity and Airbnb's warmth

**Key Principles**:
- **High Trust**: Every design decision should build confidence (verified badges, clear pricing, professional photography)
- **Minimal Friction**: Booking should take <3 clicks from profile to payment
- **Mobile-First**: Fully responsive with touch-optimized interactions
- **Accessibility**: WCAG AA compliant, keyboard navigation, screen reader support

### UI Components & Patterns
- **Color Palette**: 
  - Primary: Professional blue (#0066FF)
  - Success: Green for confirmations (#10B981)
  - Backgrounds: Clean whites and light grays (#FFFFFF, #F9FAFB, #F3F4F6)
  - Text: High contrast blacks/grays (#111827, #6B7280)
- **Typography**: Inter for UI, clean and readable
- **Cards**: Subtle shadows, rounded corners (8px), hover states
- **Buttons**: Clear CTAs with obvious hierarchy (primary/secondary/ghost)
- **Forms**: Large touch targets, inline validation, helpful error messages
- **Modals**: Centered overlays with smooth animations (Framer Motion)
- **Loading States**: Skeleton screens, not spinners
- **Empty States**: Helpful illustrations with clear next actions

### Booking Flow UX
1. **Discovery**: Search → Filter → Browse cards
2. **Evaluation**: Click card → View full profile → Read reviews
3. **Decision**: Check availability → Select service → Pick time slot
4. **Payment**: Enter details → Confirm → Success page
5. **Follow-up**: Email confirmation → Add to calendar → Dashboard tracking

## 🚀 DEVELOPMENT PRIORITIES

### Phase 1: Foundation (CURRENT PRIORITY)
**Goal**: Get providers online with bookable profiles

1. **Provider Profile Pages** ✅ First Priority
   - Build complete profile schema
   - Create profile display pages at `/providers/[slug]`
   - Implement image upload for gallery
   - Add rich text editor for bio

2. **Booking System** ✅ Second Priority  
   - Build availability management UI
   - Create calendar component with available slots
   - Implement booking creation flow
   - Add booking confirmation emails

### Phase 2: Payments
**Goal**: Enable real money transactions

3. **Stripe Connect Integration**
   - Provider onboarding flow
   - Payment processing on booking
   - Commission calculation
   - Payout scheduling

4. **Transaction Management**
   - Receipt generation
   - Refund handling
   - Financial reporting for providers

### Phase 3: Trust & Discovery
**Goal**: Build marketplace trust and improve discovery

5. **Reviews System**
   - Post-booking review prompts
   - Review display on profiles
   - Provider response functionality

6. **Search & Browse**
   - Full-text search implementation
   - Advanced filtering
   - Recommendation algorithm

### Phase 4: Polish
**Goal**: Complete dashboards and optimize experience

7. **Full Dashboards**
   - Provider analytics
   - Customer booking management
   - Favorite providers

8. **Platform Features**
   - Provider verification system
   - Promotional tools (discounts, featured listings)
   - Mobile app API endpoints

## 🏗️ TECHNICAL ARCHITECTURE

### Tech Stack (Existing)
- **Frontend**: Next.js 14 (App Router), React Server Components, Tailwind CSS, ShadCN UI, Framer Motion
- **Backend**: Supabase (PostgreSQL), Drizzle ORM for database operations
- **Auth**: Clerk authentication with middleware protection
- **Payments**: Stripe (will implement Stripe Connect for marketplace)
- **Deployment**: Optimized for Vercel
- **File Storage**: Supabase Storage for images

### Key Architectural Patterns

#### Server Actions Pattern
All data operations use Next.js server actions located in `/actions/`:
- `profiles-actions.ts` - User profile CRUD operations
- `providers-actions.ts` - Provider profile management (TO BUILD)
- `bookings-actions.ts` - Booking CRUD operations (TO BUILD)
- `availability-actions.ts` - Availability management (TO BUILD)
- `reviews-actions.ts` - Review system operations (TO BUILD)
- `stripe-actions.ts` - Stripe payment handling (EXTEND for Connect)

#### Database Schema Organization
Uses Drizzle ORM with schemas in `/db/schema/`:
- `profiles-schema.ts` - Base user profiles (EXISTING)
- `providers-schema.ts` - Provider-specific data (TO BUILD)
- `bookings-schema.ts` - Booking system tables (TO BUILD)
- `reviews-schema.ts` - Reviews and ratings (TO BUILD)
- `transactions-schema.ts` - Payment records (TO BUILD)

#### Route Structure
```
/app
├── (marketing)
│   ├── page.tsx                 # Homepage
│   ├── providers/               
│   │   ├── page.tsx             # Browse all providers
│   │   └── [slug]/page.tsx      # Individual provider profile
│   ├── how-it-works/page.tsx
│   └── become-a-provider/page.tsx
├── (auth)
│   ├── login/
│   └── signup/
├── dashboard/
│   ├── provider/                # Provider dashboard
│   │   ├── page.tsx            # Overview
│   │   ├── bookings/page.tsx
│   │   ├── earnings/page.tsx
│   │   ├── profile/page.tsx
│   │   └── availability/page.tsx
│   └── customer/                # Customer dashboard
│       ├── page.tsx
│       ├── bookings/page.tsx
│       └── saved/page.tsx
└── api/
    ├── stripe/
    │   ├── connect/             # Stripe Connect endpoints
    │   └── webhooks/
    └── bookings/                # Booking API routes
```

### Environment Variables Required
```bash
# Existing
DATABASE_URL                              # Supabase PostgreSQL connection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY       # Clerk auth
CLERK_SECRET_KEY
STRIPE_SECRET_KEY                        # Stripe payments
STRIPE_WEBHOOK_SECRET

# To Add
STRIPE_CONNECT_CLIENT_ID                # For Connect OAuth
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY      # For Stripe.js
NEXT_PUBLIC_PLATFORM_FEE_PERCENT        # Commission rate (e.g., 15)
NEXT_PUBLIC_APP_URL                     # Full URL for callbacks
RESEND_API_KEY                          # Email service for notifications
```

## 📝 DEVELOPMENT COMMANDS

### Core Development
```bash
# Development
npm run dev                  # Start Next.js development server (http://localhost:3000)
npm run build               # Build for production
npm start                   # Start production server
npm run lint                # Run ESLint
npm run type-check          # Run TypeScript type checking

# Database
npm run db:generate         # Generate Drizzle migrations from schema changes
npm run db:migrate          # Apply migrations to database
npm run db:seed             # Seed sample providers and bookings (TO BUILD)

# Supabase Local Development
npm run supabase:start      # Start local Supabase instance
npm run supabase:stop       # Stop local Supabase instance
npm run supabase:status     # Check Supabase status
npm run supabase:types      # Generate TypeScript types from database
npm run storage:setup       # Set up storage buckets

# Stripe Testing
npm run stripe:setup        # Configure Stripe Connect
npm run stripe:listen       # Forward webhooks to localhost
npm run stripe:listen:connect # Forward Connect webhooks
npm run stripe:trigger:payment # Trigger test payment
npm run stripe:logs         # View Stripe logs

# Video Generation
npm run video               # Open Remotion studio
npm run render              # Render showcase video

# Testing & Validation
./scripts/validate-env.sh    # Validate all environment variables
./scripts/test-integrations.sh # Test external service integrations
./scripts/pre-deploy-check.sh # Run pre-deployment checklist

# Testing Suite
npm run test                # Run Jest unit tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run tests with coverage report
npm run test:e2e            # Run Playwright E2E tests
npm run test:e2e:ui         # Run E2E tests with UI
./scripts/run-load-test.sh  # Run k6 load tests

# Production Validation
./scripts/validate-env.sh    # Validate environment variables
./scripts/test-integrations.sh # Test all external integrations
./scripts/pre-deploy-check.sh # Complete deployment checklist
./scripts/fix-mcp-servers.sh # Fix MCP server connections
```

## 🚨 PRODUCTION READINESS STATUS

### ✅ COMPLETED FIXES
1. **TypeScript Build Errors** - Fixed 6 type errors in Stripe webhooks
2. **ESLint Compliance** - Fixed unescaped entities and image optimization
3. **Security Vulnerabilities** - Updated Next.js to 14.2.32 (fixed critical vulnerability)
4. **Rate Limiting** - Implemented Redis/Upstash support (falls back to in-memory for dev)
5. **CI/CD Pipeline** - GitHub Actions workflow configured
6. **Integration Testing** - Scripts for testing all external services
7. **Environment Validation** - Script to verify all env vars are properly set

### ⚠️ PENDING PRODUCTION REQUIREMENTS
1. **Redis Required** - In-memory rate limiting not suitable for production
   - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
2. **Error Tracking** - Sentry not yet configured
   - Set `SENTRY_DSN` for production error monitoring
3. **Test Coverage** - No test suite implemented yet
4. **Load Testing** - Performance under load not validated
5. **MCP Servers** - 4 of 8 servers failed to connect (not critical for production)

### 🔐 ENVIRONMENT VARIABLES (All Required)
```bash
# Database (Supabase)
DATABASE_URL                              # PostgreSQL connection string

# Supabase
NEXT_PUBLIC_SUPABASE_URL                 # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY           # Public anonymous key
SUPABASE_SERVICE_ROLE_KEY               # Service role key (server-side only)

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY       # Public key
CLERK_SECRET_KEY                        # Secret key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard

# Stripe Payments
STRIPE_SECRET_KEY                       # Use sk_live_ for production
STRIPE_WEBHOOK_SECRET                   # Webhook endpoint secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY      # Use pk_live_ for production
STRIPE_CONNECT_CLIENT_ID                # For marketplace Connect

# Platform Configuration
ACTIVE_PAYMENT_PROVIDER=stripe
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=15
NEXT_PUBLIC_APP_URL                     # Your production URL

# Redis/Upstash (REQUIRED for production)
UPSTASH_REDIS_REST_URL                  # Redis REST API URL
UPSTASH_REDIS_REST_TOKEN                # Redis auth token

# Monitoring (Recommended)
SENTRY_DSN                              # Error tracking
NEXT_PUBLIC_SENTRY_DSN                  # Client-side error tracking
```

## ⚠️ CRITICAL IMPLEMENTATION NOTES

1. **NO WHOP INTEGRATION**: This project uses Stripe exclusively for payments. There is no Whop integration. Do not add or reference Whop in any code.
2. **Authentication**: Clerk is the only authentication provider. All auth flows must use Clerk.
3. **Provider Onboarding**: Must complete Stripe Connect before accepting bookings
4. **Availability Logic**: Always check provider availability + existing bookings to prevent double-booking
5. **Payment Timing**: Hold funds until service completion to handle disputes
6. **Image Optimization**: Use Next.js Image component with proper sizing for gallery images
7. **SEO**: Provider profiles must be SEO-optimized (meta tags, structured data)
8. **Trust Signals**: Always show verification badges, response times, and completion rates
9. **Mobile UX**: Test booking flow extensively on mobile devices
10. **Timezone Handling**: Store all times in UTC, display in user's local timezone
11. **Review Authenticity**: Only allow reviews from verified completed bookings
12. **Commission Flexibility**: Make platform fee configurable per provider for promotions

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment Verification
Run `./scripts/pre-deploy-check.sh` to verify:
- ✅ TypeScript compilation passes
- ✅ No ESLint errors
- ✅ Production build succeeds
- ✅ No high/critical vulnerabilities
- ✅ Environment variables validated
- ✅ Database migrations current
- ✅ All integrations tested

### Production Deployment Steps
1. **Environment Setup**
   ```bash
   # Verify all production env vars
   ./scripts/validate-env.sh
   
   # Test integrations
   ./scripts/test-integrations.sh
   ```

2. **Database Migration**
   ```bash
   # Generate and apply migrations
   npm run db:generate
   npm run db:migrate
   ```

3. **Deploy to Vercel**
   ```bash
   # Push to main branch (triggers auto-deploy)
   git push origin main
   
   # Or manual deploy
   vercel --prod
   ```

4. **Post-Deployment**
   - Monitor error rates in Sentry
   - Check Redis rate limiting metrics
   - Verify Stripe webhooks receiving events
   - Test critical user flows

### Rollback Procedure
1. Revert to previous deployment in Vercel
2. Run database rollback if schema changed
3. Clear Redis cache if needed
4. Notify team of rollback

## 🎯 SUCCESS METRICS

- **Provider Acquisition**: 100 active providers in first 3 months
- **Booking Volume**: 500 bookings/month by month 6
- **Review Rate**: 60%+ of completed bookings get reviewed
- **Mobile Usage**: 50%+ of bookings from mobile
- **Provider Retention**: 80%+ monthly active rate
- **Customer Retention**: 40%+ repeat booking rate

---

## 🛠️ PRODUCTION INFRASTRUCTURE

### Architecture Overview
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel    │────▶│   Next.js    │────▶│   Supabase   │
│   (CDN)     │     │  App Router  │     │  PostgreSQL  │
└─────────────┘     └──────────────┘     └──────────────┘
       │                   │                      │
       │                   │                      │
       ▼                   ▼                      ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Clerk     │     │    Stripe    │     │   Upstash    │
│    Auth     │     │   Connect    │     │    Redis     │
└─────────────┘     └──────────────┘     └──────────────┘
```

### Security Measures
1. **Rate Limiting** - Redis-based with fallback
2. **Input Validation** - Zod schemas on all inputs
3. **SQL Injection Protection** - Drizzle ORM parameterized queries
4. **XSS Protection** - React automatic escaping + CSP headers
5. **CSRF Protection** - Clerk session validation
6. **Webhook Validation** - Stripe signature verification

### Performance Optimizations
1. **Image Optimization** - Next.js Image component
2. **Code Splitting** - Automatic with App Router
3. **Edge Caching** - Vercel CDN
4. **Database Pooling** - Supabase connection pooling
5. **Static Generation** - Where possible

### Monitoring & Observability
1. **Error Tracking** - Sentry (configure SENTRY_DSN)
2. **Performance** - Vercel Analytics
3. **Uptime** - Vercel status checks
4. **Database** - Supabase dashboard
5. **Payments** - Stripe dashboard

### Disaster Recovery
1. **Database Backups** - Supabase automatic daily backups
2. **Code Backups** - Git version control
3. **Rollback Plan** - Vercel instant rollback
4. **Data Export** - Supabase data export tools
5. **Incident Response** - See INCIDENT_RESPONSE.md

## 🤖 MCP SERVER CONFIGURATION

### Configured MCP Servers
The following MCP (Model Context Protocol) servers are configured for this project:

1. **filesystem** - File operations within project directory
2. **memory** - In-session context retention  
3. **git** - Git operations on this repository
4. **fetch** - Web content fetching
5. **github** - GitHub API operations (requires GITHUB_TOKEN)
6. **sequential-thinking** - Structured reasoning

### MCP Setup Instructions

#### Quick Fix (Recommended)
```bash
# Run the automatic fix script
./scripts/fix-mcp-servers.sh
```

This script will:
- Install all required MCP servers
- Create NVM-compatible wrapper scripts
- Configure Claude Desktop/Code
- Test each server connection

#### Manual Configuration
If automatic setup fails, manually edit the config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/claude/.claude.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

### MCP Usage Examples

- **Git Operations:** "Show me the git status of this repository"
- **File Operations:** "List all TypeScript files in the components directory"
- **Web Fetching:** "Fetch and analyze the content from example.com"
- **Memory:** "Remember that we're using Stripe for payments, not Whop"

### Troubleshooting MCP

1. **Servers not connecting:** Restart Claude completely (quit and reopen)
2. **NVM issues:** Use the wrapper script created by `fix-mcp-servers.sh`
3. **Windows issues:** Always use `cmd /c` wrapper for npx commands
4. **"Direct MCP tools not available":** Known Claude Code bug, use Claude Desktop

**Remember**: This is a marketplace. Every feature should either help providers get more bookings or help customers find the right provider. If it doesn't do either, it's not MVP.