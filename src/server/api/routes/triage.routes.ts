// ============================================================================
// Triage Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('triage-routes');

export const triageRoutes = Router();

triageRoutes.use(authenticate);
triageRoutes.use(requireTenant);

const overrideSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  routingDestination: z.enum(['line_1_auto', 'line_2_investigation', 'systemic_review']).optional(),
  priorityScore: z.number().min(0).max(1).optional(),
  reason: z.string().min(1),
});

// POST /api/v1/triage/:complaintId -- Trigger triage for a complaint
triageRoutes.post('/:complaintId', async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;

  // Verify complaint exists and belongs to tenant
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenantId },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // Update status to triaging
  await prisma.complaint.update({
    where: { id: complaintId },
    data: { status: 'triaging' },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId,
      eventType: 'status_change',
      description: 'Triage initiated',
      metadata: { fromStatus: complaint.status, toStatus: 'triaging' },
      createdBy: req.userId,
    },
  });

  // TODO: Queue triage job via BullMQ when Redis is available
  // await triageQueue.add(QUEUES.COMPLAINT_TRIAGE, {
  //   complaintId, tenantId, rawText: complaint.rawText, businessId: complaint.businessId,
  // });

  logger.info('Triage queued', { complaintId, tenantId });

  res.json({
    success: true,
    data: { complaintId, status: 'triage_queued' },
  });
});

// POST /api/v1/triage/:complaintId/override -- Manually override triage result
triageRoutes.post(
  '/:complaintId/override',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { complaintId } = req.params as { complaintId: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const body = overrideSchema.parse(req.body);

    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, tenantId },
    });

    if (!complaint) {
      throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
    }

    const oldValues = {
      riskLevel: complaint.riskLevel,
      routingDestination: complaint.routingDestination,
      priorityScore: complaint.priorityScore,
    };

    // Build update
    const updateData: Record<string, unknown> = {};
    if (body.riskLevel !== undefined) updateData.riskLevel = body.riskLevel;
    if (body.routingDestination !== undefined) updateData.routingDestination = body.routingDestination;
    if (body.priorityScore !== undefined) updateData.priorityScore = body.priorityScore;

    await prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    // Record the override as an AI output for audit trail
    await prisma.aiOutput.create({
      data: {
        complaintId,
        outputType: 'manual_override',
        model: 'human',
        prompt: `Supervisor override: ${body.reason}`,
        rawOutput: JSON.stringify({ ...body, overriddenBy: userId }),
        parsedOutput: body,
        confidence: 1.0,
        reasoning: body.reason,
      },
    });

    await prisma.complaintEvent.create({
      data: {
        complaintId,
        eventType: 'ai_output',
        description: `Triage manually overridden: ${body.reason}`,
        metadata: { oldValues, newValues: body, overriddenBy: userId },
        createdBy: userId,
      },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'triage.override',
      entity: 'Complaint',
      entityId: complaintId,
      oldValues,
      newValues: body,
    });

    logger.info('Triage overridden', { complaintId, userId, reason: body.reason });

    res.json({
      success: true,
      data: { complaintId, ...body, overriddenBy: userId },
    });
  },
);

// GET /api/v1/triage/:complaintId/result -- Get triage result for a complaint
triageRoutes.get('/:complaintId/result', async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;

  // Verify complaint exists and belongs to tenant
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenantId },
    select: {
      id: true,
      riskLevel: true,
      priorityScore: true,
      routingDestination: true,
      category: true,
      legalCategory: true,
      complexityScore: true,
      breachLikelihood: true,
      publicHarmIndicator: true,
      isCivilDispute: true,
      isSystemicRisk: true,
      summary: true,
    },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // Fetch AI outputs related to triage
  const aiOutputs = await prisma.aiOutput.findMany({
    where: { complaintId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      outputType: true,
      model: true,
      confidence: true,
      reasoning: true,
      isEdited: true,
      editedBy: true,
      latencyMs: true,
      createdAt: true,
    },
  });

  res.json({
    success: true,
    data: {
      complaint,
      aiOutputs,
    },
  });
});
