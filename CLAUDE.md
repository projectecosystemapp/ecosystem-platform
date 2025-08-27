# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Business Model & Core Concepts

**Ecosystem Marketplace**: Two-sided platform connecting service providers with customers
- **Platform Fee**: 10% base commission on all transactions
- **Guest Surcharge**: Additional 10% for non-authenticated users
- **Payment Flow**: Stripe Connect with escrow until service completion
- **State Machine**: Bookings follow strict state transitions (INITIATED → PENDING_PROVIDER → ACCEPTED → PAYMENT_PENDING → PAYMENT_SUCCEEDED → COMPLETED)

## 🚀 Essential Commands

### Development
```bash
npm run dev                     # Start Next.js dev server (localhost:3000)
npm run build                   # Production build
npm run type-check              # TypeScript validation (must pass before commits)
npm run lint                    # ESLint checks
```

### Database Operations (Local Supabase)
```bash
# Start/Stop Local Database
supabase start                  # Start local Supabase (PostgreSQL on :54322)
supabase stop                   # Stop local Supabase
supabase status                 # Check if Supabase is running

# Schema Management (Drizzle ORM)
npm run db:generate             # Generate migration from schema changes
npm run db:migrate              # Apply migrations to database
npm run db:push                 # Push schema directly (dev only)
npm run db:studio               # Open Drizzle Studio GUI (visual DB management)
npm run db:apply-indexes        # Apply performance indexes
```

### Testing
```bash
npm run test                    # Run all unit tests
npm run test:watch              # Watch mode for TDD
npm run test:coverage           # Generate coverage report (must be >80%)
npm run test:e2e                # Run Playwright E2E tests
npm run test:e2e:ui             # Open Playwright UI mode

# Specialized Tests
npm run test:webhook-idempotency  # Test webhook handling
npm run security:audit             # Security vulnerability scan
npm run test:rate-limit            # Test rate limiting
```

### Stripe Integration
```bash
npm run stripe:listen           # Forward webhooks to localhost (required for payments)
npm run stripe:trigger:payment  # Simulate successful payment
npm run stripe:logs             # View Stripe event logs
```

### Production Deployment
```bash
npm run security:check          # Pre-deployment security audit
npm run build                   # Build for production
scripts/pre-deploy-check.sh     # Comprehensive pre-deploy validation
```

## 🏗️ Architecture Overview

### Tech Stack
- **Framework**: Next.js 14 (App Router) with React Server Components
- **Database**: PostgreSQL via Supabase + Drizzle ORM
- **Auth**: Clerk (authentication/authorization)
- **Payments**: Stripe Connect (marketplace payments)
- **State**: Zustand + Immer (client state management)
- **Styling**: Tailwind CSS + ShadCN UI components
- **Security**: CSRF protection, rate limiting (Upstash Redis), input sanitization

### Critical Design Patterns

#### 1. Server Actions vs Route Handlers
```typescript
// Server Action: Internal mutations with built-in CSRF protection
'use server' // app/actions/booking-actions.ts
export async function createBooking(data: FormData) {
  const session = await auth(); // Server-side auth check
  // Direct DB mutation
}

// Route Handler: Public APIs, webhooks
// app/api/checkout/guest/route.ts
export async function POST(request: Request) {
  // Manual security needed (rate limiting, validation)
}
```

#### 2. Database Queries (Drizzle)
```typescript
// ALWAYS use partial selects for performance
const users = await db.select({
  id: usersTable.id,
  name: usersTable.name, // Only needed columns
}).from(usersTable);

// Use prepared statements for repeated queries
const getUserById = db.select().from(users).where(eq(users.id, sql.placeholder('id'))).prepare();
```

#### 3. Fee Calculation (Centralized)
```typescript
// lib/fees.ts - Single source of truth
calculateFees(baseAmount, isGuest) {
  // Guest: pays 110% (10% surcharge)
  // Customer: pays 100% 
  // Provider: always receives 90%
}
```

## 📁 Project Structure

```
app/
├── api/                 # Public endpoints & webhooks
│   ├── checkout/       # Payment processing (guest/customer)
│   ├── webhooks/       # Stripe webhook handlers
│   └── providers/      # Provider CRUD operations
├── (authenticated)/    # Protected routes (require login)
├── (public)/          # Public routes
└── actions/           # Server actions for forms

db/
├── schema/            # Drizzle table definitions
├── queries/           # Reusable database queries
└── migrations/        # Generated SQL migrations

components/
├── ui/                # ShadCN UI components
├── providers/         # Provider-specific components
└── bookings/          # Booking flow components

lib/
├── fees.ts            # Fee calculation logic
├── stripe.ts          # Stripe configuration
└── auth.ts            # Authentication utilities
```

## 🔐 Security Requirements

### Zero-Trust Principles
1. **NEVER trust client-side validation alone** - Always verify on server
2. **Authentication required** for all mutations except guest checkout
3. **Rate limiting mandatory** on public endpoints
4. **Input sanitization** using Zod schemas before DB operations
5. **CSRF protection** automatic for Server Actions, manual for Route Handlers

### Critical Security Checks
```typescript
// Every server request MUST verify auth
const session = await auth();
if (!session) throw new Error('Unauthorized');

// Rate limit public endpoints
const { success } = await ratelimit.limit(ip);
if (!success) return new Response('Too Many Requests', { status: 429 });
```

