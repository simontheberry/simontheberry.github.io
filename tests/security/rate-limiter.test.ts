import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { rateLimit, tenantRateLimit, userRateLimit, tieredRateLimit } from '../../src/server/api/middleware/rate-limiter';

let testCounter = 0;

function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

// Generate a unique key prefix per test to avoid shared state pollution
function uniqueKey(prefix: string) {
  return `${prefix}-${Date.now()}-${++testCounter}`;
}

describe('Rate Limiter', () => {
  describe('rateLimit (IP-based)', () => {
    it('allows requests under the limit', async () => {
      const key = uniqueKey('allow');
      const app = createApp();
      app.get('/test', rateLimit({ windowMs: 60000, maxRequests: 5, keyGenerator: () => key }), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(200);
      expect(response.body.success).toBe(true);
    });

    it('sets rate limit headers', async () => {
      const key = uniqueKey('headers');
      const app = createApp();
      app.get('/test', rateLimit({ windowMs: 60000, maxRequests: 10, keyGenerator: () => key }), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('blocks requests exceeding the limit', async () => {
      const key = uniqueKey('block');
      const app = createApp();
      app.get('/test', rateLimit({ windowMs: 60000, maxRequests: 2, keyGenerator: () => key }), (_req, res) => {
        res.json({ success: true });
      });
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      // First two should pass
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      // Third should be blocked
      const blocked = await request(app).get('/test').expect(429);
      expect(blocked.body.error).toContain('Too many requests');
    });

    it('uses custom error message', async () => {
      const key = uniqueKey('custom');
      const app = createApp();
      app.get('/test', rateLimit({ windowMs: 60000, maxRequests: 1, message: 'Custom limit', keyGenerator: () => key }), (_req, res) => {
        res.json({ success: true });
      });
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      await request(app).get('/test').expect(200);
      const blocked = await request(app).get('/test').expect(429);
      expect(blocked.body.error).toBe('Custom limit');
    });
  });

  describe('tenantRateLimit', () => {
    it('rate limits based on tenant ID', async () => {
      const tenantId = uniqueKey('tenant');
      const app = createApp();
      app.use((req: any, _res: any, next: any) => {
        req.tenantId = tenantId;
        next();
      });
      app.get('/test', tenantRateLimit({ windowMs: 60000, maxRequests: 2 }), (_req, res) => {
        res.json({ success: true });
      });
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      const blocked = await request(app).get('/test').expect(429);
      expect(blocked.body.error).toContain('Tenant rate limit');
    });

    it('tracks tenants independently', async () => {
      const tenantA = uniqueKey('tenant-a');
      const tenantB = uniqueKey('tenant-b');
      const app = createApp();
      let currentTenant = tenantA;
      app.use((req: any, _res: any, next: any) => {
        req.tenantId = currentTenant;
        next();
      });
      app.get('/test', tenantRateLimit({ windowMs: 60000, maxRequests: 1 }), (_req, res) => {
        res.json({ success: true });
      });
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      // Tenant A: first request passes
      await request(app).get('/test').expect(200);

      // Tenant A: second request blocked
      await request(app).get('/test').expect(429);

      // Tenant B: first request should pass (different tenant)
      currentTenant = tenantB;
      await request(app).get('/test').expect(200);
    });
  });

  describe('userRateLimit', () => {
    it('rate limits based on user ID', async () => {
      const userId = uniqueKey('user');
      const app = createApp();
      app.use((req: any, _res: any, next: any) => {
        req.userId = userId;
        next();
      });
      app.get('/test', userRateLimit({ windowMs: 60000, maxRequests: 2 }), (_req, res) => {
        res.json({ success: true });
      });
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });

      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);
      const blocked = await request(app).get('/test').expect(429);
      expect(blocked.body.error).toContain('User rate limit');
    });
  });

  describe('tieredRateLimit', () => {
    function createTieredApp(role: string) {
      const userId = uniqueKey(`tiered-${role}`);
      const app = createApp();
      app.use((req: any, _res: any, next: any) => {
        req.userRole = role;
        req.userId = userId;
        next();
      });
      app.get('/test', tieredRateLimit({ windowMs: 60000 }), (_req, res) => {
        res.json({ success: true });
      });
      app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({ error: err.message });
      });
      return app;
    }

    it('sets higher limit for admin role', async () => {
      const app = createTieredApp('admin');
      const response = await request(app).get('/test').expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('500');
    });

    it('sets medium limit for complaint_officer role', async () => {
      const app = createTieredApp('complaint_officer');
      const response = await request(app).get('/test').expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('100');
    });

    it('sets high limit for system role', async () => {
      const app = createTieredApp('system');
      const response = await request(app).get('/test').expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('10000');
    });

    it('sets low limit for anonymous/unknown role', async () => {
      const app = createApp();
      app.get('/test', tieredRateLimit({ windowMs: 60000 }), (_req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test').expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('30');
    });

    it('sets supervisor limit correctly', async () => {
      const app = createTieredApp('supervisor');
      const response = await request(app).get('/test').expect(200);
      expect(response.headers['x-ratelimit-limit']).toBe('300');
    });
  });
});
