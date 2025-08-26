# ECOSYSTEM MASTER PROMPT  
 details.**COSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
  
**Chunk 1: Global Context & Purpose**  
  
⸻  
  
**1.0 Identity and Naming**  
  
The project shall be known as:  
  
**Ecosystem Marketplace Application**  
**Also referenced as:** *Ecosystem Marketplace*, *Project Ecosystem*, or simply *Ecosystem* within code, documentation, and agent conversations.  
  
This name is canonical. Any agent, developer, or contributor must refer to the system by this exact identity in all official contexts. No synonyms, abbreviations, or alternate brandings are permitted unless explicitly specified in ROADMAP.md or branding guidelines.  
  
⸻  
  
**1.1 Foundational Purpose**  
  
The Ecosystem Marketplace exists as a **two-sided digital marketplace platform**. Its purpose is:  
	•	To facilitate **service discovery**, **booking**, and **payment transactions** between customers (service consumers) and providers (service suppliers).  
	•	To provide **trust, security, and scalability** so that the marketplace can grow globally without compromising data, compliance, or user experience.  
	•	To generate sustainable revenue for the platform operator through transparent commission-based fees.  
  
⸻  
  
**1.2 Core Functionality (Immutable Definition)**  
  
The Ecosystem Marketplace must, at all times, support the following fundamental functions:  
	1.	**Service Discovery:**  
Customers can search, browse, and filter available providers by category, location, price, and service characteristics.  
	2.	**Provider Presence:**  
Each provider is given a **profile hub** (a structured mini-landing page) that consolidates all their offerings, availability, portfolio, and booking entry points.  
	3.	**Booking Flow:**  
Customers select a provider and service, view real-time availability, and reserve/book through the platform’s scheduling workflow.  
	4.	**Payment Flow:**  
	•	Stripe Connect is the sole canonical processor.  
	•	Platform takes **10% base commission** on every transaction.  
	•	Guest (non-authenticated) customers pay **an additional 10% surcharge**.  
	•	Providers always receive **90% of the base service price**, unaffected by guest surcharges.  
	5.	**Provider Management Tools:**  
Providers must be able to onboard, define services, manage availability, review bookings, and monitor earnings from their dashboard.  
	6.	**Customer Tools:**  
Customers must be able to sign up, sign in, search providers, make bookings, pay securely, and leave reviews.  
  
⸻  
  
**1.3 Business Model Constitution**  
  
The Ecosystem Marketplace operates under the following revenue principles:  
	•	**Commission Model:**  
	•	10% commission is deducted from each successful provider transaction.  
	•	This 10% is mandatory, non-negotiable, and embedded into all financial flows.  
	•	**Guest Checkout Surcharge:**  
	•	Non-authenticated (guest) users pay an additional +10% fee.  
	•	Providers’ payouts are unaffected.  
	•	This creates an incentive for users to register, while still allowing lightweight guest transactions.  
	•	**Provider Payouts:**  
	•	Providers are paid through Stripe Connect accounts.  
	•	Payouts may be delayed by an **escrow period** (as defined in payments policy).  
	•	Providers are never responsible for guest surcharge fees.  
	•	**Customer Pricing Transparency:**  
	•	All costs must be presented clearly at checkout.  
	•	Guest surcharge must be itemized as a distinct line item.  
  
⸻  
  
**1.4 Key Value Propositions**  
  
**For Customers:**  
	•	Access to a curated network of trusted providers.  
	•	Seamless discovery, booking, and payment.  
	•	Security-first environment with trusted payment rails.  
	•	Transparent pricing.  
	•	Guest checkout option for convenience, but nudged toward account creation for long-term benefits.  
  
**For Providers:**  
	•	Exposure to a broader customer base without building their own website.  
	•	Professional landing-page-like profiles with embedded booking.  
	•	Revenue management and Stripe-backed payouts.  
	•	Administrative tools: calendar management, earnings dashboard, refund processing.  
	•	Increased trust and credibility via the Ecosystem brand.  
  
⸻  
  
**1.5 Philosophical Grounding**  
  
The Ecosystem Marketplace is guided by the following immutable principles:  
	•	**Trust by Default:** Security, compliance, and transparency are non-negotiable.  
	•	**Provider Empowerment:** Providers must feel they “own” their profile while still being inside a managed ecosystem.  
	•	**Customer Simplicity:** Booking and paying must be intuitive and fast.  
	•	**Scalability First:** Every architecture and design choice must scale globally across regions, currencies, and devices.  
	•	**Documentation as Law:** Docs under /docs/ are canonical. Agents and developers must defer to them before generating or modifying logic.  
  
⸻  
  
**1.6 Non-Negotiables**  
  
Agents and developers must treat the following as **law**:  
	•	Commission rate: **10% base, immutable.**  
	•	Guest surcharge: **+10%, immutable.**  
	•	Stripe Connect: **sole payment processor.**  
	•	Clerk: **sole authentication provider.**  
	•	Supabase (Postgres, Storage, RLS): **sole backend database and storage system.**  
	•	Next.js 14 + TypeScript: **sole frontend stack.**  
	•	Tailwind + ShadCN: **sole UI layer.**  
  
If an agent or contributor generates code, designs, or documents that deviate from these, they must include a justification tagged as:  
  
```
⚠️ DEVIATION: [reason]

```
  
Otherwise, the deviation is invalid.  
  
⸻  
  
**1.7 Marketplace Roles**  
  
The system recognizes exactly two active participant roles (plus the platform operator):  
	1.	**Customer (Service Consumer):**  
	•	Browses and books services.  
	•	Pays via Stripe.  
	•	May book as guest (with surcharge) or as authenticated user.  
	•	Can leave reviews for providers.  
	2.	**Provider (Service Supplier):**  
	•	Creates and manages services.  
	•	Connects a Stripe account for payouts.  
	•	Manages bookings (approve/deny, message, refund).  
	•	Earns 90% of base service price.  
	3.	**Platform Operator (System Owner):**  
	•	Maintains infrastructure, security, compliance.  
	•	Collects platform commissions and guest surcharges.  
	•	Provides support to both customers and providers.  
  
⸻  
  
**1.8 Canonical Example Transaction Flow**  
	1.	Customer selects a provider’s service ($100 base price).  
	2.	Customer proceeds to checkout:  
	•	If authenticated: Total = $100.  
	•	If guest: Total = $110 ($100 base + $10 guest surcharge).  
	3.	Stripe Connect splits funds:  
	•	Provider receives $90.  
	•	Platform receives $10 commission.  
	•	If guest: Platform additionally receives $10 surcharge.  
	4.	Provider payout scheduled via Stripe.  
	5.	Platform retains commission/surcharge.  
  
⸻  
  
**1.9 Mandated Documentation**  
  
The following docs exist and must be treated as extensions of this constitution:  
	•	ARCHITECTURE.md  
	•	DESIGN-SYSTEM.md  
	•	GUEST-CHECKOUT.md  
	•	IA_ROUTES.md  
	•	PAYMENTS-IMPLEMENTATION.md  
	•	ROADMAP.md  
	•	SECURITY-AUDIT.md  
	•	TESTING-COVERAGE.md  
	•	TESTING-QA.md  
	•	UX_FLOWS.md  
	•	WEBHOOK-IDEMPOTENCY.md  
  
Agents must **reference these docs first** before generating new designs, code, or workflows.  
  
⸻  
  
**1.10 Status Declaration**  
  
As of current development status:  
	•	The Ecosystem Marketplace is **not production-ready.**  
	•	Certain security and testing features are stubbed or incomplete.  
	•	Roadmap prioritizes **MVP stabilization** before growth or scale phases.  
  
⸻  
  
**1.11 Core Principles for Agents Consuming This Constitution**  
	•	**Do not hallucinate.** If unsure, defer to docs or flag missing context.  
	•	**Tag outputs clearly.** Use markers like ✅ Implemented, ❌ Not Implemented, 🟨 Stubbed.  
	•	**Reference constitution rules.** Always check against business model, non-negotiables, and role definitions.  
	•	**Enforce clarity.** No ambiguous pricing, flows, or security handling.  
	•	**Preserve intent.** Every contribution must strengthen trust, empower providers, simplify customer UX, and scale globally.  
⸻  
  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
  
**Chunk 2: Tech Stack Deep-Dive**  
  
⸻  
  
**2.0 Tech Stack Constitution**  
  
The Ecosystem Marketplace is built on a **non-negotiable technology stack**.  
Agents, developers, and contributors must adhere strictly to these technologies unless a DEVIATION tag is provided and justified.  
  
⸻  
  
**2.1 Frontend Frameworks**  
	1.	**Next.js 14 (App Router)**  
	•	Canonical framework for frontend and full-stack rendering.  
	•	Mandatory use of **React Server Components** for optimized data fetching.  
	•	**File-based routing** with the /app/ directory is required; /pages/ legacy routing is prohibited.  
	•	app/layout.tsx defines the root layout; nested layouts must be used for dashboard/provider/customer sections.  
	•	**Route Handlers (app/api/...)** are used for API logic exposed publicly.  
	•	**Server Actions** must be used for internal mutations triggered from client components.  
	•	Edge runtime should be used for latency-sensitive API handlers (auth, rate limiting).  
	2.	**TypeScript (Strict Mode Enabled)**  
	•	All code must be written in **TypeScript**.  
	•	Strict type checking enabled (strict: true in tsconfig.json).  
	•	Null/undefined distinctions must be enforced.  
	•	any type is prohibited unless explicitly justified.  
	3.	**Tailwind CSS**  
	•	**Utility-first CSS** is the only styling approach.  
	•	No global CSS outside Tailwind config.  
	•	All custom design tokens (colors, typography, spacing) must live in tailwind.config.js.  
	•	Responsive design achieved via Tailwind breakpoints.  
	4.	**ShadCN UI (Radix + Tailwind)**  
	•	All UI components must extend from the ShadCN library.  
	•	Provides accessibility-first primitives.  
	•	Must be used for form controls, modals, menus, tooltips, and all interactive elements.  
	•	No external UI libraries allowed unless explicitly approved.  
	5.	**Framer Motion**  
	•	Sole animation library.  
	•	All transitions, micro-interactions, and component animations must use Framer Motion.  
	•	Default spring/tween parameters are documented in DESIGN-SYSTEM.md.  
	6.	**State Management: Zustand + Immer**  
	•	Zustand is the canonical global state manager.  
	•	Immer is mandatory for immutable updates.  
	•	State slices must be modular (/lib/store/...).  
	•	Context API is prohibited for global state.  
  
⸻  
  
**2.2 Backend & Database**  
	1.	**Supabase (PostgreSQL)**  
	•	Canonical backend database.  
	•	Must leverage **Supabase Auth (disabled when using Clerk)**, **Storage**, and **Row Level Security (RLS)**.  
	•	All database schema definitions live in /db/schema/.  
	•	All migrations live in /db/migrations/.  
	•	All queries live in /db/queries/.  
	2.	**Drizzle ORM**  
	•	Canonical ORM layer.  
	•	All database interactions must be **type-safe**.  
	•	SQL queries must never be written inline; only Drizzle schemas and query builders are allowed.  
	•	Relationships must be enforced at both the database schema and Drizzle schema level.  
	3.	**Supabase Storage**  
	•	Sole storage layer for provider images, documents, and uploads.  
	•	File keys must be namespaced by provider ID and object type.  
	•	Access is gated via RLS and signed URLs.  
	4.	**Row Level Security (RLS)**  
	•	Mandatory for **all tables**.  
	•	Policies must explicitly allow access only to rows owned by the authenticated user (provider or customer).  
	•	Guest checkout flows must have limited write-only permissions scoped to booking table inserts.  
  
⸻  
  
**2.3 Authentication & User Management**  
	1.	**Clerk**  
	•	Sole identity and authentication provider.  
	•	Handles sign-up, sign-in, sessions, JWT management.  
	•	Clerk webhooks must synchronize user profiles into Supabase profiles table.  
	•	lib/auth-actions.ts contains profile creation + sync logic.  
	•	OAuth integrations must be handled via Clerk, never custom.  
	2.	**Role Management**  
	•	Two roles only: **customer**, **provider**.  
	•	Role stored in Supabase profiles table.  
	•	Role-based access must be enforced both at UI and RLS levels.  
	3.	**Session Management**  
	•	Clerk provides session tokens.  
	•	Redis (Upstash) must store session metadata for rate limiting + abuse prevention.  
  
⸻  
  
**2.4 Payments & Financial Flows**  
	1.	**Stripe Connect**  
	•	Sole payment provider.  
	•	All providers must connect a Stripe account during onboarding.  
	•	Platform account is primary; all transactions flow through Connect.  
	2.	**Payment Splitting**  
	•	Base rule: **Provider = 90%, Platform = 10% commission.**  
	•	Guest rule: **Customer pays +10% surcharge. Platform retains surcharge.**  
	•	Provider payouts are never reduced by guest surcharge.  
	3.	**Refunds**  
	•	Partial and full refunds must be supported.  
	•	Stripe webhooks (payment_intent.canceled, charge.refunded) must update booking + provider earnings.  
	4.	**Escrow**  
	•	Funds held in platform account during booking.  
	•	Provider payouts scheduled after escrow release (duration defined in PAYMENTS-IMPLEMENTATION.md).  
	5.	**Webhooks**  
	•	All Stripe events processed under app/api/stripe/webhooks/route.ts.  
	•	Idempotency enforced via lib/webhook-idempotency.ts.  
	•	Duplicate webhook handling prohibited.  
  
⸻  
  
**2.5 Deployment**  
	1.	**Vercel**  
	•	Sole deployment environment for frontend and API routes.  
	•	Edge runtime required for API endpoints.  
	•	Environment variables managed via Vercel dashboard + .env files.  
	2.	**CI/CD via GitHub Actions**  
	•	All commits trigger:  
	•	TypeScript type-check.  
	•	ESLint static analysis.  
	•	Jest unit tests.  
	•	Playwright E2E smoke tests.  
	•	Lighthouse CI performance audit.  
	•	Merge blocked if any checks fail.  
  
⸻  
  
**2.6 Monitoring & Observability**  
	1.	**Sentry**  
	•	Sole monitoring platform.  
	•	Must capture:  
	•	Client-side errors.  
	•	Server-side errors.  
	•	Edge function errors.  
	•	Performance traces.  
	•	Alerts must be configured for P0/P1 issues.  
	2.	**Logging**  
	•	Structured logs only.  
	•	JSON format with request ID, user ID, and timestamp.  
	•	Stored in centralized log store for audit.  
  
⸻  
  
**2.7 Testing Frameworks**  
	1.	**Jest**  
	•	Canonical framework for unit + integration tests.  
	•	All functions in /lib/ must have ≥90% coverage.  
	2.	**Playwright**  
	•	Canonical E2E testing framework.  
	•	Must cover provider onboarding, booking flow, guest checkout, and payment flow.  
	3.	**k6**  
	•	Sole load-testing framework.  
	•	Stress-test booking + payment endpoints under simulated high concurrency.  
  
⸻  
  
**2.8 Caching & Rate Limiting**  
	1.	**Redis (Upstash)**  
	•	Sole caching layer.  
	•	Stores:  
	•	Rate-limit counters.  
	•	Session metadata.  
	•	Common queries (e.g., provider search results).  
	2.	**Rate Limiting**  
	•	Implemented via lib/security/rate-limit.ts.  
	•	Strict quotas applied to login, booking, and payment endpoints.  
  
⸻  
  
**2.9 Canonical Example: Booking with Guest Checkout**  
	1.	Customer (guest) books service priced at $200.  
	2.	Total at checkout = $220 ($200 base + $20 guest surcharge).  
	3.	Stripe Connect splits:  
	•	Provider account: $180 (90% base).  
	•	Platform: $20 (10% commission) + $20 (guest surcharge).  
	4.	Booking status = “pending provider approval.”  
	5.	Provider accepts → funds held in escrow.  
	6.	Escrow releases → payout to provider’s Stripe account.  
  
⸻  
  
**2.10 Implementation Mandates**  
	•	No alternate stacks may be substituted.  
	•	No inline SQL permitted.  
	•	No raw Stripe API calls outside lib/stripe.ts.  
	•	No direct DOM manipulation (React + ShadCN components only).  
	•	No custom auth without Clerk.  
  
Agents must treat these rules as **constitutionally binding**.  
  
⸻  
  
⏹️ *End of Chunk 2: Tech Stack Deep-Dive*  
  
⸻  
  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
  
**Chunk 3: Architecture Constitution**  
  
⸻  
  
**3.0 Architecture Philosophy**  
  
The Ecosystem Marketplace codebase follows a **layered, convention-driven architecture**.  
	•	**Directory-first conventions**: every folder represents a domain or concern.  
	•	**Strict separation of concerns**: UI, business logic, data access, and infrastructure cannot blur together.  
	•	**Self-documenting file structure**: contributors should understand system purpose simply by reading the directory tree.  
	•	**Immutable constitution**: directory names, file purposes, and conventions are binding unless a DEVIATION tag is explicitly provided.  
  
