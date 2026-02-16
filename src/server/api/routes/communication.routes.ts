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
import { getAiService } from '../../services/ai/ai-service';
import { getMailService } from '../../services/mail/mail.service';

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

  const aiService = getAiService();
  let subject: string;
  let draftBody: string;
  let confidence = 0;
  let aiOutputRecord = null;

  if (body.type === 'response_to_complainant') {
    const { result, record } = await aiService.draftComplainantResponse(
      complaint.summary || complaint.rawText.slice(0, 500),
      complaint.category || 'general',
      complaint.riskLevel || 'medium',
    );
    const parsed = result as { subject: string; body: string; confidence: number };
    subject = parsed.subject;
    draftBody = parsed.body;
    confidence = parsed.confidence ?? 0;
    aiOutputRecord = record;
  } else if (body.type === 'notice_to_business') {
    if (!complaint.business?.name) {
      throw new AppError(400, 'MISSING_BUSINESS', 'Complaint has no associated business for a business notice');
    }
    const { result, record } = await aiService.draftBusinessNotice(
      complaint.summary || complaint.rawText.slice(0, 500),
      complaint.business.name,
      complaint.category || 'general',
      complaint.category || 'consumer complaint',
    );
    const parsed = result as { subject: string; body: string; confidence: number };
    subject = parsed.subject;
    draftBody = parsed.body;
    confidence = parsed.confidence ?? 0;
    aiOutputRecord = record;
  } else {
    // Escalation notice -- no AI template yet, use a standard subject
    subject = `Escalation: Complaint ${complaint.referenceNumber}`;
    draftBody = `This complaint has been escalated for further review.\n\nReference: ${complaint.referenceNumber}\nCategory: ${complaint.category || 'Unclassified'}\nRisk Level: ${complaint.riskLevel || 'Pending assessment'}`;
    confidence = 1.0;
  }

  // Store AI output for audit trail if AI was used
  if (aiOutputRecord) {
    await prisma.aiOutput.create({
      data: {
        complaintId: body.complaintId,
        outputType: aiOutputRecord.outputType,
        model: aiOutputRecord.model,
        prompt: aiOutputRecord.prompt,
        rawOutput: aiOutputRecord.rawOutput,
        parsedOutput: aiOutputRecord.parsedOutput as Record<string, unknown>,
        confidence: aiOutputRecord.confidence,
        reasoning: aiOutputRecord.reasoning,
        tokenUsage: aiOutputRecord.tokenUsage,
        latencyMs: aiOutputRecord.latencyMs,
      },
    });
  }

  // Create communication record as draft
  const communication = await prisma.communication.create({
    data: {
      complaintId: body.complaintId,
      type: body.type === 'response_to_complainant' ? 'email_to_complainant'
        : body.type === 'notice_to_business' ? 'email_to_business'
        : 'internal_note',
      direction: 'outbound',
      subject,
      body: draftBody,
      isAiDrafted: !!aiOutputRecord,
      createdBy: userId,
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: body.complaintId,
      eventType: 'communication',
      description: `Draft ${body.type} created`,
      metadata: {
        communicationId: communication.id,
        type: body.type,
        isAiDrafted: !!aiOutputRecord,
        model: aiOutputRecord?.model,
        confidence,
      },
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
      isAiDrafted: !!aiOutputRecord,
      confidence,
      model: aiOutputRecord?.model,
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

  // Get recipient based on communication type
  let recipientEmail: string | null = null;

  if (communication.type === 'email_to_complainant') {
    // Fetch complainant email from complaint
    const complaint = await prisma.complaint.findUnique({
      where: { id: communication.complaintId },
      select: { complainantEmail: true },
    });
    recipientEmail = complaint?.complainantEmail || null;
  } else if (communication.type === 'email_to_business') {
    // Fetch business email from complaint's business
    const complaint = await prisma.complaint.findUnique({
      where: { id: communication.complaintId },
      include: { business: { select: { email: true } } },
    });
    recipientEmail = complaint?.business?.email || null;
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

  let emailSent = false;
  let emailError: string | null = null;

  // Attempt to send email if we have a recipient
  if (recipientEmail && (communication.type === 'email_to_complainant' || communication.type === 'email_to_business')) {
    const mailService = getMailService();
    const result = await mailService.sendCommunication(
      recipientEmail,
      communication.subject || 'Communication from Regulatory Authority',
      communication.body,
      communication.type as 'email_to_complainant' | 'email_to_business',
    );

    emailSent = result.success;
    emailError = result.error || null;

    if (!result.success) {
      logger.warn('Email sending failed', {
        communicationId: body.communicationId,
        recipientEmail,
        error: result.error,
      });
    }
  }

  await prisma.complaintEvent.create({
    data: {
      complaintId: communication.complaintId,
      eventType: 'communication',
      description: `Communication sent (${communication.type})${emailSent ? ' - email delivered' : emailError ? ` - email failed: ${emailError}` : ''}`,
      metadata: {
        communicationId: body.communicationId,
        approvedBy: userId,
        emailSent,
        emailError,
        recipientEmail: recipientEmail || undefined,
      },
      createdBy: userId,
    },
  });

  await writeAuditLog({
    tenantId,
    userId,
    action: 'communication.sent',
    entity: 'Communication',
    entityId: body.communicationId,
    newValues: {
      approvedBy: userId,
      sentAt: now.toISOString(),
      emailSent,
      emailError,
    },
  });

  logger.info('Communication sent', {
    communicationId: body.communicationId,
    userId,
    emailSent,
    recipientEmail,
  });

  res.json({
    success: true,
    data: {
      communicationId: body.communicationId,
      sentAt: now.toISOString(),
      emailSent,
      emailError,
    },
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
