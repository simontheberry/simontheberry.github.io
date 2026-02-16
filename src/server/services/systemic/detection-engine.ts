// ============================================================================
// Systemic Issue Detection Engine
// Embedding-based clustering + anomaly detection
// ============================================================================

import { prisma } from '../../db/client';
import { createLogger } from '../../utils/logger';
import { getAiService } from '../ai/ai-service';
import { config } from '../../config';

const logger = createLogger('systemic-detection');

export interface SimilarComplaint {
  complaintId: string;
  similarity: number;
  summary: string;
  category: string;
  businessId: string;
}

export interface ClusterCandidate {
  complaints: SimilarComplaint[];
  avgSimilarity: number;
  industry?: string;
  category?: string;
}

export interface SpikeAnomaly {
  industry: string;
  category: string;
  count: number;
  baselineCount: number;
  ratio: number;
  detectedAt: string;
}

/**
 * Systemic Issue Detection Engine
 *
 * Detects systemic consumer harm patterns using three approaches:
 *
 * 1. Embedding Similarity Clustering
 *    - Generates embeddings for each complaint
 *    - Uses cosine similarity to find clusters of similar complaints
 *    - Triggers analysis when cluster size exceeds threshold
 *
 * 2. Pattern Matching
 *    - Detects repeated fact patterns (same business, same issue type)
 *    - Identifies similar contract terms, fee structures, product issues
 *    - Flags entity-level complaint trends
 *
 * 3. Anomaly Detection
 *    - Monitors complaint volume by industry/category
 *    - Detects spikes above baseline
 *    - Alerts on novel issue emergence
 */
export class SystemicDetectionEngine {
  private aiService = getAiService();
  private similarityThreshold: number;
  private minClusterSize: number;

  constructor() {
    this.similarityThreshold = config.SIMILARITY_THRESHOLD;
    this.minClusterSize = config.CLUSTER_MIN_COMPLAINTS;
  }

