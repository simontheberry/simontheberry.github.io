// ============================================================================
// Complaint Routes – CRUD with filtering, assignment, escalation
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';
import { TransitionManager } from '../../services/state-machine/transition-manager';
import { ComplaintStateMachine, type ComplaintStatus } from '../../services/state-machine/complaint-state-machine';

const logger = createLogger('complaint-routes');

export const complaintRoutes = Router();

complaintRoutes.use(authenticate);
complaintRoutes.use(requireTenant);

// ---- Validation Schemas ----

const complaintFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.string().default('priorityScore'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.string().optional(),
  riskLevel: z.string().optional(),
  category: z.string().optional(),
  industry: z.string().optional(),
  assignedTo: z.string().optional(),
  routingDestination: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  minPriorityScore: z.coerce.number().optional(),
});

const assignSchema = z.object({
  assigneeId: z.string().uuid(),
});

const escalateSchema = z.object({
  reason: z.string().min(10),
  destination: z.enum(['line_2_investigation', 'systemic_review']),
});

const stateTransitionSchema = z.object({
  toStatus: z.string(),
  reason: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
});

const updateComplaintSchema = z.object({
  status: z.string().optional(),
  riskLevel: z.string().optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
  routingDestination: z.string().optional(),
}).refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

// ---- Routes ----

