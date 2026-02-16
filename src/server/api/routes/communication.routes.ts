// ============================================================================
// Communication Routes -- Drafts, templates, sending
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('communication-routes');

export const communicationRoutes = Router();

communicationRoutes.use(authenticate);
communicationRoutes.use(requireTenant);

const draftRequestSchema = z.object({
  complaintId: z.string().uuid(),
  type: z.enum(['response_to_complainant', 'notice_to_business', 'escalation_notice']),
});

const sendSchema = z.object({
  communicationId: z.string().uuid(),
});

// POST /api/v1/communications/draft -- Generate AI draft
communicationRoutes.post('/draft', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const body = draftRequestSchema.parse(req.body);

  // Verify complaint belongs to tenant
  const complaint = await prisma.complaint.findFirst({
    where: { id: body.complaintId, tenantId },
    include: { business: { select: { name: true } } },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  // TODO: Call AI service to generate draft based on complaint context
  // const aiService = getAiService();
  // const { result, record } = await aiService.draftComplainantResponse(...)

  // Create communication record as draft
  const communication = await prisma.communication.create({
    data: {
      complaintId: body.complaintId,
      type: body.type === 'response_to_complainant' ? 'email_to_complainant'
        : body.type === 'notice_to_business' ? 'email_to_business'
        : 'internal_note',
      direction: 'outbound',
      subject: `Regarding your complaint reference ${complaint.referenceNumber}`,
      body: 'This is an AI-generated draft. Replace with actual AI output.',
      isAiDrafted: true,
      createdBy: userId,
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: body.complaintId,
      eventType: 'communication',
      description: `Draft ${body.type} created`,
      metadata: { communicationId: communication.id, type: body.type, isAiDrafted: true },
      createdBy: userId,
    },
  });

  res.json({
    success: true,
    data: {
      communicationId: communication.id,
      complaintId: body.complaintId,
      type: body.type,
      subject: communication.subject,
      body: communication.body,
      isAiDrafted: true,
      confidence: 0.85,
    },
  });
});

// POST /api/v1/communications/send -- Approve and send
communicationRoutes.post('/send', authorize('complaint_officer', 'supervisor', 'admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const body = sendSchema.parse(req.body);

  // Find the communication and verify it belongs to this tenant via the complaint
  const communication = await prisma.communication.findUnique({
    where: { id: body.communicationId },
    include: { complaint: { select: { tenantId: true, referenceNumber: true } } },
  });

  if (!communication || communication.complaint.tenantId !== tenantId) {
    throw new AppError(404, 'NOT_FOUND', 'Communication not found');
  }

  if (communication.sentAt) {
    throw new AppError(400, 'ALREADY_SENT', 'This communication has already been sent');
  }

  // Mark as approved and sent
  const now = new Date();
  await prisma.communication.update({
    where: { id: body.communicationId },
    data: {
      isApproved: true,
      approvedBy: userId,
      sentAt: now,
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: communication.complaintId,
      eventType: 'communication',
      description: `Communication sent (${communication.type})`,
      metadata: { communicationId: body.communicationId, approvedBy: userId },
      createdBy: userId,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'communication.sent',
    entity: 'Communication',
    entityId: body.communicationId,
    newValues: { approvedBy: userId, sentAt: now.toISOString() },
  });

  logger.info('Communication sent', { communicationId: body.communicationId, userId });

  // TODO: Actually send email via SMTP when configured

  res.json({
    success: true,
    data: { communicationId: body.communicationId, sentAt: now.toISOString() },
  });
});

// GET /api/v1/communications/templates -- List communication templates
communicationRoutes.get('/templates', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const templates = await prisma.communicationTemplate.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: templates,
  });
});
