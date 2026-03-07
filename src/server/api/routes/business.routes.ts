// ============================================================================
// Business Routes – ABR lookup and business management
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { searchAbr, isValidAbr } from '../../services/business/abr-service';
import { createLogger } from '../../utils/logger';
import { AppError } from '../middleware/error-handler';

const logger = createLogger('business-routes');

export const businessRoutes = Router();

// ---- Validation Schemas ----

const searchQuerySchema = z.object({
  name: z.string().min(2).max(100),
});

// ---- Routes ----

/**
 * GET /api/v1/businesses/search – Search for businesses by name or ABN
 * Public endpoint (no authentication required)
 */
businessRoutes.get('/search', async (req: Request, res: Response) => {
  try {
    // Normalize query params (can be string or string[] from Express)
    const normalizedQuery = Object.fromEntries(
      Object.entries(req.query).map(([key, val]) => [
        key,
        Array.isArray(val) ? val[0] : val,
      ])
    );

    const { name } = searchQuerySchema.parse(normalizedQuery);

    logger.info('Business search requested', { query: name });

    // Call ABR service
    const results = await searchAbr(name);

    // Transform results for frontend
    const transformedResults = results.results.map((business) => ({
      abn: business.abn,
      name: business.entityName,
      entityType: business.entityType,
      status: business.entityStatus,
      state: business.state,
      postcode: business.postcode,
      isValid: isValidAbr(business.abn),
    }));

    res.json({
      success: true,
      data: {
        results: transformedResults,
        totalResults: transformedResults.length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid search query');
    }

    logger.error('Business search error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Return empty results on error (graceful degradation)
    res.json({
      success: true,
      data: {
        results: [],
        totalResults: 0,
      },
    });
  }
});

/**
 * GET /api/v1/businesses/:abn – Get business details by ABN
 * Public endpoint (no authentication required)
 */
businessRoutes.get('/:abn', async (req: Request, res: Response) => {
  try {
    const { abn } = req.params;

    // Validate ABN format
    if (!isValidAbr(abn)) {
      throw new AppError(400, 'INVALID_ABN', 'Invalid ABN format (must be 11 digits)');
    }

    logger.info('Business lookup by ABN', { abn });

    // Search by ABN
    const results = await searchAbr(abn);

    if (results.results.length === 0) {
      throw new AppError(404, 'NOT_FOUND', `Business with ABN ${abn} not found`);
    }

    const business = results.results[0];

    res.json({
      success: true,
      data: {
        abn: business.abn,
        name: business.entityName,
        entityType: business.entityType,
        status: business.entityStatus,
        state: business.state,
        postcode: business.postcode,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    logger.error('Business lookup error', {
      abn: req.params.abn,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to lookup business');
  }
});
