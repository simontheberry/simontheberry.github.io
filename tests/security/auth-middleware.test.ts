import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const TEST_JWT_SECRET = 'test-secret-key-min-32-characters-long';

vi.mock('../../src/server/config', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-min-32-characters-long',
  },
}));

import { authenticate, authorize } from '../../src/server/api/middleware/auth';
import jwt from 'jsonwebtoken';

function createToken(payload: Record<string, unknown>, secret?: string) {
  return jwt.sign(payload, secret || TEST_JWT_SECRET, { expiresIn: '1h' });
}

function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

describe('authenticate middleware', () => {
  it('rejects requests without Authorization header', async () => {
    const app = createApp();
    app.get('/test', authenticate, (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app).get('/test').expect(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('rejects requests with non-Bearer token format', async () => {
    const app = createApp();
    app.get('/test', authenticate, (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app)
      .get('/test')
      .set('Authorization', 'Basic abc123')
      .expect(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });

  it('rejects expired tokens', async () => {
    const app = createApp();
    app.get('/test', authenticate, (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const expiredToken = jwt.sign(
      { userId: '123', tenantId: 't-1', role: 'admin', email: 'a@b.com' },
      TEST_JWT_SECRET,
      { expiresIn: '0s' },
    );

    // Small delay to ensure token is expired
    await new Promise((r) => setTimeout(r, 50));

    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
    expect(response.body.error).toBe('INVALID_TOKEN');
  });

  it('rejects tokens signed with wrong secret', async () => {
    const app = createApp();
    app.get('/test', authenticate, (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const badToken = createToken(
      { userId: '123', tenantId: 't-1', role: 'admin', email: 'a@b.com' },
      'wrong-secret-key-that-is-long-enough',
    );

    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${badToken}`)
      .expect(401);
    expect(response.body.error).toBe('INVALID_TOKEN');
  });

  it('accepts valid tokens and sets request properties', async () => {
    const app = createApp();
    app.get('/test', authenticate, (req: any, res) => {
      res.json({
        success: true,
        userId: req.userId,
        tenantId: req.tenantId,
        userRole: req.userRole,
      });
    });
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const token = createToken({
      userId: 'user-123',
      tenantId: 'tenant-456',
      role: 'complaint_officer',
      email: 'officer@gov.au',
    });

    const response = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.userId).toBe('user-123');
    expect(response.body.tenantId).toBe('tenant-456');
    expect(response.body.userRole).toBe('complaint_officer');
  });

  it('rejects malformed JWT tokens', async () => {
    const app = createApp();
    app.get('/test', authenticate, (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer not.a.valid.jwt.token')
      .expect(401);
    expect(response.body.error).toBe('INVALID_TOKEN');
  });

  it('rejects empty Bearer token', async () => {
    const app = createApp();
    app.get('/test', authenticate, (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer ')
      .expect(401);
    expect(response.body.error).toBe('UNAUTHORIZED');
  });
});

describe('authorize middleware', () => {
  function createAppWithRole(role: string) {
    const app = createApp();
    app.use((req: any, _res: any, next: any) => {
      req.userRole = role;
      next();
    });
    return app;
  }

  it('allows access when role matches', async () => {
    const app = createAppWithRole('admin');
    app.get('/test', authorize('admin'), (_req, res) => res.json({ success: true }));

    const response = await request(app).get('/test').expect(200);
    expect(response.body.success).toBe(true);
  });

  it('allows access when role is in list', async () => {
    const app = createAppWithRole('supervisor');
    app.get('/test', authorize('supervisor', 'admin'), (_req, res) => res.json({ success: true }));

    const response = await request(app).get('/test').expect(200);
    expect(response.body.success).toBe(true);
  });

  it('denies access when role is not in list', async () => {
    const app = createAppWithRole('complaint_officer');
    app.get('/test', authorize('admin'), (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app).get('/test').expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  it('denies access when no role is set', async () => {
    const app = createApp();
    app.get('/test', authorize('admin'), (_req, res) => res.json({ success: true }));
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app).get('/test').expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });

  it('executive cannot access write endpoints', async () => {
    const app = createAppWithRole('executive');
    app.post('/test', authorize('complaint_officer', 'supervisor', 'admin'), (_req, res) => {
      res.json({ success: true });
    });
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode || 500).json({ error: err.code });
    });

    const response = await request(app).post('/test').expect(403);
    expect(response.body.error).toBe('FORBIDDEN');
  });
});