// GET /api/v1/complaints – List complaints with filtering & pagination
complaintRoutes.get('/', async (req: Request, res: Response) => {
  // Normalize query params (can be string or string[] from Express)
  const normalizedQuery = Object.fromEntries(
    Object.entries(req.query).map(([key, val]) => [
      key,
      Array.isArray(val) ? val[0] : val,
    ])
  );

  const filters = complaintFiltersSchema.parse(normalizedQuery);
  const tenantId = req.tenantId!;

  logger.info('Complaints list requested', { tenantId, filters });

  try {
    // Build dynamic where clause for filtering
    const where: Parameters<typeof prisma.complaint.findMany>[0]['where'] = {
      tenantId,
    };

    if (filters.status) where.status = filters.status;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.category) where.category = filters.category;
    if (filters.industry) where.industry = filters.industry;
    if (filters.assignedTo) where.assignedToId = filters.assignedTo;
    if (filters.routingDestination) where.routingDestination = filters.routingDestination;

    // Date range filtering
    if (filters.dateFrom || filters.dateTo) {
      where.submittedAt = {};
      if (filters.dateFrom) where.submittedAt = { ...where.submittedAt, gte: new Date(filters.dateFrom) };
      if (filters.dateTo) where.submittedAt = { ...where.submittedAt, lte: new Date(filters.dateTo) };
    }

    // Search filtering (rawText, referenceNumber, or business name)
    if (filters.search) {
      const q = filters.search.toLowerCase();
      where.OR = [
        { referenceNumber: { contains: q, mode: 'insensitive' } },
        { rawText: { contains: q, mode: 'insensitive' } },
        { business: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Minimum priority score filtering
    if (filters.minPriorityScore !== undefined) {
      where.priorityScore = { gte: filters.minPriorityScore };
    }

    // Get total count for pagination
    const totalCount = await prisma.complaint.count({ where });

    // Build orderBy
    const orderBy: Parameters<typeof prisma.complaint.findMany>[0]['orderBy'] = {};
    if (filters.sortBy === 'priorityScore') {
      orderBy.priorityScore = filters.sortOrder;
    } else if (filters.sortBy === 'submittedAt') {
      orderBy.submittedAt = filters.sortOrder;
    } else {
      orderBy.priorityScore = 'desc'; // Default sort
    }

    // Fetch complaints with related data
    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        business: {
          select: { id: true, name: true, abn: true, industry: true, isVerified: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    });

    // Transform for response
    const data = complaints.map(c => ({
      id: c.id,
      referenceNumber: c.referenceNumber,
      summary: c.summary || c.rawText.substring(0, 100) + '...',
      business: c.business?.name || 'Unknown',
      category: c.category || 'other',
      riskLevel: (c.riskLevel || 'low') as 'low' | 'medium' | 'high' | 'critical',
      priorityScore: c.priorityScore || 0,
      status: c.status,
      submittedAt: c.submittedAt?.toISOString() || new Date().toISOString(),
      slaDeadline: c.slaDeadline?.toISOString() || new Date().toISOString(),
      assignedTo: c.assignedTo,
    }));

    res.json({
      success: true,
      data,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / filters.pageSize),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch complaints', { tenantId, error: error instanceof Error ? error.message : 'Unknown error' });
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch complaints');
  }
});

// GET /api/v1/complaints/:id – Get complaint detail
complaintRoutes.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;

  try {
    const complaint = await prisma.complaint.findFirst({
      where: { id, tenantId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            abn: true,
            industry: true,
            isVerified: true,
            _count: { select: { complaints: true } },
          },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            eventType: true,
            description: true,
            metadata: true,
            createdAt: true,
          },
        },
        evidence: {
          select: { id: true, filename: true, mimeType: true, size: true, uploadedAt: true },
        },
      },
    });

    if (!complaint) {
      throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
    }

    res.json({
      success: true,
      data: {
        id: complaint.id,
        referenceNumber: complaint.referenceNumber,
        status: complaint.status,
        channel: complaint.channel,
        rawText: complaint.rawText,
        summary: complaint.summary,
        complainant: {
          firstName: complaint.complainantFirstName,
          lastName: complaint.complainantLastName,
          email: complaint.complainantEmail,
          phone: complaint.complainantPhone,
          address: complaint.complainantAddress,
        },
        business: complaint.business
          ? {
              id: complaint.business.id,
              name: complaint.business.name,
              abn: complaint.business.abn,
              industry: complaint.business.industry,
              isVerified: complaint.business.isVerified,
              complaintCount: complaint.business._count?.complaints || 0,
            }
          : null,
        category: complaint.category,
        legalCategory: complaint.legalCategory,
        industry: complaint.industry,
        productService: complaint.productService,
        monetaryValue: complaint.monetaryValue?.toNumber(),
        monetaryCurrency: complaint.monetaryCurrency,
        incidentDate: complaint.incidentDate?.toISOString(),
        routingDestination: complaint.routingDestination,
        assignedTo: complaint.assignedTo,
        priorityScore: complaint.priorityScore,
        riskLevel: (complaint.riskLevel || 'low') as 'low' | 'medium' | 'high' | 'critical',
        complexityScore: complaint.complexityScore,
        breachLikelihood: complaint.breachLikelihood,
        publicHarmIndicator: complaint.publicHarmIndicator,
        isSystemicRisk: complaint.isSystemicRisk,
        systemicClusterId: complaint.systemicClusterId,
        aiConfidence: complaint.aiConfidence,
        aiReasoning: complaint.aiReasoning,
        isAiEdited: complaint.isAiEdited,
        timeline: complaint.events.map(evt => ({
          id: evt.id,
          eventType: evt.eventType,
          description: evt.description,
          metadata: evt.metadata,
          createdAt: evt.createdAt?.toISOString(),
        })),
        evidence: complaint.evidence.map(e => ({
          id: e.id,
          filename: e.filename,
          mimeType: e.mimeType,
          size: e.size,
          uploadedAt: e.uploadedAt?.toISOString(),
        })),
        createdAt: complaint.createdAt?.toISOString(),
        updatedAt: complaint.updatedAt?.toISOString(),
        submittedAt: complaint.submittedAt?.toISOString(),
        slaDeadline: complaint.slaDeadline?.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Failed to fetch complaint detail', { id, tenantId, error: error instanceof Error ? error.message : 'Unknown error' });
    throw new AppError(500, 'DATABASE_ERROR', 'Failed to fetch complaint details');
  }
});

// PATCH /api/v1/complaints/:id – Update complaint (with state machine validation for status)
complaintRoutes.patch('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRole = req.userRole!;

  const body = updateComplaintSchema.parse(req.body);

  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // RBAC: only supervisor/admin or the assigned officer can update
  const isSupervisorOrAdmin = userRole === 'supervisor' || userRole === 'admin';
  const isAssignedOfficer = complaint.assignedToId === userId;

  if (!isSupervisorOrAdmin && !isAssignedOfficer) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this complaint');
  }

  // If status is changing, validate through state machine
  if (body.status && body.status !== complaint.status) {
    const validation = ComplaintStateMachine.validateTransition(
      complaint.status as ComplaintStatus,
      body.status as ComplaintStatus,
      {
        userId,
        userRole,
        complaintId: id,
        reason: 'Status update via PATCH',
      },
    );

    if (!validation.valid) {
      throw new AppError(400, 'INVALID_TRANSITION', validation.error || 'Invalid status transition');
    }

    // Contextual validation: require summary before resolving
    if (body.status === 'resolved' && !complaint.summary && !body.summary) {
      throw new AppError(400, 'MISSING_SUMMARY', 'A resolution summary is required before resolving');
    }
  }

  const updateData: Parameters<typeof prisma.complaint.update>[0]['data'] = {};
  if (body.status !== undefined) (updateData as any).status = body.status;
  if (body.category !== undefined) (updateData as any).category = body.category;
  if (body.riskLevel !== undefined) (updateData as any).riskLevel = body.riskLevel;
  if (body.summary !== undefined) (updateData as any).summary = body.summary;
  if (body.routingDestination !== undefined) (updateData as any).routingDestination = body.routingDestination;

  const updated = await prisma.complaint.update({
    where: { id },
    data: updateData,
  });

  // Create timeline event for status changes
  if (body.status && body.status !== complaint.status) {
    await prisma.complaintEvent.create({
      data: {
        complaintId: id,
        eventType: 'status_change',
        description: `Status changed from ${complaint.status} to ${body.status}`,
        metadata: { fromStatus: complaint.status, toStatus: body.status },
        createdBy: userId,
      },
    });
  }

  await writeAuditLog({
    tenantId,
    userId,
    action: 'complaint.updated',
    entity: 'Complaint',
    entityId: id,
    oldValues: {
      status: complaint.status,
      category: complaint.category,
      riskLevel: complaint.riskLevel,
    },
    newValues: body,
  });

  logger.info('Complaint updated', { complaintId: id, updates: Object.keys(body), userId });

  res.json({
    success: true,
    data: updated,
  });
});

