// ============================================================================
// Settings Routes -- Tenant configuration management
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { createLogger } from '../../utils/logger';
import { Prisma } from '@prisma/client';

const logger = createLogger('settings-routes');

export const settingsRoutes = Router();

settingsRoutes.use(authenticate);
settingsRoutes.use(requireTenant);

// ---- Validation Schemas ----

const priorityWeightsSchema = z.object({
  riskScore: z.number().min(0).max(1),
  systemicImpact: z.number().min(0).max(1),
  monetaryHarm: z.number().min(0).max(1),
  vulnerabilityIndicator: z.number().min(0).max(1),
  resolutionProbability: z.number().min(0).max(1),
});

const slaDefaultsSchema = z.object({
  line1ResponseHours: z.number().int().min(1).max(720),
  line2ResponseHours: z.number().int().min(1).max(720),
  businessResponseDays: z.number().int().min(1).max(90),
  escalationDays: z.number().int().min(1).max(90),
});

const updateSettingsSchema = z.object({
  priorityWeights: priorityWeightsSchema.optional(),
  slaDefaults: slaDefaultsSchema.optional(),
  autoSendEnabled: z.boolean().optional(),
  autoSendConfidenceThreshold: z.number().min(0).max(1).optional(),
  supervisorReviewThreshold: z.number().min(0).max(1).optional(),
  aiProvider: z.enum(['openai', 'anthropic', 'azure_openai', 'custom']).optional(),
  features: z.object({
    emailIngestion: z.boolean().optional(),
    webhookIntake: z.boolean().optional(),
    publicPortal: z.boolean().optional(),
    autoResponse: z.boolean().optional(),
    systemicDetection: z.boolean().optional(),
  }).optional(),
});

// Default settings applied when a tenant has no stored settings
const DEFAULT_SETTINGS = {
  priorityWeights: {
    riskScore: 0.30,
    systemicImpact: 0.25,
    monetaryHarm: 0.15,
    vulnerabilityIndicator: 0.20,
    resolutionProbability: 0.10,
  },
  slaDefaults: {
    line1ResponseHours: 48,
    line2ResponseHours: 120,
    businessResponseDays: 14,
    escalationDays: 21,
  },
  autoSendEnabled: false,
  autoSendConfidenceThreshold: 0.85,
  supervisorReviewThreshold: 0.70,
  aiProvider: 'openai' as const,
  features: {
    emailIngestion: false,
    webhookIntake: true,
    publicPortal: true,
    autoResponse: false,
    systemicDetection: true,
  },
};

// GET /api/v1/settings -- Fetch current tenant settings
settingsRoutes.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const storedSettings = (tenant?.settings ?? {}) as Record<string, unknown>;

  // Merge defaults with stored settings so frontend always gets full shape
  const settings = {
    ...DEFAULT_SETTINGS,
    ...storedSettings,
    priorityWeights: {
      ...DEFAULT_SETTINGS.priorityWeights,
      ...((storedSettings.priorityWeights as Record<string, unknown>) ?? {}),
    },
    slaDefaults: {
      ...DEFAULT_SETTINGS.slaDefaults,
      ...((storedSettings.slaDefaults as Record<string, unknown>) ?? {}),
    },
    features: {
      ...DEFAULT_SETTINGS.features,
      ...((storedSettings.features as Record<string, unknown>) ?? {}),
    },
  };

  res.json({ success: true, data: settings });
});

// PATCH /api/v1/settings -- Update tenant settings (admin/supervisor only)
settingsRoutes.patch(
  '/',
  authorize('admin', 'supervisor'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const body = updateSettingsSchema.parse(req.body);

    // Validate priority weights sum to ~1.0 if provided
    if (body.priorityWeights) {
      const total = Object.values(body.priorityWeights).reduce((sum, w) => sum + w, 0);
      if (Math.abs(total - 1.0) > 0.01) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_WEIGHTS',
            message: `Priority weights must sum to 1.0 (current total: ${total.toFixed(2)})`,
          },
        });
        return;
      }
    }

    // Validate threshold ordering if both are present
    const autoThreshold = body.autoSendConfidenceThreshold;
    const reviewThreshold = body.supervisorReviewThreshold;
    if (autoThreshold !== undefined && reviewThreshold !== undefined) {
      if (reviewThreshold >= autoThreshold) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_THRESHOLDS',
            message: 'Supervisor review threshold must be lower than auto-send confidence threshold',
          },
        });
        return;
      }
    }

    // Read current settings for audit diff
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const oldSettings = (tenant?.settings ?? {}) as Record<string, unknown>;

    // Merge incoming changes into existing settings
    const merged = {
      ...DEFAULT_SETTINGS,
      ...oldSettings,
      ...body,
      priorityWeights: {
        ...DEFAULT_SETTINGS.priorityWeights,
        ...((oldSettings.priorityWeights as Record<string, unknown>) ?? {}),
        ...(body.priorityWeights ?? {}),
      },
      slaDefaults: {
        ...DEFAULT_SETTINGS.slaDefaults,
        ...((oldSettings.slaDefaults as Record<string, unknown>) ?? {}),
        ...(body.slaDefaults ?? {}),
      },
      features: {
        ...DEFAULT_SETTINGS.features,
        ...((oldSettings.features as Record<string, unknown>) ?? {}),
        ...(body.features ?? {}),
      },
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: merged as unknown as Prisma.InputJsonValue },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'settings.updated',
      entity: 'TenantSettings',
      entityId: tenantId,
      oldValues: oldSettings,
      newValues: body as Record<string, unknown>,
    });

    logger.info('Tenant settings updated', { tenantId, userId });

    res.json({ success: true, data: merged });
  },
);

// POST /api/v1/settings/reset -- Reset tenant settings to platform defaults (admin only)
settingsRoutes.post(
  '/reset',
  authorize('admin'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const oldSettings = (tenant?.settings ?? {}) as Record<string, unknown>;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: DEFAULT_SETTINGS as unknown as Prisma.InputJsonValue },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'settings.reset',
      entity: 'TenantSettings',
      entityId: tenantId,
      oldValues: oldSettings,
      newValues: DEFAULT_SETTINGS as unknown as Record<string, unknown>,
    });

    logger.info('Tenant settings reset to defaults', { tenantId, userId });

    res.json({ success: true, data: DEFAULT_SETTINGS });
  },
);
