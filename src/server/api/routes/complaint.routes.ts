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
  const filters = complaintFiltersSchema.parse(req.query);
  const tenantId = req.tenantId!;

  // In production: prisma.complaint.findMany with dynamic where, orderBy, skip, take
  // Filter by tenantId, status, riskLevel, category, search (rawText ILIKE), dateRange
  // Include business name, assigned officer name

  logger.info('Complaints list requested', { tenantId, filters });

  const allComplaints = [
    { id: 'cmp-001', referenceNumber: 'CMP-2A4F-XK91', summary: 'Misleading pricing on home loan comparison rate.', business: 'National Finance Group Pty Ltd', category: 'misleading_conduct', riskLevel: 'critical' as const, priorityScore: 0.92, status: 'triaged', submittedAt: '2025-01-15T09:30:00Z', slaDeadline: '2025-01-22T09:30:00Z' },
    { id: 'cmp-002', referenceNumber: 'CMP-3B5G-LM72', summary: 'Aged care facility failing to provide adequate nutrition standards.', business: 'Sunrise Aged Care Holdings', category: 'service_quality', riskLevel: 'high' as const, priorityScore: 0.84, status: 'assigned', submittedAt: '2025-01-14T14:15:00Z', slaDeadline: '2025-01-21T14:15:00Z' },
    { id: 'cmp-003', referenceNumber: 'CMP-4C6H-NP83', summary: 'Telco refusing cooling-off period cancellation.', business: 'QuickConnect Telecom', category: 'unfair_contract_terms', riskLevel: 'medium' as const, priorityScore: 0.61, status: 'in_progress', submittedAt: '2025-01-13T11:00:00Z', slaDeadline: '2025-01-20T11:00:00Z' },
    { id: 'cmp-004', referenceNumber: 'CMP-5D7I-QR94', summary: 'Building contractor abandoned renovation mid-project.', business: 'Premier Builds Australia', category: 'scam_fraud', riskLevel: 'high' as const, priorityScore: 0.78, status: 'triaged', submittedAt: '2025-01-12T16:45:00Z', slaDeadline: '2025-01-19T16:45:00Z' },
    { id: 'cmp-005', referenceNumber: 'CMP-6E8J-ST05', summary: 'Insurance claim denial citing fine print exclusion.', business: 'SafeGuard Insurance Ltd', category: 'unfair_contract_terms', riskLevel: 'medium' as const, priorityScore: 0.55, status: 'awaiting_response', submittedAt: '2025-01-11T10:20:00Z', slaDeadline: '2025-01-18T10:20:00Z' },
    { id: 'cmp-006', referenceNumber: 'CMP-7F9K-UV16', summary: 'Energy provider overcharging during peak tariff incorrectly.', business: 'PowerSave Energy', category: 'billing_dispute', riskLevel: 'low' as const, priorityScore: 0.32, status: 'in_progress', submittedAt: '2025-01-10T08:00:00Z', slaDeadline: '2025-01-17T08:00:00Z' },
  ];

  // Apply filters
  let filtered = allComplaints;
  if (filters.riskLevel) filtered = filtered.filter(c => c.riskLevel === filters.riskLevel);
  if (filters.category) filtered = filtered.filter(c => c.category === filters.category);
  if (filters.status) filtered = filtered.filter(c => c.status === filters.status);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(c =>
      c.summary.toLowerCase().includes(q) ||
      c.referenceNumber.toLowerCase().includes(q) ||
      c.business.toLowerCase().includes(q)
    );
  }

  // Sort
  if (filters.sortBy === 'priorityScore') {
    filtered.sort((a, b) => filters.sortOrder === 'desc' ? b.priorityScore - a.priorityScore : a.priorityScore - b.priorityScore);
  }

  // Paginate
  const start = (filters.page - 1) * filters.pageSize;
  const paged = filtered.slice(start, start + filters.pageSize);

  res.json({
    success: true,
    data: paged,
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount: filtered.length,
      totalPages: Math.ceil(filtered.length / filters.pageSize),
    },
  });
});

