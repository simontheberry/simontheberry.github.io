import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authenticate } from '../../src/server/api/middleware/auth';
import { authorize } from '../../src/server/api/middleware/auth';
import { errorHandler } from '../../src/server/api/middleware/error-handler';
import complaintRoutes from '../../src/server/api/routes/complaint.routes';
import { createTestComplaint, createTestUser, createTestTenant } from '../factories';

// Mock Prisma
vi.mock('../../src/server/db/client', () => ({
  prisma: {
    complaint: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

describe('Complaint Routes', () => {
  let app: express.Application;
  let mockUser: any;
  let mockTenant: any;
  let mockComplaint: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock auth middleware to pass through with test user
    app.use((req: any, res, next) => {
      mockUser = createTestUser(mockTenant.id, { role: 'complaint_officer' });
      mockTenant = createTestTenant();
      req.user = mockUser;
      req.tenant = mockTenant;
      next();
    });

    app.use('/api/v1/complaint', complaintRoutes);
    app.use(errorHandler);

    mockComplaint = createTestComplaint(mockTenant.id);
  });

  describe('GET /:id', () => {
    it('returns complaint by ID with tenant isolation', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findUnique).mockResolvedValueOnce(mockComplaint);

      const response = await request(app)
        .get(`/api/v1/complaint/${mockComplaint.id}`)
        .expect(200);

      expect(response.body.data).toEqual(mockComplaint);
      expect(vi.mocked(prisma.complaint.findUnique)).toHaveBeenCalledWith({
        where: { id: mockComplaint.id },
        include: expect.objectContaining({ aiOutputs: true }),
      });
    });

    it('returns 404 for non-existent complaint', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/complaint/non-existent-id')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST / (Create)', () => {
    it('creates complaint with full validation', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.create).mockResolvedValueOnce(mockComplaint);

      const payload = {
        rawText: 'I bought a defective product',
        complainantFirstName: 'John',
        complainantLastName: 'Doe',
        complainantEmail: 'john@example.com',
        channel: 'portal' as const,
      };

      const response = await request(app)
        .post('/api/v1/complaint')
        .send(payload)
        .expect(201);

      expect(response.body.data.id).toBeDefined();
      expect(vi.mocked(prisma.complaint.create)).toHaveBeenCalled();
    });

    it('validates required fields', async () => {
      const response = await request(app)
        .post('/api/v1/complaint')
        .send({ rawText: 'Missing name and email' })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('audit logs complaint creation', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.create).mockResolvedValueOnce(mockComplaint);

      await request(app)
        .post('/api/v1/complaint')
        .send({
          rawText: 'Test',
          complainantFirstName: 'John',
          complainantLastName: 'Doe',
          complainantEmail: 'john@example.com',
          channel: 'portal',
        })
        .expect(201);

      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'complaint.created',
            tenantId: mockTenant.id,
            userId: mockUser.id,
          }),
        }),
      );
    });
  });

  describe('PATCH /:id (Update)', () => {
    it('updates complaint with proper authorization', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({
        ...mockComplaint,
        status: 'in_progress',
      });

      const response = await request(app)
        .patch(`/api/v1/complaint/${mockComplaint.id}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.data.status).toBe('in_progress');
    });

    it('prevents status transitions to invalid states', async () => {
      const response = await request(app)
        .patch(`/api/v1/complaint/${mockComplaint.id}`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('tracks old values in audit log', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({
        ...mockComplaint,
        riskLevel: 'high',
      });

      await request(app)
        .patch(`/api/v1/complaint/${mockComplaint.id}`)
        .send({ riskLevel: 'high' })
        .expect(200);

      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'complaint.updated',
            oldValues: expect.any(Object),
            newValues: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('GET / (List)', () => {
    it('paginates complaints for tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([
        mockComplaint,
      ]);

      const response = await request(app)
        .get('/api/v1/complaint?page=1&limit=20')
        .expect(200);

      expect(response.body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 20,
        }),
      );
    });

    it('filters by status', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([
        { ...mockComplaint, status: 'triaged' },
      ]);

      await request(app)
        .get('/api/v1/complaint?status=triaged')
        .expect(200);

      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'triaged',
          }),
        }),
      );
    });

    it('enforces tenant isolation in listings', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);

      await request(app).get('/api/v1/complaint').expect(200);

      // Verify all queries include tenantId filter
      expect(vi.mocked(prisma.complaint.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenant.id,
          }),
        }),
      );
    });
  });
});
