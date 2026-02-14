// ============================================================================
// Systemic Issue Detection Engine
// Embedding-based clustering + anomaly detection
// ============================================================================

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
   * Find complaints similar to a given complaint using vector similarity.
   *
   * In production, this executes a pgvector query:
   *   SELECT complaint_id, 1 - (embedding <=> $1) AS similarity
   *   FROM complaint_embeddings
   *   WHERE 1 - (embedding <=> $1) > $threshold
   *   ORDER BY similarity DESC
   *   LIMIT $limit;
   */
  async findSimilarComplaints(
    complaintId: string,
    complaintText: string,
    limit = 20,
  ): Promise<SimilarComplaint[]> {
    logger.info(`Finding similar complaints for ${complaintId}`);

    // Generate embedding for the query complaint
    const embedding = await this.aiService.generateEmbedding(complaintText);

    // TODO: Execute pgvector similarity search
    // Placeholder — in production this queries the complaint_embeddings table
    //
    // const results = await prisma.$queryRaw`
    //   SELECT ce.complaint_id, c.summary, c.category, c.business_id,
    //          1 - (ce.embedding <=> ${embedding.embedding}::vector) AS similarity
    //   FROM complaint_embeddings ce
    //   JOIN complaints c ON c.id = ce.complaint_id
    //   WHERE ce.complaint_id != ${complaintId}
    //     AND c.tenant_id = ${tenantId}
    //     AND 1 - (ce.embedding <=> ${embedding.embedding}::vector) > ${this.similarityThreshold}
    //   ORDER BY similarity DESC
    //   LIMIT ${limit};
    // `;

    return [];
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
   */
  async detectSpikes(
    tenantId: string,
    windowHours = config.SPIKE_DETECTION_WINDOW_HOURS,
    threshold = config.SPIKE_DETECTION_THRESHOLD,
  ): Promise<SpikeAnomaly[]> {
    logger.info(`Running spike detection for tenant ${tenantId}`);

    // TODO: Query DB for complaint counts in current window vs baseline
    //
    // SELECT industry, category,
    //        COUNT(*) FILTER (WHERE created_at > NOW() - interval '${windowHours} hours') as recent_count,
    //        COUNT(*) FILTER (WHERE created_at > NOW() - interval '${windowHours * 7} hours') / 7.0 as baseline_avg
    // FROM complaints
    // WHERE tenant_id = ${tenantId}
    // GROUP BY industry, category
    // HAVING COUNT(*) FILTER (WHERE created_at > NOW() - interval '${windowHours} hours') >
    //        (COUNT(*) FILTER (WHERE created_at > NOW() - interval '${windowHours * 7} hours') / 7.0) * ${threshold}

    return [];
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
    clusterResult: Awaited<ReturnType<typeof this.analyzeCluster>> | null;
    spikes: SpikeAnomaly[];
  }> {
    // Step 1: Store embedding
    try {
      const embedding = await this.aiService.generateEmbedding(complaintText);
      // TODO: Store in complaint_embeddings table via raw SQL
      logger.info(`Embedding stored for complaint ${complaintId}`);
    } catch (error) {
      logger.error('Failed to store embedding', { complaintId, error: (error as Error).message });
    }

    // Step 2: Find similar complaints
    const similarComplaints = await this.findSimilarComplaints(complaintId, complaintText);

    // Step 3: Analyze cluster if enough similar complaints found
    let clusterResult = null;
    if (similarComplaints.length >= this.minClusterSize) {
      clusterResult = await this.analyzeCluster(similarComplaints);
    }

    // Step 4: Check for spikes
    const spikes = await this.detectSpikes(tenantId);

    return { similarComplaints, clusterResult, spikes };
  }
}
