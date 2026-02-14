// ============================================================================
// Intake Routes – Public complaint submission
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const intakeRoutes = Router();

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
intakeRoutes.post('/submit', async (req: Request, res: Response) => {
  const body = complaintSubmissionSchema.parse(req.body);

  const referenceNumber = `CMP-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;

  // TODO:
  // 1. Resolve tenant from slug
  // 2. Find or create business record
  // 3. Create complaint record
  // 4. Queue triage job
  // 5. Send confirmation email

  res.status(201).json({
    success: true,
    data: {
      referenceNumber,
      message: 'Your complaint has been received and will be reviewed. You will receive updates at the email address provided.',
    },
  });
});

// POST /api/v1/intake/ai-guidance – Get AI guidance during complaint entry
intakeRoutes.post('/ai-guidance', async (req: Request, res: Response) => {
  const body = aiGuidanceSchema.parse(req.body);

  // TODO: Call AI service to analyze current text and suggest:
  // - Missing information
  // - Clarifying questions
  // - Detected category
  // - Extracted structured data

  // Placeholder response demonstrating expected shape
  res.json({
    success: true,
    data: {
      extractedData: {
        businessName: null,
        category: null,
        monetaryValue: null,
        incidentDate: null,
      },
      missingFields: [
        { field: 'businessName', question: 'What is the name of the business you are complaining about?' },
        { field: 'incidentDate', question: 'When did this issue first occur?' },
      ],
      followUpQuestions: [],
      confidence: 0,
    },
  });
});

// POST /api/v1/intake/webhook – Receive complaints from external systems
intakeRoutes.post('/webhook', async (req: Request, res: Response) => {
  const body = webhookIntakeSchema.parse(req.body);

  // TODO:
  // 1. Validate tenant API key
  // 2. Parse payload based on source schema mapping
  // 3. Create complaint
  // 4. Queue for triage

  res.status(202).json({
    success: true,
    data: { message: 'Complaint received and queued for processing' },
  });
});
