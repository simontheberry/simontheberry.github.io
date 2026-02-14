# CLAUDE.md — AI Complaint Triage Platform

## Project Identity

This is a **production-grade AI-assisted regulatory complaint triage platform** built for Australian government regulators (ACCC, ASIC, ACMA). It is NOT a demo or hackathon project. Every change must be defensible to a government stakeholder.

## Architecture

### Monorepo Structure

```
app/                    → Next.js App Router (frontend pages)
components/             → React components (forms, dashboard, layout, ui)
src/server/             → Express.js backend (API routes, services, middleware)
src/shared/             → Shared types and constants (used by both client and server)
prisma/                 → Database schema (PostgreSQL + pgvector)
styles/                 → Global CSS (Tailwind)
docs/                   → Architecture and API documentation
docker/                 → Docker configuration
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS 3 |
| Backend | Express.js on Node, TypeScript strict mode |
| Database | PostgreSQL 16 + pgvector for embeddings |
| ORM | Prisma 5 |
| Queue | BullMQ + Redis |
| AI | OpenAI (GPT-4o, ada-002) or Anthropic (Claude) via provider abstraction |
| Auth | JWT (jsonwebtoken) |
| Validation | Zod (all API boundaries) |
| Logging | Winston |
| State | Zustand (client), React Query (server state) |

### Path Aliases

- `@/*` → project root
- `@server/*` → `./src/server/*`
- `@shared/*` → `./src/shared/*`

### Build Commands

- `npm run build` → runs `build:client` then `build:server`
- `npm run build:client` → `next build`
- `npm run build:server` → `tsc -p tsconfig.server.json`
- `npm run dev` → concurrent client (port 3000) and server (port 4000)
- `npm run lint` → `next lint`
- `npm run typecheck` → `tsc --noEmit`
- `npm run test` → `vitest run`

### Deployment

- Deployed on **Vercel** (frontend + API rewrites)
- Server compiled to `dist/server/` via `tsconfig.server.json` (CommonJS, ES2022)
- API requests proxied: `/api/:path*` → `http://localhost:4000/api/:path*`

## Coding Standards

### TypeScript

- **Strict mode is ON.** All code must pass `tsc --noEmit` with zero errors.
- Use explicit types. Avoid `any`. Use `unknown` when type is genuinely unknown.
- Use `as const` for literal constants.
- Validate all external inputs with **Zod schemas** at API boundaries.
- Shared types live in `src/shared/types/`. Do not duplicate type definitions.

### Naming Conventions

- Files: `kebab-case.ts` for server, `PascalCase.tsx` for React components
- Types/Interfaces: `PascalCase`
- Variables/Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Database columns: `snake_case` (Prisma `@map()`)
- API routes: `kebab-case` (e.g., `/api/v1/intake/ai-guidance`)
- CSS classes: Tailwind utility classes only; custom classes via `@layer components` in `globals.css`

### React / Frontend

- All pages use `'use client'` directive (App Router client components)
- Components are in `components/` organized by domain: `forms/`, `dashboard/`, `layout/`, `ui/`
- Use Lucide React for icons (already installed)
- Use Tailwind exclusively for styling. No CSS modules, no styled-components.
- Government colour palette defined in `tailwind.config.ts` under `gov.*` namespace
- No emojis in UI. Professional, minimal government aesthetic.

### Backend / API

- Express routes live in `src/server/api/routes/`
- All routes must validate input with Zod before processing
- All authenticated routes use `authenticate` middleware, then `authorize(roles)` for RBAC
- Multi-tenant: every query must filter by `tenantId`
- Errors use the `AppError` class from `error-handler.ts`
- Use structured logging via `createLogger('module-name')` from Winston
- API responses follow shape: `{ success: boolean, data?: T, error?: { message: string }, meta?: PaginationMeta }`

### Database

- Schema in `prisma/schema.prisma`
- Models use `@map("snake_case")` for table/column names
- All tables have `tenantId` for multi-tenant isolation
- Use `@default(uuid())` for primary keys
- Timestamps: `createdAt` + `updatedAt` on all models
- Vector operations use raw SQL (`prisma.$queryRaw`) since Prisma doesn't natively support pgvector
- Run `npx prisma generate` after schema changes

## Domain Context

### User Roles (RBAC)

| Role | Description |
|------|------------|
| `complaint_officer` | Handles assigned complaints, drafts responses |
| `supervisor` | Manages team, overrides triage, assigns complaints |
| `executive` | Read-only strategic dashboards, enforcement candidates |
| `admin` | Full access: user management, settings, weight configuration |
| `system` | Internal use (background jobs, automated processes) |

### Complaint Lifecycle

```
submitted → triaging → triaged → assigned → in_progress → awaiting_response → resolved → closed
                                                        ↘ escalated
```

### Triage Pipeline (6 Steps)

1. Extract structured data (AI)
2. Classify complaint category + legal category
3. Score risk (low/medium/high/critical)
4. Summarize for officer
5. Calculate priority score (weighted formula, configurable per tenant)
6. Determine routing: `line_1_auto` | `line_2_investigation` | `systemic_review`

### Priority Score Formula

```
priorityScore =
  (riskScore × 0.30) +
  (systemicImpact × 0.25) +
  (monetaryHarm × 0.15) +
  (vulnerabilityIndicator × 0.20) +
  ((1 - resolutionProbability) × 0.10)
```

Weights are configurable per tenant via `TenantSettings.priorityWeights`.

### Complaint Categories

Defined in `src/shared/constants/categories.ts`:
`misleading_conduct`, `unfair_contract_terms`, `product_safety`, `pricing_issues`, `warranty_guarantee`, `refund_dispute`, `service_quality`, `billing_dispute`, `privacy_breach`, `accessibility`, `discrimination`, `scam_fraud`, `unconscionable_conduct`, `other`

### Industry Classifications

`financial_services`, `telecommunications`, `energy`, `retail`, `health`, `aged_care`, `building_construction`, `automotive`, `travel_tourism`, `education`, `real_estate`, `insurance`, `food_beverage`, `technology`, `government_services`, `other`

## Security Requirements

- **Never commit secrets.** Use environment variables via `src/server/config/index.ts` (Zod-validated).
- JWT secret must NOT use the default value in production.
- All mutations must be audit-logged (`AuditLog` table).
- AI outputs must store full provenance: model, prompt (truncated), raw output, confidence, latency.
- PII must not appear in log files. Sanitize before logging.
- Tenant isolation: every database query MUST include `tenantId` filter.
- Rate limit public endpoints (intake/submit, intake/ai-guidance).
- All AI-generated content must display confidence scores and be editable by supervisors.

## AI Guidelines

- AI provider abstraction in `src/server/services/ai/provider.ts` — supports OpenAI + Anthropic.
- Prompts in `src/server/services/ai/prompts.ts` — always use JSON mode, temperature 0.1.
- All AI calls go through `AiService.runPipeline()` which returns both result and audit record.
- Embeddings: OpenAI `text-embedding-ada-002` (1536 dimensions), stored in `complaint_embeddings` table.
- Similarity search uses cosine distance via pgvector: `1 - (embedding <=> embedding)`.
- Every AI output must have a `confidence` field (0-1) and `reasoning` string.

## Known Issues & Constraints

- `@types/jsonwebtoken` v9+ requires string literal for `expiresIn` (not config variable). Use `'8h'` directly.
- Prisma doesn't support pgvector natively — use `$queryRaw` / `$executeRaw` for vector operations.
- Anthropic provider does NOT support embeddings — use OpenAI for embedding generation.
- BullMQ workers require a separate Redis instance — not available on Vercel serverless.
- The `business.routes.ts` ABN lookup is the only fully implemented API endpoint.
- Most dashboard pages use hardcoded `DEMO_*` data objects that need replacing with API calls.
- `DashboardLayout.tsx` has `userRole = 'admin'` hardcoded — needs auth context.

## What NOT to Do

- Do not add unnecessary dependencies. The stack is intentionally minimal.
- Do not use CSS-in-JS, styled-components, or CSS modules. Tailwind only.
- Do not create new documentation files unless explicitly asked.
- Do not add comments to code you didn't change.
- Do not over-abstract. Three similar lines are better than a premature utility.
- Do not use `any` type. Ever.
- Do not hardcode tenant IDs, user IDs, or secrets.
- Do not send AI-drafted communications automatically without the `autoSendEnabled` tenant setting being true AND confidence exceeding threshold.
- Do not skip Zod validation on any API endpoint.
