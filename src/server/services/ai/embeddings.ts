// ============================================================================
// Embedding Service
// Generates, stores, and queries vector embeddings for complaint text
// Uses OpenAI ada-002 (1536 dimensions) stored via pgvector
// ============================================================================

import { createLogger } from '../../utils/logger';
import { getAiService } from './ai-service';
import type { PrismaClient as PrismaType } from '@prisma/client';

const logger = createLogger('embedding-service');

const EMBEDDING_DIMENSIONS = 1536;
const MAX_EMBEDDING_INPUT_LENGTH = 8000;

export interface EmbeddingResult {
  complaintId: string;
  model: string;
  dimensions: number;
  tokenUsage: number;
}

export interface SimilarComplaintResult {
  complaintId: string;
  referenceNumber: string;
  summary: string;
  similarity: number;
  riskLevel: string;
  category: string | null;
  business: string | null;
  systemicClusterId: string | null;
}

export class EmbeddingService {
  private aiService = getAiService();

  constructor(private prisma: PrismaType) {}

  async generateAndStore(
    complaintId: string,
    rawText: string,
    tenantId: string,
    metadata?: { category?: string; industry?: string },
  ): Promise<EmbeddingResult | null> {
    try {
      const embeddingInput = this.buildEmbeddingInput(rawText, metadata);
      const result = await this.aiService.generateEmbedding(embeddingInput);
      const embeddingVector = `[${result.embedding.join(',')}]`;

      await (this.prisma as unknown as { $executeRaw: (...args: unknown[]) => Promise<number> })
        .$executeRaw`
        INSERT INTO complaint_embeddings (id, complaint_id, tenant_id, embedding, model, created_at)
        VALUES (
          gen_random_uuid(),
          ${complaintId},
          ${tenantId},
          ${embeddingVector}::vector(${EMBEDDING_DIMENSIONS}),
          ${result.model},
          NOW()
        )
        ON CONFLICT (complaint_id) DO UPDATE SET
          embedding = ${embeddingVector}::vector(${EMBEDDING_DIMENSIONS}),
          model = ${result.model},
          created_at = NOW()
      `;

      await this.prisma.complaint.update({
        where: { id: complaintId },
        data: { embeddingId: complaintId },
      });

      logger.info(`Embedding stored for complaint ${complaintId}`, {
        model: result.model,
        tokens: result.tokenUsage,
      });

      return {
        complaintId,
        model: result.model,
        dimensions: EMBEDDING_DIMENSIONS,
        tokenUsage: result.tokenUsage,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to generate embedding for ${complaintId}`, { error: message });
      return null;
    }
  }

  async findSimilar(
    complaintId: string,
    tenantId: string,
    options?: { threshold?: number; limit?: number },
  ): Promise<SimilarComplaintResult[]> {
    const threshold = options?.threshold ?? 0.85;
    const limit = options?.limit ?? 20;

    try {
      const results = await (this.prisma as unknown as {
        $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
      }).$queryRaw<SimilarComplaintResult[]>`
        SELECT
          ce.complaint_id AS "complaintId",
          c.reference_number AS "referenceNumber",
          COALESCE(c.summary, LEFT(c.raw_text, 120) || '...') AS summary,
          1 - (ce.embedding <=> target.embedding) AS similarity,
          COALESCE(c.risk_level, 'low') AS "riskLevel",
          c.category,
          b.name AS business,
          c.systemic_cluster_id AS "systemicClusterId"
        FROM complaint_embeddings ce
        JOIN complaint_embeddings target ON target.complaint_id = ${complaintId}
        JOIN complaints c ON c.id = ce.complaint_id
        LEFT JOIN businesses b ON b.id = c.business_id
        WHERE ce.tenant_id = ${tenantId}
          AND c.tenant_id = ${tenantId}
          AND ce.complaint_id != ${complaintId}
          AND c.created_at > NOW() - INTERVAL '90 days'
          AND 1 - (ce.embedding <=> target.embedding) > ${threshold}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Similarity search failed for ${complaintId}`, { error: message });
      return [];
    }
  }

  async generateBatch(
    complaints: Array<{ id: string; rawText: string; tenantId: string; category?: string; industry?: string }>,
  ): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;

    for (const complaint of complaints) {
      const result = await this.generateAndStore(
        complaint.id,
        complaint.rawText,
        complaint.tenantId,
        { category: complaint.category, industry: complaint.industry },
      );
      if (result) {
        succeeded++;
      } else {
        failed++;
      }
    }

    logger.info(`Batch embedding complete`, { succeeded, failed, total: complaints.length });
    return { succeeded, failed };
  }

  async hasEmbedding(complaintId: string): Promise<boolean> {
    const results = await (this.prisma as unknown as {
      $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
    }).$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM complaint_embeddings WHERE complaint_id = ${complaintId}
    `;
    return Number(results[0]?.count || 0) > 0;
  }

  private buildEmbeddingInput(
    rawText: string,
    metadata?: { category?: string; industry?: string },
  ): string {
    const parts = [rawText.slice(0, MAX_EMBEDDING_INPUT_LENGTH)];
    if (metadata?.category) parts.push(`Category: ${metadata.category}`);
    if (metadata?.industry) parts.push(`Industry: ${metadata.industry}`);
    return parts.join('\n');
  }
}
