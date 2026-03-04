// ============================================================================
// Triage Routes – AI-powered complaint triage
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { createLogger } from '../../utils/logger';

const logger = createLogger('triage-routes');

export const triageRoutes = Router();

triageRoutes.use(authenticate);
triageRoutes.use(requireTenant);

// ---- Validation Schemas ----

const triageOverrideSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  routingDestination: z.enum(['line_1_auto', 'line_2_investigation', 'systemic_review']),
  priorityScore: z.number().min(0).max(1),
  reason: z.string().min(10),
});

// POST /api/v1/triage/:complaintId – Trigger triage for a complaint
triageRoutes.post('/:complaintId', async (req: Request, res: Response) => {
  const { complaintId } = req.params;
  const tenantId = req.tenantId!;

  // In production with database + BullMQ:
  // 1. Fetch complaint: prisma.complaint.findUnique({ where: { id: complaintId, tenantId } })
  // 2. Update status: prisma.complaint.update({ data: { status: 'triaging' } })
  // 3. Queue job: triageQueue.add('triage', { complaintId, tenantId, rawText })
  // 4. Worker runs TriageEngine.triageComplaint() and persists results

  logger.info('Triage triggered', { complaintId, tenantId, triggeredBy: req.userId });

  res.json({
    success: true,
    data: {
      complaintId,
      status: 'triage_queued',
      message: 'Triage pipeline has been queued for processing',
    },
  });
});

// POST /api/v1/triage/:complaintId/override – Manually override triage result
triageRoutes.post(
  '/:complaintId/override',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { complaintId } = req.params;

    try {
      const body = triageOverrideSchema.parse(req.body);
      const userId = req.userId!;

      // In production:
      // 1. prisma.complaint.update({ where: { id, tenantId }, data: { riskLevel, routingDestination, priorityScore } })
      // 2. prisma.auditLog.create({ data: { action: 'triage_override', entityType: 'complaint', entityId, metadata: { reason, previousValues, newValues } } })
      // 3. prisma.complaintEvent.create({ data: { type: 'triage_override', description: reason } })

      logger.info('Triage overridden', {
        complaintId,
        overriddenBy: userId,
        newRiskLevel: body.riskLevel,
        newRouting: body.routingDestination,
        reason: body.reason,
      });

      res.json({
        success: true,
        data: {
          complaintId,
          riskLevel: body.riskLevel,
          routingDestination: body.routingDestination,
          priorityScore: body.priorityScore,
          overriddenBy: userId,
          overriddenAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
        });
      }
      logger.error('Triage override failed', { error, complaintId });
      return res.status(500).json({ success: false, error: { message: 'Failed to override triage' } });
    }
  },
);

// GET /api/v1/triage/:complaintId/result – Get triage result for a complaint
triageRoutes.get('/:complaintId/result', async (req: Request, res: Response) => {
  const { complaintId } = req.params;

  // In production: prisma.aiOutput.findMany({ where: { complaintId }, orderBy: { createdAt: 'desc' } })

  res.json({
    success: true,
    data: {
      complaintId,
      category: 'misleading_conduct',
      legalCategory: 'Australian Consumer Law s18 - Misleading or deceptive conduct',
      riskLevel: 'high',
      complexityScore: 0.72,
      priorityScore: 0.84,
      routingDestination: 'line_2_investigation',
      isCivilDispute: false,
      isSystemicRisk: true,
      breachLikelihood: 0.78,
      publicHarmIndicator: 0.65,
      complexityFactors: {
        legalNuance: 0.7,
        investigationDepth: 0.8,
        monetaryValue: 0.6,
        partiesInvolved: 0.5,
        novelty: 0.4,
        publicHarm: 0.9,
      },
      confidence: 0.87,
      reasoning: 'High risk due to potential systemic misleading conduct affecting multiple consumers. The business has 12 prior complaints in this category. Monetary harm pattern suggests deliberate pricing deception rather than isolated error.',
      modelUsed: 'gpt-4o',
      processedAt: new Date().toISOString(),
      aiOutputs: [
        { type: 'extraction', confidence: 0.92, latencyMs: 1840 },
        { type: 'classification', confidence: 0.89, latencyMs: 2100 },
        { type: 'risk_scoring', confidence: 0.87, latencyMs: 2340 },
        { type: 'summarisation', confidence: 0.94, latencyMs: 1560 },
      ],
    },
  });
});
