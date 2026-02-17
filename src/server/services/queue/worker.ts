// ============================================================================
// Background Job Worker
// Processes triage, systemic detection, and SLA monitoring jobs
// ============================================================================

import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { createLogger } from '../../utils/logger';
import { config } from '../../config';
import { TriageEngine } from '../triage/triage-engine';
import { SystemicDetectionEngine } from '../systemic/detection-engine';
import { Line1Handler } from '../communications/line1-handler';

const logger = createLogger('queue-worker');

// ---- Job Data Interfaces ----

export interface TriageJobData {
  complaintId: string;
  tenantId: string;
  rawText: string;
  businessId?: string;
}

export interface SystemicJobData {
  complaintId: string;
  tenantId: string;
  rawText: string;
}

export interface SlaCheckJobData {
  tenantId: string;
}

export interface EmailSendJobData {
  communicationId: string;
  tenantId: string;
  to: string;
  subject: string;
  body: string;
  communicationType: 'email_to_complainant' | 'email_to_business';
}

// ---- Queue Names ----

export const QUEUES = {
  COMPLAINT_TRIAGE: 'complaint-triage',
  SYSTEMIC_DETECTION: 'systemic-detection',
  SLA_MONITOR: 'sla-monitor',
  EMAIL_SEND: 'email-send',
  EMAIL_INGEST: 'email-ingest',
} as const;

// ---- Shared Queue Instance (for enqueuing from routes) ----

let triageQueue: Queue | null = null;
let systemicQueue: Queue | null = null;
let slaQueue: Queue | null = null;

export function getTriageQueue(): Queue | null {
  return triageQueue;
}

export function getSystemicQueue(): Queue | null {
  return systemicQueue;
}

export function getSlaQueue(): Queue | null {
  return slaQueue;
}

// ---- Worker Processors ----

/**
 * Triage worker processor.
 *
 * 1. Load complaint and business context
 * 2. Run triage engine
 * 3. Update complaint with triage results
 * 4. Store AI outputs for audit trail
 * 5. Queue systemic detection job
 * 6. If Line 1 routing, generate draft communications
 */
