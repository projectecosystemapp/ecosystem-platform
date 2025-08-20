# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

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

# Video (Remotion)
npm run video               # Open Remotion studio
npm run render              # Render video to out/video.mp4
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React Server Components, Tailwind CSS, ShadCN UI, Framer Motion
- **Backend**: Supabase (PostgreSQL), Drizzle ORM for database operations
- **Auth**: Clerk authentication with middleware protection
- **Payments**: Dual payment system supporting both Stripe and Whop
- **Deployment**: Optimized for Vercel

### Key Architectural Patterns

#### Server Actions Pattern
All data operations use Next.js server actions located in `/actions/`:
- `profiles-actions.ts` - User profile CRUD operations
- `stripe-actions.ts` - Stripe payment handling
- `whop-actions.ts` - Whop payment and profile claiming
- `credits-actions.ts` - Credit system management
- `pending-profiles-actions.ts` - Pre-registration profile handling

#### Database Schema
Uses Drizzle ORM with schemas in `/db/schema/`:
- `profiles-schema.ts` - Main user profiles with plan/credit tracking
- `pending-profiles-schema.ts` - Profiles created before user registration (frictionless payment flow)

#### Authentication Flow
1. Clerk middleware in `middleware.ts` protects `/dashboard/*` routes
2. Root `layout.tsx` automatically creates/claims profiles on user authentication
3. Handles frictionless payment flows where users pay before registering

#### Payment Integration
Dual payment provider support with webhook handlers:
- `/api/stripe/webhooks` - Stripe webhook processing
- `/api/whop/webhooks` - Whop webhook with utility functions for:
  - Payment processing (`payment-handlers.ts`)
  - Frictionless payments (`frictionless-payment-handlers.ts`)
  - Membership management (`membership-handlers.ts`)

#### Component Structure
- `/components/ui/` - ShadCN UI components (auto-generated, don't modify directly)
- `/app/(marketing)/components/` - Marketing page animated components
- `/components/` - Shared components like headers, sidebars, popups

### Environment Variables Required
```bash
DATABASE_URL                              # Supabase PostgreSQL connection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY       # Clerk auth
CLERK_SECRET_KEY
STRIPE_SECRET_KEY                        # Stripe payments
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_*       # Payment links
```

### Important Implementation Notes

1. **Profile Creation**: Handled automatically in root layout - checks for existing profile, claims pending profiles by email, or creates new profile

2. **Webhook Security**: Always return 200 status to payment providers to prevent retries, even on errors

3. **Frictionless Payments**: System supports users paying before registration through pending profiles that get claimed on signup

4. **Credit System**: Built-in credit tracking in profiles table with increment/decrement actions

5. **File Naming**: Follow kebab-case for all files (e.g., `profile-actions.ts`, `payment-handler.ts`)