# Test Suite Implementation Guide (#34)

This guide accelerates completion of **Task #34: Comprehensive Test Suite** by providing:
- ✅ Pre-built test infrastructure (vitest, factories, setup)
- ✅ Example tests for all critical concerns
- ✅ Mocking patterns and best practices
- ✅ Coverage targets and prioritization

## Task Overview

**Objective:** Achieve 80%+ coverage across services, routes, and security layers.

**Timeline:** 3-4 days

**Definition of Done:**
- All AI service tests passing
- All route tests (CRUD, pagination, filtering)
- Security/RBAC tests complete
- Integration tests (triage pipeline) working
- Queue worker tests for SLA escalation
- 80% line/function coverage, 75% branch coverage

---

## Infrastructure Ready ✅

These files are pre-built and ready to use:

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration with globals, path aliases, coverage targets |
| `tests/setup.ts` | Environment setup (NODE_ENV, secrets, cleanup hooks) |
| `tests/factories.ts` | 9 factory functions generating realistic test data |
| `tests/README.md` | Comprehensive testing guide and patterns |

---

## Example Tests Provided ✅

Use these as templates for expanding coverage:

### 1. **tests/services/ai/ai-service.test.ts** (10+ suites)
Tests core AI orchestration:
- ✅ extractComplaintData (validation, confidence)
- ✅ classifyComplaint (categorization)
- ✅ scoreRisk (0-1 range, monetary impact, vulnerability)
- ✅ detectMissingData (field detection, follow-up questions)
- ✅ draftComplainantResponse (response generation)
- ✅ draftBusinessNotice (formal notice generation)
- ✅ generateEmbedding (1536-dim, normalized values)
- ✅ analyzeEvidence (relevance, findings extraction)

**Copy this pattern for other services:**
```typescript
describe('ServiceName', () => {
  let service: ServiceType;
  beforeEach(() => { service = new ServiceType(); });

  describe('methodName', () => {
    it('does X', async () => { /* test */ });
  });
});
```

### 2. **tests/routes/complaint.routes.test.ts** (route testing)
Tests HTTP endpoints:
- ✅ GET /:id (retrieval, 404 handling)
- ✅ POST / (creation, validation, audit logging)
- ✅ PATCH /:id (updates, status transitions, old value tracking)
- ✅ GET / (pagination, filtering, tenant isolation)

**Expand to other route modules:**
- `triage.routes.ts` - Test SLA endpoints, classification
- `communication.routes.ts` - Test drafting and sending
- `settings.routes.ts` - Test CRUD with admin checks
- `evidence.routes.ts` - Test upload, AI analysis, deletion
- `compliance.routes.ts` - Test reporting and export

### 3. **tests/security/rbac.test.ts** (authorization)
Tests role-based access control:
- ✅ Admin can access any endpoint
- ✅ Supervisor can manage escalation/team
- ✅ Complaint Officer has read/write only
- ✅ Executive read-only access

**Test all sensitive endpoints:**
- DELETE operations (supervisor+ only)
- Admin-only actions (user management, archival)
- Escalation endpoints (supervisor+ only)
- Settings changes (admin only)

### 4. **tests/integration/triage-pipeline.integration.test.ts** (end-to-end)
Tests complete workflows:
- ✅ Full triage: extract → classify → score → route
- ✅ Missing data detection
- ✅ Systemic risk identification
- ✅ Confidence-based routing
- ✅ Vulnerable consumer escalation

**Add integration tests for:**
- Evidence upload → AI analysis → incorporation into triage
- SLA monitoring → escalation → status update
- Communication draft → supervisor edit → send
- Complaint submission → auto-triage → response

### 5. **tests/queue/sla-worker.test.ts** (background jobs)
Tests async job processing:
- ✅ SLA breach detection (48h line1, 120h line2, 21d escalation)
- ✅ Escalation record creation
- ✅ Status updates
- ✅ Critical priority handling

**Expand to other workers:**
- Email delivery queue (sending, retries, failures)
- Embedding generation queue (bulk operations)
- Report generation queue (async PDF export)
- Archival queue (data retention)

