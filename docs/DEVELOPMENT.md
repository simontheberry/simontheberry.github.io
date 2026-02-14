# Development Guide

This guide covers day-to-day development workflows, how to extend the platform, and how to prepare for deployment.

---

## Development Workflow

### Starting the dev environment

```bash
# Start infrastructure
docker compose up -d postgres redis

# Install dependencies (first time or after package.json changes)
npm install

# Generate Prisma client (first time or after schema changes)
npx prisma generate

# Apply database migrations (first time or after schema changes)
npx prisma migrate dev --name <description>

# Start development servers (Next.js + Express, both with hot-reload)
npm run dev
```

### Running individual services

```bash
# Frontend only (port 3000)
npm run dev:client

# API only (port 4000)
npm run dev:server

# Background job worker
npm run queue:worker
```

### Type checking

```bash
# Check both client and server TypeScript
npm run typecheck
```

### Linting

```bash
npm run lint
```

---

## Database Operations

### Changing the schema

1. Edit `prisma/schema.prisma`
2. Create and apply the migration:

```bash
npx prisma migrate dev --name add_new_field
```

This generates a SQL migration file in `prisma/migrations/` and applies it to your local database.

3. Regenerate the Prisma client:

```bash
npx prisma generate
```

### Viewing and editing data

```bash
npx prisma studio
```

Opens a visual database browser at http://localhost:5555.

### Resetting the database

```bash
# Drop all tables, re-apply all migrations, run seeds
npx prisma migrate reset
```

### Seeding

Add seed logic to `src/server/db/seeds/index.ts`, then run:

```bash
npm run db:seed
```

### Raw SQL access

Connect directly to PostgreSQL:

```bash
docker compose exec postgres psql -U postgres -d complaint_triage
```

Useful queries:

```sql
-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Count complaints by status
SELECT status, COUNT(*) FROM complaints GROUP BY status;

-- Find highest priority complaints
SELECT reference_number, risk_level, priority_score
FROM complaints
ORDER BY priority_score DESC NULLS LAST
LIMIT 10;

-- Check systemic clusters
SELECT title, complaint_count, risk_level, detected_at
FROM systemic_clusters
WHERE is_active = true
ORDER BY complaint_count DESC;
```

---

## Adding a New Feature

### Adding a new API endpoint

1. **Define the route** in `src/server/api/routes/`. Either add to an existing route file or create a new one:

```typescript
// src/server/api/routes/my-feature.routes.ts
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';

export const myFeatureRoutes = Router();
myFeatureRoutes.use(authenticate);

myFeatureRoutes.get('/', async (req: Request, res: Response) => {
  res.json({ success: true, data: {} });
});
```

2. **Register the route** in `src/server/api/routes/index.ts`:

```typescript
import { myFeatureRoutes } from './my-feature.routes';
apiRouter.use('/my-feature', myFeatureRoutes);
```

3. **Add request validation** using Zod schemas:

```typescript
import { z } from 'zod';

const mySchema = z.object({
  name: z.string().min(1),
  value: z.number().positive(),
});

myFeatureRoutes.post('/', async (req, res) => {
  const body = mySchema.parse(req.body);
  // ...
});
```

### Adding a new AI pipeline

1. **Add the prompt template** in `src/server/services/ai/prompts.ts`:

```typescript
export const MY_NEW_PROMPT = `Analyze the following...
{{inputText}}
Respond with this JSON schema:
{ "result": string, "confidence": number }`;
```

2. **Add the pipeline method** in `src/server/services/ai/ai-service.ts`:

```typescript
async myNewAnalysis(inputText: string) {
  const prompt = interpolatePrompt(MY_NEW_PROMPT, { inputText });
  return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'my_new_analysis');
}
```

3. All AI outputs are automatically stored with full audit trail (prompt, raw output, parsed result, confidence, model, token usage, latency).

### Adding a new dashboard page

1. **Create the page** in `src/client/app/dashboard/my-page/page.tsx`:

```tsx
'use client';

export default function MyPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gov-grey-900">My Page</h1>
      {/* ... */}
    </div>
  );
}
```

