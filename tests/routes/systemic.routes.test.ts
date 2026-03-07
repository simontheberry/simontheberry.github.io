import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

vi.mock('../../src/server/db/client', () => ({
  prisma: {
    systemicCluster: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    complaint: {
      groupBy: vi.fn(),
    },
    business: {
      findMany: vi.fn(),
    },
    aiOutput: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
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

import { createTestTenant } from '../factories';

describe('Systemic Routes', () => {
  let app: express.Application;
  let mockTenant: any;
  const TENANT_ID = 'tenant-123';
  const USER_ID = 'user-456';

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

    const { systemicRoutes } = await import('../../src/server/api/routes/systemic.routes');
    app.use('/api/v1/systemic', systemicRoutes);
    app.use(errorHandler);
  });

  describe('GET /clusters', () => {
    it('returns active clusters for tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([
        {
          id: 'sc-1',
          tenantId: TENANT_ID,
          title: 'Misleading rates',
          description: 'Multiple complaints about misleading comparison rates',
          industry: 'Financial Services',
          category: 'misleading_conduct',
          riskLevel: 'critical',
          complaintCount: 14,
          avgSimilarity: 0.91,
          commonPatterns: ['Hidden fees'],
          isActive: true,
          isAcknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          detectionMethod: 'embedding_cosine_similarity',
          detectedAt: new Date('2025-01-14'),
          updatedAt: new Date(),
          complaints: [
            { id: 'c-1', businessId: 'b-1', business: { id: 'b-1', name: 'Finance Corp' } },
            { id: 'c-2', businessId: 'b-1', business: { id: 'b-1', name: 'Finance Corp' } },
            { id: 'c-3', businessId: 'b-2', business: { id: 'b-2', name: 'Loan Co' } },
          ],
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/clusters')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Misleading rates');
      expect(response.body.data[0].affectedBusinesses).toContain('Finance Corp');
      expect(response.body.data[0].affectedBusinesses).toContain('Loan Co');
      expect(response.body.data[0].complaintCount).toBe(14);
    });

    it('returns empty array when no clusters exist', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/systemic/clusters')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('deduplicates affected businesses', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([
        {
          id: 'sc-1',
          tenantId: TENANT_ID,
          title: 'Test cluster',
          description: null,
          industry: null,
          category: null,
          riskLevel: 'medium',
          complaintCount: 3,
          avgSimilarity: 0.88,
          commonPatterns: [],
          isActive: true,
          isAcknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          detectionMethod: null,
          detectedAt: new Date(),
          updatedAt: new Date(),
          complaints: [
            { id: 'c-1', businessId: 'b-1', business: { id: 'b-1', name: 'Same Corp' } },
            { id: 'c-2', businessId: 'b-1', business: { id: 'b-1', name: 'Same Corp' } },
            { id: 'c-3', businessId: 'b-1', business: { id: 'b-1', name: 'Same Corp' } },
          ],
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/clusters')
        .expect(200);

      expect(response.body.data[0].affectedBusinesses).toHaveLength(1);
      expect(response.body.data[0].affectedBusinesses[0]).toBe('Same Corp');
    });

    it('handles complaints without businesses', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([
        {
          id: 'sc-1',
          tenantId: TENANT_ID,
          title: 'Test cluster',
          description: null,
          industry: null,
          category: null,
          riskLevel: 'low',
          complaintCount: 2,
          avgSimilarity: 0.86,
          commonPatterns: null,
          isActive: true,
          isAcknowledged: false,
          acknowledgedBy: null,
          acknowledgedAt: null,
          detectionMethod: null,
          detectedAt: new Date(),
          updatedAt: new Date(),
          complaints: [
            { id: 'c-1', businessId: null, business: null },
          ],
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/clusters')
        .expect(200);

      expect(response.body.data[0].affectedBusinesses).toEqual([]);
      expect(response.body.data[0].commonPatterns).toEqual([]);
    });
  });

  describe('GET /clusters/:id', () => {
    it('returns cluster detail with complaints and businesses', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findFirst).mockResolvedValueOnce({
        id: 'sc-1',
        tenantId: TENANT_ID,
        title: 'Misleading rates',
        description: 'Test description',
        industry: 'Financial Services',
        category: 'misleading_conduct',
        riskLevel: 'critical',
        complaintCount: 3,
        avgSimilarity: 0.91,
        commonPatterns: ['Pattern A', 'Pattern B'],
        isActive: true,
        isAcknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        detectedAt: new Date('2025-01-14'),
        updatedAt: new Date(),
        complaints: [
          { id: 'c-1', referenceNumber: 'CMP-001', summary: 'Complaint one', riskLevel: 'high', businessId: 'b-1', business: { id: 'b-1', name: 'Corp A' } },
          { id: 'c-2', referenceNumber: 'CMP-002', summary: null, riskLevel: null, businessId: 'b-1', business: { id: 'b-1', name: 'Corp A' } },
          { id: 'c-3', referenceNumber: 'CMP-003', summary: 'Complaint three', riskLevel: 'medium', businessId: 'b-2', business: { id: 'b-2', name: 'Corp B' } },
        ],
      } as any);

      vi.mocked(prisma.aiOutput.findFirst).mockResolvedValueOnce({
        confidence: 0.91,
        reasoning: 'Strong cluster pattern detected',
        parsedOutput: { recommendedAction: 'formal_investigation', estimatedConsumerHarm: '$2.4M' },
      } as any);

      const response = await request(app)
        .get('/api/v1/systemic/clusters/sc-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      const data = response.body.data;
      expect(data.id).toBe('sc-1');
      expect(data.title).toBe('Misleading rates');
      expect(data.complaints).toHaveLength(3);
      expect(data.complaints[1].summary).toBe('No summary available');
      expect(data.complaints[1].riskLevel).toBe('low');
      expect(data.affectedBusinesses).toHaveLength(2);
      expect(data.affectedBusinesses[0].complaintCount).toBe(2);
      expect(data.aiAnalysis.confidence).toBe(0.91);
      expect(data.aiAnalysis.recommendedAction).toBe('formal_investigation');
    });

    it('returns 404 for non-existent cluster', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/systemic/clusters/non-existent')
        .expect(404);
    });

    it('returns null aiAnalysis when no AI output exists', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findFirst).mockResolvedValueOnce({
        id: 'sc-2',
        tenantId: TENANT_ID,
        title: 'Basic cluster',
        description: null,
        industry: null,
        category: null,
        riskLevel: 'medium',
        complaintCount: 3,
        avgSimilarity: 0.86,
        commonPatterns: [],
        isActive: true,
        isAcknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        detectedAt: new Date(),
        updatedAt: new Date(),
        complaints: [],
      } as any);

      vi.mocked(prisma.aiOutput.findFirst).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/systemic/clusters/sc-2')
        .expect(200);

      expect(response.body.data.aiAnalysis).toBeNull();
    });
  });

  describe('POST /clusters/:id/acknowledge', () => {
    it('acknowledges a cluster and creates audit log', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findFirst).mockResolvedValueOnce({
        id: 'sc-1',
        tenantId: TENANT_ID,
        isAcknowledged: false,
      } as any);
      vi.mocked(prisma.systemicCluster.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/api/v1/systemic/clusters/sc-1/acknowledge')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clusterId).toBe('sc-1');
      expect(response.body.data.acknowledgedBy).toBe(USER_ID);
      expect(response.body.data.acknowledgedAt).toBeDefined();

      expect(vi.mocked(prisma.systemicCluster.update)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sc-1' },
          data: expect.objectContaining({
            isAcknowledged: true,
            acknowledgedBy: USER_ID,
          }),
        }),
      );

      expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            userId: USER_ID,
            action: 'acknowledge',
            entity: 'systemic_cluster',
            entityId: 'sc-1',
          }),
        }),
      );
    });

    it('returns 404 for non-existent cluster', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .post('/api/v1/systemic/clusters/non-existent/acknowledge')
        .expect(404);
    });
  });

  describe('GET /alerts', () => {
    it('returns unacknowledged active alerts', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([
        {
          id: 'sc-1',
          title: 'Alert one',
          riskLevel: 'critical',
          complaintCount: 14,
          detectedAt: new Date('2025-01-14'),
        },
        {
          id: 'sc-3',
          title: 'Alert two',
          riskLevel: 'high',
          complaintCount: 8,
          detectedAt: new Date('2025-01-12'),
        },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/alerts')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].clusterId).toBe('sc-1');
      expect(response.body.data[0].title).toBe('Alert one');
      expect(response.body.data[0].riskLevel).toBe('critical');
    });

    it('returns empty array when no alerts', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/systemic/alerts')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('filters by unacknowledged and active', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([]);

      await request(app).get('/api/v1/systemic/alerts').expect(200);

      expect(vi.mocked(prisma.systemicCluster.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            isActive: true,
            isAcknowledged: false,
          }),
        }),
      );
    });
  });

  describe('GET /heatmap', () => {
    it('returns industry-category heatmap data', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.groupBy).mockResolvedValueOnce([
        { industry: 'Financial Services', category: 'misleading_conduct', _count: { id: 18 } },
        { industry: 'Financial Services', category: 'scam_fraud', _count: { id: 8 } },
        { industry: 'Energy', category: 'billing_dispute', _count: { id: 16 } },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/heatmap')
        .expect(200);

      expect(response.body.success).toBe(true);
      const industries = response.body.data.industries;
      expect(industries).toHaveLength(2);

      const financial = industries.find((i: any) => i.industry === 'Financial Services');
      expect(financial.categories.misleading_conduct).toBe(18);
      expect(financial.categories.scam_fraud).toBe(8);

      const energy = industries.find((i: any) => i.industry === 'Energy');
      expect(energy.categories.billing_dispute).toBe(16);
    });

    it('returns empty industries when no data', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.groupBy).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/systemic/heatmap')
        .expect(200);

      expect(response.body.data.industries).toEqual([]);
    });

    it('skips rows with null industry or category', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.groupBy).mockResolvedValueOnce([
        { industry: null, category: 'billing_dispute', _count: { id: 5 } },
        { industry: 'Energy', category: null, _count: { id: 3 } },
        { industry: 'Energy', category: 'billing_dispute', _count: { id: 10 } },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/heatmap')
        .expect(200);

      expect(response.body.data.industries).toHaveLength(1);
      expect(response.body.data.industries[0].industry).toBe('Energy');
    });
  });

  describe('GET /repeat-offenders', () => {
    it('returns businesses sorted by complaint count', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.business.findMany).mockResolvedValueOnce([
        {
          id: 'b-1',
          name: 'Bad Corp',
          abn: '12345678901',
          industry: 'Financial Services',
          complaintCount: 18,
          avgRiskScore: 0.82,
          complaints: [{ systemicClusterId: 'sc-1' }, { systemicClusterId: 'sc-2' }],
          _count: { complaints: 18 },
        },
        {
          id: 'b-2',
          name: 'Also Bad Ltd',
          abn: '98765432109',
          industry: 'Energy',
          complaintCount: 11,
          avgRiskScore: 0.58,
          complaints: [{ systemicClusterId: 'sc-3' }],
          _count: { complaints: 11 },
        },
      ] as any);

      vi.mocked(prisma.complaint.groupBy).mockResolvedValueOnce([
        { businessId: 'b-1', _max: { createdAt: new Date('2025-01-15') } },
        { businessId: 'b-2', _max: { createdAt: new Date('2025-01-10') } },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/repeat-offenders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('Bad Corp');
      expect(response.body.data[0].systemicClusters).toBe(2);
      expect(response.body.data[0].latestComplaint).toBeDefined();
      expect(response.body.data[1].name).toBe('Also Bad Ltd');
    });

    it('returns empty array when no businesses', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.business.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/systemic/repeat-offenders')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('handles limit query param', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.business.findMany).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/systemic/repeat-offenders?limit=5')
        .expect(200);

      expect(vi.mocked(prisma.business.findMany)).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('handles null latest complaint date', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.business.findMany).mockResolvedValueOnce([
        {
          id: 'b-1',
          name: 'Corp',
          abn: null,
          industry: null,
          complaintCount: 1,
          avgRiskScore: null,
          complaints: [],
          _count: { complaints: 1 },
        },
      ] as any);

      vi.mocked(prisma.complaint.groupBy).mockResolvedValueOnce([
        { businessId: 'b-1', _max: { createdAt: null } },
      ] as any);

      const response = await request(app)
        .get('/api/v1/systemic/repeat-offenders')
        .expect(200);

      expect(response.body.data[0].latestComplaint).toBeNull();
    });
  });
});