// POST /api/v1/complaints/:id/assign – Assign complaint to officer
complaintRoutes.post('/:id/assign', authorize('supervisor', 'admin'), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    const body = assignSchema.parse(req.body);

    // Verify assignee exists and belongs to tenant
    const assignee = await prisma.user.findFirst({
      where: { id: body.assigneeId, tenantId },
    });

    if (!assignee) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Assignee not found in this tenant');
    }

    // Get current complaint to check existing assignment
    const complaint = await prisma.complaint.findFirst({
      where: { id, tenantId },
      select: { assignedToId: true },
    });

    if (!complaint) {
      throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
    }

    const assignedAt = new Date();

    // Update assignment
    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        assignedToId: body.assigneeId,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Create timeline event
    await prisma.complaintEvent.create({
      data: {
        complaintId: id,
        eventType: 'assigned',
        description: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
        metadata: { assignedToId: body.assigneeId, previousAssigneeId: complaint.assignedToId },
        createdBy: userId,
      },
    });

    // Write audit log
    await writeAuditLog({
      tenantId,
      userId,
      action: 'complaint.assigned',
      entity: 'Complaint',
      entityId: id,
      oldValues: { assignedToId: complaint.assignedToId },
      newValues: { assignedToId: body.assigneeId },
    });

    logger.info('Complaint assigned', { complaintId: id, assigneeId: body.assigneeId, assignedBy: userId });

    res.json({
      success: true,
      data: {
        complaintId: id,
        assignedTo: updated.assignedTo,
        assignedBy: userId,
        assignedAt: assignedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }

    logger.error('Assignment failed', { complaintId: id, error: error instanceof Error ? error.message : 'Unknown error' });
    return res.status(500).json({ success: false, error: { message: 'Assignment failed' } });
  }
});

// POST /api/v1/complaints/:id/escalate – Escalate complaint
complaintRoutes.post('/:id/escalate', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRole = req.userRole!;

  try {
    const body = escalateSchema.parse(req.body);

    // Get current complaint
    const complaint = await prisma.complaint.findFirst({
      where: { id, tenantId },
      select: { status: true, routingDestination: true },
    });

    if (!complaint) {
      throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
    }

    // Only supervisors and admins can escalate
    const canEscalate = userRole === 'supervisor' || userRole === 'admin';
    if (!canEscalate) {
      throw new AppError(403, 'FORBIDDEN', 'Only supervisors and admins can escalate complaints');
    }

    const escalatedAt = new Date();

    // Update routing destination
    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        routingDestination: body.destination,
      },
    });

    // Create timeline event
    await prisma.complaintEvent.create({
      data: {
        complaintId: id,
        eventType: 'escalated',
        description: `Escalated to ${body.destination}: ${body.reason}`,
        metadata: {
          destination: body.destination,
          reason: body.reason,
          previousDestination: complaint.routingDestination,
        },
        createdBy: userId,
      },
    });

    // Write audit log
    await writeAuditLog({
      tenantId,
      userId,
      action: 'complaint.escalated',
      entity: 'Complaint',
      entityId: id,
      oldValues: { routingDestination: complaint.routingDestination },
      newValues: { routingDestination: body.destination, reason: body.reason },
    });

    logger.info('Complaint escalated', { complaintId: id, destination: body.destination, reason: body.reason, escalatedBy: userId });

    res.json({
      success: true,
      data: {
        complaintId: id,
        escalatedTo: body.destination,
        reason: body.reason,
        escalatedBy: userId,
        escalatedAt: escalatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }

    logger.error('Escalation failed', { complaintId: id, error: error instanceof Error ? error.message : 'Unknown error' });
    return res.status(500).json({ success: false, error: { message: 'Escalation failed' } });
  }
});

