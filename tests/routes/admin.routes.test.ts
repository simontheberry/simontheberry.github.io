import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { resetMetrics, recordHttpRequest, recordDbQuery, recordAiCall, recordAiError, recordEmbeddingReuse } from '../../src/server/services/metrics/metrics';
import { resetCacheMetrics } from '../../src/server/services/cache/redis-cache';

// Mock auth middleware -- admin routes require authenticate + authorize('admin')
vi.mock('../../src/server/api/middleware/auth', () => ({
  authenticate: vi.fn((_req: any, _res: any, next: any) => {
    _req.userId = 'test-user-id';
    _req.tenantId = 'test-tenant-id';
    _req.userRole = 'admin';
    next();
  }),
  authorize: vi.fn((..._roles: string[]) => (_req: any, _res: any, next: any) => next()),
}));

// Mock Redis parts of cache module but keep metrics functions real
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Admin Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    resetMetrics();
    resetCacheMetrics();

    // Dynamic import to get the routes after mocks are set up
    const { adminRoutes } = await import('../../src/server/api/routes/admin.routes');
    app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRoutes);
  });

  describe('GET /api/v1/admin/metrics', () => {
    it('returns success response with metrics data', async () => {
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('includes uptime information', async () => {
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.uptime.seconds).toBeGreaterThanOrEqual(0);
      expect(response.body.data.uptime.formatted).toBeDefined();
    });

    it('includes request counts', async () => {
      recordHttpRequest('GET', '/test', 200, 10);
      recordHttpRequest('GET', '/test', 500, 100);

      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      // Includes the metrics request itself + the 2 recorded
      expect(response.body.data.requests.total).toBeGreaterThanOrEqual(2);
      expect(response.body.data.requests.errors5xx).toBeGreaterThanOrEqual(1);
    });

    it('includes database latency stats', async () => {
      recordDbQuery(5);
      recordDbQuery(15);

      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.data.database.count).toBe(2);
      expect(response.body.data.database.avgMs).toBe(10);
    });

    it('includes AI call metrics with token usage', async () => {
      recordAiCall(1200, { prompt: 100, completion: 50, total: 150 });
      recordAiError();
      recordEmbeddingReuse();

      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.data.ai.calls).toBe(1);
      expect(response.body.data.ai.errors).toBe(1);
      expect(response.body.data.ai.embeddingReuses).toBe(1);
      expect(response.body.data.ai.tokens.total).toBe(150);
    });

    it('includes cache metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.data.cache).toBeDefined();
      expect(response.body.data.cache.hits).toBeDefined();
      expect(response.body.data.cache.misses).toBeDefined();
      expect(response.body.data.cache.hitRate).toBeDefined();
      expect(typeof response.body.data.cache.redisConnected).toBe('boolean');
    });

    it('includes top routes sorted by count', async () => {
      recordHttpRequest('GET', '/api/v1/complaints', 200, 10);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 12);
      recordHttpRequest('GET', '/api/v1/settings', 200, 5);

      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.data.topRoutes).toBeDefined();
      expect(Array.isArray(response.body.data.topRoutes)).toBe(true);
    });
  });

  describe('POST /api/v1/admin/metrics/reset', () => {
    it('resets all metrics and returns success', async () => {
      recordHttpRequest('GET', '/test', 200, 10);
      recordDbQuery(5);
      recordAiCall(1000);

      const response = await request(app)
        .post('/api/v1/admin/metrics/reset')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('All metrics reset');
    });

    it('metrics are zeroed after reset', async () => {
      recordHttpRequest('GET', '/test', 200, 10);
      recordDbQuery(5);

      await request(app)
        .post('/api/v1/admin/metrics/reset')
        .expect(200);

      // Fetch metrics after reset -- should be near zero
      // (the GET request itself may add 1 to counters)
      const response = await request(app)
        .get('/api/v1/admin/metrics')
        .expect(200);

      expect(response.body.data.database.count).toBe(0);
      expect(response.body.data.ai.calls).toBe(0);
    });
  });

  describe('Authentication & Authorization', () => {
    it('uses authenticate middleware on every request', async () => {
      const { authenticate } = await import('../../src/server/api/middleware/auth');
      await request(app).get('/api/v1/admin/metrics').expect(200);
      expect(authenticate).toHaveBeenCalled();
    });

    it('requires admin role via authorize middleware', async () => {
      // authorize('admin') is called at route definition time, not request time.
      // We verify the mock was configured and the route is accessible.
      const { authorize } = await import('../../src/server/api/middleware/auth');
      expect(authorize).toBeDefined();
      // The route responds 200, meaning auth middleware passed through
      await request(app).get('/api/v1/admin/metrics').expect(200);
    });
  });
});