  /**
   * Store an embedding for a complaint in the complaint_embeddings table.
   * Uses raw SQL because Prisma does not natively support pgvector.
   */
  async storeEmbedding(
    complaintId: string,
    tenantId: string,
    embedding: number[],
    model: string,
  ): Promise<void> {
    // Format the embedding array as a pgvector-compatible string: '[0.1,0.2,...]'
    const vectorStr = `[${embedding.join(',')}]`;

    // Upsert: if embedding already exists for this complaint, update it
    await prisma.$executeRaw`
      INSERT INTO complaint_embeddings (id, complaint_id, tenant_id, embedding, model, created_at)
      VALUES (gen_random_uuid(), ${complaintId}, ${tenantId}, ${vectorStr}::vector, ${model}, NOW())
      ON CONFLICT (complaint_id)
      DO UPDATE SET embedding = ${vectorStr}::vector, model = ${model}, created_at = NOW()
    `;

    // Link the embedding record to the complaint
    const embeddingRecord = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM complaint_embeddings WHERE complaint_id = ${complaintId}
    `;
    if (embeddingRecord.length > 0) {
      await prisma.complaint.update({
        where: { id: complaintId },
        data: { embeddingId: embeddingRecord[0].id },
      });
    }
  }

  /**
   * Find complaints similar to a given complaint using vector similarity.
   *
   * Executes a pgvector query:
   *   SELECT complaint_id, 1 - (embedding <=> $1) AS similarity
   *   FROM complaint_embeddings
   *   WHERE 1 - (embedding <=> $1) > $threshold
   *   ORDER BY similarity DESC
   *   LIMIT $limit;
   */
  async findSimilarComplaints(
    complaintId: string,
    tenantId: string,
    complaintText: string,
    limit = 20,
  ): Promise<SimilarComplaint[]> {
    logger.info(`Finding similar complaints for ${complaintId}`);

    // Generate embedding for the query complaint
    const embeddingResult = await this.aiService.generateEmbedding(complaintText);
    const vectorStr = `[${embeddingResult.embedding.join(',')}]`;

    // Execute pgvector similarity search with tenant isolation
    const results = await prisma.$queryRaw<Array<{
      complaint_id: string;
      similarity: number;
      summary: string | null;
      category: string | null;
      business_id: string | null;
    }>>`
      SELECT
        ce.complaint_id,
        1 - (ce.embedding <=> ${vectorStr}::vector) AS similarity,
        c.summary,
        c.category,
        c.business_id
      FROM complaint_embeddings ce
      JOIN complaints c ON c.id = ce.complaint_id
      WHERE ce.complaint_id != ${complaintId}
        AND ce.tenant_id = ${tenantId}
        AND 1 - (ce.embedding <=> ${vectorStr}::vector) > ${this.similarityThreshold}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      complaintId: r.complaint_id,
      similarity: Number(r.similarity),
      summary: r.summary || '',
      category: r.category || '',
      businessId: r.business_id || '',
    }));
  }

  /**
   * Run clustering analysis on a set of similar complaints.
   * Determines if the cluster represents a systemic issue.
   */
  async analyzeCluster(complaints: SimilarComplaint[]): Promise<{
    isSystemic: boolean;
    title: string;
    description: string;
    riskLevel: string;
    commonPatterns: string[];
    confidence: number;
  }> {
    if (complaints.length < this.minClusterSize) {
      return {
        isSystemic: false,
        title: '',
        description: '',
        riskLevel: 'low',
        commonPatterns: [],
        confidence: 0,
      };
    }

    const { result } = await this.aiService.analyzeCluster(
      complaints.map(c => ({
        id: c.complaintId,
        summary: c.summary,
        category: c.category,
      })),
    );

    return result as {
      isSystemic: boolean;
      title: string;
      description: string;
      riskLevel: string;
      commonPatterns: string[];
      confidence: number;
    };
  }

  /**
   * Detect complaint volume spikes by industry/category.
   *
   * Compares recent complaint volume against a rolling baseline
   * to identify anomalous increases.
   *
   * Baseline: average daily count over the previous 7 windows.
   * Spike: when recent count exceeds baseline * threshold.
   */
  async detectSpikes(
    tenantId: string,
    windowHours = config.SPIKE_DETECTION_WINDOW_HOURS,
    threshold = config.SPIKE_DETECTION_THRESHOLD,
  ): Promise<SpikeAnomaly[]> {
    logger.info(`Running spike detection for tenant ${tenantId}`);

    // Use raw SQL for the window-based aggregation
    // Recent window: last `windowHours` hours
    // Baseline: average per-window count over the prior 7 windows
    const results = await prisma.$queryRaw<Array<{
      industry: string | null;
      category: string | null;
      recent_count: bigint;
      baseline_avg: number | null;
    }>>`
      SELECT
        industry,
        category,
        COUNT(*) FILTER (
          WHERE created_at > NOW() - make_interval(hours => ${windowHours})
        ) AS recent_count,
        COUNT(*) FILTER (
          WHERE created_at > NOW() - make_interval(hours => ${windowHours * 7})
            AND created_at <= NOW() - make_interval(hours => ${windowHours})
        ) / NULLIF(6.0, 0) AS baseline_avg
      FROM complaints
      WHERE tenant_id = ${tenantId}
        AND industry IS NOT NULL
        AND category IS NOT NULL
      GROUP BY industry, category
      HAVING COUNT(*) FILTER (
        WHERE created_at > NOW() - make_interval(hours => ${windowHours})
      ) > 0
    `;

    const spikes: SpikeAnomaly[] = [];

    for (const row of results) {
      const recentCount = Number(row.recent_count);
      const baselineAvg = row.baseline_avg ? Number(row.baseline_avg) : 0;

      // Only flag as spike if baseline exists and ratio exceeds threshold
      // If no baseline (new category/industry), require minimum count of 5
      if (
        (baselineAvg > 0 && recentCount > baselineAvg * threshold) ||
        (baselineAvg === 0 && recentCount >= 5)
      ) {
        const ratio = baselineAvg > 0 ? recentCount / baselineAvg : recentCount;
        spikes.push({
          industry: row.industry || 'unknown',
          category: row.category || 'unknown',
          count: recentCount,
          baselineCount: Math.round(baselineAvg),
          ratio: Math.round(ratio * 100) / 100,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    if (spikes.length > 0) {
      logger.warn(`Detected ${spikes.length} complaint volume spikes`, {
        tenantId,
        spikes: spikes.map(s => ({ industry: s.industry, category: s.category, ratio: s.ratio })),
      });
    }

    return spikes;
  }

  /**
   * Run full systemic detection pipeline for a new complaint.
   * Called after triage is complete.
   */
  async processNewComplaint(
    complaintId: string,
    complaintText: string,
    tenantId: string,
  ): Promise<{
    similarComplaints: SimilarComplaint[];
    clusterResult: { isSystemic: boolean; title: string; description: string; riskLevel: string; commonPatterns: string[]; confidence: number } | null;
    spikes: SpikeAnomaly[];
  }> {
    // Step 1: Generate and store embedding
    try {
      const embeddingResult = await this.aiService.generateEmbedding(complaintText);
      await this.storeEmbedding(complaintId, tenantId, embeddingResult.embedding, embeddingResult.model);
      logger.info(`Embedding stored for complaint ${complaintId}`, { model: embeddingResult.model });
    } catch (error) {
      logger.error('Failed to generate/store embedding', { complaintId, error: (error as Error).message });
      // Continue without embedding -- similarity search will use a fresh embedding call
    }

    // Step 2: Find similar complaints via pgvector
    let similarComplaints: SimilarComplaint[] = [];
    try {
      similarComplaints = await this.findSimilarComplaints(complaintId, tenantId, complaintText);
      logger.info(`Found ${similarComplaints.length} similar complaints`, { complaintId });
    } catch (error) {
      logger.error('Similarity search failed', { complaintId, error: (error as Error).message });
    }

    // Step 3: Analyze cluster if enough similar complaints found
    let clusterResult = null;
    if (similarComplaints.length >= this.minClusterSize) {
      try {
        clusterResult = await this.analyzeCluster(similarComplaints);
      } catch (error) {
        logger.error('Cluster analysis failed', { complaintId, error: (error as Error).message });
      }
    }

    // Step 4: Check for spikes
    let spikes: SpikeAnomaly[] = [];
    try {
      spikes = await this.detectSpikes(tenantId);
    } catch (error) {
      logger.error('Spike detection failed', { tenantId, error: (error as Error).message });
    }

    return { similarComplaints, clusterResult, spikes };
  }
}
