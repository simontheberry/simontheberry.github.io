import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordHttpRequest,
  recordDbQuery,
  recordAiCall,
  recordAiError,
  recordEmbeddingReuse,
  getMetrics,
  resetMetrics,
} from '../../../src/server/services/metrics/metrics';

describe('Metrics Module', () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe('recordHttpRequest', () => {
    it('increments total request count', () => {
      recordHttpRequest('GET', '/api/v1/complaints', 200, 15);
      const metrics = getMetrics();
      expect(metrics.requests.total).toBe(1);
    });

    it('tracks 4xx errors', () => {
      recordHttpRequest('POST', '/api/v1/intake', 400, 5);
      recordHttpRequest('GET', '/api/v1/complaints', 401, 3);
      recordHttpRequest('GET', '/api/v1/complaints', 404, 4);
      const metrics = getMetrics();
      expect(metrics.requests.errors4xx).toBe(3);
      expect(metrics.requests.errors5xx).toBe(0);
    });

    it('tracks 5xx errors', () => {
      recordHttpRequest('GET', '/api/v1/dashboard', 500, 100);
      recordHttpRequest('GET', '/api/v1/triage', 503, 50);
      const metrics = getMetrics();
      expect(metrics.requests.errors5xx).toBe(2);
    });

    it('calculates error rate correctly', () => {
      recordHttpRequest('GET', '/api/v1/complaints', 200, 10);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 12);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 8);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 9);
      recordHttpRequest('GET', '/api/v1/complaints', 500, 100);
      const metrics = getMetrics();
      // 1 error out of 5 = 20%
      expect(metrics.requests.errorRate).toBe(20);
    });

    it('normalizes UUIDs in paths', () => {
      recordHttpRequest('GET', '/api/v1/complaints/a1b2c3d4-e5f6-7890-abcd-ef1234567890', 200, 10);
      recordHttpRequest('GET', '/api/v1/complaints/99999999-aaaa-bbbb-cccc-dddddddddddd', 200, 15);
      const metrics = getMetrics();
      expect(metrics.topRoutes).toHaveLength(1);
      expect(metrics.topRoutes[0].route).toBe('GET /api/v1/complaints/:id');
      expect(metrics.topRoutes[0].count).toBe(2);
    });

    it('normalizes numeric IDs in paths', () => {
      recordHttpRequest('GET', '/api/v1/items/123', 200, 10);
      recordHttpRequest('GET', '/api/v1/items/456', 200, 12);
      const metrics = getMetrics();
      expect(metrics.topRoutes).toHaveLength(1);
      expect(metrics.topRoutes[0].route).toBe('GET /api/v1/items/:n');
    });

    it('groups different methods separately', () => {
      recordHttpRequest('GET', '/api/v1/complaints', 200, 10);
      recordHttpRequest('POST', '/api/v1/complaints', 201, 50);
      const metrics = getMetrics();
      expect(metrics.topRoutes).toHaveLength(2);
    });

    it('tracks latency stats per route', () => {
      recordHttpRequest('GET', '/api/v1/settings', 200, 5);
      recordHttpRequest('GET', '/api/v1/settings', 200, 15);
      recordHttpRequest('GET', '/api/v1/settings', 200, 10);
      const metrics = getMetrics();
      const route = metrics.topRoutes.find(r => r.route === 'GET /api/v1/settings');
      expect(route).toBeDefined();
      expect(route!.count).toBe(3);
      expect(route!.avgMs).toBe(10);
      expect(route!.minMs).toBe(5);
      expect(route!.maxMs).toBe(15);
    });

    it('sorts topRoutes by count descending', () => {
      recordHttpRequest('GET', '/api/v1/settings', 200, 5);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 10);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 12);
      recordHttpRequest('GET', '/api/v1/complaints', 200, 8);
      const metrics = getMetrics();
      expect(metrics.topRoutes[0].route).toBe('GET /api/v1/complaints');
      expect(metrics.topRoutes[0].count).toBe(3);
      expect(metrics.topRoutes[1].route).toBe('GET /api/v1/settings');
    });

    it('limits topRoutes to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        recordHttpRequest('GET', `/api/v1/route${i}`, 200, 10);
      }
      const metrics = getMetrics();
      expect(metrics.topRoutes.length).toBeLessThanOrEqual(20);
    });
  });

  describe('recordDbQuery', () => {
    it('tracks database query latency', () => {
      recordDbQuery(5);
      recordDbQuery(15);
      recordDbQuery(10);
      const metrics = getMetrics();
      expect(metrics.database.count).toBe(3);
      expect(metrics.database.avgMs).toBe(10);
      expect(metrics.database.minMs).toBe(5);
      expect(metrics.database.maxMs).toBe(15);
    });

    it('returns zeroes when no queries recorded', () => {
      const metrics = getMetrics();
      expect(metrics.database.count).toBe(0);
      expect(metrics.database.avgMs).toBe(0);
      expect(metrics.database.minMs).toBe(0);
      expect(metrics.database.maxMs).toBe(0);
    });
  });

  describe('recordAiCall', () => {
    it('tracks AI call latency', () => {
      recordAiCall(1200);
      recordAiCall(800);
      const metrics = getMetrics();
      expect(metrics.ai.count).toBe(2);
      expect(metrics.ai.avgMs).toBe(1000);
      expect(metrics.ai.calls).toBe(2);
    });

    it('tracks token usage when provided', () => {
      recordAiCall(1000, { prompt: 100, completion: 50, total: 150 });
      recordAiCall(1200, { prompt: 200, completion: 80, total: 280 });
      const metrics = getMetrics();
      expect(metrics.ai.tokens.prompt).toBe(300);
      expect(metrics.ai.tokens.completion).toBe(130);
      expect(metrics.ai.tokens.total).toBe(430);
    });

    it('handles calls without token data', () => {
      recordAiCall(1000);
      const metrics = getMetrics();
      expect(metrics.ai.tokens.prompt).toBe(0);
      expect(metrics.ai.tokens.completion).toBe(0);
      expect(metrics.ai.tokens.total).toBe(0);
    });
  });

  describe('recordAiError', () => {
    it('increments AI error count', () => {
      recordAiError();
      recordAiError();
      const metrics = getMetrics();
      expect(metrics.ai.errors).toBe(2);
    });
  });

  describe('recordEmbeddingReuse', () => {
    it('increments embedding reuse count', () => {
      recordEmbeddingReuse();
      recordEmbeddingReuse();
      recordEmbeddingReuse();
      const metrics = getMetrics();
      expect(metrics.ai.embeddingReuses).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('includes uptime information', () => {
      const metrics = getMetrics();
      expect(metrics.uptime.seconds).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime.formatted).toBeDefined();
      expect(typeof metrics.uptime.formatted).toBe('string');
    });

    it('returns zero error rate when no requests', () => {
      const metrics = getMetrics();
      expect(metrics.requests.errorRate).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('resets all counters to zero', () => {
      recordHttpRequest('GET', '/test', 200, 10);
      recordHttpRequest('GET', '/test', 500, 100);
      recordDbQuery(5);
      recordAiCall(1000, { prompt: 100, completion: 50, total: 150 });
      recordAiError();
      recordEmbeddingReuse();

      resetMetrics();
      const metrics = getMetrics();

      expect(metrics.requests.total).toBe(0);
      expect(metrics.requests.errors4xx).toBe(0);
      expect(metrics.requests.errors5xx).toBe(0);
      expect(metrics.database.count).toBe(0);
      expect(metrics.ai.count).toBe(0);
      expect(metrics.ai.calls).toBe(0);
      expect(metrics.ai.errors).toBe(0);
      expect(metrics.ai.embeddingReuses).toBe(0);
      expect(metrics.ai.tokens.total).toBe(0);
      expect(metrics.topRoutes).toHaveLength(0);
    });

    it('resets uptime timer', () => {
      const before = getMetrics().uptime.seconds;
      resetMetrics();
      const after = getMetrics().uptime.seconds;
      expect(after).toBeLessThanOrEqual(before);
    });
  });
});
