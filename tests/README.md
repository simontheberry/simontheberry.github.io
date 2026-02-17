# Test Suite Documentation

This directory contains comprehensive tests for the AI Complaint Triage Platform. The test infrastructure is organized by concern and includes examples for all critical testing patterns.

## Quick Start

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Run a specific test file
npx vitest run tests/services/ai/ai-service.test.ts

# Generate coverage report
npm run test -- --coverage
```

## Test Structure

### 1. **factories.ts** - Test Data Generation

Factory functions that generate realistic test objects matching domain models.

```typescript
// Each factory accepts optional overrides
createTestTenant({ settings: { ... } })
createTestUser(tenantId, { role: 'admin' })
createTestComplaint(tenantId, { monetaryValue: 5000 })
createTestBusiness(tenantId, { industry: 'retail' })
createTestAiOutput(complaintId, { confidence: 0.95 })
createMockEmbedding() // 1536-dimensional array
```

**Usage Pattern:**
```typescript
const tenant = createTestTenant();
const user = createTestUser(tenant.id, { role: 'supervisor' });
const complaint = createTestComplaint(tenant.id);
```

### 2. **setup.ts** - Test Environment Configuration

Initializes environment variables for all tests:
- `NODE_ENV=test`
- Database and Redis URLs
- JWT secret, OpenAI API key, SMTP settings
- Auto-cleanup via `afterEach` hooks

### 3. **vitest.config.ts** - Vitest Configuration

- Global test runner with Node environment
- Path aliases matching `tsconfig.json` (@, @server, @shared)
- Coverage targets: 80% lines/functions/statements, 75% branches
- HTML coverage reporter

---

## Test Categories

### Unit Tests

**File Pattern:** `tests/services/**/*.test.ts`

Example: `tests/services/ai/ai-service.test.ts`

Tests individual functions/methods in isolation with mocked dependencies.

**Template:**
```typescript
import { AiService } from '../../../src/server/services/ai/ai-service';
import { createMockAiResponse } from '../../factories';

describe('AiService', () => {
  let aiService: AiService;

  beforeEach(() => {
    aiService = new AiService();
  });

  it('extracts structured data from complaint', async () => {
    const result = await aiService.extractComplaintData('complaint text');
    expect(result.record.confidence).toBeGreaterThan(0);
  });
});
```

**Services to Test:**
- `src/server/services/ai/ai-service.ts` - AI orchestration
- `src/server/services/triage/triage-service.ts` - Triage engine
- `src/server/services/mail/mail.service.ts` - Email sending
- `src/server/services/compliance/audit-service.ts` - Compliance reporting
- `src/server/services/queue/worker.ts` - Background jobs

### Route Tests

**File Pattern:** `tests/routes/**/*.test.ts`

Example: `tests/routes/complaint.routes.test.ts`

Tests HTTP endpoints with mocked database and auth middleware.

**Key Patterns:**
- Mock Prisma via `vi.mock('../../src/server/db/client')`
- Inject auth context via middleware
- Test happy path + error cases + validation

**Routes to Test:**
- GET endpoints (retrieval, filtering, pagination)
- POST endpoints (creation, validation)
- PATCH endpoints (updates, audit logging)
- DELETE endpoints (soft delete, authorization)

### Security Tests

**File Pattern:** `tests/security/**/*.test.ts`

Example: `tests/security/rbac.test.ts`

Tests authorization logic across all user roles.

**Coverage:**
- Admin role can access all endpoints
- Supervisor can escalate but not delete
- Complaint Officer has read/write but no admin functions
- Executive read-only access
- Multi-level authorization chains

### Integration Tests

**File Pattern:** `tests/integration/**/*.test.ts`

Example: `tests/integration/triage-pipeline.integration.test.ts`

Tests complete workflows across multiple services.

**Scenarios:**
- Full triage pipeline (extract → classify → score → route)
- Complaint with missing data detection
- Systemic risk detection from complaint clustering
- SLA escalation workflows
- Evidence analysis end-to-end

### Queue/Worker Tests

**File Pattern:** `tests/queue/**/*.test.ts`

Example: `tests/queue/sla-worker.test.ts`

Tests background job processing and async operations.

**Coverage:**
- Job enqueueing and processing
- Retry logic on failures
- Escalation creation and status updates
- Category-specific SLA logic (48h line1, 120h line2, etc.)

### Validation Tests

**File Pattern:** `tests/validation/**/*.test.ts`

Example: `tests/validation/api-validation.test.ts`

Tests Zod schemas for input validation.

**Coverage:**
- Required field validation
- Type checking (enums, strings, numbers)
- Boundary conditions (min/max lengths, positive numbers)
- Optional field handling
- Error response format
- Success response format

---

## Mocking Patterns

### Mock Prisma Database

```typescript
import { vi } from 'vitest';

