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

export function tenantResolver(_req: Request, _res: Response, next: NextFunction) {
  // SECURITY: Tenant ID is ONLY set from trusted sources:
  // - JWT payload (via authenticate middleware) for authenticated routes
  // - Database lookup by slug (via route handlers) for public routes
  //
  // The x-tenant-id header is NOT trusted because it can be spoofed by
  // any client. Allowing header-based tenant resolution would enable
  // cross-tenant data access attacks.
  next();
}

export function requireTenant(req: Request, _res: Response, next: NextFunction) {
  if (!req.tenantId) {
    throw new AppError(400, 'TENANT_REQUIRED', 'Tenant identification is required');
  }
  next();
}
