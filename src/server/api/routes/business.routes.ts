// ============================================================================
// Business Routes – ABN Lookup & Business Management
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AbnLookupService } from '../../services/enrichment/abn-lookup';

export const businessRoutes = Router();

const abnSearchSchema = z.object({
  name: z.string().min(2).optional(),
  abn: z.string().optional(),
}).refine(data => data.name || data.abn, {
  message: 'Either name or abn must be provided',
});

// GET /api/v1/businesses/search – Search ABR for business details
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
  } catch (error) {
    res.json({
      success: false,
      error: { code: 'ABN_LOOKUP_FAILED', message: 'Failed to fetch business details from ABR' },
    });
  }
});

// GET /api/v1/businesses/:id – Get business with complaint history
businessRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch business with complaint stats
  res.json({
    success: true,
    data: null,
  });
});

// GET /api/v1/businesses/:id/complaints – Get complaints for a business
businessRoutes.get('/:id/complaints', async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch complaints related to this business
  res.json({
    success: true,
    data: [],
  });
});
