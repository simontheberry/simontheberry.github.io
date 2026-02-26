// ============================================================================
// Rate Limiter Middleware
// Enhanced with per-tenant, per-user, and tiered rate limiting.
// In-memory sliding window. For production at scale, replace with Redis.
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('rate-limiter');

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

function checkLimit(key: string, windowMs: number, maxRequests: number): { entry: RateLimitEntry; exceeded: boolean } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
  } else {
    entry.count++;
  }

  return { entry, exceeded: entry.count > maxRequests };
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, message, keyGenerator } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.socket.remoteAddress || 'unknown';

    const { entry, exceeded } = checkLimit(key, windowMs, maxRequests);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (exceeded) {
      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        limit: maxRequests,
        path: req.path,
      });
      throw new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        message || 'Too many requests. Please try again later.',
      );
    }

    next();
  };
}

// Per-tenant rate limiter: prevents a single tenant from monopolizing resources
export function tenantRateLimit(options: Omit<RateLimitOptions, 'keyGenerator'>) {
  return rateLimit({
    ...options,
    keyGenerator: (req: Request) => `tenant:${req.tenantId || 'anonymous'}`,
    message: options.message || 'Tenant rate limit exceeded. Please try again later.',
  });
}

// Per-user rate limiter: prevents individual user abuse
export function userRateLimit(options: Omit<RateLimitOptions, 'keyGenerator'>) {
  return rateLimit({
    ...options,
    keyGenerator: (req: Request) => `user:${req.userId || req.ip || 'anonymous'}`,
    message: options.message || 'User rate limit exceeded. Please try again later.',
  });
}

// Role-based tiered limits
const ROLE_LIMITS: Record<string, number> = {
  admin: 500,
  supervisor: 300,
  complaint_officer: 100,
  executive: 100,
  system: 10000,
};

export function tieredRateLimit(options: { windowMs: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.userRole || 'anonymous';
    const maxRequests = ROLE_LIMITS[role] || 30;
    const key = `tiered:${req.userId || req.ip || 'anonymous'}`;

    const { entry, exceeded } = checkLimit(key, options.windowMs, maxRequests);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (exceeded) {
      logger.warn('Tiered rate limit exceeded', {
        userId: req.userId,
        role,
        count: entry.count,
        limit: maxRequests,
        path: req.path,
      });
      throw new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        options.message || 'Too many requests. Please try again later.',
      );
    }

    next();
  };
}