// GET /api/v1/complaints/:id – Get complaint detail
complaintRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  // In production: prisma.complaint.findUnique({ where: { id, tenantId }, include: { business, assignedTo, events, evidence } })

  res.json({
    success: true,
    data: {
      id,
      referenceNumber: 'CMP-2A4F-XK91',
      status: 'assigned',
      channel: 'portal',
      rawText: 'I applied for a personal loan with National Finance Group after seeing their advertisement for a 3.49% comparison rate. After signing the contract, I discovered the actual rate including all fees and charges is 5.2%. The comparison rate advertised did not include the $395 establishment fee, $10/month account keeping fee, or the mandatory insurance premium of $45/month. I am now locked into a 3-year term. When I called to complain, I was told the comparison rate was "indicative only" despite their website and brochures clearly stating it as the comparison rate under the National Consumer Credit Protection Act.',
      summary: 'Misleading pricing on home loan comparison rate — advertised 3.49% but actual rate with fees is 5.2%. Consumer locked into 3-year term.',
      complainant: {
        firstName: 'David',
        lastName: 'Thompson',
        email: 'd.thompson@email.com',
        phone: '0412 345 678',
      },
      business: {
        id: 'b-001',
        name: 'National Finance Group Pty Ltd',
        abn: '12 345 678 901',
        industry: 'Financial Services',
        isVerified: true,
        complaintCount: 18,
      },
      category: 'misleading_conduct',
      legalCategory: 'Australian Consumer Law s18 - Misleading or deceptive conduct',
      industry: 'financial_services',
      monetaryValue: 4200,
      monetaryCurrency: 'AUD',
      incidentDate: '2025-01-02T00:00:00Z',
      routingDestination: 'line_2_investigation',
      assignedTo: { id: 'u-001', firstName: 'Sarah', lastName: 'Chen', role: 'complaint_officer' },
      priorityScore: 0.92,
      riskLevel: 'critical',
      complexityScore: 0.72,
      isSystemicRisk: true,
      systemicClusterId: 'sc-001',
      aiConfidence: 0.89,
      aiReasoning: 'High risk due to potential systemic misleading conduct affecting multiple consumers. The business has 12 prior complaints in this category.',
      isAiEdited: false,
      timeline: [
        { id: 'evt-001', eventType: 'submitted', description: 'Complaint submitted via public portal', createdAt: '2025-01-15T09:30:00Z' },
        { id: 'evt-002', eventType: 'triaged', description: 'AI triage completed. Risk: Critical. Priority: 0.92. Routing: Line 2 Investigation.', createdAt: '2025-01-15T09:30:28Z' },
        { id: 'evt-003', eventType: 'assigned', description: 'Assigned to Sarah Chen (Complaint Officer)', createdAt: '2025-01-15T10:15:00Z' },
        { id: 'evt-004', eventType: 'systemic_flagged', description: 'Linked to systemic cluster: Misleading comparison rates in personal lending (14 complaints)', createdAt: '2025-01-15T10:16:00Z' },
      ],
      evidence: [],
      createdAt: '2025-01-15T09:30:00Z',
      updatedAt: '2025-01-15T10:16:00Z',
      submittedAt: '2025-01-15T09:30:00Z',
      slaDeadline: '2025-01-17T09:30:00Z',
    },
  });
});

// PATCH /api/v1/complaints/:id – Update complaint (with state machine validation for status)
complaintRoutes.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
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
  const { id } = req.params;

  try {
    const body = assignSchema.parse(req.body);

    logger.info('Complaint assigned', { complaintId: id, assigneeId: body.assigneeId, assignedBy: req.userId });

    res.json({
      success: true,
      data: {
        complaintId: id,
        assignedTo: body.assigneeId,
        assignedBy: req.userId,
        assignedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    return res.status(500).json({ success: false, error: { message: 'Assignment failed' } });
  }
});

// POST /api/v1/complaints/:id/escalate – Escalate complaint
complaintRoutes.post('/:id/escalate', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const body = escalateSchema.parse(req.body);

    logger.info('Complaint escalated', { complaintId: id, destination: body.destination, reason: body.reason, escalatedBy: req.userId });

    res.json({
      success: true,
      data: {
        complaintId: id,
        escalatedTo: body.destination,
        reason: body.reason,
        escalatedBy: req.userId,
        escalatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    return res.status(500).json({ success: false, error: { message: 'Escalation failed' } });
  }
});

// POST /api/v1/complaints/:id/transition – State machine transition
complaintRoutes.post('/:id/transition', async (req: Request, res: Response) => {
  const { id } = req.params;
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
  const { id } = req.params;
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
  const { id } = req.params;
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
  const { id } = req.params;

  // In production: pgvector cosine similarity query
  // SELECT c.id, 1 - (ce1.embedding <=> ce2.embedding) as similarity
  // FROM complaint_embeddings ce1 JOIN complaint_embeddings ce2 ...
  // WHERE similarity > 0.85

  res.json({
    success: true,
    data: [
      { id: 'cmp-010', referenceNumber: 'CMP-8G1K-VY27', summary: 'Personal loan advertised at 4.9% but actual rate 7.2% with fees', similarity: 0.94, riskLevel: 'high', business: 'QuickLoan Direct' },
      { id: 'cmp-011', referenceNumber: 'CMP-9H2L-WZ38', summary: 'Car loan comparison rate excluded establishment fee', similarity: 0.89, riskLevel: 'high', business: 'National Finance Group Pty Ltd' },
      { id: 'cmp-012', referenceNumber: 'CMP-AJ3M-XA49', summary: 'Mortgage comparison rate did not include LMI premium', similarity: 0.86, riskLevel: 'medium', business: 'Aussie Personal Finance' },
    ],
  });
});
