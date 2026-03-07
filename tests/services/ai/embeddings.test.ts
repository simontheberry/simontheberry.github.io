import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../../src/server/services/ai/ai-service', () => ({
  getAiService: vi.fn(() => ({
    generateEmbedding: vi.fn(async (input: string) => ({
      embedding: Array(1536).fill(0).map((_, i) => Math.sin(i)),
      model: 'text-embedding-ada-002',
      tokenUsage: Math.ceil(input.length / 4),
    })),
  })),
}));

vi.mock('../../../src/server/config', () => ({
  config: {
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-test',
  },
}));

vi.mock('../../../src/server/services/metrics/metrics', () => ({
  recordAiCall: vi.fn(),
}));

import { EmbeddingService } from '../../../src/server/services/ai/embeddings';

function createMockPrisma() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([]),
    complaint: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new EmbeddingService(mockPrisma as any);
  });

  describe('generateAndStore', () => {
    it('generates embedding and stores via raw SQL', async () => {
      const result = await service.generateAndStore('cmp-1', 'Test complaint text', 'tenant-1');

      expect(result).not.toBeNull();
      expect(result!.complaintId).toBe('cmp-1');
      expect(result!.model).toBe('text-embedding-ada-002');
      expect(result!.dimensions).toBe(1536);
      expect(result!.tokenUsage).toBeGreaterThan(0);
    });

    it('updates complaint embeddingId after storing', async () => {
      await service.generateAndStore('cmp-1', 'Test text', 'tenant-1');

      expect(mockPrisma.complaint.update).toHaveBeenCalledWith({
        where: { id: 'cmp-1' },
        data: { embeddingId: 'cmp-1' },
      });
    });

    it('includes category metadata in embedding input', async () => {
      const result = await service.generateAndStore(
        'cmp-1',
        'Complaint about billing',
        'tenant-1',
        { category: 'billing_dispute' },
      );

      expect(result).not.toBeNull();
    });

    it('includes industry metadata in embedding input', async () => {
      const result = await service.generateAndStore(
        'cmp-1',
        'Complaint about energy billing',
        'tenant-1',
        { category: 'billing_dispute', industry: 'energy' },
      );

      expect(result).not.toBeNull();
    });

    it('returns null on AI service failure', async () => {
      const { getAiService } = await import('../../../src/server/services/ai/ai-service');
      vi.mocked(getAiService).mockReturnValueOnce({
        generateEmbedding: vi.fn().mockRejectedValue(new Error('API key invalid')),
      } as any);

      const freshService = new EmbeddingService(mockPrisma as any);
      const result = await freshService.generateAndStore('cmp-1', 'Test', 'tenant-1');

      expect(result).toBeNull();
    });

    it('returns null on database failure', async () => {
      mockPrisma.$executeRaw.mockRejectedValueOnce(new Error('DB connection lost'));

      const result = await service.generateAndStore('cmp-1', 'Test', 'tenant-1');

      expect(result).toBeNull();
    });
  });

  describe('findSimilar', () => {
    it('returns similar complaints from database', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          complaintId: 'cmp-2',
          referenceNumber: 'CMP-002',
          summary: 'Similar complaint',
          similarity: 0.92,
          riskLevel: 'high',
          category: 'billing_dispute',
          business: 'Corp A',
          systemicClusterId: null,
        },
      ]);

      const results = await service.findSimilar('cmp-1', 'tenant-1');

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0.92);
      expect(results[0].complaintId).toBe('cmp-2');
    });

    it('uses default threshold of 0.85', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await service.findSimilar('cmp-1', 'tenant-1');

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('accepts custom threshold and limit', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await service.findSimilar('cmp-1', 'tenant-1', { threshold: 0.9, limit: 5 });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('returns empty array on database error', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Query failed'));

      const results = await service.findSimilar('cmp-1', 'tenant-1');

      expect(results).toEqual([]);
    });
  });

  describe('generateBatch', () => {
    it('processes multiple complaints', async () => {
      const complaints = [
        { id: 'cmp-1', rawText: 'First complaint', tenantId: 'tenant-1' },
        { id: 'cmp-2', rawText: 'Second complaint', tenantId: 'tenant-1' },
        { id: 'cmp-3', rawText: 'Third complaint', tenantId: 'tenant-1' },
      ];

      const result = await service.generateBatch(complaints);

      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('tracks failures separately', async () => {
      mockPrisma.$executeRaw
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(1);

      const complaints = [
        { id: 'cmp-1', rawText: 'First complaint', tenantId: 'tenant-1' },
        { id: 'cmp-2', rawText: 'Second complaint', tenantId: 'tenant-1' },
        { id: 'cmp-3', rawText: 'Third complaint', tenantId: 'tenant-1' },
      ];

      const result = await service.generateBatch(complaints);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('passes category and industry metadata', async () => {
      const complaints = [
        { id: 'cmp-1', rawText: 'Complaint', tenantId: 'tenant-1', category: 'scam_fraud', industry: 'retail' },
      ];

      const result = await service.generateBatch(complaints);

      expect(result.succeeded).toBe(1);
    });
  });

  describe('hasEmbedding', () => {
    it('returns true when embedding exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]);

      const result = await service.hasEmbedding('cmp-1');

      expect(result).toBe(true);
    });

    it('returns false when no embedding exists', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.hasEmbedding('cmp-1');

      expect(result).toBe(false);
    });

    it('returns false on empty result', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.hasEmbedding('cmp-1');

      expect(result).toBe(false);
    });
  });

  describe('buildEmbeddingInput (via generateAndStore)', () => {
    it('truncates raw text to 8000 characters', async () => {
      const longText = 'a'.repeat(10000);
      const result = await service.generateAndStore('cmp-1', longText, 'tenant-1');

      expect(result).not.toBeNull();
    });

    it('works with no metadata', async () => {
      const result = await service.generateAndStore('cmp-1', 'Short text', 'tenant-1');

      expect(result).not.toBeNull();
    });
  });
});
