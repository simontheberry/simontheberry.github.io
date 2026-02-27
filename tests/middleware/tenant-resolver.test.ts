import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { tenantResolver, requireTenant } from '../../src/server/api/middleware/tenant-resolver';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

vi.mock('../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Tenant Resolver', () => {
  describe('tenantResolver', () => {
    it('calls next without setting tenantId from header (prevents spoofing)', async () => {
      const app = express();
      app.use(tenantResolver);
      app.get('/test', (req, res) => {
        res.json({ tenantId: req.tenantId || null });
      });

      const res = await request(app)
        .get('/test')
        .set('x-tenant-id', 'spoofed-tenant')
        .expect(200);

      // tenantId should NOT be set from header - only from JWT
      expect(res.body.tenantId).toBeNull();
    });

    it('passes through without error when no tenant header present', async () => {
      const app = express();
      app.use(tenantResolver);
      app.get('/test', (_req, res) => {
        res.json({ success: true });
      });

      await request(app).get('/test').expect(200);
    });
  });

  describe('requireTenant', () => {
    it('passes when tenantId is set on request', async () => {
      const app = express();
      app.use((req: any, _res, next) => {
        req.tenantId = 'valid-tenant-id';
        next();
      });
      app.get('/test', requireTenant, (_req, res) => {
        res.json({ success: true });
      });
      app.use(errorHandler);

      await request(app).get('/test').expect(200);
    });

    it('throws 400 when tenantId is missing', async () => {
      const app = express();
      app.get('/test', requireTenant, (_req, res) => {
        res.json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get('/test').expect(400);
      expect(res.body.error.code).toBe('TENANT_REQUIRED');
      expect(res.body.error.message).toContain('Tenant identification');
    });

    it('throws 400 when tenantId is empty string', async () => {
      const app = express();
      app.use((req: any, _res, next) => {
        req.tenantId = '';
        next();
      });
      app.get('/test', requireTenant, (_req, res) => {
        res.json({ success: true });
      });
      app.use(errorHandler);

      const res = await request(app).get('/test').expect(400);
      expect(res.body.error.code).toBe('TENANT_REQUIRED');
    });
  });
});