⸻  
  
**3.1 Root Directory Overview**  
  
Canonical folders at the root level of the repository:  
  
```
/app
/actions
/components
/lib
/db
/docs
/__tests__
/e2e

```
/public  
  
Each folder is explained in detail below.  
  
⸻  
  
**3.2 /app/ – Application Layer**  
	•	Implements **Next.js App Router**.  
	•	Defines pages, routes, layouts, and API endpoints.  
	•	**Never** contains reusable components or business logic — only route definitions and glue code.  
  
**3.2.1 Layouts**  
	•	app/layout.tsx: Root layout (global providers, global CSS import, /).  
	•	app/dashboard/layout.tsx: Layout for authenticated dashboards.  
	•	app/providers/[slug]/layout.tsx: Layout for provider profile pages.  
  
Layouts enforce consistent structure (navigation, sidebars, headers, footers).  
  
**3.2.2 Pages**  
	•	app/page.tsx: Homepage (search/discovery entry point).  
	•	app/dashboard/page.tsx: Customer/provider landing page post-login.  
	•	app/dashboard/provider/...: Provider dashboard routes.  
	•	app/dashboard/customer/...: Customer dashboard routes.  
	•	app/providers/[slug]/page.tsx: Provider profile page (hero image, services, booking entry).  
  
**3.2.3 API Routes**  
	•	Lives under app/api/.  
	•	Example routes:  
	•	app/api/stripe/webhooks/route.ts → Stripe webhook handler.  
	•	app/api/bookings/route.ts → Booking API endpoint.  
	•	app/api/auth/callback/route.ts → Auth callback endpoint.  
	•	Must follow **route handler pattern** (Next.js 14).  
	•	All routes must include:  
	•	Input validation (Zod).  
	•	Rate limiting (lib/security/rate-limit.ts).  
	•	Error handling with structured JSON response.  
  
⸻  
  
**3.3 /actions/ – Server Actions**  
	•	Houses **Next.js Server Actions** for backend mutations invoked from client components.  
	•	Each file must be domain-specific:  
  
Examples:  
	•	actions/auth-actions.ts → profile creation/sync.  
	•	actions/booking-actions.ts → create, approve, cancel bookings.  
	•	actions/provider-actions.ts → onboarding, service creation, availability updates.  
  
**Mandates:**  
	•	All inputs validated with Zod.  
	•	No raw DB calls — must use /db/queries/.  
	•	Must return typed responses (Promise<{ success: boolean; data?: T; error?: string }>).  
  
⸻  
  
**3.4 /components/ – Reusable UI**  
	•	Sole home for reusable frontend components.  
	•	Must be subdivided into functional subdirectories:  
  
