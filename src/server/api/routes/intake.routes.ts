// ============================================================================
// Intake Routes – Public complaint submission
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { rateLimit } from '../middleware/rate-limiter';
import { createLogger } from '../../utils/logger';
import { getTriageQueue, QUEUES } from '../../services/queue/worker';
import type { TriageJobData } from '../../services/queue/worker';
import { getAiService } from '../../services/ai/ai-service';

const logger = createLogger('intake-routes');

export const intakeRoutes = Router();

// Rate limiting for public endpoints
const submitRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 10, message: 'Too many complaint submissions. Please try again later.' });
const guidanceRateLimit = rateLimit({ windowMs: 60 * 1000, maxRequests: 5, message: 'Too many AI guidance requests. Please try again later.' });
const webhookRateLimit = rateLimit({ windowMs: 60 * 1000, maxRequests: 10, message: 'Webhook rate limit exceeded.' });

// ---- Validation Schemas ----

const complaintSubmissionSchema = z.object({
  tenantSlug: z.string().min(1),
  complainant: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      suburb: z.string().optional(),
      state: z.string().optional(),
      postcode: z.string().optional(),
    }).optional(),
  }),
  business: z.object({
    name: z.string().min(1),
    abn: z.string().optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
  }),
  complaint: z.object({
    rawText: z.string().min(10),
    category: z.string().optional(),
    productService: z.string().optional(),
    monetaryValue: z.number().optional(),
    incidentDate: z.string().optional(),
  }),
});

const aiGuidanceSchema = z.object({
  tenantSlug: z.string().min(1),
  text: z.string().min(1),
  currentData: z.record(z.unknown()).optional(),
});

const webhookIntakeSchema = z.object({
  source: z.string(),
  payload: z.record(z.unknown()),
  tenantApiKey: z.string(),
});

// ---- Routes ----

