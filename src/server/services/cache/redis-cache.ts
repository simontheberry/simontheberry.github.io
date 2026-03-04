// ============================================================================
// Redis Cache Service -- Application-level caching with TTL
// ============================================================================

import IORedis from 'ioredis';
import { config } from '../../config';
import { createLogger } from '../../utils/logger';

const logger = createLogger('redis-cache');

let redis: any = null;
let isConnected = false;

function getRedis(): IORedis | null {
  if (redis) return redis;

  try {
    redis = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 3000,
    });

    redis.on('connect', () => {
      isConnected = true;
      logger.info('Redis cache connected');
    });

    redis.on('error', (err: any) => {
      isConnected = false;
      logger.warn('Redis cache connection error', { error: err.message });
    });

    redis.on('close', () => {
      isConnected = false;
    });

    redis.connect().catch(() => {
      // Swallow -- cache is optional
    });

    return redis;
  } catch {
    logger.warn('Redis cache initialization failed, caching disabled');
    return null;
  }
}

const PREFIX = 'cache:';

// ---- Metrics ----

const cacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
  deletes: 0,
  hitsByKey: new Map<string, number>(),
  missesByKey: new Map<string, number>(),
};

function keyCategory(key: string): string {
  if (key.includes(':settings')) return 'settings';
  if (key.includes(':dashboard:')) return 'dashboard';
  return 'other';
}

export function getCacheMetrics() {
  const total = cacheMetrics.hits + cacheMetrics.misses;
  return {
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    errors: cacheMetrics.errors,
    sets: cacheMetrics.sets,
    deletes: cacheMetrics.deletes,
    hitRate: total > 0 ? Math.round((cacheMetrics.hits / total) * 1000) / 10 : 0,
    redisConnected: isConnected,
    hitsByCategory: Object.fromEntries(cacheMetrics.hitsByKey),
    missesByCategory: Object.fromEntries(cacheMetrics.missesByKey),
  };
}

export function resetCacheMetrics(): void {
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.errors = 0;
  cacheMetrics.sets = 0;
  cacheMetrics.deletes = 0;
  cacheMetrics.hitsByKey.clear();
  cacheMetrics.missesByKey.clear();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client || !isConnected) {
    cacheMetrics.misses++;
    return null;
  }

  try {
    const value = await client.get(`${PREFIX}${key}`);
    const cat = keyCategory(key);
    if (value === null) {
      cacheMetrics.misses++;
      cacheMetrics.missesByKey.set(cat, (cacheMetrics.missesByKey.get(cat) || 0) + 1);
      return null;
    }
    cacheMetrics.hits++;
    cacheMetrics.hitsByKey.set(cat, (cacheMetrics.hitsByKey.get(cat) || 0) + 1);
    return JSON.parse(value) as T;
  } catch {
    cacheMetrics.errors++;
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client || !isConnected) return;

  try {
    await client.set(`${PREFIX}${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    cacheMetrics.sets++;
  } catch {
    cacheMetrics.errors++;
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (!client || !isConnected) return;

  try {
    await client.del(`${PREFIX}${key}`);
    cacheMetrics.deletes++;
  } catch {
    cacheMetrics.errors++;
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client || !isConnected) return;

  try {
    const keys = await client.keys(`${PREFIX}${pattern}`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Cache delete failure is non-critical
  }
}

// ---- Cache Key Helpers ----

export const CACHE_KEYS = {
  tenantSettings: (tenantId: string) => `tenant:${tenantId}:settings`,
  dashboardStats: (tenantId: string) => `tenant:${tenantId}:dashboard:stats`,
} as const;

export const CACHE_TTL = {
  TENANT_SETTINGS: 5 * 60, // 5 minutes
  DASHBOARD_STATS: 30, // 30 seconds
} as const;