```
/components/ui
/components/auth
/components/dashboard
/components/provider
/components/customer

```
  
	•	**ui/**: Base ShadCN + Tailwind components (buttons, inputs, modals).  
	•	**auth/**: Login/register components.  
	•	**dashboard/**: Shared widgets (navbars, sidebars, stats).  
	•	**provider/**: Components specific to provider flows (service card, earnings widget).  
	•	**customer/**: Components specific to customer flows (booking modal, review widget).  
  
**Rules:**  
	•	Components must be dumb/presentational.  
	•	No direct DB or API logic.  
	•	State must be passed in as props or Zustand stores.  
  
⸻  
  
**3.5 /lib/ – Business Logic & Utilities**  
  
The **heart of backend logic and utilities**.  
  
**3.5.1 Stripe Integration**  
	•	lib/stripe.ts → Canonical integration layer.  
	•	All Stripe SDK calls flow through here.  
	•	Functions: createPaymentIntent, refundPayment, splitCommission, connectAccountLink.  
	•	No other part of the codebase calls Stripe directly.  
  
**3.5.2 Security Modules**  
	•	lib/security/csrf.ts → CSRF protection helpers.  
	•	lib/security/rate-limit.ts → Redis-backed rate limiting.  
	•	lib/security/headers.ts → CSP, HSTS, XSS protection headers.  
  
**3.5.3 Database Utilities**  
	•	lib/db/index.ts → Connects Drizzle ORM to Supabase PostgreSQL.  
	•	lib/db/helpers.ts → Reusable query helpers (pagination, transactions).  
  
**3.5.4 Webhook Handling**  
	•	lib/webhook-idempotency.ts → Ensures webhooks processed once.  
	•	Must write idempotency keys to Redis.  
  
**3.5.5 Misc Utilities**  
	•	lib/validation.ts → Global Zod schemas.  
	•	lib/logger.ts → Structured logging wrapper.  
  
⸻  
  
**3.6 /db/ – Database Layer**  
  
The source of truth for all schemas, migrations, and queries.  
  
**3.6.1 Schema Definitions**  
  
Lives in /db/schema/. Examples:  
	•	profiles-schema.ts → user roles, profile data.  
	•	bookings-schema.ts → bookings, status, timestamps.  
	•	services-schema.ts → provider services, pricing.  
	•	reviews-schema.ts → customer reviews.  
  
**3.6.2 Migrations**  
	•	/db/migrations/ → versioned migration scripts.  
	•	Must be auto-generated by Drizzle kit.  
	•	No manual SQL migrations allowed.  
  
**3.6.3 Queries**  
	•	/db/queries/ → all reusable queries.  
	•	Example:  
	•	db/queries/getProviderBySlug.ts.  
	•	db/queries/getBookingsByCustomer.ts.  
	•	Queries must return typed objects only.  
  
⸻  
  
**3.7 /docs/ – Canonical Documentation**  
  
Docs act as **law**. Every agent and developer must defer to them.  
	•	ARCHITECTURE.md → patterns, directory structure.  
	•	DESIGN-SYSTEM.md → typography, color palette, component patterns.  
	•	GUEST-CHECKOUT.md → surcharge rules, guest permissions.  
	•	PAYMENTS-IMPLEMENTATION.md → Stripe Connect details.  
	•	SECURITY-AUDIT.md → known issues + fixes.  
	•	ROADMAP.md → phased development priorities.  
	•	UX_FLOWS.md → booking, onboarding, refund flows with Mermaid diagrams.  
  
⸻  
  
**3.8 /__tests__/ & /e2e/ – Testing**  
	•	__tests__/ → unit + integration tests. Must mirror structure of /lib/ and /actions/.  
	•	e2e/ → Playwright tests for flows.  
	•	All tests must be tagged with:  
	•	@unit  
	•	@integration  
	•	@e2e  
	•	Minimum coverage: 90% on /lib/, 80% overall.  
  
⸻  
  
**3.9 /public/ – Static Assets**  
	•	Contains static assets (logos, icons, default images).  
	•	Provider-uploaded assets never live here (must go to Supabase Storage).  
  
⸻  
  
**3.10 File-Level Mandates**  
	•	Every file must include JSDoc or TSDoc annotations.  
	•	Every exported function must have type signatures.  
	•	Every DB call must go through Drizzle query functions.  
	•	Every API route must enforce rate limiting + validation.  
  
⸻  
  
**3.11 Canonical Example – Booking API Flow**  
  
File Path: app/api/bookings/route.ts  
  
```
import { z } from "zod";
import { rateLimit } from "@/lib/security/rate-limit";
import { createBooking } from "@/db/queries/createBooking";
import { NextResponse } from "next/server";

const BookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  date: z.string(),
  time: z.string(),
  customerId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  await rateLimit("booking_create");

  const body = await req.json();
  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const booking = await createBooking(parsed.data);
  return NextResponse.json({ success: true, booking });
}

```
  
**Rules Demonstrated:**  
	•	Input validated with Zod.  
	•	Rate limiting applied.  
	•	DB call abstracted to /db/queries/.  
	•	Response structured and typed.  
  
⸻  
  
⏹️ *End of Chunk 3: Architecture Constitution*  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
##   
**Chunk 4: Provider & Customer Flows (Onboarding → Discovery → Booking → Payments → Reviews → Messaging)**  
  
⸻  
##   
**4.0 Overview**  
##   
## **This chunk operationalizes end-to-end user journeys. It encodes:**  
	•	Provider onboarding and account readiness (incl. Stripe Connect).  
	•	Customer authentication and guest entry.  
	•	Discovery (search, filters, ranking, caching).  
	•	Availability model and slot generation.  
	•	Booking lifecycle (state machine, concurrency, SLAs).  
	•	Payments (surcharges, commission, escrow, refunds, disputes).  
	•	Reviews, messaging, and notifications.  
	•	Admin/operator interventions and auditability.  
  
All flows must be implemented using the canonical stack from Chunks 1–3.  
  
⸻  
##   
**4.1 Roles & Permissions Matrix (RLS + UI)**  
  
****Capability****	****Guest****	****Customer (Auth)****	****Provider****	****Platform Operator****  
****Browse/search providers****	✅	✅	✅	✅  
****View provider profile****	✅	✅	✅	✅  
****Initiate booking****	✅**** (guest surcharge)****	✅	✅**** (test self-book disabled)****	✅  
****Pay****	✅**** (Stripe Checkout)****	✅	❌	✅**** (manual ops)****  
****Manage own bookings****	❌	✅**** (own)****	✅**** (own)****	✅**** (all)****  
****Connect Stripe****	❌	❌	✅	✅  
****Manage availability/services****	❌	❌	✅	✅  
****Refund/cancel (policy-gated)****	❌	✅**** (own request)****	✅**** (own customers per policy)****	✅**** (override)****  
****Leave review****	❌	✅**** (post-completion)****	❌	✅**** (moderation only)****  
****Message thread****	❌	✅**** (own)****	✅**** (own)****	✅**** (moderation)****  
  
## **All RLS policies must explicitly predicate on **auth.uid()** (Clerk-subject mapped) except guest insert paths (see §4.8).**  
  
⸻  
##   
**4.2 Provider Onboarding**  
##   
**4.2.1 Stages**  
	1.	**Account Creation** (Clerk → profiles upsert).  
	2.	**Business Profile** (name, slug, categories, service regions).  
	3.	**Compliance** (ToS/Refund policy acceptance, identity claims).  
	4.	**Stripe Connect** (account link + required capabilities).  
	5.	**Services & Pricing** (at least one active service).  
	6.	**Availability** (calendar baseline + buffers).  
	7.	**Go-Live Check** (automated readiness gate).  
  
## provider_status**: **draft | pending_compliance | pending_stripe | configuration | ready | suspended**.**  
##   
**4.2.2 API Contracts**  
	•	POST /api/providers – create/update provider profile.  
	•	POST /api/providers/connect – returns Stripe account link URL.  
	•	POST /api/providers/services – create/update service catalog.  
	•	POST /api/providers/availability – set recurring rules + exceptions.  
	•	GET /api/providers/readiness – returns readiness checklist + blockers.  
  
All inputs validated with Zod; failures return 400 with field map.  
  
**4.2.3 Minimal Schemas (Drizzle)**  
  
```
// db/schema/providers-schema.ts
export const providers = pgTable('providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id').notNull(), // Clerk user id
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  categories: text('categories').array(),
  shortBio: text('short_bio'),
  heroImageKey: text('hero_image_key'),
  status: text('status').$type<'draft'|'pending_compliance'|'pending_stripe'|'configuration'|'ready'|'suspended'>().notNull().default('draft'),
  stripeAccountId: text('stripe_account_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

```
  
**4.2.4 RLS (Concept)**  
	•	providers: owner can select/update/delete their rows; public can select only where status = 'ready'.  
	•	Stripe fields writable only by owner and system service role.  
  
**4.2.5 Stripe Connect**  
	•	Use account_links.create({ type: 'account_onboarding' }).  
	•	Enforce capabilities: transfers, card_payments.  
	•	Webhook: account.updated → recompute provider_status.  
	•	Block bookings to providers without ready.  
  
⸻  
##   
**4.3 Customer Authentication (and Guest Path)**  
	•	**Clerk** for auth.  
	•	Customer profile row auto-upsert on first sign-in.  
	•	Email verification recommended before booking (configurable).  
	•	Guest bookings permitted with surcharge (see §4.8).  
	•	Conversion tactic: post-booking account claim via magic link.  
  
⸻  
##   
**4.4 Discovery (Search, Filters, Ranking)**  
##   
**4.4.1 Search Inputs**  
	•	Query: q (text).  
	•	Filters: category[], priceMin/priceMax, ratingMin, location(lat,lng,radius), availabilityWindow.  
	•	Pagination: cursor/limit (default 20).  
  
**4.4.2 Ranking Signals (Weighted)**  
	1.	Provider readiness & compliance (hard filter).  
	2.	Proximity (if location provided).  
	3.	Relevance score (name/services/categories).  
	4.	Conversion proxy (views→bookings rate).  
	5.	Rating & recent reviews recency.  
	6.	Supply freshness (recent availability updates).  
  
Weights tunable in lib/search/ranking.ts. Must be deterministic.  
  
**4.4.3 Caching**  
	•	Redis key: search:{hash(q+filters)} → 60s TTL, stampede protection.  
	•	Invalidate on provider status change, service update, availability mutation.  
  
**4.4.4 API**  
##   
## GET /api/search/providers?q=&filters...** → **{ items: ProviderCard[], nextCursor }**.**  
  
⸻  
##   
**4.5 Provider Profile Page (Hub)**  
##   
**Composition:**  
	•	Hero (image/video), name, categories, location.  
	•	Services list (price, duration, variants).  
	•	Availability preview (next 14 days).  
	•	Reviews (paginated).  
	•	Booking CTA (primary), Contact/Message (secondary, optional until messaging shipped).  
	•	Compliance badges (payments secured, verified ID if applicable).  
  
**Non-negotiables:**  
	•	“Book Now” CTA above the fold on mobile/desktop.  
	•	Pricing transparency: base price and guest surcharge disclosure.  
	•	Edge-cached public sections (do not cache PII).  
  
⸻  
##   
**4.6 Availability Model**  
##   
**4.6.1 Data Model**  
	•	**Recurring rules:** iCal-style RRULE per weekday with start/end blocks.  
	•	**Exceptions:** date-specific overrides (open/close, extended hours).  
	•	**Buffers:** pre/post service buffers (minutes).  
	•	**Lead time:** min notice before booking (e.g., 2h).  
	•	**Cutoff:** last acceptable booking time before slot (e.g., 30m).  
	•	**Capacity:** per-slot capacity (default 1).  
  
Tables:  
	•	availability_rules(provider_id, weekday, start_minute, end_minute, capacity)  
	•	availability_exceptions(provider_id, date, start_minute, end_minute, is_closed)  
	•	provider_settings(lead_time_min, cutoff_min, pre_buffer_min, post_buffer_min, timezone)  
  
**4.6.2 Slot Generation Algorithm (Deterministic)**  
##   
## **Input: providerId, serviceId, dateWindow.**  
	1.	Resolve provider timezone.  
	2.	Expand recurring rules across dateWindow.  
	3.	Apply exceptions.  
	4.	Intersect service duration + buffers to compute slots.  
	5.	Enforce lead time & cutoff vs. **now** in provider TZ.  
	6.	Query bookings to subtract reserved capacity (status in ['hold','confirmed']).  
	7.	Return slots sorted ASC.  
  
Server function: lib/availability/generateSlots.ts with snapshot caching per provider/day (TTL 30s).  
  
**4.6.3 Concurrency Protection**  
	•	Place a **short hold** (status='hold', TTL 10 minutes) when user enters payment.  
	•	Hold keyed by (providerId, serviceId, start_at); enforce capacity.  
	•	Expire holds via background sweeper (cron) and on webhook failure.  
  
⸻  
##   
**4.7 Booking Lifecycle**  
##   
**4.7.1 States**  
##   
```
draft → hold → pending_provider → confirmed → in_progress → completed → canceled_customer → canceled_provider → no_show_customer → no_show_provider → refunded_partial → refunded_full → dispute

```
##   
## **Only permitted transitions are allowed; illegal transitions must throw.**  
##   
**4.7.2 State Machine (Mermaid)**  
  
```
stateDiagram-v2
  [*] --> draft
  draft --> hold: place_hold()
  hold --> pending_provider: payment_authorized
  pending_provider --> confirmed: provider_accepts
  pending_provider --> canceled_provider: provider_rejects
  confirmed --> in_progress: service_start
  in_progress --> completed: service_end
  confirmed --> canceled_customer: customer_cancels(policy)
  confirmed --> canceled_provider: provider_cancels(policy)
  confirmed --> no_show_customer: provider_reports
  confirmed --> no_show_provider: customer_reports
  canceled_* --> refunded_partial
  canceled_* --> refunded_full
  refunded_* --> [*]

```
  completed --> [*]  
  
**4.7.3 Core APIs / Actions**  
	•	POST /api/bookings/hold  
	•	Validates slot, sets hold with TTL, initiates PaymentIntent (auth-only unless policy requires immediate capture).  
	•	POST /api/bookings/confirm  
	•	On provider accept or auto-accept policy → capture payment (or retain escrow) → confirmed.  
	•	POST /api/bookings/cancel  
	•	Policy engine computes fees/refunds.  
	•	POST /api/bookings/reschedule  
	•	Releases old slot (respect fees), acquires new hold.  
	•	GET /api/bookings/:id  
	•	Returns secure view based on role.  
  
All endpoints: Zod validation + rate limiting.  
  
**4.7.4 Concurrency & Idempotency**  
	•	All mutating endpoints require Idempotency-Key header (UUID v4).  
	•	Redis stores operation hash for 24h; replay returns same result.  
	•	Use Postgres transactional locks when decrementing capacity.  
  
**4.7.5 SLA & Expirations**  
	•	Hold TTL: **10 minutes**.  
	•	Pending provider decision: **24 hours** (configurable); auto-expire → full refund/cancel per policy.  
	•	Reschedule window: as configured per service (e.g., 24h before start).  
  
⸻  
##   
**4.8 Guest Checkout (Surcharge, Risk, Conversion)**  
##   
**4.8.1 Pricing Rule (Immutable)**  
	•	Base price: P.  
	•	Platform commission: 0.10 * P.  
	•	Guest surcharge: 0.10 * P added to customer total.  
	•	Provider net: 0.90 * P.  
	•	Platform net: commission + surcharge (for guests).  
  
**4.8.2 Data Capture**  
	•	Required: email, name, phone (optional), consent.  
	•	Create ephemeral guest_customer record with a claim_token.  
	•	Post-payment success: send **account claim** magic link (Clerk invite → profile merge by email).  
  
**4.8.3 Permissions**  
	•	Guest can create hold and proceed to pay.  
	•	Guest cannot view dashboard; booking updates via email links (signed, single-use).  
	•	RLS: guest inserts restricted to bookings and guest_customers via service role + Zod server guard.  
  
**4.8.4 Risk Controls**  
	•	Rate limit by IP/email/device fingerprint.  
	•	Require 3DS if risk score high (Stripe Radar defaults).  
	•	Limit concurrent holds per email/IP.  
  
⸻  
##   
**4.9 Payments (Stripe Connect)**  
##   
**4.9.1 Objects & Fields**  
	•	application_fee_amount = round(0.10 * P * 100) in cents.  
	•	For guests: additional **platform surcharge** collected via separate line item or price uplifts at checkout; platform retains.  
	•	Use **destination charges** with transfer_data.destination = provider.stripeAccountId.  
  
**4.9.2 Escrow Strategy**  
	•	**Authorize** at hold.  
	•	**Capture** on provider accept (or auto-accept).  
	•	**Transfer** to provider on service completion or escrow_days maturity.  
	•	On cancel before capture: void auth; after capture: refund per policy.  
  
**4.9.3 Webhooks (Mandatory)**  
	•	payment_intent.succeeded → pending_provider or confirmed depending on accept policy.  
	•	charge.refunded → update refund status + notify.  
	•	account.updated → provider readiness recalculation.  
	•	payment_intent.payment_failed → release hold.  
  
All webhook handlers are **idempotent** and write an event log row with source, payload hash, outcome.  
  
**4.9.4 Refund Policy Engine**  
  
**Inputs: time to start, cancel reason, provider policy, non-refundable flags.**  
## **Outputs: **refund_amount**, **platform_fee_retained**, **provider_payout_adjustment**.**  
## **Engine must be pure and unit-tested.**  
  
⸻  
##   
**4.10 Messaging (Phase-Growth Feature; MVP toggle)**  
	•	Conversation threads per booking (booking_id scoped).  
	•	Role-gated access (customer/provider + operator).  
	•	Attachments via Supabase Storage (scanned, size-limited).  
	•	Notifications: email + in-app.  
	•	Abuse controls: rate limits, blocklist, report flag.  
  
If disabled in MVP, surface email relay instead (masked addresses).  
  
⸻  
##   
**4.11 Reviews**  
##   
**4.11.1 Rules**  
	•	Only **authenticated** customers who **completed** a booking can review.  
	•	One review per booking.  
	•	Ratings 1–5, optional text, image proof optional.  
	•	Moderation flags: spam/offensive; operator can hide.  
  
**4.11.2 Aggregation**  
	•	providers.average_rating and reviews_count updated via trigger or materialized view refresh.  
	•	Weight recent reviews higher in discovery ranking (§4.4.2).  
  
⸻  
##   
**4.12 Notifications**  
##   
## **Channels: email (default), in-app, optional SMS.**  
**Events:**  
	•	Hold placed (customer), slot conflict (error).  
	•	Payment authorized/failed.  
	•	Provider accept/decline.  
	•	Upcoming appointment reminder (24h and 2h).  
	•	Completed → review request.  
	•	Refund processed / dispute update.  
  
All sends must be idempotent; include message templates under /docs/COMM_TEMPLATES.md.  
  
⸻  
##   
**4.13 Operator Controls (Admin)**  
	•	Suspend provider (violations).  
	•	Force-refund with reason code.  
	•	Adjust booking state (audited).  
	•	View event log (webhooks, actions).  
	•	Export reporting (CSV) for payouts/fees.  
  
All admin actions must write to audit_logs with actor_user_id, action, entity, before/after, request_id.  
  
⸻  
##   
**4.14 Error Model & Codes**  
	•	E_AVAIL_CONFLICT – slot no longer available.  
	•	E_HOLD_EXPIRED – hold TTL exceeded.  
	•	E_PAYMENT_FAIL – Stripe failure.  
	•	E_POLICY_BLOCK – refund/cancel disallowed by policy.  
	•	E_RLS_DENY – access denied.  
	•	E_RATE_LIMIT – throttled.  
	•	E_IDEMPOTENT_REPLAY – duplicate request.  
  
Error payload:  
  
{ "error": { "code": "E_AVAIL_CONFLICT", "message": "Selected slot unavailable.", "hint": "Refresh availability and retry." } }  
  
  
⸻  
##   
**4.15 End-to-End Sequence (Guest Booking → Provider Accept → Completion)**  
  
```
sequenceDiagram
  participant U as Guest User
  participant FE as Next.js (RSC+Client)
  participant API as Route Handler
  participant AV as Availability Service
  participant STR as Stripe
  participant DB as Postgres/Drizzle
  participant P as Provider

  U->>FE: Select slot + service
  FE->>AV: GET /availability?providerId&serviceId&window
  AV-->>FE: Slots[]
  U->>FE: Book
  FE->>API: POST /bookings/hold (Idempotency-Key)
  API->>DB: upsert booking(status=hold, ttl)
  API->>STR: create PaymentIntent (auth only)
  STR-->>API: intent.created (client_secret)
  API-->>FE: { bookingId, client_secret }
  FE->>STR: confirmCardPayment(client_secret)
  STR-->>API: webhook payment_intent.succeeded
  API->>DB: set status=pending_provider
  API->>P: notify accept/decline
  P->>API: POST /bookings/confirm
  API->>STR: capture PaymentIntent (escrow)
  API->>DB: status=confirmed
  API-->>FE: confirmation
  ... time passes ...
  P->>API: POST /bookings/mark-start
  API->>DB: status=in_progress
  P->>API: POST /bookings/mark-complete
  API->>DB: status=completed
  API->>STR: transfer to provider (or release after escrow_days)
  API->>U: review request notification

```
  
  
⸻  
##   
**4.16 Minimal Contracts (Zod)**  
  
```
export const HoldBookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(), // ISO in provider TZ or UTC normalized server-side
  customer: z.object({
    type: z.enum(['guest','auth']),
    email: z.string().email(),
    name: z.string().min(2),
    phone: z.string().optional()
  })
});

export const ConfirmBookingSchema = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(['provider_accept','provider_reject'])
});

export const CancelSchema = z.object({
  bookingId: z.string().uuid(),
  actor: z.enum(['customer','provider','operator']),
  reason: z.string().max(500).optional()
});

```
  
  
⸻  
##   
**4.17 Policy Engine (Refund/Cancel)**  
  
```
type PolicyInput = {
  startAt: Date;
  now: Date;
  refundableUntilMins: number;   // e.g., 1440
  cancelFeePct: number;          // e.g., 0.10 applies to base price P
  isNonRefundable: boolean;
  priceBase: number;             // P
  isGuest: boolean;
};

type PolicyOutput = {
  refundAmount: number;          // to customer
  platformKeeps: number;         // retained fees (commission/surcharge policy-driven)
  providerKeeps: number;         // if late cancel policy allows
  notes: string[];
};

```
  
## **Rules:**  
	•	If isNonRefundable = true and within refundable window expired → refundAmount=0.  
	•	Else if within window → compute partial refund with cancelFeePct.  
	•	Platform commission refundable policy: **configurable** (default: refundable if not captured or if canceled >24h before start).  
	•	Guest surcharge refundable policy: **default non-refundable after capture**.  
  
All policies must be unit-tested with boundary times (±1 minute).  
  
⸻  
##   
**4.18 Analytics Events (Data Contracts)**  
##   
## **Emit structured events to logging pipeline:**  
	•	search_performed, provider_viewed, slot_viewed, hold_created, payment_authorized, booking_confirmed, booking_canceled, refund_issued, review_submitted, message_sent.  
  
Payload keys: userId?, providerId?, bookingId?, priceBase, guest, timestamp, requestId.  
  
⸻  
##   
**4.19 Testing Requirements (Playwright/Jest)**  
##   
**Playwright E2E (must-have):**  
	•	Guest booking happy path (auth→capture→provider accept→complete).  
	•	Availability race: two guests attempt same slot → one fails with E_AVAIL_CONFLICT.  
	•	Hold expiration → slot reappears.  
	•	Provider reject → void auth → email notification.  
	•	Refund scenarios (within window vs. late).  
  
**Jest Unit:**  
	•	Slot generator (timezones, DST, buffers).  
	•	Policy engine (refund matrices).  
	•	Webhook idempotency.  
	•	Ranking function determinism.  
  
⸻  
##   
**4.20 Operational Guardrails**  
	•	**Circuit breakers** on Stripe API calls; retry with jitter.  
	•	**Dead-letter** queue for failed webhooks with manual reprocess endpoint (operator only).  
	•	**Backfill scripts** must be read-only unless wrapped in explicit “danger” command requiring --yes.  
  
⸻  
##   
**4.21 UX Guardrails**  
	•	Always show **total cost** and **guest surcharge line** before payment.  
	•	Disable confirm buttons while awaiting idempotent responses.  
	•	Display countdown timer on hold pages (10-minute TTL).  
	•	Communicate provider timezone clearly on slot selections.  
  
⸻  
##   
**4.22 Data Retention & Privacy**  
	•	Minimize PII stored for guests; prefer tokenized references.  
	•	Purge expired holds and abandoned guest records after 30 days.  
	•	Anonymize reviews on request while preserving rating.  
  
⸻  
##   
**4.23 Failure Modes & Fallbacks**  
	•	Stripe down: prevent new holds; show maintenance toast; allow browsing.  
	•	Redis down: degrade to conservative default rate limits; disable search caching.  
	•	Supabase degraded: read-only mode for browsing; block booking mutations.  
  
⸻  
##   
**4.24 Implementation Checklist (DoD)**  
	•	Provider onboarding passes readiness gate before listing.  
	•	Search returns deterministic ranking with cache and invalidation wired.  
	•	Availability generator correctness validated for 4 timezones incl. DST.  
	•	Booking state machine enforced server-side with schema constraints.  
	•	Idempotency end-to-end (headers, Redis keys, replay behavior).  
	•	Stripe webhooks with signature verification + idempotent processing.  
	•	Refund policy engine implemented and unit-tested ≥95% branch coverage.  
	•	Notification templates authored and smoke-tested.  
	•	Operator admin actions write to audit_logs.  
	•	Playwright suite green in CI; Lighthouse passing thresholds.  
  
⸻  
  
⏹️** End of Chunk 4: Provider & Customer Flows**  
  
Alright — now we move into the **non-negotiable guardrails**. Chunk 5 is where we lock down **security, compliance, and trust doctrine** for the Ecosystem Marketplace. This becomes the “zero-trust bible” of the project.  
  
⸻  
  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
  
**Chunk 5: Security & Compliance Doctrine**  
  
⸻  
  
**5.0 Security Philosophy**  
	•	**Zero-trust by default**: no request, role, or input is trusted without validation.  
	•	**Defense in depth**: multiple overlapping controls at every layer.  
	•	**Least privilege**: users, providers, operators, and services only access what they need.  
	•	**Compliance as law**: PCI-DSS (payments), GDPR/CCPA (data privacy), SOC2 (infrastructure controls).  
	•	**Observability = security**: all security-relevant events must be logged and auditable.  
  
⸻  
  
**5.1 Authentication (Clerk Mandates)**  
	•	Clerk is the **sole identity provider**.  
	•	JWT tokens signed by Clerk must be verified on all API requests.  
	•	Session lifetimes: configurable, default 7 days idle → rolling refresh.  
	•	Multi-factor authentication (MFA) supported (SMS/email/Authenticator).  
	•	Clerk → Supabase sync: each authenticated user must have exactly one profiles row with immutable user_id.  
  
⸻  
  
**5.2 Authorization (Row Level Security – RLS)**  
  
All PostgreSQL tables **must have RLS enabled**.  
  
**5.2.1 General Rules**  
	•	Customers can only SELECT/UPDATE their own bookings.  
	•	Providers can only SELECT/UPDATE their own services, availability, and bookings.  
	•	Guests can only INSERT into bookings and guest_customers, scoped to their generated UUID.  
	•	Operators (service role key) bypass RLS, but all queries logged.  
  
**5.2.2 Example Policy: Bookings**  
  
```
-- Allow providers to read their own bookings
CREATE POLICY provider_select ON bookings
  FOR SELECT USING (provider_id = auth.uid());

-- Allow customers to read their own bookings
CREATE POLICY customer_select ON bookings
  FOR SELECT USING (customer_id = auth.uid());

-- Allow guest inserts via service role (API restricted)
CREATE POLICY guest_insert ON bookings

```
  FOR INSERT WITH CHECK (customer_id IS NULL);  
  
  
⸻  
  
**5.3 Input Validation**  
	•	**All inbound payloads** must be validated with Zod schemas.  
	•	Required fields enforced (IDs as UUIDv4, emails as valid RFC5321).  
	•	Strings length-bounded, numbers range-checked.  
	•	Reject unknown fields (strict() mode).  
	•	Example:  
  
```
const BookingSchema = z.object({
  providerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  customer: z.object({
    type: z.enum(['guest','auth']),
    email: z.string().email(),
    name: z.string().min(2).max(100),
    phone: z.string().optional()
  })
}).strict();

```
  
  
⸻  
  
**5.4 Rate Limiting**  
	•	Redis (Upstash) is canonical rate-limiting engine.  
	•	Default quotas:  
	•	Auth attempts: 5/min per IP/email.  
	•	Booking holds: 3/min per IP/email.  
	•	Payment confirmations: 5/min per IP.  
	•	Implement exponential backoff on breach.  
	•	Return 429 Too Many Requests with retry headers.  
  
⸻  
  
**5.5 CSRF & Clickjacking**  
	•	CSRF tokens must be required for any **state-changing request** outside API route POSTs.  
	•	Next.js route handlers must enforce SameSite=Lax cookies.  
	•	All POST requests must check x-csrf-token header for web forms.  
	•	Clickjacking prevented with:  
	•	X-Frame-Options: DENY  
	•	Content-Security-Policy: frame-ancestors 'none'  
  
⸻  
  
**5.6 Security Headers**  
  
Set globally via lib/security/headers.ts:  
	•	Strict-Transport-Security: max-age=31536000; includeSubDomains; preload  
	•	Content-Security-Policy (default-deny, allow self + stripe, clerk, supabase).  
	•	X-Content-Type-Options: nosniff  
	•	X-XSS-Protection: 0 (deprecated but safe baseline).  
	•	Referrer-Policy: no-referrer-when-downgrade  
  
⸻  
  
**5.7 Webhook Security**  
	•	Stripe & Clerk webhooks must verify signatures with secret keys.  
	•	Reject unsigned or mismatched events with 401.  
	•	Webhook handlers must enforce idempotency via lib/webhook-idempotency.ts.  
	•	Log raw payload hash + event ID in webhook_events table.  
  
⸻  
  
**5.8 SQL Injection & ORM Safety**  
	•	Direct SQL queries forbidden.  
	•	Drizzle ORM only.  
	•	All dynamic filters must use parameterized queries.  
	•	Example safe query:  
  
```
db.select().from(bookings)
  .where(eq(bookings.customerId, customerId));

```
  
  
⸻  
  
**5.9 Secrets Management**  
	•	Secrets managed in Vercel environment variables.  
	•	No secrets committed to Git.  
	•	All secrets prefixed with NEXT_PUBLIC_ (safe for client) or SECRET_ (server-only).  
	•	Rotation schedule: every 90 days.  
  
⸻  
  
**5.10 Audit Logging**  
  
All sensitive events must be logged:  
	•	Login attempts (success/failure).  
	•	Provider onboarding steps.  
	•	Booking state transitions.  
	•	Payment/refund events.  
	•	Admin/operator overrides.  
  
Schema:  
  
```
audit_logs: {
  id: uuid PK,
  actor_user_id: string | null,
  action: string,
  entity: string,
  entity_id: uuid,
  before: jsonb,
  after: jsonb,
  created_at: timestamptz DEFAULT now()
}

```
  
  
⸻  
  
**5.11 Monitoring & Intrusion Detection**  
	•	Sentry captures error + anomaly traces.  
	•	Redis tracks failed login attempts.  
	•	Abnormal booking velocity triggers alert (fraud detection).  
	•	Suspicious webhook replays flagged.  
  
⸻  
  
**5.12 GDPR/CCPA Compliance**  
	•	Data deletion: users can request full deletion (soft-delete bookings but anonymize PII).  
	•	Data portability: export JSON of all user data on request.  
	•	Consent: checkboxes for marketing communications.  
	•	Privacy Policy must be linked on signup.  
  
⸻  
  
**5.13 PCI-DSS Compliance**  
	•	Card data never stored in Ecosystem DB.  
	•	All payments processed via Stripe.  
	•	SAQ-A compliance level (redirected PCI burden).  
	•	Stripe’s hosted checkout recommended for guest path.  
  
⸻  
  
**5.14 Abuse Prevention**  
	•	Messaging system must scan attachments for malware.  
	•	Profanity/abuse filter in chat + reviews.  
	•	Report flag triggers moderation workflow.  
	•	Rate-limit messaging to prevent spam.  
  
⸻  
  
**5.15 Security Testing**  
	•	**Static Analysis**: ESLint + TypeScript strict rules.  
	•	**Dynamic Analysis**: penetration test in staging before production.  
	•	**Dependency Scanning**: Dependabot alerts mandatory.  
	•	**E2E Tests**: simulate attacks (SQLi, XSS, CSRF).  
  
⸻  
  
**5.16 Canonical Example – Secure Booking API**  
  
```
export async function POST(req: Request) {
  await rateLimit("booking_create");

  const csrf = req.headers.get("x-csrf-token");
  if (!csrf || !verifyCsrf(csrf)) {
    return NextResponse.json({ error: "CSRF failed" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Drizzle ORM only
  const booking = await createBooking(parsed.data);

  return NextResponse.json({ success: true, booking });
}

```
  
  
⸻  
  
**5.17 Security SLA**  
	•	P0 vulnerabilities: patch within 24h.  
	•	P1 vulnerabilities: patch within 72h.  
	•	All other issues: patch within 7 days.  
	•	Public bug bounty policy (future roadmap).  
  
⸻  
  
**5.18 Compliance Artifacts**  
  
Documents to maintain in /docs/compliance/:  
	•	GDPR-DPA.md (Data Processing Agreement).  
	•	PCI-SAQ-A.md (PCI scope evidence).  
	•	SECURITY-INCIDENT-PLAN.md.  
	•	ACCESS-CONTROL-POLICY.md.  
	•	ENCRYPTION-POLICY.md.  
  
⸻  
  
⏹️ **End of Chunk 5: Security & Compliance Doctrine**  
  
⸻  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
##   
**Chunk 6: Testing & Quality Constitution**  
  
⸻  
##   
**6.0 Testing Philosophy**  
	•	**Quality gates are law**: no feature is production-ready without full test coverage.  
	•	**Automation first**: manual QA only supplements automated tests, never replaces.  
	•	**Shift left**: tests are written in parallel with features, not after.  
	•	**Coverage ≠ confidence**: tests must simulate real-world flows, concurrency, and edge cases.  
	•	**Regression prevention**: once a bug is found, a test must be added so it never reappears.  
  
⸻  
##   
**6.1 Coverage Requirements**  
	•	/lib/ (business logic): **≥90% line & branch coverage**.  
	•	/actions/ (server actions): **≥85% coverage**.  
	•	/app/api/ (API routes): **≥80% coverage**, must include error paths.  
	•	E2E flows (Playwright): all critical journeys covered.  
	•	Policy engine: **100% branch coverage** required.  
  
Coverage enforced via Jest + Istanbul. PR blocked if thresholds unmet.  
  
⸻  
##   
**6.2 Unit Testing (Jest)**  
##   
## **Scope: pure functions, utilities, helpers, schema validators.**  
##   
**6.2.1 Required Units**  
	•	Zod schemas (valid, invalid, boundary inputs).  
	•	Availability slot generator (lead time, cutoff, DST shifts).  
	•	Refund policy engine (full matrix of cases).  
	•	Rate limiting module (throttle + reset).  
	•	Webhook idempotency (replay events).  
	•	Search ranking (deterministic scoring).  
  
**6.2.2 Example Test (Availability)**  
  
```
test("blocks slots within lead time", () => {
  const now = new Date("2025-08-25T12:00:00Z");
  const startAt = new Date("2025-08-25T12:30:00Z");
  const slots = generateSlots(provider, service, { now });
  expect(slots).not.toContain(startAt);
});

```
  
  
⸻  
##   
**6.3 Integration Testing (Jest + Supertest)**  
##   
## **Scope: multi-module flows without UI.**  
##   
**6.3.1 Required Integrations**  
	•	API → DB → response chain.  
	•	Booking hold → Stripe PaymentIntent creation.  
	•	Provider onboarding → Stripe Connect sync.  
	•	Guest booking insert → ephemeral profile → booking record.  
	•	Refund request → policy engine → Stripe refund → DB update.  
  
**6.3.2 Mocking Rules**  
	•	Stripe API must be mocked in integration tests.  
	•	Supabase can be hit via local test instance.  
	•	Redis must run in test container (not mocked).  
  
⸻  
##   
**6.4 End-to-End Testing (Playwright)**  
##   
## **Scope: simulate user/browser flows.**  
##   
**6.4.1 Critical Journeys**  
	•	Customer signup → search → booking → payment → provider accept → completion.  
	•	Guest booking path with surcharge.  
	•	Booking hold expiry → slot reappears.  
	•	Provider rejects → refund flows back to card.  
	•	Refund edge cases (late cancel, non-refundable).  
	•	Reviews submission + visibility in provider profile.  
	•	Messaging thread (if enabled).  
  
**6.4.2 Example**  
  
```
test("guest checkout surcharge applied", async ({ page }) => {
  await page.goto("/providers/jane-doe");
  await page.click("text=Book Now");
  await page.fill("input[name=email]", "guest@example.com");
  await page.click("text=Continue");
  const total = await page.textContent("#total");
  expect(total).toBe("$110.00"); // $100 base + 10% surcharge
});

```
  
  
⸻  
##   
**6.5 Load & Stress Testing (k6)**  
##   
## **Purpose: validate scaling under concurrency.**  
##   
**6.5.1 Scenarios**  
	•	**Booking burst**: 1k customers booking same provider concurrently.  
	•	**Search load**: 10k queries/minute across categories.  
	•	**Webhook flood**: Stripe event replay simulation.  
	•	**Availability queries**: 100k slot generations across providers.  
  
**6.5.2 Thresholds**  
	•	Booking API p95 latency < 250ms.  
	•	Search API p95 latency < 200ms.  
	•	Error rate < 0.5%.  
	•	Zero double-bookings under load.  
  
**6.5.3 Example (k6 script)**  
  
```
import http from "k6/http";
import { check } from "k6";

export default function() {
  const res = http.post("https://app.ecosystem.com/api/bookings/hold", {
    providerId: "uuid",
    serviceId: "uuid",
    startAt: "2025-08-25T15:00:00Z"
  });
  check(res, { "status is 200": (r) => r.status === 200 });
}

```
  
  
⸻  
##   
**6.6 Visual Regression Testing**  
	•	**Lighthouse CI**: enforce performance + accessibility thresholds.  
	•	Performance ≥ 90.  
	•	Accessibility ≥ 95.  
	•	SEO ≥ 90.  
	•	**Percy/Chromatic**: screenshot diffs of UI components.  
	•	Baselines updated only via reviewed PR.  
  
⸻  
##   
**6.7 CI/CD Quality Gates**  
##   
## **All PRs must pass:**  
	1.	**Type Checking**: tsc --noEmit.  
	2.	**Linting**: ESLint (no warnings permitted).  
	3.	**Unit Tests**: Jest with coverage thresholds.  
	4.	**Integration Tests**: DB + Stripe mock flows.  
	5.	**E2E Smoke Tests**: Playwright on staging env.  
	6.	**Performance Tests**: Lighthouse ≥ thresholds.  
	7.	**Security Scan**: npm audit + dependency check.  
  
PR merges are blocked unless all gates pass.  
  
⸻  
##   
**6.8 QA Environments**  
	•	**Local dev**: Supabase + Redis docker containers.  
	•	**Staging**: mirrors prod infra (Vercel, Supabase project, Redis).  
	•	**Production**: only deploy after green staging run.  
  
⸻  
##   
**6.9 Manual QA (Supplemental)**  
	•	Exploratory testing around new flows.  
	•	Cross-device browser matrix (Safari iOS, Chrome Android, Edge Windows).  
	•	Accessibility audit using screen readers (NVDA, VoiceOver).  
  
⸻  
##   
**6.10 Testing Documentation**  
  
## **Located in **/docs/**:**  
	•	TESTING-COVERAGE.md: coverage reports.  
	•	TESTING-QA.md: manual QA checklist.  
	•	LOAD-TESTING.md: k6 scripts + results.  
	•	VISUAL-REGRESSION.md: baseline screenshots.  
  
⸻  
##   
**6.11 Failure Injection (Chaos Engineering, Optional Future)**  
	•	Simulate Stripe downtime (fail PaymentIntent create).  
	•	Simulate Redis down (fallback logic for rate limiting).  
	•	Simulate DB failover.  
	•	Ensure graceful degradation (browsing works, booking disabled).  
  
⸻  
##   
**6.12 Testing SLA**  
	•	Unit & integration tests written **with feature PR**.  
	•	E2E scenarios updated **weekly**.  
	•	Load tests run **monthly** or before major release.  
	•	Visual regression baseline updated on **UI changes**.  
  
⸻  
##   
**6.13 Example Testing Matrix (Booking Flow)**  
  
****Test Type****	****Scenario****	****Expected Outcome****  
****Unit****	****Availability slot generator with DST transition****	****Slots shift correctly by 1h****  
****Integration****	****POST /bookings/hold → Stripe intent****	****DB row in hold, Stripe mocked intent created****  
****E2E****	****Guest books $100 service****	****Checkout shows $110 total, booking created****  
****Load****	****1000 holds same slot****	****Only 1 confirmed booking, others rejected with ****E_AVAIL_CONFLICT  
****Visual****	****Booking modal open****	****Matches baseline, no UI regression****  
****Manual****	****Cancel booking within refund window****	****Refund processed, email sent****  
  
  
⸻  
##   
**6.14 DoD (Definition of Done) – Testing**  
  
## **A feature is not done unless:**  
	•	Unit tests written, passing, coverage ≥ threshold.  
	•	Integration tests simulate end-to-end data flow.  
	•	E2E happy paths validated.  
	•	Failure cases tested.  
	•	QA sign-off checklist complete.  
	•	Documentation updated.  
  
⸻  
  
## ⏹️** End of Chunk 6: Testing & Quality Constitution**  
  
⸻  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
##   
**Chunk 7: Performance & Scaling Mandates**  
  
⸻  
##   
**7.0 Performance Philosophy**  
	•	**Performance is a feature**: slow apps break trust as much as insecure apps.  
	•	**Global-first**: optimize for latency across geographies.  
	•	**Predictable under load**: no hidden bottlenecks.  
	•	**Fail soft**: if one subsystem degrades, others must remain usable.  
	•	**Measure continuously**: performance budgets tracked in CI/CD.  
  
⸻  
##   
**7.1 Frontend Performance**  
##   
**7.1.1 Rendering**  
	•	Use **React Server Components** wherever possible.  
	•	Client components limited to interactive UI.  
	•	Lazy load heavy bundles (e.g., charts, messaging).  
	•	Hydration deferred for non-critical UI (skeleton loaders required).  
  
**7.1.2 Assets**  
	•	All images served via **Next.js Image component** with responsive breakpoints.  
	•	Supabase Storage signed URLs cached at CDN.  
	•	next/font for typography; self-hosted Google Fonts disallowed.  
	•	Asset size budget: single-page JS bundle < 200kb gzipped.  
  
**7.1.3 Caching**  
	•	**unstable_cache** used for provider profiles and search results.  
	•	Profile pages: edge cached (60s TTL, tag invalidation on provider update).  
	•	Search: Redis + ISR hybrid (short TTL).  
  
⸻  
##   
**7.2 Backend Performance**  
##   
**7.2.1 Database**  
	•	Connection pooling required via **pgbouncer** (Supabase-managed).  
	•	All queries must use **indexes** for filter fields (provider slug, serviceId, customerId).  
	•	N+1 prevention: join queries via Drizzle relations, not per-row calls.  
	•	Database latency SLO: p95 query < 50ms.  
  
**7.2.2 Redis**  
	•	**Primary cache** for:  
	•	Search results.  
	•	Availability slot snapshots.  
	•	Rate limit counters.  
	•	Idempotency keys.  
	•	TTL standards:  
	•	Search: 60s.  
	•	Availability: 30s.  
	•	Rate-limit counters: sliding window (1m).  
	•	Idempotency keys: 24h.  
  
**7.2.3 Background Jobs**  
	•	Job queue TBD (future scale phase).  
	•	Current workaround: use Vercel Cron + Supabase edge functions.  
	•	Jobs:  
	•	Expire holds (10m).  
	•	Cleanup expired guest records (30d).  
	•	Refresh materialized review aggregates.  
  
⸻  
##   
**7.3 API Performance**  
##   
**7.3.1 SLAs**  
	•	Booking API: p95 < 250ms.  
	•	Search API: p95 < 200ms.  
	•	Stripe webhook handler: p95 < 300ms.  
	•	Global cache hit ratio ≥ 80%.  
  
**7.3.2 Pagination**  
	•	Cursor-based pagination only.  
	•	limit max = 50.  
	•	Prevents deep offset scans.  
  
**7.3.3 Response Size**  
	•	JSON payloads < 100kb.  
	•	Use selective fields (no overfetching).  
	•	Compression: Gzip + Brotli at CDN.  
  
⸻  
##   
**7.4 Availability Generation (Perf-Sensitive)**  
	•	Slot generation must run in < 100ms per provider/day.  
	•	Precompute common slots nightly (next 14 days).  
	•	Cache computed slots in Redis keyed by provider/day.  
	•	On booking hold, subtract slot capacity atomically without regenerating entire calendar.  
  
⸻  
##   
**7.5 Global Scaling**  
##   
**7.5.1 CDN**  
	•	Vercel Edge Network is canonical CDN.  
	•	Static assets cached globally.  
	•	Provider profiles edge-rendered close to users.  
  
**7.5.2 Timezones & DST**  
	•	Availability engine must normalize to provider timezone.  
	•	DST transitions validated in unit tests.  
  
**7.5.3 Localization (Scale Phase)**  
	•	i18n pipeline (future): Next.js appDir i18n routing.  
	•	Locale detection by Accept-Language header.  
  
⸻  
##   
**7.6 Performance Budgets (CI/CD Enforced)**  
	•	Lighthouse CI thresholds:  
	•	Performance ≥ 90.  
	•	TTI (Time to Interactive) ≤ 3s on 4G.  
	•	CLS (Cumulative Layout Shift) ≤ 0.1.  
	•	k6 load tests must meet thresholds:  
	•	<0.5% error rate.  
	•	Zero overselling slots.  
  
⸻  
##   
**7.7 Monitoring & Metrics**  
##   
**7.7.1 Sentry**  
	•	Capture perf spans for API handlers.  
	•	Trace slow DB queries.  
	•	Alert on >5% error rate in any endpoint.  
  
**7.7.2 Analytics**  
	•	Log event timings: search latency, booking creation latency.  
	•	Aggregate daily p95 + p99 in dashboards.  
  
**7.7.3 Synthetic Monitoring**  
	•	Scheduled Playwright scripts hit staging every 5 minutes.  
	•	Alert if median latency > threshold.  
  
⸻  
##   
**7.8 Graceful Degradation**  
	•	Redis unavailable: fall back to DB queries with lower TTL cache.  
	•	Supabase degraded: switch app to **browse-only mode**, disable booking mutations.  
	•	Stripe down: disable checkout flows, show banner, queue booking attempts.  
  
⸻  
##   
**7.9 Scaling Roadmap**  
	•	**MVP**: Redis caching, Supabase connection pooling, Vercel Edge caching.  
	•	**Growth**: Add dedicated job workers (BullMQ or Supabase functions).  
	•	**Scale**: Sharded Redis, read replicas for Postgres, global edge compute functions.  
  
⸻  
##   
**7.10 Example – Optimized Search Flow**  
	1.	Request: /api/search?q=wellness&limit=20.  
	2.	Hash query + filters → Redis cache check.  
	3.	Cache miss → Postgres full-text search.  
	•	Indexed on providers.name, services.title.  
	•	Join with reviews aggregate.  
	4.	Result stored in Redis with 60s TTL.  
	5.	Response sent, <200ms p95.  
  
⸻  
##   
**7.11 Example – Availability Hold**  
  
```
// lib/availability/holdSlot.ts
import { redis } from "@/lib/redis";

export async function holdSlot(providerId: string, slotKey: string, ttl = 600) {
  const key = `hold:${providerId}:${slotKey}`;
  const acquired = await redis.set(key, "1", { nx: true, ex: ttl });
  if (!acquired) throw new Error("E_AVAIL_CONFLICT");
  return true;
}

```
  
	•	Uses Redis atomic SET NX EX.  
	•	Prevents overselling under high concurrency.  
  
⸻  
##   
**7.12 Performance SLA**  
	•	Global users (EU, NA, APAC) must see TTFB < 500ms.  
	•	Booking availability queries scale to 100k concurrent users.  
	•	Provider dashboard must load in < 2s median.  
	•	Escrow + payout events processed within < 60s from Stripe event.  
  
⸻  
  
## ⏹️** End of Chunk 7: Performance & Scaling Mandates**  
  
⸻  
  
# 📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
  
  
  
# **Chunk 8: Design System & UI Standards**  
  
  
  
  
  
## **8.0 Design Philosophy**  
  
  
* Consistency > Creativity: providers’ profiles should feel custom but platform-wide patterns must be uniform.  
* Accessibility-first: WCAG 2.1 AA baseline, AAA where feasible.  
* Mobile-first: smallest screens are primary; desktop enhancements are secondary.  
* Simplicity & clarity: minimal cognitive load — every UI element must explain itself.  
* Trust signals always visible: pricing transparency, security badges, and booking buttons must be prominent.  
  
  
  
  
  
## **8.1 Core Stack**  
  
  
* Tailwind CSS → canonical utility-first styling.  
* ShadCN UI (Radix primitives + Tailwind) → base component library.  
* Framer Motion → declarative animations, micro-interactions.  
* next/font → typography pipeline.  
  
  
No alternate UI libraries permitted unless DEVIATION flagged.  
  
  
  
  
## **8.2 Typography**  
  
  
* Canonical font: Inter (via next/font/google).  
* Code/monospace: IBM Plex Mono.  
* Sizing scale (Tailwind tokens):   
    * Heading 1: text-4xl font-bold  
    * Heading 2: text-2xl font-semibold  
    * Heading 3: text-xl font-semibold  
    * Body: text-base font-normal  
    * Small: text-sm text-muted-foreground  
*   
  
  
Line height defaults:  
  
* Headings → 1.2  
* Body → 1.5  
  
  
  
  
  
## **8.3 Color Palette**  
  
  
Defined in tailwind.config.js.  
  
* Primary: #2563eb (blue-600).  
* Primary Hover: #1d4ed8 (blue-700).  
* Secondary: #64748b (slate-500).  
* Background: #ffffff (light mode), #0f172a (dark mode).  
* Surface: #f8fafc (slate-50).  
* Text: #0f172a (dark), #f1f5f9 (light).  
* Accent: #10b981 (emerald-500) for success states.  
* Error: #ef4444 (red-500).  
* Warning: #f59e0b (amber-500).  
  
  
Dark mode supported via class="dark".  
  
  
  
  
## **8.4 Spacing & Layout**  
  
  
* Grid system: Tailwind grid/flex only.  
* Container max-widths:   
    * sm: 640px  
    * md: 768px  
    * lg: 1024px  
    * xl: 1280px  
*   
* Gutters: px-4 on mobile, px-8 desktop.  
* Vertical spacing: multiples of 4px (Tailwind scale).  
* Provider profile hero: always full-width (w-full h-[320px]).  
  
  
  
  
  
## **8.5 Component Standards**  
  
  
  
**8.5.1 Buttons**  
  
  
* ShadCN Button variants only.  
* Variants: primary, secondary, ghost, destructive.  
* Example:  
  
```
<Button variant="primary" size="lg">Book Now</Button>

```
  
**8.5.2 Forms**  
  
  
* Use ShadCN Form components.  
* Validation errors shown inline (text-red-500 text-sm mt-1).  
* Required fields marked with *.  
  
  
  
**8.5.3 Modals**  
  
  
* ShadCN Dialog required for booking modal.  
* Close on escape key + backdrop click.  
* Trap focus inside modal.  
  
  
  
**8.5.4 Navigation**  
  
  
* Top navbar: Ecosystem logo (left), search (center), auth/profile (right).  
* Dashboard sidebar: collapsible, icons + labels.  
  
  
  
**8.5.5 Cards**  
  
  
* Provider/service cards: shadow-sm, rounded-lg, hover:shadow-md.  
* Include hero image, name, price, CTA.  
  
  
  
  
  
## **8.6 Accessibility**  
  
  
* All interactive elements must have aria-label or aria-labelledby.  
* Contrast ratio ≥ 4.5:1 for text.  
* Forms: associate labels with inputs.  
* Focus states: visible outlines (blue-500).  
* Screen reader only text (sr-only) for non-text icons.  
* Animations must respect prefers-reduced-motion.  
  
  
  
  
  
## **8.7 Animations & Micro-Interactions**  
  
  
* Framer Motion:   
    * Fade/slide-in for modals.  
    * Hover spring scale (0.98–1.02) on buttons/cards.  
    * Booking confirmation → subtle checkmark morph.  
*   
* Animation duration: 150–300ms max.  
* No infinite looping animations.  
  
  
  
  
  
## **8.8 Provider Profile Page Standard**  
  
  
Composition:  
  
1. Hero Section:   
    * Background image/video (Supabase Storage).  
    * Provider name + categories.  
    * “Book Now” CTA.  
2.   
3. Services Section:   
    * List of services with price/duration.  
    * CTA to expand availability.  
4.   
5. About Section:   
    * Provider bio, testimonials.  
6.   
7. Availability Section:   
    * Calendar widget (14-day preview).  
    * Click → open booking modal.  
8.   
9. Reviews Section:   
    * Customer ratings, text.  
    * Average rating + count.  
10.   
  
  
  
  
  
## **8.9 Provider Dashboard Standards**  
  
  
* Sidebar navigation (services, bookings, earnings, settings).  
* Dashboard cards with key metrics:   
    * Upcoming bookings.  
    * Earnings this month.  
    * New reviews.  
*   
* Charts (earnings trends) via react-chartjs-2 (lazy-loaded).  
  
  
  
  
  
## **8.10 Customer Booking Flow UI**  
  
  
* Booking modal steps:   
    1. Select date/time.  
    2. Enter details (guest: email/name).  
    3. Payment method (Stripe checkout).  
    4. Confirmation screen.  
*   
* Show total price with guest surcharge itemized.  
* Display countdown timer (10m hold).  
  
  
  
  
  
## **8.11 Design Tokens**  
  
  
Defined in /docs/DESIGN-SYSTEM.md.  
  
* Colors, typography, spacing exported as Tailwind theme.  
* Components must consume tokens, not hard-coded values.  
* Design tokens versioned with semver (design-tokens@1.0.0).  
  
  
  
  
  
## **8.12 Visual Regression Guardrails**  
  
  
* Percy/Chromatic baseline per component.  
* No component visual changes allowed without explicit design approval.  
* Booking modal, provider card, and dashboard nav considered critical visual components.  
  
  
  
  
  
## **8.13 Branding & Trust**  
  
  
* Ecosystem logo: SVG stored in /public/brand/logo.svg.  
* Brand accent: blue gradient (from-blue-600 to-blue-400).  
* Booking/payment screens must include “Secured by Stripe” lock badge.  
* Guest surcharge explained in tooltip + checkout line item.  
  
  
  
  
  
## **8.14 Error & Empty States**  
  
  
* Error messages: short, actionable.  
* Empty states must suggest next action.   
    * Example: “No bookings yet. Create a service to get started.”  
*   
* Loading states: skeleton loaders, not spinners.  
  
  
  
  
  
## **8.15 Internationalization (Future-Scale)**  
  
  
* All UI strings in /locales/{lang}.json.  
* next-intl integration recommended.  
* Fallback: English (US).  
* RTL languages supported via Tailwind rtl: classes.  
  
  
  
  
  
## **8.16 Example – Booking Modal Component**  
  
```
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { motion } from "framer-motion";

export function BookingModal({ service }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="primary">Book Now</Button>
      </DialogTrigger>
      <DialogContent className="p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-xl font-semibold">{service.name}</h2>
          <p className="text-sm text-muted-foreground">${service.price}</p>
          {/* Stepper, forms, etc */}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