2. **Add navigation** in `src/client/components/layout/DashboardLayout.tsx` — add an entry to the `NAV_ITEMS` array:

```typescript
{
  label: 'My Page',
  href: '/dashboard/my-page',
  icon: <SomeIcon className="h-5 w-5" />,
  roles: ['complaint_officer', 'supervisor', 'admin'],
},
```

The page will automatically be wrapped in the dashboard layout (sidebar + top bar) because it's under `/dashboard/`.

### Adding a new background job

1. **Define the job data type** in `src/server/services/queue/worker.ts`:

```typescript
export interface MyJobData {
  complaintId: string;
  // ...
}
```

2. **Add a queue name** to the `QUEUES` constant.

3. **Write the processor function**.

4. **Register the worker** in the `startWorkers()` function.

5. **Enqueue jobs** from your route handler:

```typescript
// const queue = new Queue(QUEUES.MY_QUEUE, { connection });
// await queue.add('process', jobData);
```

---

## Shared Types

Types in `src/shared/types/` are imported by both client and server:

- `complaint.ts` — Complaint, TriageResult, PriorityWeights, enums
- `user.ts` — User, Tenant, TenantSettings, roles
- `api.ts` — ApiResponse, PaginationMeta, DashboardStats, filters

Constants in `src/shared/constants/`:

- `categories.ts` — Complaint categories, industry classifications, risk level configs, status labels

When adding new enums or shared types, put them here so both sides stay in sync.

---

## AI Provider Configuration

The platform uses a provider abstraction layer (`src/server/services/ai/provider.ts`) that supports:

| Provider | Models | Embeddings |
|----------|--------|------------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, etc. | text-embedding-ada-002, text-embedding-3-small |
| Anthropic | claude-sonnet, claude-opus, etc. | Not supported natively (falls back to OpenAI for embeddings) |

### Switching providers

Set `AI_PROVIDER` in `.env`:

```bash
# Use OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Use Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514
# Note: Still needs OPENAI_API_KEY for embeddings
```

### Adding a new provider

1. Implement the `AiProvider` interface in `src/server/services/ai/provider.ts`
2. Add the provider to the `createAiProvider()` factory function
3. Add the provider name to the config schema in `src/server/config/index.ts`

---

## Multi-Tenancy

Every database query is scoped to a `tenantId`. The tenant is resolved from:

1. `x-tenant-id` HTTP header (API key authentication)
2. JWT token payload (user authentication)
3. URL subdomain (future: `accc.platform.gov.au`)

When writing new queries, always include the tenant filter:

```typescript
const complaints = await prisma.complaint.findMany({
  where: { tenantId: req.tenantId },
});
```

---

## Production Build

```bash
# Build both client and server
npm run build

# The output:
#   .next/          — Next.js production build
#   dist/server/    — Compiled Express server

# Start production server
npm run start
```

### Docker production build

```bash
# Build the production image
docker build -f docker/Dockerfile -t complaint-triage .

# Run it
docker run -p 3000:3000 -p 4000:4000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=... \
  complaint-triage
```

### Environment variables in production

- Set `NODE_ENV=production`
- Use a strong, random `JWT_SECRET` (at least 32 characters)
- Configure `DATABASE_URL` to point to your production PostgreSQL with pgvector
- Configure `REDIS_URL` to point to your production Redis
- Set `CLIENT_URL` to your actual domain
- Disable `autoSendEnabled` in tenant settings until manually verified

---

## Security Checklist

Before deploying to production:

- [ ] Set a strong, unique `JWT_SECRET`
- [ ] Use HTTPS for all traffic
- [ ] Set `CLIENT_URL` to the actual production domain
- [ ] Review CORS configuration in `src/server/index.ts`
- [ ] Ensure `autoSendEnabled` is `false` in tenant settings
- [ ] Set up database encryption at rest
- [ ] Configure rate limiting on public endpoints
- [ ] Set up log aggregation for audit logs
- [ ] Review all AI prompt templates for your regulatory context
- [ ] Test RBAC by logging in with each role type
