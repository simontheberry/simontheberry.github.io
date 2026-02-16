// ============================================================================
// Complaint Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';
import { normalizeQuery } from '../../utils/query-parser';

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

const complaintUpdateSchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  riskLevel: z.string().optional(),
  priorityScore: z.number().optional(),
  routingDestination: z.string().optional(),
  summary: z.string().optional(),
  productService: z.string().optional(),
});

const assignSchema = z.object({
  assigneeId: z.string().uuid(),
});

const escalateSchema = z.object({
  reason: z.string().min(1),
  destination: z.string().optional(),
});

// ---- Helpers ----

// Map sortBy field names to Prisma column names
const SORT_FIELD_MAP: Record<string, string> = {
  priorityScore: 'priorityScore',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  submittedAt: 'submittedAt',
  riskLevel: 'riskLevel',
  status: 'status',
  referenceNumber: 'referenceNumber',
};

// ---- Routes ----

// GET /api/v1/complaints -- List complaints with filtering & pagination
complaintRoutes.get('/', async (req: Request, res: Response) => {
  const filters = complaintFiltersSchema.parse(normalizeQuery(req.query as any));
  const tenantId = req.tenantId!;

  // Build where clause with tenant isolation
  const where: Prisma.ComplaintWhereInput = { tenantId };

  if (filters.status) where.status = filters.status;
  if (filters.riskLevel) where.riskLevel = filters.riskLevel;
  if (filters.category) where.category = filters.category;
  if (filters.industry) where.industry = filters.industry;
  if (filters.assignedTo) where.assignedToId = filters.assignedTo;
  if (filters.routingDestination) where.routingDestination = filters.routingDestination;
  if (filters.minPriorityScore) where.priorityScore = { gte: filters.minPriorityScore };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.dateFrom);
    if (filters.dateTo) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.dateTo);
  }

  if (filters.search) {
    where.OR = [
      { referenceNumber: { contains: filters.search, mode: 'insensitive' } },
      { rawText: { contains: filters.search, mode: 'insensitive' } },
      { summary: { contains: filters.search, mode: 'insensitive' } },
      { complainantEmail: { contains: filters.search, mode: 'insensitive' } },
      { complainantFirstName: { contains: filters.search, mode: 'insensitive' } },
      { complainantLastName: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // Validate sort field
  const sortField = SORT_FIELD_MAP[filters.sortBy] || 'createdAt';
  const orderBy = { [sortField]: filters.sortOrder };

  const [complaints, totalCount] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        business: { select: { id: true, name: true, abn: true, industry: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.complaint.count({ where }),
  ]);

  res.json({
    success: true,
    data: complaints,
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / filters.pageSize),
    },
  });
});

// GET /api/v1/complaints/:id -- Get complaint detail
complaintRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;

  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
    include: {
      business: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      team: { select: { id: true, name: true } },
      evidence: true,
      aiOutputs: { orderBy: { createdAt: 'desc' } },
      communications: { orderBy: { createdAt: 'desc' } },
      timeline: { orderBy: { createdAt: 'desc' }, take: 50 },
      escalations: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  res.json({
    success: true,
    data: complaint,
  });
});

// PATCH /api/v1/complaints/:id -- Update complaint
// Only supervisors, admins, or the assigned officer can update
complaintRoutes.patch('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRole = req.userRole!;
  const body = complaintUpdateSchema.parse(req.body);

  // Fetch existing complaint with tenant isolation
  const existing = await prisma.complaint.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // RBAC: only supervisor/admin or the assigned officer can update
  const isSupervisorOrAdmin = userRole === 'supervisor' || userRole === 'admin';
  const isAssignedOfficer = existing.assignedToId === userId;

  if (!isSupervisorOrAdmin && !isAssignedOfficer) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to update this complaint');
  }

  // Build update data, filtering out undefined fields
  const updateData: Prisma.ComplaintUpdateInput = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.category !== undefined) updateData.category = body.category;
  if (body.riskLevel !== undefined) updateData.riskLevel = body.riskLevel;
  if (body.priorityScore !== undefined) updateData.priorityScore = body.priorityScore;
  if (body.routingDestination !== undefined) updateData.routingDestination = body.routingDestination;
  if (body.summary !== undefined) updateData.summary = body.summary;
  if (body.productService !== undefined) updateData.productService = body.productService;

  const updated = await prisma.complaint.update({
    where: { id },
    data: updateData,
  });

  // Timeline event for status changes
  if (body.status && body.status !== existing.status) {
    await prisma.complaintEvent.create({
      data: {
        complaintId: id,
        eventType: 'status_change',
        description: `Status changed from ${existing.status} to ${body.status}`,
        metadata: { fromStatus: existing.status, toStatus: body.status },
        createdBy: userId,
      },
    });
  }

  // Audit log
  await writeAuditLog({
    tenantId,
    userId,
    action: 'complaint.updated',
    entity: 'Complaint',
    entityId: id,
    oldValues: {
      status: existing.status,
      category: existing.category,
      riskLevel: existing.riskLevel,
      priorityScore: existing.priorityScore,
    },
    newValues: body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  logger.info('Complaint updated', { complaintId: id, userId, changes: Object.keys(body) });

  res.json({
    success: true,
    data: updated,
  });
});

