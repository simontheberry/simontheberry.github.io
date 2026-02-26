import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware
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
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $use: vi.fn(),
  },
}));

// Mock audit log
vi.mock('../../src/server/db/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock cache
vi.mock('../../src/server/services/cache/redis-cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
  cacheDel: vi.fn().mockResolvedValue(undefined),
  CACHE_KEYS: {
    tenantSettings: (tenantId: string) => `tenant:${tenantId}:settings`,
    dashboardStats: (tenantId: string) => `tenant:${tenantId}:dashboard:stats`,
  },
  CACHE_TTL: {
    TENANT_SETTINGS: 300,
    DASHBOARD_STATS: 30,
  },
}));

// Mock logger
vi.mock('../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Settings Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { settingsRoutes } = await import('../../src/server/api/routes/settings.routes');
    app = express();
    app.use(express.json());
    app.use('/api/v1/settings', settingsRoutes);
    // Error handler to catch Zod validation errors
    app.use((err: any, _req: any, res: any, _next: any) => {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
        return;
      }
      res.status(500).json({ success: false, error: { message: err.message } });
    });
  });

  describe('GET /api/v1/settings', () => {
    it('returns cached settings when available', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      const cachedSettings = { autoSendEnabled: true, priorityWeights: { riskScore: 0.5 } };
      vi.mocked(cacheGet).mockResolvedValueOnce(cachedSettings);

      const response = await request(app)
        .get('/api/v1/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(cachedSettings);
      // Should NOT have queried the database
      const { prisma } = await import('../../src/server/db/client');
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to database on cache miss', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        settings: { autoSendEnabled: true },
      } as any);

      const response = await request(app)
        .get('/api/v1/settings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-tenant-id' },
        select: { settings: true },
      });
    });

    it('writes to cache after database read', async () => {
      const { cacheGet, cacheSet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        settings: {},
      } as any);

      await request(app)
        .get('/api/v1/settings')
        .expect(200);

      expect(cacheSet).toHaveBeenCalledWith(
        'tenant:test-tenant-id:settings',
        expect.any(Object),
        300,
      );
    });

    it('merges defaults with stored settings', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        settings: { autoSendEnabled: true },
      } as any);

      const response = await request(app)
        .get('/api/v1/settings')
        .expect(200);

      // Should have default priority weights even though stored settings only had autoSendEnabled
      expect(response.body.data.priorityWeights).toBeDefined();
      expect(response.body.data.priorityWeights.riskScore).toBe(0.3);
      expect(response.body.data.autoSendEnabled).toBe(true);
    });

    it('returns full defaults when tenant has no settings', async () => {
      const { cacheGet } = await import('../../src/server/services/cache/redis-cache');
      vi.mocked(cacheGet).mockResolvedValueOnce(null);

      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        settings: null,
      } as any);

      const response = await request(app)
        .get('/api/v1/settings')
        .expect(200);

      expect(response.body.data.autoSendEnabled).toBe(false);
      expect(response.body.data.autoSendConfidenceThreshold).toBe(0.85);
      expect(response.body.data.slaDefaults.line1ResponseHours).toBe(48);
    });
  });

  describe('PATCH /api/v1/settings', () => {
    it('updates settings and returns merged result', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        settings: {},
      } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/settings')
        .send({ autoSendEnabled: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.autoSendEnabled).toBe(true);
    });

    it('invalidates cache after update', async () => {
      const { cacheDel } = await import('../../src/server/services/cache/redis-cache');
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ settings: {} } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      await request(app)
        .patch('/api/v1/settings')
        .send({ autoSendEnabled: true })
        .expect(200);

      expect(cacheDel).toHaveBeenCalledWith('tenant:test-tenant-id:settings');
    });

    it('writes audit log on update', async () => {
      const { writeAuditLog } = await import('../../src/server/db/audit');
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ settings: {} } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      await request(app)
        .patch('/api/v1/settings')
        .send({ autoSendEnabled: true })
        .expect(200);

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'test-tenant-id',
          action: 'settings.updated',
          entity: 'TenantSettings',
        }),
      );
    });

    it('rejects priority weights that do not sum to 1.0', async () => {
      const response = await request(app)
        .patch('/api/v1/settings')
        .send({
          priorityWeights: {
            riskScore: 0.5,
            systemicImpact: 0.5,
            monetaryHarm: 0.5,
            vulnerabilityIndicator: 0.5,
            resolutionProbability: 0.5,
          },
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_WEIGHTS');
    });

    it('accepts priority weights that sum to 1.0', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ settings: {} } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/settings')
        .send({
          priorityWeights: {
            riskScore: 0.30,
            systemicImpact: 0.25,
            monetaryHarm: 0.15,
            vulnerabilityIndicator: 0.20,
            resolutionProbability: 0.10,
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('rejects invalid threshold ordering', async () => {
      const response = await request(app)
        .patch('/api/v1/settings')
        .send({
          autoSendConfidenceThreshold: 0.80,
          supervisorReviewThreshold: 0.90,
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_THRESHOLDS');
    });

    it('accepts valid confidence threshold within range', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ settings: {} } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .patch('/api/v1/settings')
        .send({ autoSendConfidenceThreshold: 0.9 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.autoSendConfidenceThreshold).toBe(0.9);
    });
  });

  describe('POST /api/v1/settings/reset', () => {
    it('resets to default settings', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({
        settings: { autoSendEnabled: true },
      } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/api/v1/settings/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.autoSendEnabled).toBe(false);
      expect(response.body.data.priorityWeights.riskScore).toBe(0.3);
    });

    it('invalidates cache after reset', async () => {
      const { cacheDel } = await import('../../src/server/services/cache/redis-cache');
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ settings: {} } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      await request(app)
        .post('/api/v1/settings/reset')
        .expect(200);

      expect(cacheDel).toHaveBeenCalledWith('tenant:test-tenant-id:settings');
    });

    it('writes audit log on reset', async () => {
      const { writeAuditLog } = await import('../../src/server/db/audit');
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce({ settings: {} } as any);
      vi.mocked(prisma.tenant.update).mockResolvedValueOnce({} as any);

      await request(app)
        .post('/api/v1/settings/reset')
        .expect(200);

      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'settings.reset',
          entity: 'TenantSettings',
        }),
      );
    });
  });
});
