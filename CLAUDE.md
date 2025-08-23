# Ecosystem Marketplace - Critical Context

## 🎯 Business Model
**Platform Fees:**
- **Base Fee**: 10% from all transactions (provider receives 90%)
- **Guest Surcharge**: Additional 10% for non-authenticated users (guest pays 110% total)
- **Escrow**: Funds held until service completion

## 📊 Core State Machines

### Booking States
```
INITIATED → PENDING_PROVIDER → ACCEPTED → PAYMENT_PENDING → PAYMENT_SUCCEEDED → COMPLETED
                    ↓                           ↓
                REJECTED              PAYMENT_FAILED
```

### Payment Processing
- **Guest**: `/api/checkout/guest` (public, +10% surcharge)
- **Customer**: `/api/checkout/customer` (authenticated, no surcharge)
- **Webhook**: Stripe events trigger final state transitions
- **Polling**: UI polls `/api/bookings/[id]/status` for resilient UX

## 🔐 Security Principles
1. **Zero-Trust**: Every server request must be authenticated/authorized
2. **Server-Side Auth**: Never trust client-side checks alone
3. **Rate Limiting**: All public endpoints must have rate limits
4. **PCI Compliance**: SAQ A-EP level required for Stripe Connect

## 🏗️ Tech Stack Decisions

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **State**: Zustand + Immer (for nested updates)
- **Styling**: Tailwind CSS
- **Images**: Next/Image with Supabase transforms

### Backend
- **ORM**: Drizzle with explicit FOREIGN KEY constraints
- **Database**: PostgreSQL (Supabase)
- **Payments**: Stripe Connect
- **Auth**: Clerk

### Critical Patterns
- **Server Actions** for mutations (forms)
- **Route Handlers** for public APIs
- **Partial selects** in database queries
- **Prepared statements** for repeated queries

## 📁 Reference Documentation
For detailed implementation guides, see:
- `/docs/ARCHITECTURE.md` - Code patterns & standards
- `/docs/BOOKING-PAYMENTS.md` - Payment flow implementation
- `/docs/TESTING-QA.md` - Testing & quality standards

## ⚠️ Current Priority Issues
1. Guest checkout endpoint missing
2. Fee calculation not centralized
3. Webhook idempotency not implemented
4. No structured logging/observability

## 🚀 Quick Commands

### Development

```bash
npm run dev                  # Start dev server
npm run type-check          # TypeScript validation
npm run test                # Run test suite
npm run build              # Production build
```

### Database Management (Verified Workflow)

```bash
# Local Supabase
supabase start             # Start local Supabase (PostgreSQL on :54322)
supabase stop              # Stop local Supabase
supabase status            # Check if Supabase is running

# Drizzle ORM - Schema & Migrations
npm run db:generate        # Generate migration from schema changes
npm run db:migrate         # Apply migrations to database
npm run db:push           # Push schema directly (dev only)
npm run db:studio         # Open Drizzle Studio GUI (https://local.drizzle.studio)

# Direct Database Access
npx drizzle-kit studio     # Visual database management
# Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### Stripe Testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

## 📈 Success Metrics

- **API Response**: p95 < 100ms
- **Payment Success**: > 98%
- **Test Coverage**: > 80%
- **Accessibility**: WCAG AA compliant

---
**Last Updated**: 2025-08-23
**Version**: 2.0.1