```
  
  
  
  
## **8.17 UX Laws (Immutable)**  
  
  
* Book Now always visible on provider profiles.  
* Price transparency at all booking steps.  
* Accessibility compliance enforced via CI.  
* Error states never dead-ends → always suggest a retry or next step.  
  
  
  
  
  
## **8.18 DoD (Definition of Done – UI)**  
  
  
A UI feature is not complete unless:  
  
* Adheres to design tokens.  
* Responsive on mobile, tablet, desktop.  
* Passes accessibility audit (axe, Lighthouse).  
* Screenshots added to Percy baseline.  
* Skeleton loaders + error states implemented.  
  
  
  
  
⏹️ End of Chunk 8: Design System & UI Standards  
  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
  
**Chunk 9: Roadmap & Implementation Matrix**  
  
⸻  
  
**9.0 Philosophy of the Roadmap**  
	•	**Clarity over optimism**: all features tagged as ✅ Implemented, 🟨 Stubbed, or ❌ Missing.  
	•	**Phase-locked**: MVP → Growth → Scale; features outside current phase must not block MVP.  
	•	**Execution-first**: roadmap is not aspirational; it’s the playbook.  
	•	**Living document**: changes require explicit commit updates to /docs/ROADMAP.md.  
  
⸻  
  
**9.1 Phase Breakdown**  
  
**9.1.1 MVP (Minimum Viable Product)**  
  
Goal: get providers live with bookable profiles, handle transactions, and validate flows.  
  
**Scope:**  
	•	Provider onboarding (profile, services, availability).  
	•	Provider profiles as landing pages.  
	•	Customer discovery (search/filter).  
	•	Booking flow (holds, payments, provider accept/reject).  
	•	Guest checkout with surcharge.  
	•	Stripe Connect integration (escrow, payouts).  
	•	Basic refunds.  
	•	Security baseline (RLS, CSRF, headers).  
	•	Logging & monitoring (Sentry).  
	•	Unit + integration + E2E test coverage (≥80%).  
  
⸻  
  
**9.1.2 Growth Phase**  
  
Goal: improve trust, usability, and platform stickiness.  
  
**Scope:**  
	•	Messaging between customers/providers.  
	•	Reviews & ratings.  
	•	Enhanced provider dashboards (earnings graphs, KPIs).  
	•	Advanced discovery (location radius search, popularity ranking).  
	•	Automated notifications (reminders, review prompts).  
	•	Internationalization (multi-language, multi-currency).  
	•	Mobile app scaffolding (React Native or Expo).  
	•	Trust & verification features (ID badges, verified providers).  
	•	Expanded refund policies (partial, conditional).  
  
⸻  
  
**9.1.3 Scale Phase**  
  
Goal: global expansion + enterprise features.  
  
**Scope:**  
	•	AI-powered discovery (semantic search, recommendations).  
	•	Provider marketing tools (SEO landing, promotions).  
	•	White-label support for enterprise customers.  
	•	Role-based teams (multi-user provider accounts).  
	•	Webhooks for providers to sync bookings to external CRMs.  
	•	Dedicated background jobs (BullMQ, Kafka).  
	•	Sharded Redis, Postgres read replicas.  
	•	SOC2/GDPR full compliance audits.  
	•	Native mobile apps (iOS/Android full).  
  
⸻  
  
**9.2 Implementation Matrix**  
  
**Feature**	**Status**	**Phase**	**Notes**  
**Provider onboarding** (multi-step wizard)	🟨 Stubbed	MVP	Flow scaffolded, Stripe Connect sync incomplete  
**Provider profile pages**	✅ Implemented	MVP	Hero, services, booking button live  
**Service discovery**	🟨 Stubbed	MVP	Basic search built, advanced filters missing  
**Booking flow** (availability, holds, confirm, cancel)	🟨 Stubbed	MVP	Holds + confirm exist, refund logic partial  
**Guest checkout** (10% surcharge)	🟨 Stubbed	MVP	Docs exist, surcharge calc incomplete in UI  
**Stripe Connect payouts**	❌ Missing	MVP	Escrow capture implemented, transfers not live  
**Refunds**	🟨 Stubbed	MVP	Partial refunds not wired, policy engine incomplete  
**Security headers + RLS**	✅ Implemented	MVP	Baseline shipped, needs audit  
**Sentry monitoring**	✅ Implemented	MVP	Error capture wired  
**Unit tests**	🟨 Stubbed	MVP	Partial coverage, <80% threshold  
**Integration tests**	❌ Missing	MVP	To be implemented  
**E2E booking tests**	❌ Missing	MVP	Planned in Playwright  
**Messaging**	❌ Missing	Growth	Not in MVP  
**Reviews & ratings**	❌ Missing	Growth	Planned after MVP stability  
**Provider dashboards (analytics)**	❌ Missing	Growth	Stub UI only  
**Internationalization**	❌ Missing	Growth	Future roadmap  
**Notifications (reminders, emails)**	🟨 Stubbed	Growth	Booking emails exist, reminders missing  
**AI discovery**	❌ Missing	Scale	Semantic search future  
**Enterprise features (teams, webhooks)**	❌ Missing	Scale	Deferred  
  
  
⸻  
  
**9.3 Roadmap Priorities (as of 2025-08-25)**  
	1.	**Stabilize MVP flows**:  
	•	Complete Stripe Connect payouts.  
	•	Wire refunds policy engine.  
	•	Build E2E booking test suite.  
	•	Harden RLS + CSRF audit.  
	2.	**MVP Launch Readiness**:  
	•	Document provider onboarding clearly.  
	•	Enforce guest surcharge in all flows.  
	•	Achieve 85%+ test coverage baseline.  
	3.	**Growth Phase Kickoff**:  
	•	Launch reviews + messaging for stickiness.  
	•	Build notifications pipeline.  
	•	Expand discovery features (ranking + location).  
	4.	**Scale Prep**:  
	•	Shard Redis, prep read replicas.  
	•	Begin compliance documentation for SOC2/GDPR.  
	•	Design AI-powered discovery experiments.  
  
⸻  
  
**9.4 DoD (Definition of Done) by Phase**  
	•	**MVP Done When**:  
	•	Providers can onboard → publish → get bookings → receive payouts.  
	•	Customers (guest/auth) can search → book → pay → receive confirmations.  
	•	Refunds, monitoring, and tests are live.  
	•	**Growth Done When**:  
	•	Customers can chat, review, and trust verified providers.  
	•	Notifications + dashboards improve engagement.  
	•	Multi-language + multi-currency expand reach.  
	•	**Scale Done When**:  
	•	Ecosystem supports enterprise accounts.  
	•	AI discovery increases conversion.  
	•	Platform resilient under global traffic.  
  
⸻  
  
**9.5 Implementation Risks**  
	•	**Stripe payouts** (MVP blocker).  
	•	**Refund engine** complexity.  
	•	**RLS misconfigurations** leading to data leaks.  
	•	**Guest surcharge logic** inconsistencies across UI vs backend.  
	•	**Insufficient testing coverage** delaying production readiness.  
  
⸻  
  
**9.6 Example – Roadmap Diagram (Mermaid)**  
  
flowchart TD  
  A[MVP Phase] --> B[Growth Phase]  
  B --> C[Scale Phase]  
  
  A --> A1[Provider Onboarding ✅🟨]  
  A --> A2[Booking Flow 🟨]  
  A --> A3[Guest Checkout 🟨]  
  A --> A4[Stripe Payouts ❌]  
  A --> A5[Refunds 🟨]  
  A --> A6[Security Baseline ✅]  
  
  B --> B1[Messaging ❌]  
  B --> B2[Reviews ❌]  
  B --> B3[Dashboards ❌]  
  B --> B4[Notifications 🟨]  
  
  C --> C1[AI Discovery ❌]  
  C --> C2[Enterprise Tools ❌]  
  C --> C3[Mobile Native ❌]  
  
  
⸻  
  
**9.7 Roadmap SLA**  
	•	**Weekly roadmap sync** required.  
	•	All roadmap updates must be logged in docs/ROADMAP.md.  
	•	Agents must always cross-check implementation status before generating code.  
	•	No feature flagged as ✅ unless test coverage and documentation are complete.  
  
⸻  
  
⏹️ **End of Chunk 9: Roadmap & Implementation Matrix**  
📜** ECOSYSTEM MARKETPLACE – MASTER PRD / AGENT CONSTITUTION**  
##   
**Chunk 10: Agent Usage Instructions**  
  
⸻  
##   
**10.0 Purpose**  
  
## **This chunk defines how AI coding/design/testing/documentation agents must interpret and interact with the Ecosystem Marketplace constitution.**  
## **It is the “user manual for the constitution itself.”**  
## **No agent may generate, modify, or propose features without adhering to these rules.**  
  
⸻  
##   
**10.1 Agent Operating Principles**  
	•	**Single source of truth**: all outputs must be consistent with Chunks 1–9.  
	•	**Documentation first**: if information is missing, check /docs/ equivalents (ARCHITECTURE.md, ROADMAP.md, etc.).  
	•	**Fail loudly**: if a spec is unclear or missing, return a ⚠️ CLARIFICATION NEEDED marker.  
	•	**No hallucination**: do not assume implementation details beyond this constitution.  
	•	**Immutable constraints**: business model (10% commission, 10% guest surcharge, Stripe-only payments, Clerk-only auth, Supabase-only DB) may never be altered unless tagged DEVIATION.  
  
⸻  
##   
**10.2 Output Tagging**  
##   
## **All agent outputs must include explicit tags for feature status:**  
	•	✅ Implemented → feature is coded, tested, and documented.  
	•	🟨 Stubbed → feature scaffold exists, incomplete logic or missing coverage.  
	•	❌ Missing → feature not built at all.  
  
Agents must always tag features before describing or coding them.  
  
⸻  
##   
**10.3 Deviation Protocol**  
  
**If an agent proposes something that differs from constitution rules, it must include:**  
  
```
⚠️ DEVIATION:
- What deviates
- Why deviation is proposed
- Risk/benefit analysis
- Phase impact (MVP/Growth/Scale)