async function processTriageJob(data: TriageJobData): Promise<void> {
  const startTime = Date.now();
  logger.info(`Processing triage job for complaint ${data.complaintId}`);

  // Load business context
  let businessContext = { previousComplaintCount: 0, industry: 'other', businessStatus: 'active' };
  if (data.businessId) {
    const business = await prisma.business.findUnique({
      where: { id: data.businessId },
      select: { complaintCount: true, industry: true, entityStatus: true },
    });
    if (business) {
      businessContext = {
        previousComplaintCount: business.complaintCount,
        industry: business.industry || 'other',
        businessStatus: business.entityStatus || 'active',
      };
    }
  }

  // Load tenant priority weights if configured
  const tenant = await prisma.tenant.findUnique({
    where: { id: data.tenantId },
    select: { settings: true },
  });
  const tenantSettings = tenant?.settings as Record<string, unknown> | null;
  const priorityWeights = tenantSettings?.priorityWeights as Record<string, number> | undefined;

  // Run triage engine
  const engine = new TriageEngine();
  const triageOutput = await engine.triageComplaint({
    complaintId: data.complaintId,
    rawText: data.rawText,
    businessContext,
    priorityWeights: priorityWeights ? {
      riskScore: priorityWeights.riskScore ?? 0.30,
      systemicImpact: priorityWeights.systemicImpact ?? 0.25,
      monetaryHarm: priorityWeights.monetaryHarm ?? 0.15,
      vulnerabilityIndicator: priorityWeights.vulnerabilityIndicator ?? 0.20,
      resolutionProbability: priorityWeights.resolutionProbability ?? 0.10,
    } : undefined,
  });

  const { triageResult, aiOutputs, summary } = triageOutput;

  // Calculate SLA deadline based on routing
  const slaHours = triageResult.routingDestination === 'line_1_auto'
    ? ((tenantSettings?.slaDefaults as Record<string, number>)?.line1ResponseHours ?? 48)
    : ((tenantSettings?.slaDefaults as Record<string, number>)?.line2ResponseHours ?? 120);
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  // Update complaint with triage results
  await prisma.complaint.update({
    where: { id: data.complaintId },
    data: {
      status: 'triaged',
      summary,
      category: triageResult.category,
      legalCategory: triageResult.legalCategory,
      riskLevel: triageResult.riskLevel,
      priorityScore: triageResult.priorityScore,
      complexityScore: triageResult.complexityScore,
      breachLikelihood: triageResult.breachLikelihood,
      publicHarmIndicator: triageResult.publicHarmIndicator,
      isCivilDispute: triageResult.isCivilDispute,
      isSystemicRisk: triageResult.isSystemicRisk,
      routingDestination: triageResult.routingDestination,
      slaDeadline,
    },
  });

  // Store AI outputs for audit trail
  for (const output of aiOutputs) {
    await prisma.aiOutput.create({
      data: {
        complaintId: data.complaintId,
        outputType: output.outputType,
        model: output.model,
        prompt: output.prompt,
        rawOutput: output.rawOutput,
        parsedOutput: output.parsedOutput as Record<string, unknown>,
        confidence: output.confidence,
        reasoning: output.reasoning,
        tokenUsage: output.tokenUsage,
        latencyMs: output.latencyMs,
      },
    });
  }

  // Update business risk scores
  if (data.businessId) {
    const businessComplaints = await prisma.complaint.findMany({
      where: { businessId: data.businessId, riskLevel: { not: null } },
      select: { priorityScore: true },
    });
    const avgRisk = businessComplaints.reduce((sum, c) => sum + (c.priorityScore ?? 0), 0) / businessComplaints.length;
    await prisma.business.update({
      where: { id: data.businessId },
      data: {
        avgRiskScore: Math.round(avgRisk * 1000) / 1000,
        repeatOffenderFlag: businessComplaints.length >= 3,
      },
    });
  }

  // Timeline event
  await prisma.complaintEvent.create({
    data: {
      complaintId: data.complaintId,
      eventType: 'ai_output',
      description: `AI triage completed: ${triageResult.riskLevel} risk, routed to ${triageResult.routingDestination}`,
      metadata: {
        riskLevel: triageResult.riskLevel,
        priorityScore: triageResult.priorityScore,
        routingDestination: triageResult.routingDestination,
        confidence: triageResult.confidence,
      },
    },
  });

  // Audit log
  await writeAuditLog({
    tenantId: data.tenantId,
    action: 'complaint.triaged',
    entity: 'Complaint',
    entityId: data.complaintId,
    newValues: {
      riskLevel: triageResult.riskLevel,
      priorityScore: triageResult.priorityScore,
      routingDestination: triageResult.routingDestination,
    },
  });

  // Queue systemic detection
  const sysQueue = getSystemicQueue();
  if (sysQueue) {
    await sysQueue.add(QUEUES.SYSTEMIC_DETECTION, {
      complaintId: data.complaintId,
      tenantId: data.tenantId,
      rawText: data.rawText,
    } satisfies SystemicJobData);
  }

  // If Line 1 routing, generate draft communications
  if (triageResult.routingDestination === 'line_1_auto') {
    try {
      const complaint = await prisma.complaint.findUnique({
        where: { id: data.complaintId },
        include: { business: true },
      });

      if (complaint) {
        const line1Handler = new Line1Handler();
        const drafts = await line1Handler.generateDrafts({
          complaintId: data.complaintId,
          tenantId: data.tenantId,
          summary,
          category: triageResult.category,
          riskLevel: triageResult.riskLevel,
          businessName: complaint.business?.name ?? 'Unknown Business',
          businessEmail: complaint.business?.email ?? undefined,
          complainantEmail: complaint.complainantEmail,
          complainantFirstName: complaint.complainantFirstName,
          issues: [triageResult.category],
        });

        // Store complainant response draft
        await prisma.communication.create({
          data: {
            complaintId: data.complaintId,
            type: 'email_to_complainant',
            direction: 'outbound',
            subject: drafts.complainantResponse.subject,
            body: drafts.complainantResponse.body,
            isAiDrafted: true,
          },
        });

        // Store business notice draft if applicable
        if (drafts.businessNotice) {
          await prisma.communication.create({
            data: {
              complaintId: data.complaintId,
              type: 'email_to_business',
              direction: 'outbound',
              subject: drafts.businessNotice.subject,
              body: drafts.businessNotice.body,
              isAiDrafted: true,
            },
          });
        }
      }
    } catch (err) {
      logger.error('Failed to generate Line 1 drafts', { complaintId: data.complaintId, error: (err as Error).message });
    }
  }

  const totalTime = Date.now() - startTime;
  logger.info(`Triage complete for complaint ${data.complaintId}`, {
    riskLevel: triageResult.riskLevel,
    routing: triageResult.routingDestination,
    totalTimeMs: totalTime,
  });
}

