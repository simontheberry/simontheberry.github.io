// ============================================================================
// Business Routes – ABN Lookup & Business Management
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { AppError } from '../middleware/error-handler';
import { AbnLookupService } from '../../services/enrichment/abn-lookup';

export const businessRoutes = Router();

// All business routes require authentication
businessRoutes.use(authenticate);
businessRoutes.use(requireTenant);

const abnSearchSchema = z.object({
  name: z.string().min(2).optional(),
  abn: z.string().optional(),
}).refine(data => data.name || data.abn, {
  message: 'Either name or abn must be provided',
});

// GET /api/v1/businesses/search -- Search ABR for business details
businessRoutes.get('/search', async (req: Request, res: Response) => {
  const query = abnSearchSchema.parse(req.query);
  const abnService = new AbnLookupService();

  try {
    let result;
    if (query.abn) {
      result = await abnService.lookupByAbn(query.abn);
    } else if (query.name) {
      result = await abnService.searchByName(query.name);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch {
    res.json({
      success: false,
      error: { code: 'ABN_LOOKUP_FAILED', message: 'Failed to fetch business details from ABR' },
    });
  }
});

// GET /api/v1/businesses/:id -- Get business with complaint history
businessRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;

  const business = await prisma.business.findFirst({
    where: { id, tenantId },
    include: {
      complaints: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          category: true,
          riskLevel: true,
          priorityScore: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!business) {
    throw new AppError(404, 'NOT_FOUND', 'Business not found');
  }

  res.json({
    success: true,
    data: business,
  });
});

// GET /api/v1/businesses/:id/complaints -- Get complaints for a business
businessRoutes.get('/:id/complaints', async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = req.tenantId!;

  // Verify business belongs to tenant
  const business = await prisma.business.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!business) {
    throw new AppError(404, 'NOT_FOUND', 'Business not found');
  }

  const complaints = await prisma.complaint.findMany({
    where: { businessId: id, tenantId },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      category: true,
      riskLevel: true,
      priorityScore: true,
      summary: true,
      createdAt: true,
      submittedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({
    success: true,
    data: complaints,
  });
});
