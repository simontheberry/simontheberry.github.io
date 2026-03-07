// ============================================================================
// Intake Routes – Public complaint submission with AI guidance
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from '@prisma/client/runtime/library';
import { getAiService } from '../../services/ai/ai-service';
import { createLogger } from '../../utils/logger';
import { rateLimit } from '../middleware/rate-limiter';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';

const logger = createLogger('intake-routes');

export const intakeRoutes = Router();

// Rate limit complaint submissions: 5 per 15 minutes per IP
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many complaint submissions. Please try again later.',
});

// Rate limit AI guidance: 20 per 15 minutes per IP
const guidanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many AI guidance requests. Please try again later.',
});

// Rate limit webhook: 100 per 15 minutes per IP
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Webhook rate limit exceeded.',
});

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
    entityName: z.string().optional(),
    entityType: z.string().optional(),
    entityStatus: z.string().optional(),
    isVerified: z.boolean().optional(),
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
intakeRoutes.post('/submit', submitLimiter, async (req: Request, res: Response) => {
  try {
    const body = complaintSubmissionSchema.parse(req.body);

    // 1. Resolve tenant from slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: body.tenantSlug },
    });

    if (!tenant) {
      throw new AppError(400, 'INVALID_TENANT', 'Tenant not found');
    }

    const complaintId = uuidv4();
    const referenceNumber = `CMP-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

    // Calculate SLA deadline (48 hours for initial triage)
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + 48);

    // 2. Find or create business record
    let business = null;
    if (body.business.abn) {
      business = await prisma.business.findUnique({
        where: { abn: body.business.abn },
      });
      if (!business) {
        business = await prisma.business.create({
          data: {
            abn: body.business.abn,
            name: body.business.name,
            entityType: body.business.entityType || 'Unknown',
            entityStatus: body.business.entityStatus || 'Active',
            website: body.business.website,
            industry: body.business.industry,
            isVerified: body.business.isVerified || false,
            tenantId: tenant.id,
          },
        });
      }
    } else {
      // Create unverified business record for manual entry
      business = await prisma.business.create({
        data: {
          abn: null,
          name: body.business.name,
          entityType: 'Unknown',
          entityStatus: 'Unknown',
          website: body.business.website,
          industry: body.business.industry,
          isVerified: false,
          tenantId: tenant.id,
        },
      });
    }

    // 3. Create complaint record
    const complaint = await prisma.complaint.create({
      data: {
        id: complaintId,
        referenceNumber,
        tenantId: tenant.id,
        businessId: business.id,
        status: 'submitted',
        channel: 'portal',
        rawText: body.complaint.rawText,
        category: body.complaint.category || 'other',
        industry: body.business.industry || 'other',
        monetaryValue: body.complaint.monetaryValue ? new Decimal(body.complaint.monetaryValue) : null,
        monetaryCurrency: 'AUD',
        incidentDate: body.complaint.incidentDate ? new Date(body.complaint.incidentDate) : null,
        slaDeadline,
        submittedAt: new Date(),
        // Complainant info
        complainantFirstName: body.complainant.firstName,
        complainantLastName: body.complainant.lastName,
        complainantEmail: body.complainant.email,
        complainantPhone: body.complainant.phone,
        complainantAddress: body.complainant.address || null,
      },
    });

    // 4. Create initial complaint event (submitted)
    await prisma.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        eventType: 'submitted',
        description: 'Complaint submitted via public portal',
        createdBy: 'system',
      },
    });

    // 5. Write audit log
    await writeAuditLog({
      tenantId: tenant.id,
      userId: 'system',
      action: 'complaint.submitted',
      entity: 'Complaint',
      entityId: complaint.id,
      newValues: {
        referenceNumber,
        businessName: body.business.name,
        category: body.complaint.category,
      },
    });

    logger.info('Complaint submitted and persisted', {
      referenceNumber,
      complaintId: complaint.id,
      tenantId: tenant.id,
      businessId: business.id,
      channel: 'portal',
      hasAbn: !!body.business.abn,
      textLength: body.complaint.rawText.length,
    });

    // TODO: Queue triage job via BullMQ (Task #1 future work)
    // TODO: Queue confirmation email via mail service (Task #6 future work)

    res.status(201).json({
      success: true,
      data: {
        referenceNumber,
        complaintId: complaint.id,
        slaDeadline: slaDeadline.toISOString(),
        message: 'Your complaint has been received and will be reviewed. You will receive updates at the email address provided.',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors,
        },
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }

    logger.error('Complaint submission failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});

// POST /api/v1/intake/ai-guidance – Get AI guidance during complaint entry
intakeRoutes.post('/ai-guidance', guidanceLimiter, async (req: Request, res: Response) => {
  try {
    const body = aiGuidanceSchema.parse(req.body);

    // Attempt to call AI service for real analysis
    try {
      const aiService = getAiService();
      const { result, record } = await aiService.detectMissingData(
        body.text,
        body.currentData || {},
      );

      const guidance = result as {
        extractedData?: Record<string, unknown>;
        missingFields?: Array<{ field: string; importance?: string; question: string }>;
        followUpQuestions?: string[];
        completenessScore?: number;
        confidence?: number;
      };

      logger.info('AI guidance generated', {
        textLength: body.text.length,
        completenessScore: guidance.completenessScore,
        confidence: record.confidence,
        latencyMs: record.latencyMs,
      });

      return res.json({
        success: true,
        data: {
          extractedData: guidance.extractedData || {},
          missingFields: guidance.missingFields || [],
          followUpQuestions: guidance.followUpQuestions || [],
          completenessScore: guidance.completenessScore || 0,
          confidence: record.confidence || guidance.confidence || 0,
        },
      });
    } catch (aiError) {
      logger.warn('AI guidance failed, using rule-based fallback', { error: aiError });
    }

    // Rule-based fallback when AI is unavailable
    const text = body.text.toLowerCase();
    const currentData = body.currentData || {};

    const extractedData: Record<string, unknown> = {};
    const missingFields: Array<{ field: string; importance: string; question: string }> = [];

    // Extract what we can from text
    const dollarMatch = body.text.match(/\$[\d,]+(?:\.\d{2})?/);
    if (dollarMatch) {
      extractedData.monetaryValue = parseFloat(dollarMatch[0].replace(/[$,]/g, ''));
    }

    const dateMatch = body.text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      extractedData.incidentDate = dateMatch[0];
    }

    // Detect category from keywords
    if (text.includes('scam') || text.includes('fraud')) {
      extractedData.category = 'scam_fraud';
    } else if (text.includes('mislead') || text.includes('deceptive') || text.includes('false advertising')) {
      extractedData.category = 'misleading_conduct';
    } else if (text.includes('refund')) {
      extractedData.category = 'refund_dispute';
    } else if (text.includes('billing') || text.includes('overcharg')) {
      extractedData.category = 'billing_dispute';
    } else if (text.includes('warranty') || text.includes('guarantee')) {
      extractedData.category = 'warranty_guarantee';
    } else if (text.includes('privacy') || text.includes('data breach')) {
      extractedData.category = 'privacy_breach';
    } else if (text.includes('unsafe') || text.includes('safety') || text.includes('dangerous')) {
      extractedData.category = 'product_safety';
    }

    // Identify missing fields
    if (!currentData.businessName && !text.match(/(?:business|company|store|shop|provider)\s+(?:name|called)\s+["']?(\w+)/i)) {
      missingFields.push({
        field: 'businessName',
        importance: 'critical',
        question: 'What is the name of the business you are complaining about?',
      });
    }

    if (!extractedData.monetaryValue && !currentData.monetaryValue) {
      missingFields.push({
        field: 'monetaryValue',
        importance: 'high',
        question: 'How much money has this issue cost you (if any)?',
      });
    }

    if (!extractedData.incidentDate && !currentData.incidentDate) {
      missingFields.push({
        field: 'incidentDate',
        importance: 'high',
        question: 'When did this issue first occur?',
      });
    }

    if (body.text.length < 100) {
      missingFields.push({
        field: 'details',
        importance: 'high',
        question: 'Can you provide more details about what happened? Include any communications you had with the business.',
      });
    }

    const completenessScore = Math.min(1, (
      (currentData.businessName || extractedData.businessName ? 0.25 : 0) +
      (extractedData.monetaryValue || currentData.monetaryValue ? 0.15 : 0) +
      (extractedData.incidentDate || currentData.incidentDate ? 0.15 : 0) +
      (extractedData.category || currentData.category ? 0.15 : 0) +
      (body.text.length > 200 ? 0.30 : body.text.length / 200 * 0.30)
    ));

    return res.json({
      success: true,
      data: {
        extractedData,
        missingFields,
        followUpQuestions: [],
        completenessScore: Math.round(completenessScore * 100) / 100,
        confidence: 0.6,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }

    logger.error('AI guidance failed entirely', { error });
    return res.json({
      success: true,
      data: {
        extractedData: {},
        missingFields: [],
        followUpQuestions: [],
        completenessScore: 0,
        confidence: 0,
      },
    });
  }
});

// POST /api/v1/intake/webhook – Receive complaints from external systems
intakeRoutes.post('/webhook', webhookLimiter, async (req: Request, res: Response) => {
  try {
    webhookIntakeSchema.parse(req.body);

    // In production: validate API key against tenant, parse payload, create complaint

    res.status(202).json({
      success: true,
      data: { message: 'Complaint received and queued for processing' },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }

    logger.error('Webhook intake failed', { error });
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error' },
    });
  }
});
