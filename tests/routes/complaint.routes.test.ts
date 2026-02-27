import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

// Mock all dependencies before importing routes
vi.mock('../../src/server/db/client', () => ({
  prisma: {
    complaint: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    complaintEvent: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
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

describe('Complaint Routes', () => {
  let app: express.Application;
  let mockTenant: any;
  let mockComplaint: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTenant = createTestTenant();
    mockComplaint = createTestComplaint(mockTenant.id, { assignedToId: 'test-user-id' });

    app = express();
    app.use(express.json());

    // Inject auth/tenant context
    app.use((req: any, _res: any, next: any) => {
      req.tenantId = mockTenant.id;
      req.userId = 'test-user-id';
      req.userRole = 'complaint_officer';
      next();
    });

    // Dynamic import to get the named export after mocks are set up
    const { complaintRoutes } = await import('../../src/server/api/routes/complaint.routes');
    app.use('/api/v1/complaints', complaintRoutes);
    app.use(errorHandler);
  });

  describe('GET /:id', () => {
    it('returns complaint by ID with tenant isolation', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(mockComplaint);

      const response = await request(app)
        .get(`/api/v1/complaints/${mockComplaint.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(mockComplaint.id);
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/complaints/non-existent-id')
        .expect(404);
    });
  });

  describe('GET / (List)', () => {
    it('paginates complaints for tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([mockComplaint]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(1);

      const response = await request(app)
        .get('/api/v1/complaints')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('enforces tenant isolation in listings', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app).get('/api/v1/complaints').expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenant.id,
          }),
        }),
      );
    });

    it('filters by status when query param provided', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.complaint.count).mockResolvedValueOnce(0);

      await request(app)
        .get('/api/v1/complaints?status=triaged')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalled();
    });
  });

  describe('PATCH /:id (Update)', () => {
    it('updates complaint status', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const assignedComplaint = { ...mockComplaint, assignedToId: 'test-user-id' };
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(assignedComplaint);
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({
        ...assignedComplaint,
        status: 'triaging',
      });
      vi.mocked(prisma.complaintEvent.create).mockResolvedValueOnce({
        id: 'evt-1',
        complaintId: mockComplaint.id,
        eventType: 'status_change',
        description: 'Status changed from submitted to triaging',
        metadata: { fromStatus: 'submitted', toStatus: 'triaging' },
        createdBy: 'test-user-id',
        createdAt: new Date(),
      } as any);

      const response = await request(app)
        .patch(`/api/v1/complaints/${mockComplaint.id}`)
        .send({ status: 'triaging' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('returns 404 when updating non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .patch('/api/v1/complaints/non-existent-id')
        .send({ status: 'triaging' })
        .expect(404);
    });
  });
});
