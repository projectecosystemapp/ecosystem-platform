# Ecosystem Platform - GitHub Copilot Instructions

**ALWAYS follow these instructions first.** Only search for additional context or run bash commands if the information below is incomplete or found to be incorrect.

## Project Overview

Ecosystem Platform is a Next.js 14 marketplace connecting service providers with customers. Built with TypeScript, Supabase, Clerk authentication, Stripe Connect payments, and comprehensive AI agent integration.

## Working Effectively

### Essential Setup Commands
Run these commands in order for initial setup:

```bash
# Verify Node.js version (requires ≥18, tested with v20.19.4)
node -v

# Install dependencies (takes ~21 seconds - NEVER CANCEL)
npm install

# Copy environment template 
cp .env.example .env.local
# Edit .env.local with required credentials (see Environment Setup section)
```

### Development Workflow Commands

**CRITICAL BUILD STATUS**: The build currently fails due to TypeScript compilation errors (308 errors across 51 files). The codebase appears to be work-in-progress.

```bash
# Validate code quality (works reliably)
npm run lint                    # ~10 seconds - WORKS (warnings only)

# TypeScript validation (currently failing)
npm run type-check              # ~26 seconds - FAILS (308 TypeScript errors)

# Build application (currently failing)
npm run build                   # ~90 seconds - FAILS due to TypeScript errors

# Run unit tests (partial success)
npm run test                    # ~9 seconds - PARTIAL (some pass, some fail)

# Run E2E tests (requires valid Clerk setup)
npm run test:e2e                # ~2 minutes - FAILS without proper auth setup
```

**TIMEOUT WARNINGS:**
- **NEVER CANCEL** npm install (21+ seconds) 
- **NEVER CANCEL** npm run build (90+ seconds, set timeout to 120+ seconds)
- **NEVER CANCEL** npm run test:e2e (120+ seconds, set timeout to 180+ seconds)

### Database Operations

```bash
# Local Supabase setup (requires Supabase CLI installation)
npx supabase start              # Start local PostgreSQL database
npx supabase status             # Check if running
npx supabase stop               # Stop when done

# Schema management with Drizzle ORM
npm run db:generate             # Generate migrations (interactive prompts)
npm run db:migrate              # Apply migrations to database  
npm run db:push                 # Push schema directly (dev only)
npm run db:studio               # Open visual database manager

# Environment validation
chmod +x scripts/validate-env.sh && ./scripts/validate-env.sh  # ~0.1 seconds
```

### Development Server

```bash
# Start development server (starts in ~2-3 seconds)
npm run dev                     # Navigate to http://localhost:3000

# Required for payment testing (requires Stripe CLI installation)
npm run stripe:listen           # Forward Stripe webhooks to localhost
# Note: Stripe CLI not included in repository, must be installed separately
```

## Environment Setup

### Required Services & Credentials

Create `.env.local` with these required variables:

```bash
# Database (Supabase) - REQUIRED
DATABASE_URL=postgresql://user:pass@host:port/database
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Authentication (Clerk) - REQUIRED  
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup

# Payments (Stripe) - REQUIRED for payment features
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Platform Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
ACTIVE_PAYMENT_PROVIDER=stripe
NEXT_PUBLIC_PLATFORM_FEE_PERCENT=10
NEXT_PUBLIC_GUEST_SURCHARGE_PERCENT=10
```

### Optional Production Services

```bash
# Rate Limiting (Upstash Redis) - Recommended for production
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Error Monitoring (Sentry) - Recommended for production  
NEXT_PUBLIC_SENTRY_DSN=https://xxx.ingest.sentry.io
SENTRY_DSN=https://xxx.ingest.sentry.io
```

## Current Limitations & Workarounds

### Build Issues
- **TypeScript Compilation**: Build fails with 308 type errors across 51 files
- **Workaround**: Use `npm run lint` for code quality validation instead of full build
- **Status**: Code appears to be work-in-progress with incomplete type definitions

### Testing Issues  
- **Unit Tests**: Partially working - some tests pass, some fail due to missing environment variables
- **E2E Tests**: Require valid Clerk authentication keys to run successfully
- **Workaround**: Focus on linting and manual testing for now

### Development Recommendations
1. **Always run `npm run lint`** before committing - this is the most reliable validation
2. **Use fake environment values** for build testing (see .env.local.example)
3. **Test manually in browser** rather than relying on automated tests currently
4. **Focus on component development** - the UI framework (ShadCN + Tailwind) works well

