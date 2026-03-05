// ============================================================================
// Communication Routes – Drafts, templates, sending
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';

export const communicationRoutes = Router();

communicationRoutes.use(authenticate);
communicationRoutes.use(requireTenant);

const draftRequestSchema = z.object({
  complaintId: z.string().uuid(),
  type: z.enum(['response_to_complainant', 'notice_to_business', 'escalation_notice']),
});

// POST /api/v1/communications/draft – Generate AI draft
communicationRoutes.post('/draft', async (req: Request, res: Response) => {
  const body = draftRequestSchema.parse(req.body);

  // TODO: Call AI service to generate draft based on complaint context
  res.json({
    success: true,
    data: {
      complaintId: body.complaintId,
      type: body.type,
      subject: '[Draft] Regarding your complaint reference CMP-XXXX',
      body: 'This is an AI-generated draft. Replace with actual AI output.',
      isAiDrafted: true,
      confidence: 0.85,
    },
  });
});

// POST /api/v1/communications/send – Approve and send
communicationRoutes.post('/send', async (req: Request, res: Response) => {
  const { communicationId } = req.body;

  // TODO: Mark as approved, send email, log audit event
  res.json({
    success: true,
    data: { communicationId, sentAt: new Date().toISOString() },
  });
});

// GET /api/v1/communications/templates – List communication templates
communicationRoutes.get('/templates', async (req: Request, res: Response) => {
  // TODO: Fetch templates for tenant
  res.json({
    success: true,
    data: [],
  });
});
