// ============================================================================
// Admin Routes – System metrics and operational data
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/auth';
import { getMetrics, resetMetrics } from '../../services/metrics/metrics';
import { getCacheMetrics, resetCacheMetrics } from '../../services/cache/redis-cache';

export const adminRoutes = Router();

// All admin routes require authentication + admin role
adminRoutes.use(authenticate);
adminRoutes.use(authorize('admin'));

// GET /api/v1/admin/metrics — Combined application + cache metrics
adminRoutes.get('/metrics', (_req: Request, res: Response) => {
  const appMetrics = getMetrics();
  const cache = getCacheMetrics();

  res.json({
    success: true,
    data: {
      ...appMetrics,
      cache,
    },
  });
});

// POST /api/v1/admin/metrics/reset — Reset all metric counters
adminRoutes.post('/metrics/reset', (_req: Request, res: Response) => {
  resetMetrics();
  resetCacheMetrics();

  res.json({
    success: true,
    data: { message: 'All metrics reset' },
  });
});
