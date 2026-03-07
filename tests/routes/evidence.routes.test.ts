import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

vi.mock('../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../src/server/api/middleware/auth', () => ({
  authenticate: (_req: any, _res: any, next: any) => next(),
  authorize: (..._roles: any[]) => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../src/server/api/middleware/tenant-resolver', () => ({
  requireTenant: (_req: any, _res: any, next: any) => next(),
}));

describe('Evidence Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use((req: any, _res: any, next: any) => {
      req.tenantId = 'tenant-1';
      req.userId = 'user-1';
      req.userRole = 'complaint_officer';
      next();
    });

    const { evidenceRoutes } = await import('../../src/server/api/routes/evidence.routes');
    app.use('/api/v1/evidence', evidenceRoutes);
    app.use(errorHandler);
  });

  describe('POST /upload', () => {
    it('returns stub upload response', async () => {
      const response = await request(app)
        .post('/api/v1/evidence/upload')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.uploadedAt).toBeDefined();
    });

    it('includes file stub ID with timestamp', async () => {
      const response = await request(app)
        .post('/api/v1/evidence/upload')
        .expect(200);

      expect(response.body.data.id).toMatch(/^file-stub-/);
    });
  });

  describe('GET /:fileId/download', () => {
    it('returns 501 not implemented', async () => {
      const response = await request(app)
        .get('/api/v1/evidence/file-123/download')
        .expect(501);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /:fileId', () => {
    it('returns deleted file ID', async () => {
      const response = await request(app)
        .delete('/api/v1/evidence/file-456')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deletedId).toBe('file-456');
    });

    it('echoes back the fileId param', async () => {
      const response = await request(app)
        .delete('/api/v1/evidence/custom-file-id')
        .expect(200);

      expect(response.body.data.deletedId).toBe('custom-file-id');
    });
  });
});
