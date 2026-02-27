import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

vi.mock('../../src/server/db/client', () => ({
  prisma: {
    complaint: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    complaintEvent: { create: vi.fn() },
    aiOutput: { create: vi.fn(), findMany: vi.fn() },
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

vi.mock('../../src/server/api/middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorize: (..._roles: any[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/server/api/middleware/tenant-resolver', () => ({
  requireTenant: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/server/services/queue/worker', () => {
  const mockAdd = vi.fn().mockResolvedValue({});
  return {
    getTriageQueue: vi.fn(() => ({ add: mockAdd })),
    getSlaQueue: vi.fn(() => ({ add: mockAdd })),
    QUEUES: { COMPLAINT_TRIAGE: 'complaint-triage', SLA_MONITOR: 'sla-monitor' },
  };
});

import { createTestComplaint, createTestTenant } from '../factories';

describe('Triage Routes', () => {
  let app: express.Application;
  let mockTenant: ReturnType<typeof createTestTenant>;
  let mockComplaint: ReturnType<typeof createTestComplaint>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTenant = createTestTenant();
    mockComplaint = createTestComplaint(mockTenant.id, {
      status: 'submitted',
      rawText: 'Test complaint for triage',
      riskLevel: 'medium',
      priorityScore: 0.5,
      routingDestination: 'line_1_auto',
    });

    app = express();
    app.use(express.json());

    app.use((req: any, _res: any, next: any) => {
      req.tenantId = mockTenant.id;
      req.userId = 'test-user-id';
      req.userRole = 'supervisor';
      next();
    });

    const { triageRoutes } = await import('../../src/server/api/routes/triage.routes');
    app.use('/api/v1/triage', triageRoutes);
    app.use(errorHandler);
  });

  describe('POST /:complaintId (Trigger triage)', () => {
    it('queues triage job for existing complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(mockComplaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...mockComplaint, status: 'triaging' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('triage_queued');
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .post('/api/v1/triage/non-existent-id')
        .expect(404);
    });
  });

  describe('POST /:complaintId/override', () => {
    it('overrides triage result with reason', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(mockComplaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.aiOutput.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}/override`)
        .send({
          riskLevel: 'critical',
          routingDestination: 'systemic_review',
          reason: 'Multiple similar complaints from same business',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.riskLevel).toBe('critical');
      expect(response.body.data.routingDestination).toBe('systemic_review');
    });

    it('rejects override without reason', async () => {
      await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}/override`)
        .send({ riskLevel: 'high' })
        .expect(400);
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .post('/api/v1/triage/missing-id/override')
        .send({ riskLevel: 'high', reason: 'Test override' })
        .expect(404);
    });

    it('rejects invalid risk level', async () => {
      await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}/override`)
        .send({ riskLevel: 'extreme', reason: 'Test' })
        .expect(400);
    });

    it('rejects invalid routing destination', async () => {
      await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}/override`)
        .send({ routingDestination: 'invalid_route', reason: 'Test' })
        .expect(400);
    });
  });

  describe('GET /:complaintId/result', () => {
    it('returns triage result with AI outputs', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce({
        id: mockComplaint.id,
        riskLevel: 'high',
        priorityScore: 0.78,
        routingDestination: 'line_2_investigation',
        category: 'product_safety',
        summary: 'Defective product complaint',
      } as any);
      vi.mocked(prisma.aiOutput.findMany).mockResolvedValueOnce([
        {
          id: 'ai-1',
          outputType: 'classification',
          model: 'gpt-4o',
          confidence: 0.92,
          reasoning: 'Product safety issue',
          isEdited: false,
          latencyMs: 250,
          createdAt: new Date(),
        },
      ] as any);

      const response = await request(app)
        .get(`/api/v1/triage/${mockComplaint.id}/result`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.complaint.riskLevel).toBe('high');
      expect(response.body.data.aiOutputs).toHaveLength(1);
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/triage/missing-id/result')
        .expect(404);
    });
  });

  describe('GET /sla/breaches', () => {
    it('returns SLA breaches for tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([
        {
          id: 'cmp-breach',
          referenceNumber: 'CMP-BREACH-1',
          status: 'triaged',
          slaDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/triage/sla/breaches')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.breaches).toHaveLength(1);
    });

    it('returns empty when no breaches', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/triage/sla/breaches')
        .expect(200);

      expect(response.body.data.count).toBe(0);
    });
  });

  describe('GET /sla/approaching', () => {
    it('returns complaints approaching SLA deadline', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([
        {
          id: 'cmp-approaching',
          referenceNumber: 'CMP-APPROACH-1',
          status: 'in_progress',
          slaDeadline: new Date(Date.now() + 6 * 60 * 60 * 1000),
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/triage/sla/approaching')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.approaching).toHaveLength(1);
      expect(response.body.data.threshold.hours).toBe(12);
    });
  });

  describe('POST /:complaintId/sla/reopen', () => {
    it('reopens escalated complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const escalatedComplaint = createTestComplaint(mockTenant.id, { status: 'escalated' });
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(escalatedComplaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...escalatedComplaint, status: 'in_progress' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post(`/api/v1/triage/${escalatedComplaint.id}/sla/reopen`)
        .send({ reason: 'Additional evidence received' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('in_progress');
      expect(response.body.data.reason).toBe('Additional evidence received');
    });

    it('returns 404 for non-escalated complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}/sla/reopen`)
        .send({ reason: 'Test reopen' })
        .expect(404);
    });

    it('rejects without reason', async () => {
      await request(app)
        .post(`/api/v1/triage/${mockComplaint.id}/sla/reopen`)
        .send({})
        .expect(400);
    });
  });
});
