import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { securityHeaders } from '../../src/server/api/middleware/security-headers';

function createApp() {
  const app = express();
  app.use(securityHeaders);
  app.get('/api/test', (_req, res) => {
    res.json({ success: true });
  });
  app.get('/page', (_req, res) => {
    res.send('<html><body>Page</body></html>');
  });
  return app;
}

describe('Security Headers Middleware', () => {
  describe('HSTS', () => {
    it('sets Strict-Transport-Security header', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains; preload',
      );
    });

    it('sets max-age to 1 year (31536000 seconds)', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('max-age=31536000');
    });

    it('includes preload directive', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('preload');
    });
  });

  describe('Content-Security-Policy', () => {
    it('sets CSP header', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('restricts default-src to self', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
    });

    it('restricts script-src to self', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("script-src 'self'");
    });

    it('prevents framing with frame-ancestors none', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('restricts form-action to self', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("form-action 'self'");
    });
  });

  describe('X-Frame-Options', () => {
    it('sets X-Frame-Options to DENY', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('X-Content-Type-Options', () => {
    it('sets nosniff to prevent MIME sniffing', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Referrer-Policy', () => {
    it('sets strict-origin-when-cross-origin', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Permissions-Policy', () => {
    it('disables camera, microphone, geolocation, payment', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      const policy = response.headers['permissions-policy'];
      expect(policy).toContain('camera=()');
      expect(policy).toContain('microphone=()');
      expect(policy).toContain('geolocation=()');
      expect(policy).toContain('payment=()');
    });
  });

  describe('X-XSS-Protection', () => {
    it('enables XSS protection with mode=block', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Cache-Control for API routes', () => {
    it('sets no-store on API paths', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['pragma']).toBe('no-cache');
    });

    it('does not set no-store on non-API paths', async () => {
      const app = createApp();
      const response = await request(app).get('/page');
      // Non-API paths should not have the restrictive cache-control
      const cacheControl = response.headers['cache-control'];
      if (cacheControl) {
        expect(cacheControl).not.toContain('no-store');
      }
    });
  });

  describe('All headers present on single request', () => {
    it('includes all security headers in one response', async () => {
      const app = createApp();
      const response = await request(app).get('/api/test');

      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });
});