/**
 * Systemic detection processor.
 *
 * 1. Generate and store embedding
 * 2. Find similar complaints
 * 3. If cluster found, run analysis
 * 4. Create or update systemic cluster record
 * 5. Generate alerts if thresholds met
 */
async function processSystemicDetection(data: SystemicJobData): Promise<void> {
  logger.info(`Processing systemic detection for complaint ${data.complaintId}`);

  const engine = new SystemicDetectionEngine();
  const result = await engine.processNewComplaint(data.complaintId, data.rawText, data.tenantId);

  // If systemic issue detected, create or update cluster
  if (result.clusterResult && result.clusterResult.isSystemic) {
    const cluster = await prisma.systemicCluster.create({
      data: {
        tenantId: data.tenantId,
        title: result.clusterResult.title,
        description: result.clusterResult.description,
        riskLevel: result.clusterResult.riskLevel,
        complaintCount: result.similarComplaints.length + 1,
        avgSimilarity: result.similarComplaints.reduce((s, c) => s + c.similarity, 0) / result.similarComplaints.length,
        detectionMethod: 'embedding_similarity',
        commonPatterns: result.clusterResult.commonPatterns,
      },
    });

    // Link the current complaint to the cluster
    await prisma.complaint.update({
      where: { id: data.complaintId },
      data: { systemicClusterId: cluster.id, isSystemicRisk: true },
    });

    // Link similar complaints
    for (const similar of result.similarComplaints) {
      await prisma.complaint.update({
        where: { id: similar.complaintId },
        data: { systemicClusterId: cluster.id, isSystemicRisk: true },
      });
    }

    await writeAuditLog({
      tenantId: data.tenantId,
      action: 'systemic.cluster_created',
      entity: 'SystemicCluster',
      entityId: cluster.id,
      newValues: {
        title: cluster.title,
        complaintCount: cluster.complaintCount,
        riskLevel: cluster.riskLevel,
      },
    });

    logger.info('Systemic cluster created', {
      clusterId: cluster.id,
      complaintCount: cluster.complaintCount,
      riskLevel: cluster.riskLevel,
    });
  }

  // Log spike anomalies
  for (const spike of result.spikes) {
    logger.warn('Complaint volume spike detected', {
      tenantId: data.tenantId,
      industry: spike.industry,
      category: spike.category,
      ratio: spike.ratio,
    });
  }

  logger.info(`Systemic detection complete for complaint ${data.complaintId}`);
}

/**
 * SLA monitoring processor.
 * Runs on a scheduled basis (e.g., every hour).
 *
 * 1. Find complaints approaching or past SLA deadline
 * 2. Check for business non-response on Line 1 complaints
 * 3. Trigger escalations where needed
 * 4. Send notifications to assigned officers
 */