```
  
## **Deviations without this block are invalid.**  
  
⸻  
##   
**10.4 Self-Audit Requirement**  
  
## **Before finalizing output, agent must run a self-audit checklist:**  
	1.	Does this align with business model (10% + 10% guest surcharge)?  
	2.	Does this respect the canonical stack (Next.js 14, Supabase, Clerk, Stripe, Tailwind, ShadCN, Redis)?  
	3.	Are RLS, Zod validation, and rate limiting enforced?  
	4.	Is idempotency applied to mutating operations?  
	5.	Does this phase match roadmap status (MVP vs Growth vs Scale)?  
	6.	Is feature status tagged (✅, 🟨, ❌)?  
	7.	Are all outputs type-safe (TypeScript)?  
	8.	Is logging and monitoring integrated?  
  
If any answer is **no**, agent must output ⚠️ CONSTITUTION BREACH with explanation.  
  
⸻  
##   
**10.5 Scope Control**  
	•	**Do not implement outside roadmap phase** unless explicitly asked.  
	•	**Do not generate enterprise/AI features** during MVP unless requested.  
	•	**Do not introduce new 3rd-party dependencies** without DEVIATION.  
	•	**Do not modify financial flows** (commission, surcharge, payouts).  
  
⸻  
##   
**10.6 Coding Standards for Agents**  
	•	All code must be **TypeScript + Drizzle ORM**.  
	•	API routes must use **Next.js App Router**.  
	•	All inputs must use **Zod schemas**.  
	•	All DB queries must go through /db/queries/.  
	•	All state management must use **Zustand + Immer**.  
	•	All UI components must be **ShadCN + Tailwind**.  
	•	All animations must use **Framer Motion**.  
	•	All secrets accessed via environment variables, never hardcoded.  
	•	All logging must go through lib/logger.ts.  
  
⸻  
##   
**10.7 Documentation Standards for Agents**  
	•	When documenting, reference canonical docs by filename.  
	•	Use structured Markdown with headings.  
	•	Always update or generate new entries under /docs/ if knowledge expands.  
	•	Documentation must flag missing pieces with ❌.  
  
⸻  
##   
**10.8 Testing Standards for Agents**  
	•	Every new function must include unit tests (Jest).  
	•	Every new API must include integration tests.  
	•	Every new flow must include E2E tests (Playwright).  
	•	Every test must include at least one **negative case**.  
	•	Coverage below thresholds → ⚠️ TEST COVERAGE BREACH.  
  
⸻  
##   
**10.9 Error Handling Protocol**  
  
**All agent-generated APIs must follow canonical error model (§4.14):**  
  
{ "error": { "code": "E_AVAIL_CONFLICT", "message": "Selected slot unavailable.", "hint": "Refresh availability and retry." } }  
  
## **Agents must not use ad-hoc error shapes.**  
  
⸻  
##   
**10.10 Communication Rules**  
	•	When asked for code → return **only code**, not pseudo.  
	•	When asked for architecture → return structured, file-level breakdowns.  
	•	When asked for roadmap → return tagged matrix.  
	•	When uncertain → ask for clarification using ⚠️ CLARIFICATION NEEDED.  
  
⸻  
##   
**10.11 Example Agent Workflow**  
	1.	Input: *“Implement booking cancel API”*  
	2.	Agent checks constitution:  
	•	Business model rules (refund engine).  
	•	Canonical stack (Next.js route, Drizzle).  
	•	Roadmap (MVP: refunds stubbed).  
	3.	Output must include:  
	•	✅/🟨/❌ status.  
	•	Route handler code (with Zod, RLS).  
	•	Corresponding tests.  
	•	Docs reference (PAYMENTS-IMPLEMENTATION.md).  
  
⸻  
##   
**10.12 Forbidden Agent Behaviors**  
	•	❌ Introducing alternative auth providers.  
	•	❌ Using raw SQL queries.  
	•	❌ Suggesting changes to commission/surcharge rates.  
	•	❌ Deploying untested code.  
	•	❌ Silent assumptions (must always declare).  
  
⸻  
##   
**10.13 Phase Awareness**  
	•	MVP agents may not generate Growth or Scale features unless specifically unlocked.  
	•	Growth-phase features must wait until MVP is ✅.  
	•	Scale features may not block MVP/Growth.  
  
⸻  
##   
**10.14 Operator Instructions**  
  
**Platform operator may override constitution temporarily via DEVIATION.**  
## **Operators must always log overrides in **/docs/ROADMAP.md** with commit reference.**  
  
⸻  
##   
**10.15 Final Agent Pledge**  
##   
## **All agents working on Ecosystem Marketplace must adhere to this constitution.**  
## **Outputs inconsistent with business model, tech stack, or roadmap are invalid unless marked with DEVIATION.**  
## **Every line of code, doc, or test must strengthen:**  
	•	Trust  
	•	Simplicity  
	•	Scalability  
  
Agents failing compliance must declare ⚠️** CONSTITUTION BREACH**.  
  
⸻  
##   
****Below is a developer-optimized, implementation-level spec that closes ambiguity for agents. It’s opinionated on layout, file locations, error-localization, and diagnostic workflows so an agent can jump straight to the right place instead of “scanning the repo.”****  
  
## **Use this as the navigation map + execution contract for Cursor/Claude Code.**  
  
⸻  
##   
**Execution-Ready Spec: App vs Account vs Studio**  
##   
*(with precise file paths, page anatomy, error-localization playbooks, and agent search strategies)*  
##   
**0) Namespaces (Hard Split)**  
	•	**App (Public):** browsing, search, provider/event pages  
Root: /app/* (public)  
Chrome: /app/layout.tsx → components/nav/PublicHeader.tsx  
	•	**Account (Private, customer):** profile, saved, notifications, billing  
Root: /app/account/*  
Chrome: /app/account/layout.tsx → components/nav/AccountSidebar.tsx  
	•	**Studio (Private, provider):** listings, events, availability, bookings, earnings, payouts, landing editor, settings  
Root: /app/studio/*  
Chrome: /app/studio/layout.tsx → components/nav/StudioSidebar.tsx  
  
**Middleware/guards:**  
	•	Path gating in /middleware.ts  
	•	Role & readiness logic: /lib/auth/guards.ts  
	•	Role claims: Clerk custom claims preferred; fallback: getProfile(userId) (/db/queries/getProfile.ts)  
  
⸻  
##   
**1) Page Anatomy & Layout Contracts**  
##   
**1.1 Public Shell (/app/layout.tsx)**  
	•	**Header:** components/nav/PublicHeader.tsx  
	•	Left: Logo  
	•	Center (≥md): GlobalSearch  
	•	Right: AccountMenu (Sign in / Profile / Open Studio link if provider)  
	•	**Footer:** components/footer/PublicFooter.tsx (legal, support email)  
	•	**Toasts/Alerts:** components/ui/Toaster.tsx (mounted once)  
  
## **DoD: no private links; fast TTFB; header remains ≤56px height.**  
  
⸻  
##   
**1.2 Account Shell (/app/account/layout.tsx)**  
	•	**Grid:** grid-cols-[240px_1fr] (≥md), single column on mobile  
	•	**Sidebar:** components/nav/AccountSidebar.tsx  
Items: Overview, Profile, Saved, Notifications, Billing, (if role provider → “Open Studio”)  
	•	**Main:** breadcrumbs (components/nav/Breadcrumbs.tsx) + page content  
  
## **No global search here. Private look & feel.**  
  
⸻  
##   
**1.3 Studio Shell (/app/studio/layout.tsx)**  
	•	**Grid:** grid-cols-[260px_1fr] (≥md)  
	•	**Sidebar:** components/nav/StudioSidebar.tsx  
Items (fixed order): Overview, Listings, Events, Availability, Bookings, Earnings, Payouts, Landing Page, Settings  
	•	**Main:** page header (title + CTA), tab strip if needed, content  
  
## **Zero public chrome. No search.**  
  
⸻  
##   
**2) Route Map (Authoritative)**  
  
/app/page.tsx                          *// Discover (public)*  
/app/search/page.tsx                   *// Multi-index search*  
/app/providers/[slug]/page.tsx         *// Public provider page*  
/app/events/page.tsx                   *// Public events list*  
/app/events/[slug]/page.tsx            *// Public event page*  
  
/app/account/page.tsx                  *// Account overview*  
/app/account/profile/page.tsx  
/app/account/saved/page.tsx  
/app/account/notifications/page.tsx  
/app/account/billing/page.tsx  
  
/app/studio/page.tsx                   *// Studio overview*  
/app/studio/listings/page.tsx  
/app/studio/events/page.tsx  
/app/studio/availability/page.tsx  
/app/studio/bookings/page.tsx  
/app/studio/earnings/page.tsx  
/app/studio/payouts/page.tsx  
/app/studio/landing-editor/page.tsx  
/app/studio/settings/page.tsx  
  
**API (selected):**  
  
/app/api/search/route.ts  
/app/api/providers/route.ts  
/app/api/providers/[slug]/route.ts  
/app/api/events/route.ts  
/app/api/events/[slug]/route.ts  
/app/api/bookings/hold/route.ts  
/app/api/bookings/confirm/route.ts  
/app/api/bookings/cancel/route.ts  
/app/api/providers/connect/route.ts  
/app/api/stripe/webhooks/route.ts  
  
  
⸻  
##   
**3) Public Pages – Content Contracts**  
##   
**3.1 Discover (/app/page.tsx)**  
	•	**Sections:** Featured Biomes, Trending Providers, Trending Events  
	•	**Components:**  
	•	components/biomes/BiomeGrid.tsx  
	•	components/providers/ProviderCard.tsx  
	•	components/events/EventCard.tsx  
	•	**Data (RSC loaders):**  
	•	lib/search/providers.ts:getTrendingProviders()  
	•	lib/search/events.ts:getTrendingEvents()  
	•	db/queries/getFeaturedBiomes.ts  
  
## **Cache: edge cache 60s; tags → revalidateTag('providers'), revalidateTag('events').**  
  
⸻  
##   
**3.2 Search (/app/search/page.tsx)**  
	•	**Top Tabs (vertical switch):** Providers | Services | Events | Biomes | People (flagged)  
## **components/nav/GlobalTabs.tsx (maps to type=)**  
	•	**Secondary Segmented (“By …”):** per type (by= presets)  
## **components/nav/ByTabs.tsx (reads lib/search/presets.ts)**  
	•	**Filter drawer:** components/search/FiltersDrawer.tsx (URL-bound)  
	•	**Result list:** virtualized grid; per-type card renderer  
  
## **Controller: /app/api/search/route.ts → dispatch to lib/search/{type}.ts**  
## **Cache: Redis per hash(type+by+filters) 60s.**  
  
⸻  
##   
**3.3 Provider Page (/app/providers/[slug]/page.tsx)**  
	•	**Sections:** hero (image/video), services list, availability preview, reviews, events (tab), About  
	•	**Primary CTA:** “Book Now” (fixed position on mobile)  
	•	**No inline editing** (Studio-only)  
  
**Data:**  
	•	db/queries/getProviderBySlug.ts  
	•	db/queries/getProviderServices.ts  
	•	db/queries/getProviderEvents.ts  
	•	db/queries/getProviderReviews.ts  
  
## **Cache: ISR + tag provider:{id}; invalidated on Studio publish.**  
  
⸻  
##   
**3.4 Event Page (/app/events/[slug]/page.tsx)**  
	•	**Sections:** hero, schedule (occurrences), price, venue/map, provider snippet, “Book Ticket”  
	•	**Views:** list | calendar | map (if geo) via view= param  
  
**Data:**  
	•	db/queries/getEventBySlug.ts  
	•	db/queries/getEventOccurrences.ts  
  
⸻  
##   
**4) Account (Customer) Pages – Content Contracts**  
##   
**4.1 Account Overview (/app/account/page.tsx)**  
	•	**Cards:** upcoming bookings, saved items, notifications summary  
	•	**Data:** db/queries/getUpcomingBookingsByUser.ts, db/queries/getSavedItems.ts  
  
**4.2 Saved (/app/account/saved/page.tsx)**  
	•	**Tabs:** providers | services | events  
	•	**Data:** db/queries/getSavedByType.ts  
  
**4.3 Notifications / Billing**  
	•	Controlled forms with Zod; write via actions/account-actions.ts  
	•	Stripe customer portal link optional (if needed)  
  
⸻  
##   
**5) Studio (Provider) Pages – Content Contracts**  
##   
**5.1 Studio Overview (/app/studio/page.tsx)**  
	•	**KPI cards:** upcoming bookings, earnings MTD, review count, Stripe status  
	•	**Data:** db/queries/getProviderOverview.ts  
  
**5.2 Listings (/app/studio/listings/page.tsx)**  
	•	Grid of services (CRUD modal)  
	•	**Actions:** actions/provider-actions.ts:createService/updateService/deleteService  
	•	**Data:** db/queries/getServicesByOwner.ts  
	•	**Validation:** lib/validation/services.ts (Zod)  
  
**5.3 Events (/app/studio/events/page.tsx)**  
	•	List of events + occurrences (nested table)  
	•	**Actions:** actions/event-actions.ts  
	•	**Data:** db/queries/getEventsByOwner.ts  
	•	**Schema:** /db/schema/events-schema.ts, /db/schema/event-occurrences-schema.ts  
  
**5.4 Availability (/app/studio/availability/page.tsx)**  
	•	Weekly calendar + exception editor  
	•	**Data:** db/queries/getAvailabilityRules.ts, getExceptions.ts  
	•	**Actions:** actions/availability-actions.ts  
	•	**Engine:** lib/availability/generateSlots.ts  
  
**5.5 Bookings (/app/studio/bookings/page.tsx)**  
	•	Table with state chips; accept/decline/reschedule/refund  
	•	**Actions:** actions/booking-actions.ts → confirm/reject/cancel  
	•	**Policy engine:** lib/payments/policy.ts  
  
**5.6 Earnings / Payouts**  
	•	Charts + transfer history  
	•	**Stripe connect:** lib/stripe.ts:getAccountStatus, transferToProvider  
	•	**Data:** db/queries/getEarnings.ts, getPayouts.ts  
  
**5.7 Landing Editor (/app/studio/landing-editor/page.tsx)**  
	•	Block-based editor composing the same public blocks with edit affordances  
	•	**Data:** db/queries/getProviderForOwner.ts  
	•	**Actions:** actions/landing-actions.ts:saveBlocks/publish  
	•	**Revalidate:** revalidateTag('provider:{id}')  
  
**5.8 Settings**  
	•	Business info, Stripe connect link, policies  
	•	**Stripe:** actions/stripe-actions.ts:createAccountLink  
	•	**RLS:** only owner can write; server derives providerId, never from client  
  
⸻  
##   
**6) Error Localization Playbooks (Symptom → File)**  
##   
**Booking can’t hold slot (E_AVAIL_CONFLICT)**  
	1.	Check lib/availability/holdSlot.ts (Redis SET NX EX)  
	2.	Check db/queries/getActiveHolds.ts  
	3.	If many conflicts under light load → review lib/availability/generateSlots.ts race on capacity subtraction  
  
**Payment captured but booking not confirmed**  
	1.	app/api/stripe/webhooks/route.ts → payment_intent.succeeded handler  
	2.	lib/webhook-idempotency.ts (look for replay skip)  
	3.	Booking transition in actions/booking-actions.ts:markConfirmed  
	4.	Sentry breadcrumb: payment_authorized → missing? Add in lib/stripe.ts  
  
**Guest surcharge missing on UI**  
	1.	UI total at components/checkout/OrderSummary.tsx  
	2.	Pricing calc at lib/payments/pricing.ts:computeTotals(P, guest)  
	3.	API verify at app/api/bookings/hold/route.ts before intent creation  
	4.	Snap test in __tests__/pricing.spec.ts  
  
**Provider can access another provider’s listing**  
	1.	RLS policies in /db/migrations/*rls*.sql (providers/services/bookings)  
	2.	Server reads in actions/* ensure providerId derived from owner, not body param  
	3.	Integration test: __tests__/security/rls.spec.ts  
  
**Events calendar empty on weekend**  
	1.	URL param mapping view/by in /app/events/page.tsx  
	2.	Date window builder lib/search/presets.ts:eventsPresets  
	3.	Occurrence query: db/queries/getEventOccurrencesInRange.ts + timezone conversion checks  
  
⸻  
##   
**7) Agent Navigation & Targeted Search (don’t “scan,” jump)**  
##   
**Go-to queries (ripgrep / code search)**  
	•	“Find pricing math”:  
	•	rg "computeTotals|guest surcharge|application_fee_amount" -- lib app  
	•	“Find booking state machine”:  
	•	rg "status=.*(hold|confirmed|pending_provider)" -- db lib actions  
	•	“Find idempotency”:  
	•	rg "Idempotency-Key|idempotenc" -- app lib  
	•	“Find RLS policies”:  
	•	rg "CREATE POLICY|RLS" -- db/migrations  
	•	“Find Stripe webhooks”:  
	•	rg "payment_intent|account.updated|webhook" -- app/api lib  
	•	“Find availability engine”:  
	•	rg "generateSlots|availability_rules|exceptions" -- lib db  
	•	“Find events schema”:  
	•	rg "event_occurrences|events.*pgTable" -- db/schema  
  
**Module entrypoints (memorize):**  
	•	Payments: lib/stripe.ts + lib/payments/*  
	•	Availability: lib/availability/*  
	•	Pricing: lib/payments/pricing.ts  
	•	Policy engine: lib/payments/policy.ts  
	•	Search: lib/search/*, controller /app/api/search/route.ts  
	•	Auth guards: lib/auth/guards.ts  
	•	Logging: lib/logger.ts  
	•	Rate limit: lib/security/rate-limit.ts  
  
⸻  
##   
**8) Feature Flags & Config (single sources)**  
	•	**Flags:** /lib/config/features.ts (read-only import; no runtime mutation client-side)  
	•	**Env:** .env, Vercel envs, referenced only from server files  
	•	**Constants (URLs, names):** /lib/config/constants.ts  
	•	**Design tokens:** Tailwind config + /docs/DESIGN-SYSTEM.md  
  
⸻  
##   
**9) Diagnostics & Observability (pin the breadcrumb)**  
	•	Always attach requestId (header → logger context).  
	•	Breadcrumbs to capture:  
	•	search_performed, hold_created, payment_authorized, booking_confirmed, refund_issued  
	•	Emit via lib/logger.ts (JSON, includes userId, bookingId, providerId).  
	•	Sentry: set span around DB + Stripe calls, tag area:payments|availability|search.  
  
⸻  
##   
**10) Error Taxonomy (uniform)**  
##   
## **Codes and sources (all caps, stable):**  
	•	E_AVAIL_CONFLICT → lib/availability/holdSlot.ts, API holds  
	•	E_HOLD_EXPIRED → holds sweeper (Vercel Cron)  
	•	E_PAYMENT_FAIL → lib/stripe.ts + webhook feedback  
	•	E_POLICY_BLOCK → lib/payments/policy.ts  
	•	E_RLS_DENY → surfaced from DB access control  
	•	E_RATE_LIMIT → lib/security/rate-limit.ts  
	•	E_IDEMPOTENT_REPLAY → lib/webhook-idempotency.ts  
  
**API payload shape (mandatory):**  
  
{ "error": { "code": "E_AVAIL_CONFLICT", "message": "Selected slot unavailable.", "hint": "Refresh availability and retry." } }  
  
  
⸻  
##   
**11) Test Pointers (where to add or look)**  
	•	Unit: __tests__/unit/*  
	•	pricing: __tests__/unit/pricing.spec.ts  
	•	policy: __tests__/unit/policy.spec.ts  
	•	slots: __tests__/unit/availability.spec.ts  
	•	Integration: __tests__/integration/*  
	•	bookings API: bookings.hold.int.spec.ts, bookings.confirm.int.spec.ts  
	•	stripe webhook: stripe.webhook.int.spec.ts  
	•	E2E: /e2e/* (Playwright)  
	•	guest booking surcharge flow  
	•	provider accept → capture → completion  
	•	studio landing publish → public revalidate  
  
⸻  
##   
**12) High-Risk Implementation Edges (call-out)**  
	•	**Timezone math** (availability & events): normalize to provider TZ; unit tests include DST boundaries.  
	•	**Idempotency on retries**: protect hold/confirm/cancel; use Idempotency-Key header with 24h Redis key.  
	•	**RLS correctness**: never accept providerId from client in Studio; derive from authenticated owner.  
	•	**Stripe Connect transfers**: only after capture + escrow maturity; confirm transfer_group linking.  
	•	**Guest → account claim**: merge profiles by verified email; prevent dup accounts.  
	•	**Search cache invalidation**: invalidate Redis on provider publish, service CRUD, event CRUD.  
  
⸻  
##   
**13) “If you must scan” Protocol (last resort)**  
  
## **When a direct pointer fails, scan in this order:**  
	1.	**Routing layer**: app/api/<area>/route.ts or page under app/<ns>/<page>/page.tsx  
	2.	**Area lib**: lib/<area>/* (payments, availability, search)  
	3.	**DB Queries**: db/queries/* (no inline SQL)  
	4.	**Schema**: db/schema/* (look for missing field or wrong types)  
	5.	**Migrations**: db/migrations/* (RLS, indexes)  
	6.	**Flags**: lib/config/features.ts (feature accidentally off)  
  
Use deterministic searches (ripgrep examples above). Do **not** open the entire repo tree without a hypothesis.  
  
⸻  
##   
**14) Minimal Stubs to Unblock Agents (if missing)**  
	•	lib/payments/pricing.ts → computeTotals(P, isGuest)  
	•	lib/search/presets.ts → maps type, by → filters/date windows  
	•	lib/payments/policy.ts → pure function; returns refund breakdown  
	•	lib/webhook-idempotency.ts → seen(eventId, hash) + TTL  
	•	db/queries/getProviderForOwner.ts → server-only derivation; never from client param  
	•	components/checkout/OrderSummary.tsx → single source for totals line items  
  
⸻  
##   
**15) Command Cheatsheet**  
	•	**Typecheck:** pnpm tsc --noEmit  
	•	**Unit/Integration:** pnpm jest --runInBand  
	•	**E2E:** pnpm playwright test  
	•	**Lint:** pnpm eslint . --max-warnings=0  
	•	**Load (k6):** k6 run scripts/bookings-burst.js  
	•	**Local Redis/Supabase:** docker compose up -d (document compose file)  
	•	**Seed dev data:** pnpm seed → .dev/seed.ts  
  
⸻  
##   
**16) Final Alignment**  
	•	Public **App** is pure discovery/consumption.  
	•	**Account** is your “You” space.  
	•	**Studio** is the provider’s “back office.”  
	•	Each area has **fixed entrypoints** and **known files** so agents can jump directly.  
	•	Error codes, logs, and tests are **pre-agreed contracts**; adhere or raise ⚠️ DEVIATION.  
##   
Below is a **blunt, cleanup-first hardening playbook** to make the repo unambiguous for agents, remove template cruft, and block “clever” workarounds. Paste into /docs/HARDENING.md and enforce via CI.  
  
⸻  
  
**De-Template & Hardening Playbook (Authoritative)**  
  
**0) Truths (non-negotiable)**  
	•	**Single sources**:  
	•	Payments: lib/stripe.ts, lib/payments/*  
	•	Pricing math: lib/payments/pricing.ts  
	•	Refund policy: lib/payments/policy.ts  
	•	Availability: lib/availability/*  
	•	Search: lib/search/* + /app/api/search/route.ts  
	•	RLS & indices: /db/migrations/*  
	•	Feature flags: lib/config/features.ts  
	•	Error codes: lib/errors.ts  
	•	**No forks of logic**. If a feature needs a variant, add a param to the single module. Duplicate modules are rejected in PR.  
  
⸻  
  
**1) Kill-List: Nuke Template Junk (run before anything else)**  
  
Delete, then commit. CI fails if any are present.  
  
**Paths**  
	•	/pages/** (legacy Next pages)  
	•	/components/examples/**, /components/demo/**, /components/marketing/** (unless explicitly used)  
	•	/styles/** except globals.css (Tailwind)  
	•	/public/* demo assets (vercel.svg, stock logos, mock avatars)  
	•	/app/api/hello/route.ts (or any scaffold “hello” endpoints)  
	•	Any *.sample.* left by templates that you don’t actually use  
  
**Files**  
	•	.env.example → keep but remove unused vars  
	•	README.md → rewrite to **this** repo; remove template badges  
	•	Remove service stubs that are replaced by Stripe (lib/payments/fake-*.ts)  
  
**Commands**  
  
```
rg -n "hello world|boilerplate|lorem|template|example|starter" app components lib