// POST /api/v1/complaints/:id/transition – State machine transition
complaintRoutes.post('/:id/transition', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;

  try {
    const body = stateTransitionSchema.parse(req.body);

    // Execute state transition with audit trail
    const result = await TransitionManager.executeTransition(
      id,
      body.toStatus as ComplaintStatus,
      {
        userId: req.userId!,
        userRole: req.userRole || 'system',
        complaintId: id,
        reason: body.reason,
        metadata: body.metadata,
      },
      tenantId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { message: result.error || 'Transition failed' },
      });
    }

    logger.info('Complaint state transitioned', {
      complaintId: id,
      from: result.previousStatus,
      to: result.newStatus,
      userId: req.userId,
    });

    res.json({
      success: true,
      data: {
        complaintId: id,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        transitionedAt: new Date().toISOString(),
        transitionedBy: req.userId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    logger.error('State transition failed', { complaintId: id, error: error instanceof Error ? error.message : 'Unknown error' });
    return res.status(500).json({ success: false, error: { message: 'Transition failed' } });
  }
});

// GET /api/v1/complaints/:id/available-transitions – Get available state transitions
complaintRoutes.get('/:id/available-transitions', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;
  const userRole = req.userRole || 'system';

  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
    select: { status: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  const transitions = TransitionManager.getAvailableTransitions(
    complaint.status as ComplaintStatus,
    userRole,
  );

  res.json({
    success: true,
    data: transitions,
  });
});

// GET /api/v1/complaints/:id/timeline – Get complaint event timeline
complaintRoutes.get('/:id/timeline', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;

  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  const history = await TransitionManager.getTransitionHistory(id, tenantId);

  res.json({
    success: true,
    data: history,
  });
});

// GET /api/v1/complaints/:id/similar – Find similar complaints via vector search
complaintRoutes.get('/:id/similar', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const tenantId = req.tenantId!;

  try {
    // Verify complaint exists and belongs to tenant
    const complaint = await prisma.complaint.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!complaint) {
      throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
    }

    // Check if embedding exists for this complaint
    const embeddingCheck = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM complaint_embeddings WHERE complaint_id = ${id}
    `;
    const hasEmbedding = Number(embeddingCheck[0]?.count || 0) > 0;

    if (!hasEmbedding) {
      return res.json({
        success: true,
        data: [],
        meta: { message: 'No embedding generated for this complaint yet' },
      });
    }

    const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 0.85;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const results = await prisma.$queryRaw<Array<{
      complaintId: string;
      referenceNumber: string;
      summary: string;
      similarity: number;
      riskLevel: string;
      business: string | null;
      systemicClusterId: string | null;
    }>>`
      SELECT
        ce.complaint_id AS "complaintId",
        c.reference_number AS "referenceNumber",
        COALESCE(c.summary, LEFT(c.raw_text, 120) || '...') AS summary,
        1 - (ce.embedding <=> target.embedding) AS similarity,
        COALESCE(c.risk_level, 'low') AS "riskLevel",
        b.name AS business,
        c.systemic_cluster_id AS "systemicClusterId"
      FROM complaint_embeddings ce
      JOIN complaint_embeddings target ON target.complaint_id = ${id}
      JOIN complaints c ON c.id = ce.complaint_id
      LEFT JOIN businesses b ON b.id = c.business_id
      WHERE ce.tenant_id = ${tenantId}
        AND c.tenant_id = ${tenantId}
        AND ce.complaint_id != ${id}
        AND c.created_at > NOW() - INTERVAL '90 days'
        AND 1 - (ce.embedding <=> target.embedding) > ${threshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    res.json({
      success: true,
      data: results.map(r => ({
        id: r.complaintId,
        referenceNumber: r.referenceNumber,
        summary: r.summary,
        similarity: parseFloat(String(r.similarity)),
        riskLevel: r.riskLevel,
        business: r.business || 'Unknown',
        systemicClusterId: r.systemicClusterId,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Similarity search failed', { complaintId: id, error: error instanceof Error ? error.message : 'Unknown error' });
    throw new AppError(500, 'SEARCH_ERROR', 'Failed to find similar complaints');
  }
});
