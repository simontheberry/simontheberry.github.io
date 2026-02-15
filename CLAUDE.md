# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

This is a **production-grade AI-assisted regulatory complaint triage platform** built for Australian government regulators (ACCC, ASIC, ACMA). It is NOT a demo or hackathon project. Every change must be defensible to a government stakeholder.

## Commands

### Development

- `npm run dev` — start both Next.js (port 3000) and Express API (port 4000) concurrently
- `npm run dev:client` — Next.js only (port 3000)
- `npm run dev:server` — Express API only via `tsx watch` (port 4000)

### Build & Check

- `npm run build` — builds client (`next build`) then server (`tsc -p tsconfig.server.json`)
- `npm run typecheck` — `tsc --noEmit` (strict mode, zero errors required)
- `npm run lint` — `next lint`

### Testing

- `npm run test` — `vitest run`
- `npm run test:watch` — `vitest` (watch mode)
- Run a single test file: `npx vitest run path/to/file.test.ts`
- **Note:** No test files or vitest config currently exist. When adding tests, create a `vitest.config.ts` with path alias resolution matching the tsconfig.

### Database

- `npx prisma generate` — regenerate Prisma client (run after schema changes)
- `npx prisma migrate dev --name <name>` — create and apply a migration
- `npx prisma migrate deploy` — apply pending migrations (production)
- `npm run db:seed` — seed demo data via `tsx src/server/db/seeds/index.ts`
- `npx prisma studio` — visual database browser at http://localhost:5555

### Infrastructure

- `docker compose up -d postgres redis` — start only DB and cache for local dev
- `npm run queue:worker` — start BullMQ background worker

## Architecture

### Monorepo Structure

```
app/                    → Next.js App Router pages (all use 'use client')
components/             → React components organized by domain: forms/, dashboard/, layout/
src/server/             → Express.js backend
  ├── api/routes/       → Route modules (auth, intake, complaint, triage, dashboard, business, systemic, communication)
  ├── api/middleware/    → auth, error-handler, tenant-resolver, request-logger
  ├── services/ai/      → AI provider abstraction, prompts, orchestrator
  ├── services/triage/  → Triage engine + priority calculator
  ├── services/queue/   → BullMQ background job processors
  └── config/           → Zod-validated environment config
src/shared/             → Shared types (complaint, user, api) and constants (categories)
prisma/                 → PostgreSQL schema (14 tables + pgvector)
styles/globals.css      → Tailwind + custom gov component classes
```

### Two TypeScript Configs

- **`tsconfig.json`** — Frontend + shared. ES modules. Includes `app/`, `components/`, `src/shared/`.
- **`tsconfig.server.json`** — Backend compilation. CommonJS output to `dist/server/`. Includes `src/server/`, `src/shared/`.

### Path Aliases

- `@/*` → project root
- `@server/*` → `./src/server/*`
- `@shared/*` → `./src/shared/*`

### Request Flow

Next.js on port 3000 proxies `/api/:path*` to Express on port 4000 via `next.config.js` rewrites. All API routes are mounted under `/api/v1`. Express middleware stack: helmet → CORS → JSON → request logger → tenant resolver → routes → error handler.

### Deployment

- **Vercel** for frontend + API rewrites
- Server compiled to `dist/server/` (CommonJS, ES2022)
- BullMQ workers require separate Redis — not available on Vercel serverless

## Coding Standards

### TypeScript

- **Strict mode is ON.** All code must pass `tsc --noEmit` with zero errors.
- Use explicit types. Avoid `any` — use `unknown` when type is genuinely unknown.
- Use `as const` for literal constants.
- Validate all external inputs with **Zod schemas** at API boundaries.
- Shared types live in `src/shared/types/`. Do not duplicate type definitions.

### Naming Conventions

- Files: `kebab-case.ts` for server, `PascalCase.tsx` for React components
- Types/Interfaces: `PascalCase` | Variables/Functions: `camelCase` | Constants: `UPPER_SNAKE_CASE`
- Database columns: `snake_case` (Prisma `@map()`)
- API routes: `kebab-case` (e.g., `/api/v1/intake/ai-guidance`)

### React / Frontend

