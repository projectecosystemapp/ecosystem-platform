# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Testing (TO ADD)
npm run test                # Run unit tests
npm run test:e2e            # Run end-to-end tests
```

## ⚠️ CRITICAL IMPLEMENTATION NOTES

1. **Provider Onboarding**: Must complete Stripe Connect before accepting bookings
2. **Availability Logic**: Always check provider availability + existing bookings to prevent double-booking
3. **Payment Timing**: Hold funds until service completion to handle disputes
4. **Image Optimization**: Use Next.js Image component with proper sizing for gallery images
5. **SEO**: Provider profiles must be SEO-optimized (meta tags, structured data)
6. **Trust Signals**: Always show verification badges, response times, and completion rates
7. **Mobile UX**: Test booking flow extensively on mobile devices
8. **Timezone Handling**: Store all times in UTC, display in user's local timezone
9. **Review Authenticity**: Only allow reviews from verified completed bookings
10. **Commission Flexibility**: Make platform fee configurable per provider for promotions

## 🎯 SUCCESS METRICS

- **Provider Acquisition**: 100 active providers in first 3 months
- **Booking Volume**: 500 bookings/month by month 6
- **Review Rate**: 60%+ of completed bookings get reviewed
- **Mobile Usage**: 50%+ of bookings from mobile
- **Provider Retention**: 80%+ monthly active rate
- **Customer Retention**: 40%+ repeat booking rate

---

**Remember**: This is a marketplace. Every feature should either help providers get more bookings or help customers find the right provider. If it doesn't do either, it's not MVP.