### 6. **tests/validation/api-validation.test.ts** (input validation)
Tests Zod schemas:
- ✅ Complaint creation (required fields, email format, text length)
- ✅ Complaint updates (valid status transitions, value ranges)
- ✅ Evidence upload (file types, size limits)
- ✅ Template creation (enum validation, variables)
- ✅ Pagination (boundaries, defaults)
- ✅ Response formats (success/error structure)

**Add validation for:**
- Business routes (ABN format, contact info)
- Communication routes (email validation, template interpolation)
- Settings routes (weights sum to 1, thresholds 0-1)
- Compliance export (date ranges, format selection)

---

## Implementation Roadmap

### Day 1: Service Tests (70 tests)
Focus on business logic with mocked dependencies.

**Priority Order:**
1. `tests/services/ai/` - Core AI service (complete)
2. `tests/services/triage/triage-service.test.ts` - Routing, priority
3. `tests/services/mail/mail.service.test.ts` - Email sending, templates
4. `tests/services/compliance/audit-service.test.ts` - Reporting, archival

**Test Template:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailService } from '../../../src/server/services/mail/mail.service';

vi.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;
  beforeEach(() => { service = new MailService(); });

  it('sends email with proper configuration', async () => {
    // Arrange: Create test data
    const result = await service.sendEmail({...});
    // Assert: Verify behavior
    expect(result.success).toBe(true);
  });
});
```

### Day 2: Route Tests (50 tests)
Test HTTP endpoints with mocked database and auth.

**Route Modules (by size):**
1. `complaint.routes` - ✅ Template provided
2. `triage.routes` - SLA, classification endpoints
3. `communication.routes` - Draft, send, preview
4. `settings.routes` - CRUD with authorization
5. `evidence.routes` - Upload, list, delete
6. `business.routes` - Lookup, creation
7. `compliance.routes` - Reports, export, archive
8. `notes.routes` - CRUD for internal notes

**Pattern:**
```typescript
// Mock Prisma and auth
vi.mock('../../src/server/db/client');
app.use((req: any) => { req.user = createTestUser(...); });

// Test each HTTP verb
it('GET /:id returns with tenant isolation', async () => {
  vi.mocked(prisma.complaint.findUnique).mockResolvedValueOnce({...});
  const response = await request(app).get('/api/v1/complaint/123');
  expect(response.status).toBe(200);
});
```

### Day 3: Security & Integration Tests (40 tests)
Test authorization logic and end-to-end workflows.

**Security Tests:**
- ✅ RBAC template provided
- Admin, Supervisor, Officer, Executive roles
- Multi-level authorization chains
- Protected delete/archive operations

**Integration Tests:**
- ✅ Triage pipeline template provided
- Evidence → AI analysis → incorporation
- SLA → escalation → notification
- Complaint submission → auto-response

### Day 4: Completion (50 tests)
Coverage, edge cases, error scenarios.

**Additional Test Categories:**
- Error handling (malformed input, timeouts, API failures)
- Data retention (archival, deletion)
- Performance (triage latency, query optimization)
- Email delivery (SMTP failures, retry logic)
- Component tests (React components in `components/`)

---

## Running & Debugging

### Run Specific Tests
```bash
# Single file
npx vitest run tests/services/ai/ai-service.test.ts

# Single test suite
npx vitest run tests/services/ai/ai-service.test.ts -t "extractComplaintData"

# Watch mode (development)
npm run test:watch

