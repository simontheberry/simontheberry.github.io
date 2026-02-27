import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

vi.mock('../../src/server/db/client', () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    business: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    complaint: { create: vi.fn() },
    complaintEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../src/server/db/audit', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../src/server/config', () => ({
  config: {
    server: { port: 4000, host: '0.0.0.0', corsOrigin: '*', nodeEnv: 'test' },
    database: { url: 'postgres://test' },
    jwt: { secret: 'test-secret', expiresIn: '8h' },
    ai: { openaiApiKey: 'sk-test', provider: 'openai', model: 'gpt-4' },
    redis: { url: 'redis://localhost:6379' },
  },
}));

vi.mock('../../src/server/api/middleware/rate-limiter', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/server/services/queue/worker', () => ({
  getTriageQueue: vi.fn(() => null),
  getSlaQueue: vi.fn(() => null),
  QUEUES: { COMPLAINT_TRIAGE: 'complaint-triage', SLA_MONITOR: 'sla-monitor' },
}));

vi.mock('../../src/server/services/ai/ai-service', () => ({
  getAiService: vi.fn(() => ({
    detectMissingData: vi.fn(async () => ({
      result: {
        extractedData: { businessName: 'Test' },
        missingFields: [{ field: 'amount', question: 'How much?' }],
        followUpQuestions: ['How much was the transaction?'],
        completenessScore: 0.6,
        confidence: 0.85,
      },
      record: { model: 'gpt-4o' },
    })),
  })),
}));

import { createTestTenant } from '../factories';

describe('Intake Routes', () => {
  let app: express.Application;
  let mockTenant: ReturnType<typeof createTestTenant>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTenant = createTestTenant({ slug: 'test-regulator' });

    app = express();
    app.use(express.json());

    const { intakeRoutes } = await import('../../src/server/api/routes/intake.routes');
    app.use('/api/v1/intake', intakeRoutes);
    app.use(errorHandler);
  });

  describe('POST /submit', () => {
    const validSubmission = {
      tenantSlug: 'test-regulator',
      complainant: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
      },
      business: {
        name: 'Dodgy Corp',
      },
      complaint: {
        rawText: 'I was charged twice for a product that was never delivered to my address.',
      },
    };

    it('creates complaint and returns reference number', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as any);
      vi.mocked(prisma.business.create).mockResolvedValueOnce({ id: 'biz-1' } as any);
      vi.mocked(prisma.complaint.create).mockResolvedValueOnce({
        id: 'cmp-1',
        referenceNumber: 'CMP-TEST-1234',
      } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/api/v1/intake/submit')
        .send(validSubmission)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.referenceNumber).toBeDefined();
      expect(response.body.data.complaintId).toBe('cmp-1');
    });

    it('returns 404 for invalid tenant slug', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      await request(app)
        .post('/api/v1/intake/submit')
        .send(validSubmission)
        .expect(404);
    });

    it('returns 404 for inactive tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        ...mockTenant,
        isActive: false,
      } as any);

      await request(app)
        .post('/api/v1/intake/submit')
        .send(validSubmission)
        .expect(404);
    });

    it('rejects missing complainant first name', async () => {
      await request(app)
        .post('/api/v1/intake/submit')
        .send({
          ...validSubmission,
          complainant: { ...validSubmission.complainant, firstName: '' },
        })
        .expect(400);
    });

    it('rejects invalid email', async () => {
      await request(app)
        .post('/api/v1/intake/submit')
        .send({
          ...validSubmission,
          complainant: { ...validSubmission.complainant, email: 'not-email' },
        })
        .expect(400);
    });

    it('rejects complaint text shorter than 10 characters', async () => {
      await request(app)
        .post('/api/v1/intake/submit')
        .send({
          ...validSubmission,
          complaint: { rawText: 'Too short' },
        })
        .expect(400);
    });

    it('rejects missing business name', async () => {
      await request(app)
        .post('/api/v1/intake/submit')
        .send({
          ...validSubmission,
          business: { name: '' },
        })
        .expect(400);
    });

    it('rejects missing tenant slug', async () => {
      await request(app)
        .post('/api/v1/intake/submit')
        .send({
          ...validSubmission,
          tenantSlug: '',
        })
        .expect(400);
    });

    it('links existing business by ABN', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const existingBiz = { id: 'biz-existing', complaintCount: 5 };
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as any);
      vi.mocked(prisma.business.findUnique).mockResolvedValueOnce(existingBiz as any);
      vi.mocked(prisma.business.update).mockResolvedValueOnce({
        ...existingBiz,
        complaintCount: 6,
      } as any);
      vi.mocked(prisma.complaint.create).mockResolvedValueOnce({
        id: 'cmp-2',
        referenceNumber: 'CMP-TEST-5678',
      } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/api/v1/intake/submit')
        .send({
          ...validSubmission,
          business: { name: 'Existing Corp', abn: '12345678901' },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(vi.mocked(prisma.business.update)).toHaveBeenCalled();
    });
  });

  describe('POST /ai-guidance', () => {
    it('returns AI guidance for complaint text', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as any);

      const response = await request(app)
        .post('/api/v1/intake/ai-guidance')
        .send({
          tenantSlug: 'test-regulator',
          text: 'I bought a faulty product',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.missingFields).toBeDefined();
      expect(response.body.data.followUpQuestions).toBeDefined();
      expect(response.body.data.confidence).toBeDefined();
    });

    it('returns 404 for invalid tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      await request(app)
        .post('/api/v1/intake/ai-guidance')
        .send({
          tenantSlug: 'nonexistent',
          text: 'Test complaint text',
        })
        .expect(404);
    });

    it('rejects empty text', async () => {
      await request(app)
        .post('/api/v1/intake/ai-guidance')
        .send({
          tenantSlug: 'test-regulator',
          text: '',
        })
        .expect(400);
    });
  });

  describe('POST /webhook', () => {
    it('rejects invalid API key', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant as any).findMany = vi.fn().mockResolvedValueOnce([]);

      await request(app)
        .post('/api/v1/intake/webhook')
        .send({
          source: 'external-system',
          payload: { complaintText: 'Test complaint from webhook' },
          tenantApiKey: 'invalid-key',
        })
        .expect(401);
    });

    it('rejects missing required fields', async () => {
      await request(app)
        .post('/api/v1/intake/webhook')
        .send({ source: 'test' })
        .expect(400);
    });
  });
});
