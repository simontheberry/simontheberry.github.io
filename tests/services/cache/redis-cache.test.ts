import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCacheMetrics,
  resetCacheMetrics,
} from '../../../src/server/services/cache/redis-cache';

// Note: cacheGet/cacheSet/cacheDel require a live Redis connection.
// These tests focus on the metrics tracking layer which is in-memory
// and doesn't require Redis. Integration tests with Redis would go
// in tests/integration/.

describe('Cache Metrics', () => {
  beforeEach(() => {
    resetCacheMetrics();
  });

  describe('getCacheMetrics', () => {
    it('returns initial metrics with all zeroes', () => {
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.sets).toBe(0);
      expect(metrics.deletes).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });

    it('returns redisConnected status', () => {
      const metrics = getCacheMetrics();
      expect(typeof metrics.redisConnected).toBe('boolean');
    });

    it('returns category breakdowns as objects', () => {
      const metrics = getCacheMetrics();
      expect(metrics.hitsByCategory).toBeDefined();
      expect(metrics.missesByCategory).toBeDefined();
      expect(typeof metrics.hitsByCategory).toBe('object');
      expect(typeof metrics.missesByCategory).toBe('object');
    });
  });

  describe('resetCacheMetrics', () => {
    it('resets all counters to zero', () => {
      // Manually verify reset clears everything
      resetCacheMetrics();
      const metrics = getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.sets).toBe(0);
      expect(metrics.deletes).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });

    it('clears category breakdowns', () => {
      resetCacheMetrics();
      const metrics = getCacheMetrics();
      expect(Object.keys(metrics.hitsByCategory)).toHaveLength(0);
      expect(Object.keys(metrics.missesByCategory)).toHaveLength(0);
    });
  });

  describe('hitRate calculation', () => {
    it('returns 0 when no requests', () => {
      const metrics = getCacheMetrics();
      expect(metrics.hitRate).toBe(0);
    });
  });
});
