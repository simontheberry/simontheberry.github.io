// ============================================================================
// Systemic Detection Engine
// Embeds complaints, finds similar clusters, and detects systemic patterns
// ============================================================================

import { createLogger } from '../../utils/logger';
import { getAiService, type AiOutputRecord } from '../ai/ai-service';
import { config } from '../../config';
import type { RiskLevel } from '../../../shared/types/complaint';

const logger = createLogger('systemic-detection');

// ---- Types ----

export interface SimilarComplaint {
  complaintId: string;
  similarity: number;
  category: string | null;
  businessId: string | null;
  systemicClusterId: string | null;
}

export interface ClusterCandidate {
  complaints: SimilarComplaint[];
  avgSimilarity: number;
  existingClusterId: string | null;
}

export interface SystemicDetectionResult {
  complaintId: string;
  embeddingStored: boolean;
  similarComplaints: SimilarComplaint[];
  clusterAction: 'created' | 'updated' | 'none';
  clusterId: string | null;
  isSpike: boolean;
  aiOutput: AiOutputRecord | null;
}

export interface EmbeddingRecord {
  complaintId: string;
  model: string;
  tokenUsage: number;
}

// ---- Prisma client type (injected to avoid import coupling) ----

export interface PrismaClient {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  complaint: {
    findFirst(args: { where: Record<string, unknown>; select: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  systemicCluster: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    findUnique(args: { where: { id: string }; select: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  aiOutput: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

// ---- Engine ----

export class SystemicDetectionEngine {
  private aiService = getAiService();
  private similarityThreshold: number;
  private clusterMinComplaints: number;
  private spikeWindowHours: number;
  private spikeThreshold: number;

  constructor(
    private prisma: PrismaClient,
    options?: {
      similarityThreshold?: number;
      clusterMinComplaints?: number;
      spikeWindowHours?: number;
      spikeThreshold?: number;
    },
  ) {
    this.similarityThreshold = options?.similarityThreshold ?? config.SIMILARITY_THRESHOLD;
    this.clusterMinComplaints = options?.clusterMinComplaints ?? config.CLUSTER_MIN_COMPLAINTS;
    this.spikeWindowHours = options?.spikeWindowHours ?? config.SPIKE_DETECTION_WINDOW_HOURS;
    this.spikeThreshold = options?.spikeThreshold ?? config.SPIKE_DETECTION_THRESHOLD;
  }

  async processNewComplaint(
    complaintId: string,
    rawText: string,
    tenantId: string,
  ): Promise<SystemicDetectionResult> {
    logger.info(`Starting systemic detection for complaint ${complaintId}`);

    // Step 1: Generate and store embedding
    const embeddingRecord = await this.generateAndStoreEmbedding(complaintId, rawText, tenantId);

    // Step 2: Find similar complaints within the same tenant
    const similarComplaints = await this.findSimilarComplaints(
      complaintId,
      tenantId,
    );

    logger.info(`Found ${similarComplaints.length} similar complaints for ${complaintId}`, {
      threshold: this.similarityThreshold,
    });

    // Step 3: Evaluate cluster membership
    let clusterAction: 'created' | 'updated' | 'none' = 'none';
    let clusterId: string | null = null;
    let aiOutput: AiOutputRecord | null = null;

    if (similarComplaints.length >= this.clusterMinComplaints - 1) {
      const clusterResult = await this.evaluateCluster(
        complaintId,
        tenantId,
        similarComplaints,
      );
      clusterAction = clusterResult.action;
      clusterId = clusterResult.clusterId;
      aiOutput = clusterResult.aiOutput;
    }

    // Step 4: Spike detection
    const isSpike = await this.detectSpike(tenantId);

    if (isSpike) {
      logger.warn(`Spike detected for tenant ${tenantId}`, {
        windowHours: this.spikeWindowHours,
        threshold: this.spikeThreshold,
      });
    }

    // Store embedding audit record
    if (embeddingRecord) {
      await this.prisma.aiOutput.create({
        data: {
          complaintId,
          outputType: 'embedding',
          model: embeddingRecord.model,
          prompt: rawText.slice(0, 500),
          rawOutput: `[${embeddingRecord.model} embedding, 1536 dimensions]`,
          confidence: null,
          reasoning: null,
          tokenUsage: { totalTokens: embeddingRecord.tokenUsage },
          latencyMs: null,
        },
      });
    }

    logger.info(`Systemic detection complete for ${complaintId}`, {
      similarCount: similarComplaints.length,
      clusterAction,
      clusterId,
      isSpike,
    });

    return {
      complaintId,
      embeddingStored: embeddingRecord !== null,
      similarComplaints,
      clusterAction,
      clusterId,
      isSpike,
      aiOutput,
    };
  }

  // ---- Step 1: Generate Embedding ----

  private async generateAndStoreEmbedding(
    complaintId: string,
    rawText: string,
    tenantId: string,
  ): Promise<EmbeddingRecord | null> {
    try {
      // Build embedding input: combine raw text with structural metadata
      const complaint = await this.prisma.complaint.findFirst({
        where: { id: complaintId, tenantId },
        select: { category: true, industry: true, businessId: true },
      });

      const embeddingInput = [
        rawText,
        complaint?.category ? `Category: ${complaint.category}` : '',
        complaint?.industry ? `Industry: ${complaint.industry}` : '',
      ].filter(Boolean).join('\n');

      const embeddingResult = await this.aiService.generateEmbedding(embeddingInput);
      const embeddingVector = `[${embeddingResult.embedding.join(',')}]`;

      // Store embedding via raw SQL (Prisma doesn't support pgvector natively)
      // The tenant_id is stored for isolation in similarity queries
      await this.prisma.$executeRaw`
        INSERT INTO complaint_embeddings (id, complaint_id, tenant_id, embedding, model, created_at)
        VALUES (
          gen_random_uuid(),
          ${complaintId},
          ${tenantId},
          ${embeddingVector}::vector(1536),
          ${embeddingResult.model},
          NOW()
        )
        ON CONFLICT (complaint_id) DO UPDATE SET
          embedding = ${embeddingVector}::vector(1536),
          model = ${embeddingResult.model},
          created_at = NOW()
      `;

      // Link embedding to complaint
      await this.prisma.complaint.update({
        where: { id: complaintId },
        data: { embeddingId: complaintId },
      });

      return {
        complaintId,
        model: embeddingResult.model,
        tokenUsage: embeddingResult.tokenUsage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to generate embedding for ${complaintId}`, { error: message });
      return null;
    }
  }

  // ---- Step 2: Find Similar Complaints ----

  private async findSimilarComplaints(
    complaintId: string,
    tenantId: string,
  ): Promise<SimilarComplaint[]> {
    try {
      const results = await this.prisma.$queryRaw<SimilarComplaint[]>`
        SELECT
          ce.complaint_id AS "complaintId",
          1 - (ce.embedding <=> target.embedding) AS similarity,
          c.category,
          c.business_id AS "businessId",
          c.systemic_cluster_id AS "systemicClusterId"
        FROM complaint_embeddings ce
        JOIN complaint_embeddings target ON target.complaint_id = ${complaintId}
        JOIN complaints c ON c.id = ce.complaint_id
        WHERE ce.tenant_id = ${tenantId}
          AND c.tenant_id = ${tenantId}
          AND ce.complaint_id != ${complaintId}
          AND c.created_at > NOW() - INTERVAL '90 days'
          AND 1 - (ce.embedding <=> target.embedding) > ${this.similarityThreshold}
        ORDER BY similarity DESC
        LIMIT 50
      `;

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Similarity search failed for ${complaintId}`, { error: message });
      return [];
    }
  }

  // ---- Step 3: Evaluate & Manage Clusters ----

  private async evaluateCluster(
    complaintId: string,
    tenantId: string,
    similarComplaints: SimilarComplaint[],
  ): Promise<{ action: 'created' | 'updated' | 'none'; clusterId: string | null; aiOutput: AiOutputRecord | null }> {
    // Check if any similar complaints are already in a cluster
    const existingClusterIds = similarComplaints
      .map(c => c.systemicClusterId)
      .filter((id): id is string => id !== null);

    const uniqueClusterIds = [...new Set(existingClusterIds)];

    if (uniqueClusterIds.length > 0) {
      // Add to existing cluster (use the most common one)
      const clusterCounts = new Map<string, number>();
      for (const id of existingClusterIds) {
        clusterCounts.set(id, (clusterCounts.get(id) || 0) + 1);
      }
      const targetClusterId = [...clusterCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0][0];

      // Verify cluster belongs to the same tenant before updating
      const targetCluster = await this.prisma.systemicCluster.findUnique({
        where: { id: targetClusterId },
        select: { tenantId: true },
      });
      if (!targetCluster || targetCluster.tenantId !== tenantId) {
        logger.warn(`Cluster ${targetClusterId} tenant mismatch, skipping update`);
        return { action: 'none', clusterId: null, aiOutput: null };
      }

      const avgSimilarity = similarComplaints.reduce((sum, c) => sum + c.similarity, 0) / similarComplaints.length;

      await this.prisma.complaint.update({
        where: { id: complaintId },
        data: { systemicClusterId: targetClusterId },
      });

      await this.prisma.systemicCluster.update({
        where: { id: targetClusterId },
        data: {
          complaintCount: { increment: 1 },
          avgSimilarity,
          updatedAt: new Date(),
        },
      });

      logger.info(`Added complaint ${complaintId} to existing cluster ${targetClusterId}`);

      return { action: 'updated', clusterId: targetClusterId, aiOutput: null };
    }

    // No existing cluster -- create a new one via AI analysis
    const complaint = await this.prisma.complaint.findFirst({
      where: { id: complaintId, tenantId },
      select: { summary: true, category: true },
    });

    const clusterComplaints = [
      {
        id: complaintId,
        summary: (complaint?.summary as string) || 'No summary available',
        category: (complaint?.category as string) || 'unknown',
      },
      ...await Promise.all(
        similarComplaints.slice(0, 10).map(async (sc) => {
          const c = await this.prisma.complaint.findFirst({
            where: { id: sc.complaintId, tenantId },
            select: { summary: true, category: true },
          });
          return {
            id: sc.complaintId,
            summary: (c?.summary as string) || 'No summary available',
            category: (c?.category as string) || 'unknown',
          };
        }),
      ),
    ];

    const { result: analysis, record: aiOutput } = await this.aiService.analyzeCluster(clusterComplaints);
    const analysisData = analysis as Record<string, unknown>;

    if (!analysisData.isSystemic) {
      logger.info(`Cluster analysis for ${complaintId}: not systemic (confidence: ${analysisData.confidence})`);
      return { action: 'none', clusterId: null, aiOutput };
    }

    // Create new cluster
    const avgSimilarity = similarComplaints.reduce((sum, c) => sum + c.similarity, 0) / similarComplaints.length;
    const category = (complaint?.category as string) || null;

    const cluster = await this.prisma.systemicCluster.create({
      data: {
        tenantId,
        title: analysisData.title as string,
        description: analysisData.description as string,
        category,
        riskLevel: (analysisData.riskLevel as string) || 'medium',
        complaintCount: clusterComplaints.length,
        avgSimilarity,
        detectionMethod: 'embedding_cosine_similarity',
        commonPatterns: analysisData.commonPatterns as string[],
        isActive: true,
      },
    });

    // Assign all complaints to the new cluster
    await this.prisma.complaint.update({
      where: { id: complaintId },
      data: { systemicClusterId: cluster.id, isSystemicRisk: true },
    });

    for (const sc of similarComplaints) {
      await this.prisma.complaint.update({
        where: { id: sc.complaintId },
        data: { systemicClusterId: cluster.id, isSystemicRisk: true },
      });
    }

    // Store AI output for audit
    await this.prisma.aiOutput.create({
      data: {
        complaintId,
        outputType: 'clustering_analysis',
        model: aiOutput.model,
        prompt: aiOutput.prompt,
        rawOutput: aiOutput.rawOutput,
        parsedOutput: aiOutput.parsedOutput as Record<string, unknown>,
        confidence: aiOutput.confidence,
        reasoning: aiOutput.reasoning,
        tokenUsage: aiOutput.tokenUsage,
        latencyMs: aiOutput.latencyMs,
      },
    });

    logger.info(`Created new systemic cluster ${cluster.id}`, {
      title: analysisData.title,
      complaintCount: clusterComplaints.length,
      avgSimilarity,
      riskLevel: analysisData.riskLevel,
    });

    return { action: 'created', clusterId: cluster.id, aiOutput };
  }

  // ---- Step 4: Spike Detection ----

  private async detectSpike(tenantId: string): Promise<boolean> {
    try {
      const results = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM complaints
        WHERE tenant_id = ${tenantId}
          AND created_at > NOW() - MAKE_INTERVAL(hours => ${this.spikeWindowHours})
      `;

      const count = Number(results[0]?.count || 0);
      return count >= this.spikeThreshold;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Spike detection query failed', { error: message, tenantId });
      return false;
    }
  }
}