## 🤖 Agent System

### Core Architecture
**Agent Orchestration**: AI-powered agent system with task delegation and workflow automation
- **5 Core Agents**: Core, UI, Database, Payments, Security (see `/lib/agents/runners/`)
- **8 MCP Servers**: Sequential thinking, filesystem, memory, GitHub, Notion, IDE, Vercel, Postgres
- **Task Distribution**: Capability-based matching with priority queuing
- **Workflow Engine**: Graph-based DAG execution with checkpoints

### Agent Commands
```bash
# Agent System Management
curl http://localhost:3000/api/agents/status    # System health check
curl http://localhost:3000/api/agents/tasks     # View all tasks
curl -X POST http://localhost:3000/api/agents/init  # Initialize agents

# Monitor agents via admin dashboard
# Navigate to: http://localhost:3000/admin/agents
```

### Agent Configuration
Configure agents via environment variables in `.env.local`:
```bash
# Core settings
AGENTS_ENABLED=true
AGENT_AUTO_INITIALIZE=true
AGENT_TASK_TIMEOUT=300000
AGENT_MAX_CONCURRENT_TASKS=10

# Enable/disable MCP servers
MCP_SEQUENTIAL_THINKING_ENABLED=true
MCP_FILESYSTEM_ENABLED=true
MCP_POSTGRES_ENABLED=true
# ... see .env.stripe.example for full list

# Security & resources
AGENT_SANDBOX_MODE=true
AGENT_MEMORY_LIMIT_MB=512
AGENT_REQUIRE_HUMAN_APPROVAL=true
```

### Agent Capabilities
- **Core Agent**: Task coordination, planning, decision-making
- **UI Agent**: Component generation, refactoring, styling
- **DB Agent**: Schema design, migrations, query optimization
- **Payments Agent**: Stripe integration, reconciliation, fraud detection
- **Security Agent**: Vulnerability scanning, compliance auditing, threat modeling

## ⚠️ Common Pitfalls & Solutions

| Issue | Solution |
|-------|----------|
| Payment stuck in PAYMENT_PENDING | Check Stripe webhook is running: `npm run stripe:listen` |
| Database connection errors | Ensure Supabase is running: `supabase status` |
| Type errors in build | Run `npm run type-check` before committing |
| Guest checkout failing | Verify rate limiting Redis is configured |
| Webhook processed multiple times | Check webhook_events table for idempotency |
| Agents not initializing | Check `/api/agents/status` and MCP server health |
| Agent tasks failing | Review task logs in admin dashboard at `/admin/agents` |

## 📊 Performance Targets

- **API Response**: p95 < 100ms
- **First Contentful Paint**: < 1.5s
- **Test Coverage**: > 80%
- **Lighthouse Score**: > 80
- **Payment Success Rate**: > 98%

## 🔄 State Machines

### Booking States
```
INITIATED → PENDING_PROVIDER → ACCEPTED → PAYMENT_PENDING → PAYMENT_SUCCEEDED → COMPLETED
                  ↓                           ↓
              REJECTED                 PAYMENT_FAILED
```

### Payment Processing Flow
1. Customer/Guest initiates payment
2. Create Stripe PaymentIntent with appropriate fees
3. Store payment record in DB
4. Client confirms payment
5. Webhook updates booking state
6. UI polls for status updates (resilient to webhook delays)

### Agent Task States
```
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
   ↓         ↓            ↓            ↓
CANCELLED  FAILED    CANCELLED   ARCHIVED
```

### Agent Workflow Execution
1. Task created via API or auto-generated
2. Orchestrator matches task to capable agent
3. Agent receives task and begins execution
4. Progress tracked with checkpoints
5. Results returned and stored
6. Human approval required for sensitive operations

## 📝 Development Workflow

1. **Before starting work**: 
   - Run `supabase start` for local DB
   - Run `npm run dev` for dev server
   - Run `npm run stripe:listen` if testing payments
   - Visit `/admin/agents` to initialize agent system

2. **Before committing**:
   - Run `npm run type-check` - MUST pass
   - Run `npm run lint` - Fix any errors
   - Run `npm run test` - Ensure tests pass

3. **Testing payments**:
   - Use test card: `4242 4242 4242 4242`
   - Guest checkout: Verify 110% charge
   - Customer checkout: Verify 100% charge

## 🆘 Debug Commands

```bash
# Check if all services are running
supabase status                    # Database status
curl http://localhost:3000/api/health  # API health check
curl http://localhost:3000/api/agents/status  # Agent system status
npm run redis:check                 # Redis connectivity

# View logs
npm run stripe:logs                # Stripe events
docker logs supabase-postgres      # Database logs

# Reset state
supabase db reset                  # Reset database to clean state
```

## 📚 Key Documentation References

- `/docs/ARCHITECTURE.md` - Detailed code patterns & standards
- `/docs/BOOKING-PAYMENTS.md` - Complete payment implementation guide  
- `/docs/TESTING-QA.md` - Testing standards & examples
- `/docs/SECURITY-AUDIT.md` - Security requirements & checklist

---
**Version**: 3.0.0
**Last Updated**: 2025-08-26