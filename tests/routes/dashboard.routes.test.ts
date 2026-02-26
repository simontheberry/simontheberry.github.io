import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth
vi.mock('../../src/server/api/middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _res: any, next: any) => {
    _req.userId = 'test-user-id';
    _req.tenantId = 'test-tenant-id';
    _req.userRole = 'admin';
    next();
  }),
  authorize: vi.fn((..._roles: string[]) => (_req: any, _res: any, next: any) => next()),
}));

// Mock tenant-resolver
vi.mock('../../src/server/api/middleware/tenant-resolver', () => ({
  requireTenant: vi.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock Prisma
vi.mock('../../src/server/db/client', () => ({
  prisma: {
    complaint: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    systemicCluster: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    business: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ total: BigInt(10), within_sla: BigInt(8) }]),
    $use: vi.fn(),
  },
}));

// Mock cache
vi.mock('../../src/server/services/cache/redis-cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  CACHE_KEYS: {
    tenantSettings: (id: string) => `tenant:${id}:settings`,
    dashboardStats: (id: string) => `tenant:${id}:dashboard:stats`,
  },
  CACHE_TTL: { TENANT_SETTINGS: 300, DASHBOARD_STATS: 30 },
}));

describe('Dashboard Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-set default mock return values after clearAllMocks
    const { prisma } = await import('../../src/server/db/client');
    vi.mocked(prisma.complaint.count).mockResolvedValue(0);
    vi.mocked(prisma.complaint.findMany).mockResolvedValue([]);
    vi.mocked(prisma.systemicCluster.count).mockResolvedValue(0);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ total: BigInt(0), within_sla: BigInt(0) }]);

    const { dashboardRoutes } = await import('../../src/server/api/routes/dashboard.routes');
    app = express();
    app.use(express.json());
    app.use('/api/v1/dashboard', dashboardRoutes);
  });

  describe('GET /api/v1/dashboard/stats', () => {
    it('returns cached stats when available', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      const cachedStats = { totalComplaints: 50, openComplaints: 10 };
      vi.mocked(cacheGet).mockResolvedValueOnce(cachedStats);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(cachedStats);

      // Should NOT query database
      const { prisma } = await import('../../src/server/db/client');
      expect(prisma.complaint.count).not.toHaveBeenCalled();
    });

    it('queries database on cache miss', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      const { prisma } = await import('../../src/server/db/client');
      expect(prisma.complaint.count).toHaveBeenCalled();
    });

    it('writes stats to cache after database query', async () => {
      const { cacheGet, cacheSet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      expect(cacheSet).toHaveBeenCalledWith(
        'tenant:test-tenant-id:dashboard:stats',
        expect.any(Object),
        30, // CACHE_TTL.DASHBOARD_STATS
      );
    });

    it('returns all expected stat fields', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      const data = response.body.data;
      expect(data).toHaveProperty('totalComplaints');
      expect(data).toHaveProperty('openComplaints');
      expect(data).toHaveProperty('criticalComplaints');
      expect(data).toHaveProperty('complaintsToday');
      expect(data).toHaveProperty('pendingTriage');
      expect(data).toHaveProperty('systemicAlerts');
      expect(data).toHaveProperty('slaBreaches');
      expect(data).toHaveProperty('slaApproaching');
      expect(data).toHaveProperty('slaComplianceRate');
      expect(data).toHaveProperty('avgResolutionDays');
    });

    it('computes SLA compliance rate from raw query', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { total: BigInt(100), within_sla: BigInt(80) },
      ]);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      expect(response.body.data.slaComplianceRate).toBe(80);
    });

    it('returns null SLA rate when no resolved complaints', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        { total: BigInt(0), within_sla: BigInt(0) },
      ]);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      expect(response.body.data.slaComplianceRate).toBeNull();
    });

    it('computes average resolution days', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([
        { submittedAt: threeDaysAgo, resolvedAt: now } as any,
      ]);

      const response = await request(app)
        .get('/api/v1/dashboard/stats')
        .expect(200);

      expect(response.body.data.avgResolutionDays).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/dashboard/officer', () => {
    it('returns officer queue and stats', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);
      // 4 count calls for: assigned, inProgress, awaitingResponse, resolvedThisWeek
      vi.mocked(prisma.complaint.count)
        .mockResolvedValueOnce(3)  // assigned
        .mockResolvedValueOnce(2)  // inProgress
        .mockResolvedValueOnce(1)  // awaitingResponse
        .mockResolvedValueOnce(5); // resolvedThisWeek

      const response = await request(app)
        .get('/api/v1/dashboard/officer')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.queue).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.assigned).toBe(3);
      expect(response.body.data.stats.resolvedThisWeek).toBe(5);
    });

    it('filters by current user ID', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);

      await request(app)
        .get('/api/v1/dashboard/officer')
        .expect(200);

      expect(prisma.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'test-tenant-id',
            assignedToId: 'test-user-id',
          }),
        }),
      );
    });
  });

  describe('GET /api/v1/dashboard/supervisor', () => {
    it('returns team workload and bottlenecks', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        {
          id: 'officer-1',
          firstName: 'Jane',
          lastName: 'Doe',
          assignedComplaints: [
            { id: 'c1', status: 'in_progress', priorityScore: 0.8, riskLevel: 'high' },
            { id: 'c2', status: 'assigned', priorityScore: 0.5, riskLevel: 'medium' },
          ],
        } as any,
      ]);
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]); // bottlenecks
      vi.mocked(prisma.systemicCluster.findMany).mockResolvedValueOnce([]); // alerts

      const response = await request(app)
        .get('/api/v1/dashboard/supervisor')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.teamWorkload).toHaveLength(1);
      expect(response.body.data.teamWorkload[0].name).toBe('Jane Doe');
      expect(response.body.data.teamWorkload[0].totalOpen).toBe(2);
      expect(response.body.data.teamWorkload[0].high).toBe(1);
      expect(response.body.data.bottlenecks).toBeDefined();
      expect(response.body.data.systemicAlerts).toBeDefined();
    });
  });

  describe('GET /api/v1/dashboard/executive', () => {
    it('returns industry risk map and enforcement candidates', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.groupBy).mockResolvedValueOnce([
        { industry: 'financial_services', _count: { id: 15 } } as any,
        { industry: 'telecommunications', _count: { id: 8 } } as any,
      ]);
      vi.mocked(prisma.business.findMany)
        .mockResolvedValueOnce([]) // repeat offenders
        .mockResolvedValueOnce([]); // enforcement candidates

      const response = await request(app)
        .get('/api/v1/dashboard/executive')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.industryRiskMap).toHaveLength(2);
      expect(response.body.data.industryRiskMap[0].industry).toBe('financial_services');
      expect(response.body.data.industryRiskMap[0].complaintCount).toBe(15);
      expect(response.body.data.repeatOffenderIndex).toBeDefined();
      expect(response.body.data.enforcementCandidates).toBeDefined();
    });
  });

  describe('GET /api/v1/dashboard/trends', () => {
    it('returns trends for default 30d period', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/dashboard/trends')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('30d');
      expect(response.body.data.series).toBeDefined();
      expect(Array.isArray(response.body.data.series)).toBe(true);
    });

    it('accepts 7d period parameter', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/dashboard/trends?period=7d')
        .expect(200);

      expect(response.body.data.period).toBe('7d');
    });

    it('groups complaints by date with risk level counts', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const today = new Date();
      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce([
        { createdAt: today, riskLevel: 'critical', category: 'scam_fraud' } as any,
        { createdAt: today, riskLevel: 'high', category: 'product_safety' } as any,
        { createdAt: today, riskLevel: 'low', category: 'other' } as any,
      ]);

      const response = await request(app)
        .get('/api/v1/dashboard/trends')
        .expect(200);

      expect(response.body.data.series).toHaveLength(1);
      const dayData = response.body.data.series[0];
      expect(dayData.total).toBe(3);
      expect(dayData.critical).toBe(1);
      expect(dayData.high).toBe(1);
      expect(dayData.low).toBe(1);
    });
  });
});