```
rg -n "vercel.svg|next.svg|favicon.ico" public  
  
  
⸻  
  
**2) Dependencies: Allowlist / Denylist**  
  
**Allowlist (production)**  
	•	next, react, react-dom, @clerk/nextjs, @supabase/*, drizzle-orm, zod, stripe, ioredis (or Upstash SDK), framer-motion, date-fns, lucide-react, @radix-ui/react-*  
  
**Denylist (remove if present)**  
	•	UI systems: mui, chakra, antd, mantine, bootstrap  
	•	State libs: redux, mobx, recoil  
	•	ORM: prisma, sequelize, raw pg inside app code  
	•	Payment libs other than Stripe  
	•	Random util bloat: lodash (prefer std/small funcs), moment (use date-fns)  
	•	Client router hacks: next/navigation misuse in server files (fix with RSC patterns)  
  
**Checks**  
  
```
npx depcheck
npm ls --depth=0

```
rg -n "from 'prisma'|from 'sequelize'|from 'redux'|from 'recoil'" .  
  
  
⸻  
  
**3) TS/ESLint/Prettier: Lock Configuration (no wiggle room)**  
  
**tsconfig.json (strict)**  
  
```
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM"],
    "jsx": "preserve",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowJs": false,
    "checkJs": false,
    "noEmit": true,
    "paths": { "@/*": ["./"] }
  },
  "include": ["app", "lib", "db", "components", "actions", "scripts", "__tests__", "e2e"]
}

