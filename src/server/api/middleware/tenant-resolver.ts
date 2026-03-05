// ============================================================================
// Multi-Tenant Resolver Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
      userRole?: string;
    }
  }
}

export function tenantResolver(req: Request, _res: Response, next: NextFunction) {
  // Tenant can be resolved from:
  // 1. x-tenant-id header (API key auth)
  // 2. JWT token payload (user auth)
  // 3. Subdomain (e.g., accc.complaints.gov.au)

  const tenantId = req.headers['x-tenant-id'] as string;

  if (tenantId) {
    req.tenantId = tenantId;
  }

  // Public routes (complaint submission) may not require tenant ID
  // It will be resolved from the portal URL or submission context
  next();
}

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) {
    throw new AppError(400, 'TENANT_REQUIRED', 'Tenant identification is required');
  }
  next();
}