// POST /api/v1/complaints/:id/assign -- Assign complaint to officer
complaintRoutes.post('/:id/assign', authorize('supervisor', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const body = assignSchema.parse(req.body);

  // Verify complaint exists in tenant
  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // Verify assignee exists in same tenant
  const assignee = await prisma.user.findFirst({
    where: { id: body.assigneeId, tenantId, isActive: true },
  });

  if (!assignee) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Assignee not found in this organisation');
  }

  const previousAssignee = complaint.assignedToId;

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      assignedToId: body.assigneeId,
      status: complaint.status === 'triaged' ? 'assigned' : complaint.status,
    },
  });

  // Create task for the assigned officer
  await prisma.task.create({
    data: {
      complaintId: id,
      assignedTo: body.assigneeId,
      title: `Review complaint ${complaint.referenceNumber}`,
      type: 'review',
      priority: complaint.priorityScore ? Math.round(complaint.priorityScore * 10) : 5,
    },
  });

  // Timeline event
  await prisma.complaintEvent.create({
    data: {
      complaintId: id,
      eventType: 'assignment',
      description: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
      metadata: { previousAssignee, newAssignee: body.assigneeId, assignedBy: userId },
      createdBy: userId,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'complaint.assigned',
    entity: 'Complaint',
    entityId: id,
    oldValues: { assignedToId: previousAssignee },
    newValues: { assignedToId: body.assigneeId },
  });

  logger.info('Complaint assigned', { complaintId: id, assigneeId: body.assigneeId, assignedBy: userId });

  res.json({
    success: true,
    data: { complaintId: id, assignedTo: body.assigneeId, assigneeName: `${assignee.firstName} ${assignee.lastName}` },
  });
});

// POST /api/v1/complaints/:id/escalate -- Escalate complaint
complaintRoutes.post('/:id/escalate', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const body = escalateSchema.parse(req.body);

  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // RBAC: assigned officer, supervisor, or admin can escalate
  const isSupervisorOrAdmin = req.userRole === 'supervisor' || req.userRole === 'admin';
  const isAssignedOfficer = complaint.assignedToId === userId;

  if (!isSupervisorOrAdmin && !isAssignedOfficer) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to escalate this complaint');
  }

  const previousStatus = complaint.status;

  // Create escalation record
  await prisma.escalation.create({
    data: {
      complaintId: id,
      fromStatus: previousStatus,
      toStatus: 'escalated',
      reason: body.reason,
      escalatedBy: userId,
    },
  });

  // Update complaint status and routing
  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status: 'escalated',
      routingDestination: body.destination || 'line_2_investigation',
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: id,
      eventType: 'escalation',
      description: `Escalated: ${body.reason}`,
      metadata: { fromStatus: previousStatus, toStatus: 'escalated', reason: body.reason, destination: body.destination },
      createdBy: userId,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'complaint.escalated',
    entity: 'Complaint',
    entityId: id,
    oldValues: { status: previousStatus },
    newValues: { status: 'escalated', reason: body.reason },
  });

  logger.info('Complaint escalated', { complaintId: id, reason: body.reason, userId });

  res.json({
    success: true,
    data: { complaintId: id, escalatedTo: body.destination || 'line_2_investigation', reason: body.reason },
  });
});

// GET /api/v1/complaints/:id/timeline -- Get complaint event timeline
complaintRoutes.get('/:id/timeline', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;

  // Verify complaint belongs to tenant
  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  const events = await prisma.complaintEvent.findMany({
    where: { complaintId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  res.json({
    success: true,
    data: events,
  });
});

// GET /api/v1/complaints/:id/similar -- Find similar complaints
complaintRoutes.get('/:id/similar', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;

  // Verify complaint belongs to tenant
  const complaint = await prisma.complaint.findFirst({
    where: { id, tenantId },
    select: { id: true, category: true, industry: true, businessId: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // TODO: Use pgvector similarity search when embeddings are available
  // For now, find complaints with same category/industry in the same tenant
  const similar = await prisma.complaint.findMany({
    where: {
      tenantId,
      id: { not: id },
      OR: [
        { category: complaint.category ?? undefined },
        { industry: complaint.industry ?? undefined },
        { businessId: complaint.businessId ?? undefined },
      ],
    },
    select: {
      id: true,
      referenceNumber: true,
      summary: true,
      category: true,
      riskLevel: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  res.json({
    success: true,
    data: similar,
  });
});