# Coverage report
npm run test -- --coverage
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["run", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

Then press F5 to debug current test file.

---

## Coverage Tracking

### Current Status (from vitest config)
```
Lines:        80% target
Functions:    80% target
Statements:   80% target
Branches:     75% target
```

### Monitor Coverage
```bash
# Generate HTML report
npm run test -- --coverage

# View in browser
open coverage/index.html
```

### Coverage by Module (Expected)
| Module | Type | Tests | Coverage |
|--------|------|-------|----------|
| `ai-service` | Unit | 12 | 90% |
| `triage-service` | Unit | 10 | 85% |
| `complaint.routes` | Route | 8 | 85% |
| `rbac` | Security | 10 | 90% |
| `triage-pipeline` | Integration | 6 | 80% |
| `sla-worker` | Queue | 8 | 80% |
| `validation` | Unit | 25 | 95% |

---

## Key Patterns

### Pattern 1: Unit Test with Mocked Dependencies
```typescript
vi.mock('../../src/server/db/client');

it('does something', async () => {
  const { prisma } = await import('../../src/server/db/client');
  vi.mocked(prisma.complaint.create).mockResolvedValueOnce({...});

  const result = await service.createComplaint({...});
  expect(result.id).toBeDefined();
});
```

### Pattern 2: Route Test with Auth
```typescript
app.use((req: any, res, next) => {
  req.user = createTestUser(tenant.id, { role: 'admin' });
  req.tenant = tenant;
  next();
});

it('admin can delete', async () => {
  const response = await request(app).delete('/api/v1/evidence/123');
  expect(response.status).toBe(200);
});
```

### Pattern 3: Authorization Check
```typescript
it('officer cannot delete', async () => {
  const officer = createTestUser(tenant.id, { role: 'complaint_officer' });
  app.use((req: any) => { req.user = officer; });

  const response = await request(app).delete('/api/v1/evidence/123');
  expect(response.status).toBe(403);
});
```

### Pattern 4: Integration Test
```typescript
it('full triage pipeline', async () => {
  // Step 1: Extract
  const extracted = await ai.extractComplaintData(text);
  expect(extracted.record.confidence).toBeGreaterThan(0.85);

  // Step 2: Classify
  const classified = await ai.classifyComplaint(text, extracted);
  expect(classified.result.category).toBeDefined();

  // Step 3: Score
  const scored = await ai.scoreRisk(complaint, classified);
  expect(scored.result.riskScore).toBeLessThanOrEqual(1);
});
```

### Pattern 5: Validation Test
```typescript
it('rejects invalid status', () => {
  const schema = z.object({ status: z.enum(['low', 'high']) });
  const result = schema.safeParse({ status: 'invalid' });
  expect(result.success).toBe(false);
});
```

---

## Common Pitfalls

❌ **Don't:** Use real database connections in tests
✅ **Do:** Mock Prisma with `vi.mock()` and return fake data

❌ **Don't:** Make real API calls to OpenAI/Anthropic
✅ **Do:** Mock AI service methods with `vi.mocked().mockResolvedValueOnce()`

❌ **Don't:** Test implementation details (private methods)
✅ **Do:** Test public interfaces and behavior

❌ **Don't:** Leave `vi.clearAllMocks()` out of `afterEach`
✅ **Do:** Clear mocks to prevent test pollution

❌ **Don't:** Write tests without `beforeEach` setup
✅ **Do:** Use factories to create consistent test data

---

## Success Criteria for #34

✅ All AI service tests (extracting, classifying, scoring, drafting, analyzing)
✅ All route tests (GET/POST/PATCH/DELETE for each module)
✅ RBAC tests (admin, supervisor, officer, executive, system roles)
✅ Integration tests (triage pipeline, SLA escalation, evidence analysis)
✅ Validation tests (Zod schemas for all endpoints)
✅ 80%+ coverage on critical paths
✅ All tests passing: `npm run test` → green
✅ No TypeScript errors: `npm run typecheck` → 0 errors
✅ Documentation: tests/README.md covers patterns

---

## Support & Questions

If you need clarification on:
- **Mocking patterns** → See `tests/README.md` "Mocking Patterns"
- **Test structure** → Review example tests in `tests/`
- **Vitest docs** → https://vitest.dev/
- **Zod validation** → https://zod.dev/

**Key Files:**
- Factories: `tests/factories.ts`
- Setup: `tests/setup.ts`
- Examples: `tests/services/ai/ai-service.test.ts`

---

## Next Phase

When #34 is complete:
- ✅ Phase 2 is 100% shipped
- ✅ All code has test coverage
- 🚀 Phase 3 ready to start (performance tuning, bug fixes, UX research)