```
  
**.eslintrc.cjs**  
  
```
module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended",
    "plugin:testing-library/react"
  ],
  plugins: ["@typescript-eslint", "unused-imports", "simple-import-sort"],
  rules: {
    "unused-imports/no-unused-imports": "error",
    "simple-import-sort/imports": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "no-restricted-imports": [
      "error",
      { "paths": [{ "name": "pg", "message": "Use Drizzle only" }] }
    ]
  }
};

```
  
**.prettierrc**  
  
{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }  
  
**Block noncompliant PRs in CI** (see §10).  
  
⸻  
  
**4) Tailwind Purge & Tokens**  
	•	Purge only app/**/*.{ts,tsx}, components/**/*.{ts,tsx}, lib/**/*.{ts,tsx}  
	•	Reject ad-hoc color hex codes. Use tokens.  
	•	No global CSS except reset + Tailwind base.  
  
**Scan**  
  
rg -n "#[0-9a-fA-F]{6}" app components | rg -v "(//|\/\*)"  
  
  
⸻  
  
**5) ENV Matrix (remove dead vars)**  
  
Single table in /docs/ENV.md (agents rely on this; delete the rest).  
  
**Key**	**Scope**	**Required**	**Example**	**Description**  
NEXT_PUBLIC_APP_URL	client	yes	https://app.example.com	canonical base URL  
CLERK_*	server/client	yes	…	auth  
SUPABASE_URL, SUPABASE_ANON_KEY	client	yes	…	RSC fetch (public)  
SUPABASE_SERVICE_ROLE	server	yes	…	server actions (never client)  
STRIPE_SECRET_KEY	server	yes	…	stripe SDK  
STRIPE_WEBHOOK_SECRET	server	yes	…	verify webhooks  
REDIS_URL	server	yes	…	rate limit, cache  
FEATURE_FLAGS	server	no	JSON	optional override  
  
Remove anything else. Fail CI if unknown env is referenced:  
  
rg -n "process\.env\.[A-Z_]+" | rg -v "CLERK_|SUPABASE_|STRIPE_|REDIS_|NEXT_PUBLIC_APP_URL|FEATURE_FLAGS"  
  
  
⸻  
  
**6) Error Codes Registry (single file)**  
  
lib/errors.ts exports all codes & messages; API routes import these. No ad-hoc strings.  
  
```
export const ERR = {
  AVAIL_CONFLICT: { code: 'E_AVAIL_CONFLICT', msg: 'Selected slot unavailable.' },
  HOLD_EXPIRED:   { code: 'E_HOLD_EXPIRED', msg: 'Your hold expired.' },
  PAYMENT_FAIL:   { code: 'E_PAYMENT_FAIL', msg: 'Payment failed.' },
  POLICY_BLOCK:   { code: 'E_POLICY_BLOCK', msg: 'Action blocked by policy.' },
  RLS_DENY:       { code: 'E_RLS_DENY', msg: 'Access denied.' },
  RATE_LIMIT:     { code: 'E_RATE_LIMIT', msg: 'Too many requests.' },
  IDEMPOTENT:     { code: 'E_IDEMPOTENT_REPLAY', msg: 'Duplicate request.' }

```
} as const;  
  
**API response helper**  
  
```
export function err(res: NextResponse, e: keyof typeof ERR, hint?: string, status=400) {
  const { code, msg } = ERR[e];
  return NextResponse.json({ error: { code, message: msg, hint } }, { status });
}

```
  
  
⸻  
  
**7) Single-Entry Modules (ban multi-entry drift)**  
  
Create index barrels and force imports through them:  
	•	lib/payments/index.ts → stripe, pricing, policy, webhook-idempotency  
	•	lib/availability/index.ts → generateSlots, holdSlot  
	•	lib/search/index.ts → providers, services, events, biomes, people, presets  
  
ESLint rule: disallow deep paths except the index barrels (enforce via no-restricted-imports).  
  
⸻  
  
**8) DB Hygiene**  
	•	**Migrations are law.** Do not manually alter schemas in dev DB.  
	•	Every table: RLS on, owner/role policies explicit.  
	•	Indexes on: foreign keys, slugs, frequently filtered columns, time ranges.  
	•	Add NOT NULL constraints where possible.  
	•	**ts-prune models**: delete unused schemas/queries.  
  
**Commands**  
  
```
npx ts-prune | rg -v "^(0) "   # investigate > delete dead exports

```
rg -n "SELECT \*" db | rg -v "drizzle"  **# ensure no raw SQL use**  
  
  
⸻  
  
**9) Security Footguns (ban list)**  
	•	No client-provided providerId in Studio writes. Server derives owner → providerId.  
	•	No inline Stripe calls outside lib/stripe.ts.  
	•	No mutating route without Idempotency-Key.  
	•	No API without Zod validation + rate-limit.  
	•	No public response leaking internal IDs beyond what we’ve standardized (use UUIDs, not DB ints).  
	•	No any or // @ts-ignore without // DEVIATION: rationale.  
  
**Scan**  
  
rg -n "@ts-ignore|: any\b" app lib actions | rg -v "DEVIATION"  
  
  
⸻  
  
**10) CI Blocking Rules (GitHub Actions)**  
	•	**Typecheck**: tsc --noEmit  
	•	**Lint**: ESLint (error on warnings)  
	•	**Unit/Integration**: Jest with coverage gates (lib ≥90%, overall ≥80%)  
	•	**E2E smoke**: Playwright for guest booking + provider accept  
	•	**Bundle size**: next build + nextjs-bundle-analyzer budget (entry < 200kb gzip)  
	•	**Deps**: depcheck must return no unused deps  
	•	**Secrets**: truffleHog or gitleaks on PR  
  
If any fail → block merge. No “override” labels.  
  
⸻  
  
**11) Observability Contracts**  
	•	lib/logger.ts wraps console with { ts, level, requestId, userId?, bookingId?, providerId? }  
	•	Sentry spans: area:payments|availability|search|studio|account  
	•	Required breadcrumbs per transaction:  
	•	search_performed, hold_created, payment_authorized, booking_confirmed, refund_issued  
	•	Webhook event log table must store event_id, payload_hash, processed_at, result.  
  
⸻  
  
**12) CSP / Trusted Domains (ban CDNs you don’t use)**  
  
Set via lib/security/headers.ts.  
	•	script-src 'self' 'unsafe-inline' (minimize inline) https://js.stripe.com https://*.clerk.com  
	•	connect-src 'self' supabase stripe clerk redis (as needed)  
	•	img-src 'self' data: blob: supabase-cdn  
	•	frame-src stripe clerk  
	•	Add exact Clerk/Stripe endpoints you call; fail closed.  
  
⸻  
  
**13) UX Anti-Patterns (remove/ban)**  
	•	Inline edit controls on public /providers/[slug] → **Studio only**  
	•	Spinner-only loading → use skeletons  
	•	Hidden pricing → must itemize guest surcharge before payment  
	•	Non-sticky booking CTA on mobile provider pages → make it sticky  
	•	Infinite scroll without back/forward support → keep URL state as truth  
  
⸻  
  
**14) Scripts (one-liners agents can rely on)**  
  
**package.json**  
  
```
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "test": "jest --runInBand",
    "test:unit": "jest __tests__/unit --runInBand",
    "test:int": "jest __tests__/integration --runInBand",
    "e2e": "playwright test",
    "analyze": "ANALYZE=true next build",
    "depcheck": "depcheck",
    "pr:check": "pnpm typecheck && pnpm lint && pnpm test && pnpm depcheck"
  }
}

