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
  // Tenant resolution strategy:
  // - For authenticated routes, tenantId comes from JWT payload (set by authenticate middleware)
  // - The x-tenant-id header is IGNORED to prevent tenant spoofing attacks
  // - For public routes, tenant is resolved from the request body (tenantSlug)
  // - Subdomain-based resolution can be added for multi-tenant deployments

  // Do NOT set tenantId from headers - this prevents spoofing.
  // The authenticate middleware will set req.tenantId from the verified JWT.
  next();
}

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) {
    throw new AppError(400, 'TENANT_REQUIRED', 'Tenant identification is required');
  }
  next();
}