async function processSlaCheck(data: SlaCheckJobData): Promise<void> {
  const now = new Date();
  logger.info(`Running SLA check for tenant ${data.tenantId}`);

  // Find complaints past SLA deadline that are still open
  const breaches = await prisma.complaint.findMany({
    where: {
      tenantId: data.tenantId,
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
    },
  });

  logger.info(`Found ${breaches.length} SLA breaches for tenant ${data.tenantId}`);

  for (const complaint of breaches) {
    // Create escalation record
    await prisma.escalation.create({
      data: {
        complaintId: complaint.id,
        fromStatus: complaint.status,
        toStatus: 'escalated',
        reason: `SLA deadline breached (deadline: ${complaint.slaDeadline?.toISOString()})`,
        escalatedBy: 'system',
      },
    });

    // Update complaint status
    await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        status: 'escalated',
        routingDestination: complaint.routingDestination === 'line_1_auto'
          ? 'line_2_investigation'
          : complaint.routingDestination,
      },
    });

    // Timeline event
    await prisma.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        eventType: 'escalation',
        description: `Auto-escalated: SLA deadline breached`,
        metadata: {
          slaDeadline: complaint.slaDeadline?.toISOString(),
          previousStatus: complaint.status,
          escalatedBy: 'system',
        },
      },
    });

    await writeAuditLog({
      tenantId: data.tenantId,
      action: 'complaint.sla_breach_escalated',
      entity: 'Complaint',
      entityId: complaint.id,
      oldValues: { status: complaint.status },
      newValues: { status: 'escalated', reason: 'SLA breach' },
    });
  }

  // Check for Line 1 complaints approaching SLA (within 12 hours) for early warning
  const approaching = await prisma.complaint.count({
    where: {
      tenantId: data.tenantId,
      slaDeadline: { gt: now, lt: new Date(now.getTime() + 12 * 60 * 60 * 1000) },
      status: { notIn: ['resolved', 'closed', 'withdrawn', 'escalated'] },
    },
  });

  if (approaching > 0) {
    logger.warn(`${approaching} complaints approaching SLA deadline for tenant ${data.tenantId}`);
  }

  logger.info(`SLA check complete for tenant ${data.tenantId}`, {
    breaches: breaches.length,
    approaching,
  });
}

// ---- Worker Bootstrap ----

/**
 * Start all queue workers.
 * Call this from a separate process or in the main server.
 */
export async function startWorkers(): Promise<void> {
  logger.info('Starting background job workers');

  const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  // Create queues for enqueuing jobs from routes
  triageQueue = new Queue(QUEUES.COMPLAINT_TRIAGE, { connection });
  systemicQueue = new Queue(QUEUES.SYSTEMIC_DETECTION, { connection });
  slaQueue = new Queue(QUEUES.SLA_MONITOR, { connection });

  // Triage worker
  const triageWorker = new Worker(
    QUEUES.COMPLAINT_TRIAGE,
    async (job) => {
      try {
        await processTriageJob(job.data as TriageJobData);
      } catch (err) {
        logger.error('Triage job failed', {
          jobId: job.id,
          complaintId: (job.data as TriageJobData).complaintId,
          error: (err as Error).message,
        });
        throw err;
      }
    },
    { connection, concurrency: 5 },
  );

  // Systemic detection worker
  const systemicWorker = new Worker(
    QUEUES.SYSTEMIC_DETECTION,
    async (job) => {
      try {
        await processSystemicDetection(job.data as SystemicJobData);
      } catch (err) {
        logger.error('Systemic detection job failed', {
          jobId: job.id,
          complaintId: (job.data as SystemicJobData).complaintId,
          error: (err as Error).message,
        });
        throw err;
      }
    },
    { connection, concurrency: 3 },
  );

  // SLA monitor worker
  const slaWorker = new Worker(
    QUEUES.SLA_MONITOR,
    async (job) => {
      try {
        await processSlaCheck(job.data as SlaCheckJobData);
      } catch (err) {
        logger.error('SLA check job failed', {
          jobId: job.id,
          tenantId: (job.data as SlaCheckJobData).tenantId,
          error: (err as Error).message,
        });
        throw err;
      }
    },
    { connection, concurrency: 1 },
  );

  // Schedule hourly SLA checks for all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const tenant of tenants) {
    await slaQueue.add(
      QUEUES.SLA_MONITOR,
      { tenantId: tenant.id } satisfies SlaCheckJobData,
      {
        repeat: { every: 60 * 60 * 1000 }, // Every hour
        jobId: `sla-check-${tenant.id}`,
      },
    );
  }

  // Log worker events
  for (const worker of [triageWorker, systemicWorker, slaWorker]) {
    worker.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed on ${worker.name}`);
    });
    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed on ${worker.name}`, { error: err.message });
    });
  }

  logger.info('All workers started', {
    queues: Object.values(QUEUES),
    tenantSlaJobs: tenants.length,
  });
}

// Run if executed directly
if (require.main === module) {
  startWorkers().catch((err) => {
    logger.error('Worker startup failed', { error: (err as Error).message });
    process.exit(1);
  });
}
