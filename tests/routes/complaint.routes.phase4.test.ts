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
      count: vi.fn(),
    },
    complaintEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
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

vi.mock('../../src/server/utils/query-parser', () => ({
  normalizeQuery: (q: any) => q,
  getQueryParam: (v: any) => (typeof v === 'string' ? v : undefined),
}));

import { createTestComplaint, createTestTenant } from '../factories';

describe('Complaint Routes - Phase 4', () => {
  let app: express.Application;
  let mockTenant: any;
  const TENANT_ID = 'tenant-p4';
  const USER_ID = 'user-p4';

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTenant = createTestTenant({ id: TENANT_ID });

    app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.tenantId = TENANT_ID;
      req.userId = USER_ID;
      req.userRole = 'supervisor';
      next();
    });

    const { complaintRoutes } = await import('../../src/server/api/routes/complaint.routes');
    app.use('/api/v1/complaints', complaintRoutes);
    app.use(errorHandler);
  });

  describe('GET /:id/similar (Vector Search)', () => {
    it('returns similar complaints via vector search', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce({ id: 'cmp-1' } as any);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ count: BigInt(1) }] as any)
        .mockResolvedValueOnce([
          {
            complaintId: 'cmp-2',
            referenceNumber: 'CMP-002',
            summary: 'Similar complaint',
            similarity: 0.92,
            riskLevel: 'high',
            business: 'Corp A',
            systemicClusterId: null,
          },
          {
            complaintId: 'cmp-3',
            referenceNumber: 'CMP-003',
            summary: 'Another similar',
            similarity: 0.87,
            riskLevel: 'medium',
            business: null,
            systemicClusterId: 'sc-1',
          },
        ] as any);

      const response = await request(app)
        .get('/api/v1/complaints/cmp-1/similar')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].similarity).toBe(0.92);
      expect(response.body.data[0].referenceNumber).toBe('CMP-002');
      expect(response.body.data[1].business).toBe('Unknown');
    });

    it('returns empty array with message when no embedding exists', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce({ id: 'cmp-1' } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ count: BigInt(0) }] as any);

      const response = await request(app)
        .get('/api/v1/complaints/cmp-1/similar')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.message).toContain('No embedding');
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/complaints/non-existent/similar')
        .expect(404);
    });

    it('accepts threshold and limit query params', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce({ id: 'cmp-1' } as any);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ count: BigInt(1) }] as any)
        .mockResolvedValueOnce([] as any);

      const response = await request(app)
        .get('/api/v1/complaints/cmp-1/similar?threshold=0.9&limit=5')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('returns empty array when no similar complaints found', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce({ id: 'cmp-1' } as any);
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([{ count: BigInt(1) }] as any)
        .mockResolvedValueOnce([] as any);

      const response = await request(app)
        .get('/api/v1/complaints/cmp-1/similar')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('State Transitions via PATCH /:id', () => {
    const makeComplaint = (status: string, assignedToId?: string) =>
      createTestComplaint(TENANT_ID, {
        id: 'cmp-transition',
        status,
        assignedToId: assignedToId ?? USER_ID,
      });

    it('transitions from submitted to triaging', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaint = makeComplaint('submitted');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(complaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...complaint, status: 'triaging' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/complaints/cmp-transition')
        .send({ status: 'triaging' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('transitions from assigned to in_progress', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaint = makeComplaint('assigned');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(complaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...complaint, status: 'in_progress' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/complaints/cmp-transition')
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('transitions from in_progress to awaiting_response', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaint = makeComplaint('in_progress');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(complaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...complaint, status: 'awaiting_response' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/complaints/cmp-transition')
        .send({ status: 'awaiting_response' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('transitions from in_progress to resolved', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaint = makeComplaint('in_progress');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(complaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...complaint, status: 'resolved' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/complaints/cmp-transition')
        .send({ status: 'resolved' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('creates complaint event on status change', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaint = makeComplaint('submitted');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(complaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ ...complaint, status: 'triaging' } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      await request(app)
        .patch('/api/v1/complaints/cmp-transition')
        .send({ status: 'triaging' })
        .expect(200);

      expect(vi.mocked(prisma.complaintEvent.create)).toHaveBeenCalled();
    });

    it('updates non-status fields', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaint = makeComplaint('in_progress');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(complaint as any);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({
        ...complaint,
        summary: 'Updated summary',
      } as any);
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/complaints/cmp-transition')
        .send({ summary: 'Updated summary' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /:id/timeline', () => {
    it('returns complaint events timeline', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce({ id: 'cmp-1', tenantId: TENANT_ID } as any);
      vi.mocked(prisma.complaintEvent.findMany).mockResolvedValueOnce([
        {
          id: 'evt-1',
          complaintId: 'cmp-1',
          eventType: 'submitted',
          description: 'Complaint submitted',
          metadata: null,
          createdBy: 'system',
          createdAt: new Date('2025-01-10'),
        },
        {
          id: 'evt-2',
          complaintId: 'cmp-1',
          eventType: 'status_change',
          description: 'Status changed to triaging',
          metadata: { fromStatus: 'submitted', toStatus: 'triaging' },
          createdBy: USER_ID,
          createdAt: new Date('2025-01-11'),
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/complaints/cmp-1/timeline')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/complaints/non-existent/timeline')
        .expect(404);
    });
  });

  describe('Pagination and Filtering', () => {
    it('supports search query filter', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/complaints?search=billing')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalled();
    });

    it('supports riskLevel filter', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/complaints?riskLevel=critical')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalled();
    });

    it('supports category filter', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/complaints?category=billing_dispute')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalled();
    });

    it('supports assignedTo filter', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/complaints?assignedTo=user-123')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalled();
    });

    it('returns pagination metadata', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const complaints = Array.from({ length: 5 }, (_, i) =>
        createTestComplaint(TENANT_ID, { id: `cmp-${i}` }),
      );
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce(complaints as any);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(25);

      const response = await request(app)
        .get('/api/v1/complaints?page=1&pageSize=5')
        .expect(200);

      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.totalCount).toBe(25);
    });

    it('sorts by priorityScore desc by default', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/complaints?sortBy=priorityScore&sortOrder=desc')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalled();
    });
  });
});