```
  
PR must run pr:check.  
  
⸻  
  
**15) Codeowners / PR Template**  
  
**CODEOWNERS**  
  
```
/lib/payments/*   @payments-owner
/lib/availability/* @scheduling-owner
/app/api/**       @backend-owner
/app/studio/**    @studio-owner
/app/account/**   @account-owner

```
  
**.github/PULL_REQUEST_TEMPLATE.md**  
	•	Touched only single-source modules; no duplicated logic  
	•	Zod validation & rate-limit on new routes  
	•	Idempotency on mutating endpoints  
	•	Unit/Integration/E2E added/updated  
	•	Flags respected; no client-side mutations of flags  
	•	Error codes used from lib/errors.ts  
	•	Screenshots (UI) / Perf numbers (api) attached  
  
⸻  
  
**16) Feature Flags Discipline**  
	•	Flags read from lib/config/features.ts (+ optional server override).  
	•	**Never** branch on flags in more than two places: UI gate + server gate.  
	•	Remove dead flags after rollout. PR must delete flag + code path + tests.  
  
⸻  
  
**17) Dead Code & Orphans (monthly)**  
	•	npx ts-prune → delete dead exports  
	•	npx depcheck → remove unused deps  
	•	rg -n "TODO|FIXME" → convert to issues or implement; **no lingering TODOs** in app/lib  
  
⸻  
  
**18) Performance Budgets (hard fail)**  
	•	TTI ≤ 3s (4G), CLS ≤ 0.1 (Lighthouse CI)  
	•	API p95: Search ≤ 200ms, Booking ≤ 250ms  
	•	Redis hit ratio ≥ 80% on search endpoints  
  
⸻  
  
**19) When Agents Fix Errors (don’t scan—jump)**  
	•	**Payments bug** → lib/stripe.ts, app/api/stripe/webhooks/route.ts, lib/payments/pricing.ts, lib/payments/policy.ts  
	•	**Availability bug** → lib/availability/generateSlots.ts, lib/availability/holdSlot.ts, related queries in db/queries/*  
	•	**RLS/Access bug** → /db/migrations/*rls*.sql, server actions that write (actions/*)  
	•	**Tabs/URL state bug** → /app/search/page.tsx, components/nav/GlobalTabs.tsx, components/nav/ByTabs.tsx, lib/search/presets.ts  
  
If pointer fails, follow the “If you must scan” protocol (routing → lib → queries → schema → migrations → flags).  
  
⸻  
  
**20) Final Guardrails**  
	•	No hacks, no shortcuts: if a test is flaky, **fix root cause**; don’t widen timeouts.  
	•	No silent fallbacks: log + surface error codes; fail fast.  
	•	No optimistic writes that bypass policy/validation.  
	•	No “temporary” demo code in main. Feature branches only; delete after merge.  
  
Short answer: yes—what you pasted is solid. To make it airtight for senior agents and align with industry best-practice, here’s the missing 10%: hard specs, compliance mappings, and zero-wiggle runbooks. Everything below is **actionable** and references **exact files/paths**.  
  
⸻  
  
**Delta Add-Ons: Industry-Grade Specs & Zero-Ambiguity Guards**  
  
**A) Design Specs — Hard Numbers (no vibes)**  
  
**Tokens** (tailwind.config.ts + /docs/DESIGN-SYSTEM.md)  
	•	Type scale (px): 12, 14, 16, 18, 20, 24, 30, 36, 48  
	•	Line heights: 1.2 (headings), 1.5 (body)  
	•	Spacing scale: multiples of 4px up to 64px  
	•	Radius: sm=6px, md=10px, lg=14px, xl=20px  
	•	Shadows: sm, md, lg only; forbid custom box-shadow  
  
**Components**  
	•	**Global header**: 56px height, 16px horizontal gutters; sticky on mobile  
	•	**Card**: 16px padding, 16px radius, 1px border slate-200, image aspect 16:9  
	•	**Modal**: 640px max-width; mobile full-screen; focus trap enforced  
	•	**Tabs**: 44px (global), 36px (“By …” segmented)  
	•	**CTA** (“Book now”): min width 120px; mobile sticky bottom bar 56px high  
  
**Lint** (/scripts/design-lint.ts)  
	•	Reject non-token colors/sizes (regex: hex, px not in allowlist)  
	•	CI step pnpm design:lint (fail on first violation)  
  
⸻  
  
**B) Accessibility Gates (WCAG 2.1 AA)**  
  
**Checklist** /docs/A11Y.md  
	•	Focus ring: visible on every interactive  
	•	Contrast: ≥4.5:1 (use axe-core report)  
	•	Keyboard: tab order, escape to close, roving role=tab  
	•	Reduced motion: honor prefers-reduced-motion  
  
**CI**  
	•	lighthouse-ci a11y ≥95 (gates)  
	•	@axe-core/playwright smoke on /, /search, /providers/[slug], /checkout  
  
⸻  
  
**C) Browser & Device Support (explicit)**  
  
**Matrix** /docs/BROWSER-MATRIX.md  
	•	Mobile: iOS Safari (latest -1), Chrome Android (latest -1)  
	•	Desktop: Chrome/Edge/Firefox/Safari (latest -1)  
	•	Viewports tested: 360×780, 390×844, 768×1024, 1280×800, 1440×900  
  
**Playwright projects**: named for matrix; failures block merge.  
  
⸻  
  
**D) Email Deliverability (don’t get junked)**  
  
**DNS** /docs/EMAIL.md  
	•	SPF include for provider (e.g., Postmark/Ses)  
	•	DKIM keys generated/verified  
	•	DMARC policy p=quarantine (start), later p=reject  
  
**Templates** /docs/COMM_TEMPLATES.md + /components/email/*  
	•	Booking receipt, provider accept/reject, reminders (24h, 2h), refund notice  
	•	All render from server truth (no client interpolation)  
  
**Monitoring**  
	•	Bounce/complaint webhooks → /app/api/email/webhooks/route.ts → audit_logs  
  
⸻  
  
**E) Compliance Map (PCI/GDPR/SOC2-lite)**  
  
**Table** /docs/COMPLIANCE-MAP.md  
  
**Control**	**Implementation**	**Evidence (file/path)**  
PCI SAQ-A	Stripe Elements/Checkout only; never store PAN	lib/stripe.ts, CSP allows only js.stripe.com  
Webhook signing	Verify HMAC; rotate secrets quarterly	/app/api/stripe/webhooks/route.ts, rotation in /docs/SECURITY-INCIDENT-PLAN.md  
RLS/Least privilege	Per-table policies with tests	/db/migrations/*rls*.sql, __tests__/integration/rls.spec.ts  
Data rights	Export/delete endpoints	/app/api/account/export/route.ts, /app/api/account/delete/route.ts  
Auditability	audit_logs + webhook_logs	/db/schema/audit.ts, /db/schema/webhook_events.ts  
Backups	Daily pg backups; restore drill quarterly	/docs/DR-BACKUP.md  
  
  
⸻  
  
**F) Data Retention & PII Minimization (by table)**  
  
**Policy** /docs/DATA-RETENTION.md  
  
**Table**	**PII**	**Retention**	**Purge Task**  
guest_customers	email, name	30 days	vercel-cron nightly  
messages	text, files	18 months	quarterly purge; metadata retained  
webhook_events	payload hash only	90 days	nightly  
audit_logs	actor id	2 years	manual archive  
  
Supabase RLS denies reads after purge horizon.  
  
⸻  
  
**G) Backups, DR, On-Call**  
  
**RTO/RPO** /docs/DR-BACKUP.md  
	•	RTO ≤ 4h, RPO ≤ 24h (pg backups)  
	•	Redis ephemeral; warm cache rebuild scripts /scripts/warm-cache.ts  
  
**Runbooks** /docs/RUNBOOKS.md  
	•	**Payments degraded**: disable checkout flag (features.payments.enabled=false) → banner; hold queue paused  
	•	**Webhooks failing**: drain webhook_dlq via /app/api/admin/webhooks/retry/route.ts  
	•	**Redis down**: switch rate limit to in-memory emergency guard; booking disabled  
  
PagerDuty/Uptime: alert on error rate >5%, webhook backlog >100, p95 >1s.  
  
⸻  
  
**H) Migrations Safety**  
  
**Process** /docs/DB-MIGRATIONS.md  
	•	Plan → Apply → Verify; never break RLS  
	•	Online migrations only; add columns nullable → backfill → enforce NOT NULL  
	•	Pre-deploy check: pnpm drizzle:check + pnpm test:int -- db:migrations  
	•	Rollback template generated alongside forward migration  
  
⸻  
  
**I) Stripe Connect Evidence Trail**  
  
**Booking ledger** /db/schema/ledger.ts  
	•	Columns: booking_id, intent_id, charge_id, transfer_id, amount_cents, platform_fee_cents, surcharge_cents, captured_at, transferred_at, refunded_at  
	•	Every webhook writes a row; admin UI /studio/payouts reads from ledger, not Stripe live  
  
**Don’t-ship-if**: you can’t reconstruct money flow from this table alone.  
  
⸻  
  
**J) Feature Flag Governance**  
  
**File** lib/config/features.ts (source of truth)  
**Server override**: FEATURE_FLAGS env JSON (parsed once in lib/config/flags.ts)  
**Policy** /docs/FEATURE-FLAGS.md  
	•	Max 2 call sites per flag (UI gate + server gate)  
	•	Flags must have owner + expiry date  
	•	Removal PR must delete code + tests + doc row  
  
⸻  
  
**K) Provider Verification (Trust v1)**  
  
**Signals**  
	•	Email + phone OTP → profiles.verified_email/phone booleans  
	•	Stripe account charges_enabled → surface “Payout-ready”  
	•	Optional KYB (later): store result only; no docs in DB  
  
**Ranking boost** in lib/search/ranking.ts: verified_weight = 0.1  
  
Badge assets in /public/badges/*, controlled via features.discovery.verificationBadges  
  
⸻  
  
**L) Anti-Abuse**  
  
**Messaging**  
	•	MIME allowlist (images/pdf max 5MB)  
	•	Virus scan stub → blocklist extension list  
	•	Regex PII masking (emails/phones) in lib/messaging/sanitize.ts  
  
**Provider links** on public pages: rel="nofollow noopener"; disallow raw emails/phones in descriptions.  
  
Rate limits:  
	•	/api/bookings/*: 3/min/user, 10/min/IP  
	•	/api/messages/*: 10/min/user, 30/min/IP  
  
⸻  
  
**M) Security Header Lockdown (exact CSP)**  
  
```
lib/security/headers.ts

```
  
```
default-src 'self';
script-src 'self' https://js.stripe.com https://*.clerk.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co;
connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.clerk.com;
frame-src https://js.stripe.com https://*.clerk.com;
font-src 'self';
base-uri 'self';

```
frame-ancestors 'none';  
  
Add/remove only via PR with evidence.  
  
⸻  
  
**N) Build-time Budgets (hard)**  
	•	JS per-route (gzip) < **200kb**; image payload < **400kb**  
	•	Fail PR if any new route exceeds budget (nextjs-bundle-analyzer CI step)  
	•	Disallow dynamic import waterfalls (lint rule no-dynamic-import-outside-lazy custom)  
  
⸻  
  
**O) Exact “Fix-Here” Pointers (augment §19)**  
	•	**Totals mismatch on checkout** → lib/payments/pricing.ts (unit tests), components/checkout/OrderSummary.tsx, guard in /app/api/bookings/hold/route.ts  
	•	**Wrong refunds** → lib/payments/policy.ts + tests __tests__/unit/policy.spec.ts, webhook charge.refunded mapping in /app/api/stripe/webhooks/route.ts  
	•	**Calendar DST issues** → lib/availability/generateSlots.ts (timezone utils), tests with DST fixtures __tests__/unit/availability.dst.spec.ts  
	•	**Search tabs not reflecting URL** → /app/search/page.tsx (server param mapping), components/nav/GlobalTabs.tsx, components/nav/ByTabs.tsx  
	•	**Provider can edit others’ data** → actions/* (server derives providerId), RLS in /db/migrations/*rls*.sql  
  
⸻  
  
**P) Repo Hygiene Bots (prevent backslide)**  
  
**Dangerfile** /Dangerfile.ts  
	•	Block @ts-ignore without // DEVIATION: reason  
	•	Flag added deps not in allowlist  
	•	Warn on added images > 400kb  
	•	Fail on new files in /pages/**, /components/demo/**  
  
⸻  
  
**Q) Makefile (fast path for agents)**  
  
```
Makefile

```
  
```
bootstrap: ## Install & prepare dev
\tpnpm i && docker compose up -d && pnpm db:migrate && pnpm seed

check: ## Full PR gate
\tpnpm typecheck && pnpm lint && pnpm test && pnpm depcheck && pnpm analyze

e2e:
\tpnpm playwright test

migrate:
\tpnpm drizzle:generate && pnpm drizzle:migrate

```
  
  
⸻  
  
**R) “Brutal Prioritization” Build Order (locked)**  
  
Already great; add two ship-stoppers:  
	•	**Stop ship if** any client-provided price/tax sneaks into PaymentIntent creation.  
	•	**Stop ship if** booking confirmation can occur without Stripe capture success.  
  
Add these to /docs/SHIP-GATES.md and the PR template.  
  
⸻  
  
**S) Legal Pages (don’t forget)**  
	•	/legal/terms, /legal/privacy, /legal/refunds (public routes in app/legal/*)  
	•	Link in footer; cache aggressively  
	•	Keep policy keys consistent with refund engine terms  
  
⸻  
  
**T) Static Analysis for Secrets & PII**  
	•	gitleaks in CI with baseline  
	•	Regex in scripts/pii-scan.ts to flag accidental dumps (email, phone, ssn, etc.) in logs or seeds  
  
⸻  
  
**U) Observability Schema (log once, use everywhere)**  
  
lib/logger.ts log shape:  
  
```
type Log = {
  ts: string; level: 'info'|'warn'|'error';
  reqId?: string; userId?: string; providerId?: string; bookingId?: string;
  area: 'payments'|'availability'|'search'|'studio'|'account'|'webhooks';
  event?: 'search_performed'|'hold_created'|'payment_authorized'|'booking_confirmed'|'refund_issued';
  msg: string; meta?: Record<string, unknown>;
}

```
  
Sentry setTag('area', area) + setContext('ids', { userId, bookingId, providerId }).  
  
⸻  
  
**V) Final “No Cleverness” Rules (explicit refuses)**  
	•	No custom payment rails, no direct bank transfers in v1  
	•	No inline edit on public pages, ever  
	•	No disabling idempotency for “speed”  
	•	No dynamic RLS bypass with service role in user-facing requests  
	•	No “temporary” demo content in main  
  
⸻  
  
**W) One-Page Checklist for Agents (pin in repo root)**  
  
```
/CHECKLIST.md

```
	•	Feature lives in single-source module (see §0)  
	•	Zod validation + rate limit + idempotency  
	•	Uses error helper from lib/errors.ts  
	•	Flags respected (UI + server)  
	•	Tests: unit + integration; E2E if user-visible  
	•	A11y pass; design-lint pass  
	•	Bundle budget pass; Lighthouse ≥ thresholds  
	•	Logs + breadcrumbs added  
	•	Docs updated (ROADMAP / ENV / RUNBOOKS)  
  
⸻  
  
**Done. What this gives you**  
	•	Industry baselines covered: WCAG, PCI SAQ-A, GDPR hygiene, SOC2-lite controls, SRE runbooks, DR.  
	•	Exact design specs with tokens and px values; CI enforces.  
	•	Unambiguous file pointers for every common failure.  
	•	Compliance evidence and auditability built-in (ledger, logs, policies).  
	•	No template drift or “smart” shortcuts.  