// POST /api/v1/intake/submit – Submit a complaint via the public portal
intakeRoutes.post('/submit', submitRateLimit, async (req: Request, res: Response) => {
  const body = complaintSubmissionSchema.parse(req.body);

  // 1. Resolve tenant from slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.tenantSlug },
  });

  if (!tenant || !tenant.isActive) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'The specified regulator portal was not found');
  }

  const tenantId = tenant.id;

  // 2. Find or create business record
  let business = null;
  if (body.business.abn) {
    business = await prisma.business.findUnique({
      where: { tenantId_abn: { tenantId, abn: body.business.abn } },
    });
  }

  if (!business) {
    business = await prisma.business.create({
      data: {
        tenantId,
        name: body.business.name,
        abn: body.business.abn,
        website: body.business.website,
        industry: body.business.industry,
        complaintCount: 1,
      },
    });
  } else {
    business = await prisma.business.update({
      where: { id: business.id },
      data: { complaintCount: { increment: 1 } },
    });
  }

  // 3. Create complaint record
  const referenceNumber = `CMP-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

  const complaint = await prisma.complaint.create({
    data: {
      tenantId,
      referenceNumber,
      status: 'submitted',
      channel: 'portal',
      rawText: body.complaint.rawText,
      complainantFirstName: body.complainant.firstName,
      complainantLastName: body.complainant.lastName,
      complainantEmail: body.complainant.email,
      complainantPhone: body.complainant.phone,
      complainantAddress: body.complainant.address ?? undefined,
      businessId: business.id,
      category: body.complaint.category,
      industry: body.business.industry,
      productService: body.complaint.productService,
      monetaryValue: body.complaint.monetaryValue
        ? new Decimal(body.complaint.monetaryValue)
        : undefined,
      incidentDate: body.complaint.incidentDate
        ? new Date(body.complaint.incidentDate)
        : undefined,
      submittedAt: new Date(),
    },
  });

  // 4. Create timeline event
  await prisma.complaintEvent.create({
    data: {
      complaintId: complaint.id,
      eventType: 'status_change',
      description: 'Complaint submitted via public portal',
      metadata: { fromStatus: null, toStatus: 'submitted', channel: 'portal' },
    },
  });

  // 5. Audit log
  await writeAuditLog({
    tenantId,
    action: 'complaint.submitted',
    entity: 'Complaint',
    entityId: complaint.id,
    newValues: {
      referenceNumber,
      businessName: body.business.name,
      category: body.complaint.category,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  logger.info('Complaint submitted', {
    complaintId: complaint.id,
    referenceNumber,
    tenantId,
  });

  // Queue triage job if Redis/BullMQ is available
  const triageQueue = getTriageQueue();
  if (triageQueue) {
    await triageQueue.add(QUEUES.COMPLAINT_TRIAGE, {
      complaintId: complaint.id,
      tenantId,
      rawText: body.complaint.rawText,
      businessId: business.id,
    } satisfies TriageJobData);
    logger.info('Triage job queued', { complaintId: complaint.id, tenantId });
  } else {
    logger.warn('Triage queue not available, complaint requires manual triage', {
      complaintId: complaint.id,
      tenantId,
    });
  }

  res.status(201).json({
    success: true,
    data: {
      referenceNumber,
      complaintId: complaint.id,
      message: 'Your complaint has been received and will be reviewed. You will receive updates at the email address provided.',
    },
  });
});

// POST /api/v1/intake/ai-guidance – Get AI guidance during complaint entry
intakeRoutes.post('/ai-guidance', guidanceRateLimit, async (req: Request, res: Response) => {
  const body = aiGuidanceSchema.parse(req.body);

  // Resolve tenant to validate the slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.tenantSlug },
  });

  if (!tenant || !tenant.isActive) {
    throw new AppError(404, 'TENANT_NOT_FOUND', 'The specified regulator portal was not found');
  }

  const aiService = getAiService();
  const { result, record } = await aiService.detectMissingData(body.text, body.currentData ?? {});

  const parsed = result as {
    extractedData: Record<string, unknown>;
    missingFields: Array<{ field: string; importance?: string; question: string }>;
    followUpQuestions: string[];
    completenessScore?: number;
    confidence: number;
  };

  res.json({
    success: true,
    data: {
      extractedData: parsed.extractedData,
      missingFields: parsed.missingFields,
      followUpQuestions: parsed.followUpQuestions,
      completenessScore: parsed.completenessScore ?? null,
      confidence: parsed.confidence,
      model: record.model,
    },
  });
});

// POST /api/v1/intake/webhook – Receive complaints from external systems
intakeRoutes.post('/webhook', webhookRateLimit, async (req: Request, res: Response) => {
  const body = webhookIntakeSchema.parse(req.body);

  // 1. Validate tenant API key by looking up a tenant with matching settings
  // For now, the API key is stored in tenant.settings as JSON
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
  });

  const tenant = tenants.find((t) => {
    const settings = t.settings as Record<string, unknown>;
    return settings?.apiKey === body.tenantApiKey;
  });

  if (!tenant) {
    throw new AppError(401, 'INVALID_API_KEY', 'Invalid tenant API key');
  }

  // 2. Parse payload based on source
  const payload = body.payload as Record<string, unknown>;
  const rawText = (payload.complaintText as string) || (payload.description as string) || JSON.stringify(payload);

  // 3. Create complaint
  const referenceNumber = `CMP-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

  const complaint = await prisma.complaint.create({
    data: {
      tenantId: tenant.id,
      referenceNumber,
      status: 'submitted',
      channel: 'webhook',
      rawText,
      complainantFirstName: (payload.firstName as string) || 'Unknown',
      complainantLastName: (payload.lastName as string) || 'Unknown',
      complainantEmail: (payload.email as string) || 'unknown@webhook.intake',
      submittedAt: new Date(),
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: complaint.id,
      eventType: 'status_change',
      description: `Complaint received via webhook (source: ${body.source})`,
      metadata: { fromStatus: null, toStatus: 'submitted', channel: 'webhook', source: body.source },
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    action: 'complaint.webhook_received',
    entity: 'Complaint',
    entityId: complaint.id,
    newValues: { referenceNumber, source: body.source },
  });

  logger.info('Webhook complaint received', {
    complaintId: complaint.id,
    referenceNumber,
    source: body.source,
    tenantId: tenant.id,
  });

  // Queue triage job if Redis/BullMQ is available
  const webhookTriageQueue = getTriageQueue();
  if (webhookTriageQueue) {
    await webhookTriageQueue.add(QUEUES.COMPLAINT_TRIAGE, {
      complaintId: complaint.id,
      tenantId: tenant.id,
      rawText,
    } satisfies TriageJobData);
    logger.info('Triage job queued for webhook complaint', { complaintId: complaint.id });
  } else {
    logger.warn('Triage queue not available, webhook complaint requires manual triage', {
      complaintId: complaint.id,
      tenantId: tenant.id,
    });
  }

  res.status(202).json({
    success: true,
    data: {
      referenceNumber,
      complaintId: complaint.id,
      message: 'Complaint received and queued for processing',
    },
  });
});
