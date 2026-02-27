import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authorize } from '../../src/server/api/middleware/auth';
import { createTestUser, createTestTenant } from '../factories';

describe('RBAC Authorization', () => {
  let app: express.Application;
  let mockTenant: any;

  beforeEach(() => {
    mockTenant = createTestTenant();
    app = express();
    app.use(express.json());

    // Protected admin endpoint
    app.get(
      '/api/protected/admin',
      authorize('admin'),
      (req, res) => {
        res.json({ success: true });
      },
    );

    // Protected supervisor endpoint
    app.patch(
      '/api/protected/update',
      authorize('supervisor', 'admin'),
      (req, res) => {
        res.json({ success: true });
      },
    );

    // Error handler
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.status || 403).json({ error: err.message });
    });
  });

  describe('Admin Role', () => {
    it('admin can access admin endpoints', async () => {
      const adminUser = createTestUser(mockTenant.id, { role: 'admin' });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = adminUser;
        req.userRole = adminUser.role;
        next();
      });

      app2.get(
        '/api/protected/admin',
        authorize('admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      const response = await request(app2)
        .get('/api/protected/admin')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('admin can access any role-gated endpoint', async () => {
      const adminUser = createTestUser(mockTenant.id, { role: 'admin' });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = adminUser;
        req.userRole = adminUser.role;
        next();
      });

      app2.patch(
        '/api/protected/update',
        authorize('supervisor'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      const response = await request(app2)
        .patch('/api/protected/update')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Supervisor Role', () => {
    it('supervisor can access supervisor-only endpoints', async () => {
      const supervisorUser = createTestUser(mockTenant.id, {
        role: 'supervisor',
      });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = supervisorUser;
        req.userRole = supervisorUser.role;
        next();
      });

      app2.patch(
        '/api/protected/update',
        authorize('supervisor', 'admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      const response = await request(app2)
        .patch('/api/protected/update')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('supervisor cannot access admin-only endpoints', async () => {
      const supervisorUser = createTestUser(mockTenant.id, {
        role: 'supervisor',
      });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = supervisorUser;
        req.userRole = supervisorUser.role;
        next();
      });

      app2.get(
        '/api/protected/admin',
        authorize('admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      app2.use((err: any, req: any, res: any, next: any) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app2)
        .get('/api/protected/admin')
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('Complaint Officer Role', () => {
    it('complaint officer can access basic endpoints', async () => {
      const officerUser = createTestUser(mockTenant.id, {
        role: 'complaint_officer',
      });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = officerUser;
        req.userRole = officerUser.role;
        next();
      });

      app2.get(
        '/api/protected/read',
        authorize('complaint_officer', 'supervisor', 'admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      const response = await request(app2)
        .get('/api/protected/read')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('complaint officer cannot escalate complaints', async () => {
      const officerUser = createTestUser(mockTenant.id, {
        role: 'complaint_officer',
      });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = officerUser;
        req.userRole = officerUser.role;
        next();
      });

      app2.post(
        '/api/protected/escalate',
        authorize('supervisor', 'admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      app2.use((err: any, req: any, res: any, next: any) => {
        res.status(403).json({ error: 'Insufficient permissions' });
      });

      const response = await request(app2)
        .post('/api/protected/escalate')
        .expect(403);

      expect(response.body.error).toBe('Insufficient permissions');
    });
  });

  describe('Executive Role', () => {
    it('executive can read dashboards but not modify', async () => {
      const executiveUser = createTestUser(mockTenant.id, {
        role: 'executive',
      });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = executiveUser;
        req.userRole = executiveUser.role;
        next();
      });

      // Read endpoint
      app2.get(
        '/api/dashboard/stats',
        authorize('executive', 'supervisor', 'admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      // Write endpoint
      app2.patch(
        '/api/complaint/update',
        authorize('supervisor', 'admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      app2.use((err: any, req: any, res: any, next: any) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      // Should have read access
      const readResponse = await request(app2)
        .get('/api/dashboard/stats')
        .expect(200);
      expect(readResponse.body.success).toBe(true);

      // Should not have write access
      const writeResponse = await request(app2)
        .patch('/api/complaint/update')
        .expect(403);
      expect(writeResponse.body.error).toBe('Forbidden');
    });
  });

  describe('Multi-level Authorization', () => {
    it('enforces authorization on multi-level routes', async () => {
      const officerUser = createTestUser(mockTenant.id, {
        role: 'complaint_officer',
      });

      const app2 = express();
      app2.use(express.json());
      app2.use((req: any, res, next) => {
        req.user = officerUser;
        req.userRole = officerUser.role;
        next();
      });

      app2.delete(
        '/api/evidence/:id',
        authorize('supervisor', 'admin'),
        (req, res) => {
          res.json({ success: true });
        },
      );

      app2.use((err: any, req: any, res: any, next: any) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      // Officer cannot delete evidence (supervisor+ only)
      const response = await request(app2)
        .delete('/api/evidence/test-id')
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
    });
  });
});