## Validation Scenarios

After making changes, ALWAYS run these validation steps:

### Code Quality Validation
```bash
# Primary validation (always works)
npm run lint                    # Must pass - fix all errors

# Secondary validation (currently failing but attempt anyway)
npm run type-check              # May fail due to existing issues

# Test specific components if possible
npm run test -- --testPathPattern=path/to/your/test
```

### Manual Testing Scenarios

**CRITICAL**: Since automated testing has limitations, perform these manual validations:

1. **Basic Application Startup**:
   - Run `npm run dev`
   - Navigate to `http://localhost:3000`
   - Verify home page loads without console errors

2. **Component Testing**:
   - Test any new UI components in isolation
   - Verify responsive design works
   - Check accessibility with screen reader

3. **Authentication Flow** (if Clerk configured):
   - Test login/signup flows
   - Verify protected routes work correctly

4. **Database Operations** (if Supabase configured):
   - Test CRUD operations through the UI
   - Verify data persistence

## Project Structure

```
app/                    # Next.js 14 App Router pages
├── api/               # API routes and webhooks
├── (authenticated)/   # Protected routes requiring login
└── (public)/          # Public routes

components/            # React components (ShadCN-based)
├── ui/               # Base UI components
├── marketplace/      # Marketplace-specific components
└── provider/         # Provider dashboard components

db/                   # Database layer
├── schema/           # Drizzle ORM table definitions
├── queries/          # Reusable database queries
└── migrations/       # Generated SQL migrations

lib/                  # Utility libraries
├── auth.ts          # Authentication helpers
├── stripe.ts        # Stripe payment integration
└── fees.ts          # Fee calculation logic

actions/              # Next.js Server Actions
```

### Key File Patterns
- Components: `components/category/component-name.tsx`
- Server Actions: `actions/category-actions.ts`
- Database Schemas: `db/schema/table-name-schema.ts`
- Database Queries: `db/queries/table-name-queries.ts`

## Agent System Integration

This platform includes an AI agent orchestration system:

```bash
# Agent system commands
curl http://localhost:3000/api/agents/status    # Check agent health
curl http://localhost:3000/api/agents/tasks     # View active tasks

# Monitor via dashboard (when running)
# Navigate to: http://localhost:3000/admin/agents
```

## Common Tasks & Solutions

| Task | Command | Expected Time | Status |
|------|---------|---------------|---------|
| Install dependencies | `npm install` | ~21 seconds | ✅ Works |
| Lint code | `npm run lint` | ~10 seconds | ✅ Works (warnings only) |
| Type check | `npm run type-check` | ~26 seconds | ❌ Fails (308 errors) |
| Build application | `npm run build` | ~90 seconds | ❌ Fails (TypeScript errors) |
| Run unit tests | `npm run test` | ~9 seconds | ⚠️ Partial |
| Run E2E tests | `npm run test:e2e` | ~2 minutes | ❌ Needs auth setup |
| Start dev server | `npm run dev` | ~3 seconds | ✅ Works |

## Security & Best Practices

### Required Before Commits
```bash
npm run lint                    # Must pass - fix all errors
npm run type-check              # Attempt, document if failing
```

### Security Features
- CSRF protection on all Server Actions
- Rate limiting via Upstash Redis (or in-memory fallback)  
- Input sanitization using Zod schemas
- Zero-trust authentication model

### Payment Testing
```bash
# Test card number for Stripe
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

## Debug Commands

```bash
# Check service status
npx supabase status                              # Database
curl http://localhost:3000/api/health           # API health
curl http://localhost:3000/api/agents/status    # Agent system

# View logs  
npm run stripe:logs                              # Stripe events
docker logs supabase-postgres                   # Database logs (if Docker)

# Reset development state
npx supabase db reset                           # Reset database
```

## Performance Expectations

- **Dependency Installation**: ~21 seconds
- **Linting**: ~10 seconds  
- **Type Checking**: ~26 seconds
- **Full Build**: ~90 seconds (currently failing)
- **Unit Tests**: ~9 seconds (partial)
- **E2E Tests**: ~2 minutes (setup dependent)

---

**Last Updated**: 2025-08-29  
**Repository Status**: Work in progress - build issues present  
**Recommended Workflow**: Lint → Manual test → Commit