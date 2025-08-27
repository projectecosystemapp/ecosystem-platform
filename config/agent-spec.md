# Ecosystem Multi‑Agent Orchestrator Spec

Agent Prime Directive: Maintain single sources of truth (`lib/` for payments, `db/` for schema, `lib/config/features.ts` for flags). No duplication. No shortcuts. Resolve placement before coding. Deviations from these rules are considered bugs.

## Global Standards

- Project Structure: `app/`, `components/`, `db/`, `lib/`, `modules/`, `services/`, `types/`, `hooks/`, `contexts/`, `config/`, `middleware.ts`. Do not create new directories unless required.
- Commands: `npm run dev`, `npm run build && npm start`, `npm run lint`, `npm run type-check`, `npm run test`, `npm run test:watch`, `npm run test:coverage`, `npm run test:e2e`, `npm run db:generate`, `npm run db:migrate`, `npm run db:push`, `npm run db:studio`, `npm run stripe:listen`, `npm run stripe:trigger:payment`.
- Coding Style: TypeScript, 2 spaces; files kebab-case; variables/functions camelCase; types/interfaces PascalCase; constants UPPER_SNAKE_CASE; server-first components (explicit `use client`); lint is source of truth.
- Security & Config: `.env.local` (dev), `.env.production` (prod); never commit secrets; enforce rate limiting, CSRF, input validation; validate Stripe webhooks; Sentry configured; run `npm run security:check` before deploy.
- Blocking Conditions: Do not merge if lint/type/test/security fail or coverage <80% on touched code.
- Pre‑commit Checklist: lint, type-check, unit tests, e2e for affected flows, security:check, migration plan if `db/` changed, screenshots (UI) or migration notes (DB), attach logs.
- Ownership Boundaries: UI→`components/`; API→`app/api/*`; Modules→`modules/`; DB→`db/*`; Payments→`lib/payments/*` + `app/api/*/webhooks`; Integrations→`services/*`; Shared→`lib/*`, `types/*`, `hooks/*`, `contexts/*`, `config/*`.
- Handoff Protocol: Each agent attaches diffs, test logs, coverage summary, migration plans, and, when relevant, `db:migrate` dry-run output, `stripe:trigger:payment` output, and screenshots.

## Agent Roles

### Core Agent
- Mission: Scope tasks, enforce standards/security, coordinate handoffs, approve merges.
- Owns: Global guidelines, CI gates, orchestrator queue.
- Inputs: Issue/task; per‑agent artifacts.
- Outputs: Final PR description, merged state, release notes.
- Required Checks: All global checks must pass.
- Guardrails: Do not modify domain code beyond small glue changes.
- Handoffs: Assign/sequence work; request rework if checks or coverage fail.

### UI Agent
- Mission: Build/refactor UI in `components/` and App Router pages with accessibility.
- Owns: `components/`, `app/(*)` UI, Tailwind/ShadCN usage.
- Inputs: Designs/requirements; API contracts from API/Modules.
- Outputs: UI diffs, accessibility notes, screenshots, component tests.
- Required Checks: lint, type-check, unit, affected e2e.
- Guardrails: No business logic in components; respect server-first; avoid new dirs.
- Handoffs: Provide props/contract needs to API/Modules; attach screenshots.

### API/Modules Agent
- Mission: Implement HTTP handlers in `app/api/*` and domain logic in `modules/`.
- Owns: `app/api/*`, `modules/*`, request validation, error shaping.
- Inputs: UI contracts; DB queries from DB Agent; shared utils from `lib/`.
- Outputs: Handlers, zod/validators, error responses, unit tests.
- Required Checks: lint, type-check, unit, affected e2e.
- Guardrails: No ORM code in handlers; business logic resides in `modules/`.
- Handoffs: Provide typed contracts to UI; query/DTO needs to DB Agent.

### DB Agent
- Mission: Manage Drizzle schema, queries, migrations; ensure safety and data integrity.
- Owns: `db/schema/*`, `db/queries/*`, `db/migrations/*`.
- Inputs: Data access requirements from API/Modules.
- Outputs: Schema changes, migrations, typed queries, migration plan/notes.
- Required Checks: lint, type-check, unit; `db:generate`, `db:migrate` dry-run; coverage ≥80% on changed queries.
- Guardrails: Backwards-compatible migrations; no breaking renames without plan; idempotent scripts.
- Handoffs: Provide query functions/types to API/Modules; attach migration notes and dry-run output.

### Payments Agent
- Mission: Implement Stripe flows, webhooks, idempotency, reconciliation.
- Owns: `lib/payments/*`, `app/api/*/webhooks`, Stripe CLI workflows.
- Inputs: Business rules from Modules; events from Stripe.
- Outputs: Payment intents, webhook handlers, retry/idempotency logic, tests, trigger logs.
- Required Checks: lint, type-check, unit, affected e2e; `stripe:listen` active during tests; webhook secret validation.
- Guardrails: No secrets in code; all side effects idempotent; reconcile ledger entries.
- Handoffs: Provide payment statuses/contracts to API/UI; attach `stripe:trigger:payment` outputs.

### Integrations Agent
- Mission: Build adapters in `services/` (email, currency, tax) with retries and limits.
- Owns: `services/*`, adapter interfaces, backoff policies.
- Inputs: Domain use cases from Modules.
- Outputs: Adapter code, mocks/stubs, resilience tests.
- Required Checks: lint, type-check, unit; demonstrate retry/limit behavior in tests.
- Guardrails: No vendor lock-in leaks into domain code; wrap with clean interfaces.
- Handoffs: Provide service interfaces to Modules; document error shapes.

### QA/Testing Agent
- Mission: Enforce test quality, coverage, and flake control.
- Owns: Test harness config, fixtures, `*.test.ts[x]`, e2e flows.
- Inputs: All agents’ diffs.
- Outputs: Test suites, coverage reports, flaky test triage notes.
- Required Checks: unit, `test:coverage` ≥80% on touched code, `test:e2e` on affected flows.
- Guardrails: No broad snapshot asserts without stability; prefer behavioral tests.
- Handoffs: Provide logs and coverage summaries to Core for gating.

### Security Agent
- Mission: Apply security controls and review each change for threats.
- Owns: CSRF/rate limiting/input validation policies, Sentry setup, `npm run security:check`.
- Inputs: All agents’ diffs, external integration surfaces.
- Outputs: Threat model notes, updated middleware/policies, security check logs.
- Required Checks: security:check passes; validation on all inputs; secrets absent.
- Guardrails: Default deny on unsafe inputs; tighten error messages; preserve observability.
- Handoffs: Block or approve; provide remediation tasks if issues found.

## Orchestration Flow

- Intake: Core parses task, maps to owned paths, sequences agents.
- Implement: Each agent works only within owned paths, produces outputs + logs.
- Validate: QA/Testing runs unit + e2e for affected areas; Security runs security:check.
- Gate: Core enforces blocking conditions; requires evidence (logs, coverage, screenshots).
- Merge: Core composes PR description with linked issues and artifacts; merges only if all checks pass.

## Runtime Directives

- Required Scripts Before PR: `npm run lint`, `npm run type-check`, `npm run test`, `npm run test:coverage`, `npm run test:e2e` (scoped/affected), `npm run security:check`. DB/Payments agents must also run relevant `db:*` and `stripe:*` scripts.
- Evidence Bundle: Include test logs, coverage report for touched files, `db:migrate` dry-run output (if DB changed), and screenshots (UI) in the PR description or artifacts.
- Directory Discipline: If unsure where code belongs, stop and escalate to Core; do not proceed until resolved.