vi.mock('../../src/server/db/client', () => ({
  prisma: {
    complaint: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// In test
const { prisma } = await import('../../src/server/db/client');
vi.mocked(prisma.complaint.create).mockResolvedValueOnce({...});
```

### Mock Auth Middleware

```typescript
app.use((req: any, res, next) => {
  req.user = createTestUser(tenant.id, { role: 'admin' });
  req.tenant = tenant;
  next();
});
```

### Mock AI Service

```typescript
vi.mock('../../src/server/services/ai/ai-service');

const aiService = new AiService();
vi.mocked(aiService.extractComplaintData).mockResolvedValueOnce({
  result: { extractedFields: {...} },
  record: { confidence: 0.95 }
});
```

### Mock External APIs

```typescript
// For OpenAI, Anthropic, SMTP, etc.
vi.mock('openai', () => ({
  OpenAI: vi.fn(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({...})
    }
  }))
}));
```

---

## Test Assertions

### Common Patterns

```typescript
// Existence checks
expect(result).toBeDefined();
expect(result.id).toBeTruthy();

// Type checks
expect(Array.isArray(result)).toBe(true);
expect(typeof result).toBe('number');

// Range validation (confidence, risk scores)
expect(score).toBeGreaterThanOrEqual(0);
expect(score).toBeLessThanOrEqual(1);

// Enum validation
expect(['low', 'medium', 'high']).toContain(result.riskLevel);

// Array content
expect(result).toHaveLength(3);
expect(result).toContain(expectedItem);

// Object properties
expect(result).toHaveProperty('id');
expect(result).toMatchObject({ status: 'triaged', riskLevel: 'high' });

// Mock call verification
expect(vi.mocked(prisma.complaint.create)).toHaveBeenCalledWith({
  data: expect.objectContaining({ tenantId: '...' })
});
```

---

## Coverage Goals

| Metric | Target | Status |
|--------|--------|--------|
| Lines | 80% | In Progress (#34) |
| Functions | 80% | In Progress (#34) |
| Statements | 80% | In Progress (#34) |
| Branches | 75% | In Progress (#34) |

**Priority Areas:**
1. AI service (extracting, classifying, scoring)
2. Triage logic (routing, priority calculation)
3. RBAC middleware (authorization across roles)
4. Complaint routes (CRUD operations)
5. Queue workers (SLA checking, escalation)
6. Compliance/audit (logging, reporting)

---

## Running Tests

### Single File
```bash
npx vitest run tests/services/ai/ai-service.test.ts
```

### Single Suite
```bash
npx vitest run tests/services/ai/ai-service.test.ts --reporter=verbose
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test -- --coverage
# Opens: coverage/index.html
```

### Debugging
```bash
node --inspect-brk ./node_modules/.bin/vitest run tests/services/ai/ai-service.test.ts
# Then open chrome://inspect
```

---

## Common Issues & Solutions

**Issue:** "Cannot find module" errors
- **Solution:** Check path aliases in `vitest.config.ts` match `tsconfig.json`

**Issue:** Mock not working
- **Solution:** Mock must be imported/used in same test file; ensure vi.mock() is at top level

**Issue:** Async test timeouts
- **Solution:** Add `timeout: 10000` to `it()` or ensure all promises are awaited

**Issue:** Database queries not isolated per test
- **Solution:** Use `vi.clearAllMocks()` in `afterEach` hook; create fresh test data in `beforeEach`

---

## Next Steps for #34

1. **Expand route tests** - Add POST/PATCH/DELETE to each route module
2. **Add component tests** - React components in `components/` directory
3. **Performance tests** - Measure triage pipeline latency
4. **Error scenario tests** - Network failures, timeouts, malformed data
5. **Data retention tests** - Archive and deletion workflows
6. **Email delivery tests** - Mock SMTP and verify template interpolation

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Vitest Testing Library](https://testing-library.com/)