- All pages use `'use client'` directive (App Router client components)
- Use Lucide React for icons
- Use Tailwind exclusively — no CSS modules, no styled-components
- Government colour palette: `gov.blue.*`, `gov.navy`, `gov.gold`, `gov.red`, `gov.green`, `gov.grey.*` defined in `tailwind.config.ts`
- Custom component classes in `styles/globals.css`: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.input-field`, `.badge` (with `.badge-low/medium/high/critical` severity variants)
- No emojis in UI. Professional, minimal government aesthetic.

### Backend / API

- Express routes in `src/server/api/routes/` — 9 route modules mounted via `routes/index.ts`
- All routes validate input with Zod before processing
- Authenticated routes: `authenticate` middleware → `authorize(roles)` for RBAC
- Multi-tenant: every query must filter by `tenantId`
- Errors use `AppError` class from `error-handler.ts`
- Structured logging via `createLogger('module-name')` from Winston
- API response shape: `{ success: boolean, data?: T, error?: { message: string }, meta?: PaginationMeta }`

### Database

- Schema in `prisma/schema.prisma` — 14+ tables with multi-tenant isolation
- Models use `@map("snake_case")` for table/column names
- `@default(uuid())` for primary keys, `createdAt` + `updatedAt` on all models
- Vector operations use raw SQL (`prisma.$queryRaw`) — Prisma doesn't support pgvector natively

## Domain Context

### User Roles (RBAC)

`complaint_officer` (handles complaints) | `supervisor` (manages team, overrides triage) | `executive` (read-only dashboards) | `admin` (full access) | `system` (background jobs)

### Complaint Lifecycle

```
submitted → triaging → triaged → assigned → in_progress → awaiting_response → resolved → closed
                                                        ↘ escalated
```

### Triage Pipeline

1. Extract structured data (AI) → 2. Classify category + legal category → 3. Score risk (low/medium/high/critical) → 4. Summarize → 5. Calculate priority score (weighted formula, configurable per tenant) → 6. Route: `line_1_auto` | `line_2_investigation` | `systemic_review`

### Priority Score Formula

```
priorityScore = (riskScore × 0.30) + (systemicImpact × 0.25) + (monetaryHarm × 0.15) +
                (vulnerabilityIndicator × 0.20) + ((1 - resolutionProbability) × 0.10)
```

Weights configurable per tenant via `TenantSettings.priorityWeights`.

### Categories & Industries

- Complaint categories defined in `src/shared/constants/categories.ts` (14 values: misleading_conduct, product_safety, scam_fraud, etc.)
- Industry classifications: 16 values (financial_services, telecommunications, energy, etc.)

## Security Requirements

- Environment variables via `src/server/config/index.ts` (Zod-validated). Never commit secrets.
- JWT secret must NOT use the default value in production.
- All mutations must be audit-logged (`AuditLog` table).
- AI outputs must store full provenance: model, prompt (truncated), raw output, confidence, latency.
- PII must not appear in log files.
- Tenant isolation: every database query MUST include `tenantId` filter.
- Rate limit public endpoints (intake/submit, intake/ai-guidance).
- All AI-generated content must display confidence scores and be editable by supervisors.

## AI Guidelines

- Provider abstraction in `src/server/services/ai/provider.ts` — supports OpenAI + Anthropic.
- Prompts in `src/server/services/ai/prompts.ts` — JSON mode, temperature 0.1.
- All AI calls go through `AiService.runPipeline()` — returns both result and audit record.
- Embeddings: OpenAI `text-embedding-ada-002` (1536 dims), stored in `complaint_embeddings` table.
- Similarity search: cosine distance via pgvector `1 - (embedding <=> embedding)`.
- Every AI output must have `confidence` (0-1) and `reasoning` fields.
- Anthropic provider does NOT support embeddings — always use OpenAI for embedding generation.

## Known Issues & Constraints

- `@types/jsonwebtoken` v9+ requires string literal for `expiresIn`. Use `'8h'` directly, not a config variable.
- The `business.routes.ts` ABN lookup is the only fully implemented API endpoint.
- Most dashboard pages use hardcoded `DEMO_*` data objects that need replacing with API calls.
- `DashboardLayout.tsx` has `userRole = 'admin'` hardcoded — needs auth context integration.
- No test files exist yet. Vitest is installed but unconfigured.

## What NOT to Do

- Do not add unnecessary dependencies. The stack is intentionally minimal.
- Do not use CSS-in-JS, styled-components, or CSS modules. Tailwind only.
- Do not create new documentation files unless explicitly asked.
- Do not add comments to code you didn't change.
- Do not over-abstract. Three similar lines are better than a premature utility.
- Do not use `any` type. Ever.
- Do not hardcode tenant IDs, user IDs, or secrets.
- Do not send AI-drafted communications automatically without `autoSendEnabled` being true AND confidence exceeding threshold.
- Do not skip Zod validation on any API endpoint.
