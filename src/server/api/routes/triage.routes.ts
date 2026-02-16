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
import { getTriageQueue, getSlaQueue, QUEUES } from '../../services/queue/worker';
import type { TriageJobData, SlaCheckJobData } from '../../services/queue/worker';

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
triageRoutes.post('/:complaintId', authorize('supervisor', 'admin'), async (req: Request, res: Response) => {
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

  // Queue triage job if Redis/BullMQ is available
  const triageQueue = getTriageQueue();
  if (triageQueue) {
    await triageQueue.add(QUEUES.COMPLAINT_TRIAGE, {
      complaintId,
      tenantId,
      rawText: complaint.rawText,
      businessId: complaint.businessId ?? undefined,
    } satisfies TriageJobData);
    logger.info('Triage job queued', { complaintId, tenantId });
  } else {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Triage queue is not available. Redis may not be running.');
  }

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

// ============================================================================
// SLA Management Endpoints
// ============================================================================

// GET /api/v1/triage/sla/breaches -- Get SLA breaches for tenant
triageRoutes.get('/sla/breaches', authorize('complaint_officer', 'supervisor', 'admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const now = new Date();

  // Find complaints past SLA deadline that are still open
  const breaches = await prisma.complaint.findMany({
    where: {
      tenantId,
      slaDeadline: { lt: now },
      status: { notIn: ['resolved', 'closed', 'withdrawn', 'escalated'] },
    },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      assignedToId: true,
      routingDestination: true,
      slaDeadline: true,
      complaintCount: false,
      category: true,
      riskLevel: true,
      createdAt: true,
    },
    orderBy: { slaDeadline: 'asc' },
  });

  res.json({
    success: true,
    data: {
      count: breaches.length,
      breaches,
    },
  });
});

// GET /api/v1/triage/sla/approaching -- Get complaints approaching SLA deadline
triageRoutes.get('/sla/approaching', authorize('complaint_officer', 'supervisor', 'admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const now = new Date();
  const hoursThreshold = 12; // Default 12 hours

  // Find complaints approaching SLA deadline (within 12 hours)
  const approaching = await prisma.complaint.findMany({
    where: {
      tenantId,
      slaDeadline: {
        gt: now,
        lt: new Date(now.getTime() + hoursThreshold * 60 * 60 * 1000),
      },
      status: { notIn: ['resolved', 'closed', 'withdrawn', 'escalated'] },
    },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      assignedToId: true,
      routingDestination: true,
      slaDeadline: true,
      category: true,
      riskLevel: true,
      createdAt: true,
    },
    orderBy: { slaDeadline: 'asc' },
  });

  // Calculate time until deadline for each complaint
  const complaintsSorted = approaching.map((c) => ({
    ...c,
    hoursUntilDeadline: (c.slaDeadline ? c.slaDeadline.getTime() - now.getTime() : 0) / (60 * 60 * 1000),
  }));

  res.json({
    success: true,
    data: {
      count: complaintsSorted.length,
      approaching: complaintsSorted,
      threshold: { hours: hoursThreshold, description: `within ${hoursThreshold} hours` },
    },
  });
});

// POST /api/v1/triage/sla/check -- Manually trigger SLA check
triageRoutes.post('/sla/check', authorize('admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  const queue = getSlaQueue();
  if (!queue) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'SLA queue is not available. Redis may not be running.');
  }

  // Manually enqueue SLA check job with high priority
  await queue.add(
    QUEUES.SLA_MONITOR,
    { tenantId } satisfies SlaCheckJobData,
    { priority: 10 } // High priority for manual triggers
  );

  await writeAuditLog({
    tenantId,
    userId,
    action: 'sla.manual_check_triggered',
    entity: 'SlaCheck',
    entityId: tenantId,
    newValues: { triggeredAt: new Date().toISOString() },
  });

  logger.info('Manual SLA check triggered', { tenantId, userId });

  res.json({
    success: true,
    data: {
      message: 'SLA check job enqueued',
      tenantId,
      status: 'processing',
    },
  });
});

// POST /api/v1/triage/sla/:complaintId/reopen -- Reopen escalated complaint
triageRoutes.post('/:complaintId/sla/reopen', authorize('supervisor', 'admin'), async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const reopenSchema = z.object({
    reason: z.string().min(1),
  });
  const body = reopenSchema.parse(req.body);

  // Find escalated complaint
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenantId, status: 'escalated' },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Escalated complaint not found');
  }

  // Reopen complaint
  await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      status: complaint.routingDestination === 'line_1_auto' ? 'in_progress' : 'in_progress',
    },
  });

  // Create timeline event
  await prisma.complaintEvent.create({
    data: {
      complaintId,
      eventType: 'escalation',
      description: `SLA escalation reopened: ${body.reason}`,
      metadata: {
        reason: body.reason,
        reopenedBy: userId,
      },
      createdBy: userId,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'complaint.sla_escalation_reopened',
    entity: 'Complaint',
    entityId: complaintId,
    oldValues: { status: 'escalated' },
    newValues: { status: 'in_progress', reason: body.reason },
  });

  logger.info('SLA escalation reopened', { complaintId, userId, reason: body.reason });

  res.json({
    success: true,
    data: {
      complaintId,
      status: 'in_progress',
      reason: body.reason,
      reopenedBy: userId,
    },
  });
});
