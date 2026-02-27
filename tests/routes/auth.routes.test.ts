import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'express-async-errors';
import request from 'supertest';
import express from 'express';
import { createHash } from 'crypto';
import { errorHandler } from '../../src/server/api/middleware/error-handler';

const TEST_JWT_SECRET = 'test-secret-for-auth-routes';

vi.mock('../../src/server/db/client', () => ({
  prisma: {
    tenant: { findUnique: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn() },
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
    JWT_SECRET: 'test-secret-for-auth-routes',
    JWT_EXPIRES_IN: '8h',
  },
}));

vi.mock('../../src/server/api/middleware/rate-limiter', () => ({
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
}));

import { createTestTenant, createTestUser } from '../factories';

describe('Auth Routes', () => {
  let app: express.Application;
  let mockTenant: ReturnType<typeof createTestTenant>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockTenant = createTestTenant({ slug: 'test-regulator' });

    app = express();
    app.use(express.json());

    const { authRoutes } = await import('../../src/server/api/routes/auth.routes');
    app.use('/api/v1/auth', authRoutes);
    app.use(errorHandler);
  });

  describe('POST /login', () => {
    it('returns JWT token for valid credentials', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const password = 'SecurePassword123!';
      const passwordHash = createHash('sha256').update(password).digest('hex');
      const mockUser = createTestUser(mockTenant.id, {
        email: 'officer@gov.au',
        passwordHash,
        role: 'complaint_officer',
      });

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockUser as any);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(mockUser as any);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer@gov.au',
          password,
          tenantSlug: 'test-regulator',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('officer@gov.au');
      expect(response.body.data.user.role).toBe('complaint_officer');
    });

    it('returns 401 for invalid tenant', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer@gov.au',
          password: 'test123',
          tenantSlug: 'nonexistent',
        })
        .expect(401);

      expect(response.body.error.message).toContain('Invalid email or password');
    });

    it('returns 401 for non-existent user', async () => {
      const { prisma } = await import('../../src/server/db/client');
      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'unknown@gov.au',
          password: 'test123',
          tenantSlug: 'test-regulator',
        })
        .expect(401);
    });

    it('returns 401 for wrong password', async () => {
      const { prisma } = await import('../../src/server/db/client');
      const correctHash = createHash('sha256').update('correct-password').digest('hex');
      const mockUser = createTestUser(mockTenant.id, {
        email: 'officer@gov.au',
        passwordHash: correctHash,
      });

      vi.mocked(prisma.tenant.findUnique).mockResolvedValueOnce(mockTenant as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(mockUser as any);

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'officer@gov.au',
          password: 'wrong-password',
          tenantSlug: 'test-regulator',
        })
        .expect(401);
    });

    it('rejects missing email', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'test', tenantSlug: 'test' })
        .expect(400);
    });

    it('rejects missing password', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@gov.au', tenantSlug: 'test' })
        .expect(400);
    });

    it('rejects missing tenant slug', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@gov.au', password: 'test' })
        .expect(400);
    });

    it('rejects invalid email format', async () => {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'test', tenantSlug: 'test' })
        .expect(400);
    });
  });

  describe('POST /refresh', () => {
    it('returns 401 without authorization header', async () => {
      await request(app)
        .post('/api/v1/auth/refresh')
        .expect(401);
    });

    it('returns 401 with invalid token', async () => {
      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  describe('GET /me', () => {
    it('returns 401 without token', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('returns 401 with invalid token', async () => {
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);
    });
  });
});
