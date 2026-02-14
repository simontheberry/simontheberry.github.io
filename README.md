# AI Complaint Triage Platform

AI-powered complaint triage and workflow management for government regulators. Replaces manual FIFO inbox processing with intelligent prioritisation based on risk, systemic harm, and consumer vulnerability.

Built with Next.js, Express.js, PostgreSQL (pgvector), Redis, and a model-agnostic AI layer.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Setup Options](#setup-options)
  - [Option A: Docker (recommended)](#option-a-docker-recommended)
  - [Option B: Local development](#option-b-local-development)
  - [Option C: Frontend only (no backend)](#option-c-frontend-only-no-backend)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Application URLs](#application-urls)
- [Testing the Application](#testing-the-application)
  - [View the UI with demo data](#view-the-ui-with-demo-data)
  - [Test the API manually](#test-the-api-manually)
  - [Test the complaint submission flow](#test-the-complaint-submission-flow)
  - [Test the AI triage pipeline](#test-the-ai-triage-pipeline)
  - [Test the ABN lookup](#test-the-abn-lookup)
- [Project Structure](#project-structure)
- [Database](#database)
- [Troubleshooting](#troubleshooting)
- [Further Reading](#further-reading)

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| **Node.js** | 20+ | All setups |
| **npm** | 9+ | All setups |
| **Docker** & **Docker Compose** | Latest | Option A (Docker setup) |
| **PostgreSQL** | 16+ with pgvector | Option B only (if not using Docker) |
| **Redis** | 7+ | Option B only (if not using Docker) |

---

## Quick Start

The fastest way to see the platform running:

```bash
# 1. Clone and enter the project
cd complaint-triage-platform

# 2. Start database and cache via Docker
docker compose up -d postgres redis

# 3. Install dependencies
npm install

# 4. Set up environment
cp .env.example .env

# 5. Generate Prisma client and create database tables
npx prisma generate
npx prisma migrate dev --name init

# 6. Start the development servers
npm run dev
```

Then open **http://localhost:3000** in your browser.

The dashboard pages include demo data so you can immediately explore the UI without any API keys or database content.

---

## Setup Options

### Option A: Docker (recommended)

Runs everything in containers. No local PostgreSQL or Redis installation needed.

```bash
# 1. Create your environment file
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET to any random string

# 2. Start all services (PostgreSQL + pgvector, Redis, App, Worker)
docker compose up -d

# 3. Run database migrations (first time only)
docker compose exec app npx prisma migrate deploy
```

The platform is now available at **http://localhost:3000** (frontend) and **http://localhost:4000** (API).

To stop everything:

```bash
docker compose down
```

To stop and also remove all data (database volumes):

```bash
docker compose down -v
```

### Option B: Local development

Run Node.js locally with Docker only for PostgreSQL and Redis.

```bash
# 1. Start only the database and cache
docker compose up -d postgres redis

# 2. Install Node.js dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# The defaults in .env.example already point to localhost:5432 and localhost:6379

# 4. Generate the Prisma client
npx prisma generate

# 5. Create database tables
npx prisma migrate dev --name init

# 6. (Optional) Seed the database with demo data
npm run db:seed

# 7. Start the development servers (client + API in watch mode)
npm run dev
```

This starts:
- **Next.js** on http://localhost:3000 (hot-reloading)
- **Express API** on http://localhost:4000 (watch mode via tsx)

### Option C: Frontend only (no backend)

If you only want to explore the UI design without running the API or database:

```bash
npm install
npm run dev:client
```

Open http://localhost:3000. All dashboard pages render with hardcoded demo data. The complaint submission form will be visible but API calls will fail (expected).

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required for basic operation

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/complaint_triage` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | `change-this-to-a-secure-random-string` | Secret for signing JWT tokens. Use a random 32+ character string in production. |

### Required for AI features

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROVIDER` | `openai` | Which LLM provider to use: `openai`, `anthropic`, or `azure_openai` |
| `OPENAI_API_KEY` | — | Your OpenAI API key (if using OpenAI) |
| `ANTHROPIC_API_KEY` | — | Your Anthropic API key (if using Anthropic) |
| `AI_MODEL` | `gpt-4o` | Model to use for classification/triage |
| `EMBEDDING_MODEL` | `text-embedding-ada-002` | Model for generating complaint embeddings |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Express API port |
| `ABR_API_GUID` | — | Australian Business Register API key ([register here](https://abr.business.gov.au/Tools/WebServices)) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | — | SMTP server for sending emails |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_USER` / `IMAP_PASS` | — | IMAP server for email ingestion |
| `SIMILARITY_THRESHOLD` | `0.85` | Minimum cosine similarity for systemic clustering |
| `CLUSTER_MIN_COMPLAINTS` | `3` | Minimum complaints to form a systemic cluster |

---

## Available Scripts

Run from the project root:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both Next.js and Express API in development mode with hot-reloading |
| `npm run dev:client` | Start only the Next.js frontend (port 3000) |
| `npm run dev:server` | Start only the Express API (port 4000) |
| `npm run build` | Build both client and server for production |
| `npm run start` | Run the production server |
| `npm run typecheck` | Run TypeScript type checking without emitting |
| `npm run lint` | Run ESLint across the codebase |
| `npm run test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run queue:worker` | Start the background job worker (triage, systemic detection, SLA checks) |
| `npx prisma generate` | Regenerate the Prisma client after schema changes |
| `npx prisma migrate dev --name <name>` | Create and apply a new migration |
| `npx prisma migrate deploy` | Apply pending migrations (production) |
| `npx prisma studio` | Open the Prisma visual database browser (http://localhost:5555) |
| `docker compose up -d` | Start all Docker services |
| `docker compose down` | Stop all Docker services |

---

## Application URLs

After running `npm run dev`:

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Landing page |
| http://localhost:3000/complaint-form | Public complaint submission portal (AI-guided) |
| http://localhost:3000/dashboard/officer | Complaint officer queue (priority-sorted) |
| http://localhost:3000/dashboard/supervisor | Supervisor team overview |
| http://localhost:3000/dashboard/executive | Executive risk overview |
| http://localhost:3000/dashboard/complaints | All complaints (filtered, searchable) |
| http://localhost:3000/dashboard/systemic | Systemic issue clusters |
| http://localhost:3000/dashboard/settings | Triage weights, SLA, AI config |
| http://localhost:4000/health | API health check |
| http://localhost:4000/api/v1/... | REST API endpoints |

---

## Testing the Application

### View the UI with demo data

The dashboard pages include hardcoded demo data so you can evaluate the interface immediately:

1. Start the frontend: `npm run dev:client`
2. Visit http://localhost:3000/dashboard/officer — see a priority-sorted complaint queue with risk badges, SLA timers, and priority scores
3. Visit http://localhost:3000/dashboard/executive — see industry risk map, repeat offender index, enforcement candidates
4. Visit http://localhost:3000/dashboard/systemic — see detected complaint clusters with common patterns
5. Visit http://localhost:3000/complaint-form — walk through the multi-step complaint submission form

### Test the API manually

Start the full stack (`npm run dev`), then test API endpoints with curl:

```bash
# Health check
curl http://localhost:4000/health

# Submit a complaint (public endpoint — no auth required)
curl -X POST http://localhost:4000/api/v1/intake/submit \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "default",
    "complainant": {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com"
    },
    "business": {
      "name": "Acme Financial Services"
    },
    "complaint": {
      "rawText": "I was charged hidden fees on my home loan that were not disclosed in the comparison rate. The advertised rate was 5.99% but the actual cost including fees is closer to 7.2%. I have been overcharged approximately $3,400 over the past 12 months."
    }
  }'

# Request AI guidance during complaint entry (public endpoint)
curl -X POST http://localhost:4000/api/v1/intake/ai-guidance \
  -H "Content-Type: application/json" \
  -d '{
    "tenantSlug": "default",
    "text": "I bought a fridge from Harvey Norman and it stopped working after 3 months. They said the warranty had expired but I thought it should be covered under consumer guarantees."
  }'

# Login (returns JWT token)
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "officer@regulator.gov.au",
    "password": "password",
    "tenantSlug": "default"
  }'

# Use the returned token for protected endpoints:
TOKEN="<paste token from login response>"

# List complaints (protected)
curl http://localhost:4000/api/v1/complaints \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"

# Get dashboard stats (protected)
curl http://localhost:4000/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"

# Trigger triage for a complaint (protected)
curl -X POST http://localhost:4000/api/v1/triage/COMPLAINT_ID_HERE \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: demo-tenant-id"

# Search for a business via ABR (requires ABR_API_GUID in .env)
curl "http://localhost:4000/api/v1/businesses/search?name=Telstra"
```

### Test the complaint submission flow

1. Open http://localhost:3000/complaint-form
2. **Step 1 — Describe Issue**: Enter a complaint narrative (at least 20 characters). Click "Analyze with AI" to see the AI guidance panel (requires API key configured).
3. **Step 2 — Business Details**: Search for a business by name. If `ABR_API_GUID` is set, results come from the Australian Business Register. Otherwise, use manual entry.
4. **Step 3 — Your Details**: Enter name, email, optional phone.
5. **Step 4 — Review & Submit**: Review all details and submit. The API returns a reference number.

### Test the AI triage pipeline

Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`.

The triage pipeline runs as a background job but can be tested directly:

```bash
# In a Node.js script or REPL (npx tsx):
import { TriageEngine } from './src/server/services/triage/triage-engine';

const engine = new TriageEngine();
const result = await engine.triageComplaint({
  complaintId: 'test-001',
  rawText: 'I signed up for a mobile plan advertised at $49/month but have been charged $79/month for three months. The company refuses to honour the advertised price.',
  businessContext: {
    previousComplaintCount: 5,
    industry: 'telecommunications',
    businessStatus: 'Active',
  },
});
console.log(JSON.stringify(result, null, 2));
```

### Test the ABN lookup

```bash
# Search by business name
curl "http://localhost:4000/api/v1/businesses/search?name=Commonwealth+Bank"

# Lookup by ABN (requires ABR_API_GUID)
curl "http://localhost:4000/api/v1/businesses/search?abn=48123123124"
```

Or test the service directly:

```bash
npx tsx -e "
  const { AbnLookupService } = require('./src/server/services/enrichment/abn-lookup');
  const svc = new AbnLookupService();
  console.log('Valid ABN check:', svc.isValidAbn('51824753556'));
"
```

---

## Project Structure

```
├── prisma/schema.prisma           # Database schema (14 tables)
├── docker/Dockerfile              # Multi-stage production build
├── docker-compose.yml             # PostgreSQL + Redis + App + Worker
├── docs/
│   └── ARCHITECTURE.md            # System design, API reference, lifecycle walkthrough
├── src/
│   ├── shared/                    # Types and constants shared across client & server
│   ├── server/                    # Express.js backend
│   │   ├── index.ts               # Server entry point
│   │   ├── config/                # Zod-validated env config
│   │   ├── api/
│   │   │   ├── routes/            # 8 route modules
│   │   │   └── middleware/        # Auth, RBAC, tenant, error handling, logging
│   │   └── services/
│   │       ├── ai/                # LLM abstraction + prompt templates + orchestrator
│   │       ├── triage/            # Triage engine + priority calculator
│   │       ├── enrichment/        # ABN/ABR lookup service
│   │       ├── systemic/          # Embedding clustering + anomaly detection
│   │       ├── communications/    # Line 1 draft generation
│   │       └── queue/             # BullMQ background job processors
│   └── client/                    # Next.js frontend
│       ├── app/                   # Pages (complaint form, dashboard views, settings)
│       ├── components/            # Reusable UI components
│       └── styles/                # Tailwind CSS + government design system
└── package.json
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture diagram, database schema, complete API endpoint table, complaint lifecycle walkthrough, priority scoring formula, and MVP roadmap.

---

## Database

### Visual browser

```bash
npx prisma studio
```

Opens a web UI at http://localhost:5555 where you can browse and edit all tables.

### Schema overview

The database has 14 tables:

| Table | Purpose |
|-------|---------|
| `tenants` | Multi-tenant root (agencies/regulators) |
| `users` | Regulator staff with roles |
| `teams` | Organisational units |
| `complaints` | Core complaint records with all classification/risk fields |
| `complaint_embeddings` | pgvector embeddings for similarity search |
| `businesses` | Businesses with complaint stats and repeat offender flags |
| `evidence` | Uploaded files attached to complaints |
| `ai_outputs` | Full audit trail of every AI operation |
| `systemic_clusters` | Detected systemic issue groups |
| `communications` | Drafts, sent emails, internal notes |
| `communication_templates` | Reusable response templates |
| `tasks` | Workflow tasks assigned to officers |
| `escalations` | Escalation history |
| `complaint_events` | Timeline of all complaint events |
| `audit_logs` | Full system audit trail |

### Reset the database

```bash
npx prisma migrate reset
```

This drops all tables, re-applies migrations, and runs seeds.

---

## Troubleshooting

### `docker compose up` fails with port conflicts

PostgreSQL (5432) or Redis (6379) may already be running locally. Either stop the local services or change the port mappings in `docker-compose.yml`.

### `npx prisma migrate dev` fails with connection error

Make sure PostgreSQL is running and `DATABASE_URL` in `.env` is correct. If using Docker:

```bash
docker compose up -d postgres
# Wait a few seconds for it to become healthy
docker compose ps  # Should show postgres as "healthy"
```

### AI features return errors

- Check that `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set in `.env`
- Check that `AI_PROVIDER` matches the key you provided (`openai` or `anthropic`)
- The dashboard pages work without an API key (they use demo data)

### ABN search returns no results

- Register for an ABR API GUID at https://abr.business.gov.au/Tools/WebServices
- Set `ABR_API_GUID` in `.env`
- The complaint form falls back to manual entry if ABR is unavailable

### Next.js API calls fail in development

The Next.js dev server proxies `/api/*` requests to `http://localhost:4000`. Make sure the Express API is running (`npm run dev` starts both, or run `npm run dev:server` separately).

---

## Further Reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Full system architecture, API reference, database relationships, complaint lifecycle, priority formula, security model, MVP roadmap
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — Detailed development guide, adding new features, testing, deployment
- [docs/API.md](docs/API.md) — Complete API endpoint reference with request/response examples
