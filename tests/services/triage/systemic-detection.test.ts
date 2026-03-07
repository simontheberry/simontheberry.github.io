import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../../src/server/config', () => ({
  config: {
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: 'sk-test',
    SIMILARITY_THRESHOLD: 0.85,
    CLUSTER_MIN_COMPLAINTS: 3,
    SPIKE_DETECTION_WINDOW_HOURS: 24,
    SPIKE_DETECTION_THRESHOLD: 50,
  },
}));

vi.mock('../../../src/server/services/ai/ai-service', () => ({
  getAiService: vi.fn(() => ({
    generateEmbedding: vi.fn(async () => ({
      embedding: Array(1536).fill(0).map((_, i) => Math.sin(i)),
      model: 'text-embedding-ada-002',
      tokenUsage: 10,
    })),
    analyzeCluster: vi.fn(async () => ({
      result: {
        isSystemic: true,
        title: 'AI-detected cluster',
        description: 'AI-generated cluster description',
        riskLevel: 'high',
        commonPatterns: ['Pattern A', 'Pattern B'],
        confidence: 0.88,
      },
      record: {
        model: 'gpt-4o',
        prompt: 'Analyze cluster...',
        rawOutput: '{}',
        parsedOutput: {},
        confidence: 0.88,
        reasoning: 'Strong pattern detected',
        tokenUsage: { prompt: 200, completion: 100 },
        latencyMs: 500,
        outputType: 'clustering_analysis',
      },
    })),
  })),
}));

vi.mock('../../../src/server/services/metrics/metrics', () => ({
  recordAiCall: vi.fn(),
}));

import { SystemicDetectionEngine } from '../../../src/server/services/triage/systemic-detection';

function createMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    complaint: {
      findFirst: vi.fn().mockResolvedValue({
        category: 'misleading_conduct',
        industry: 'financial_services',
        businessId: 'biz-1',
        summary: 'Test summary',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    systemicCluster: {
      create: vi.fn().mockResolvedValue({ id: 'cluster-new' }),
      findUnique: vi.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    aiOutput: {
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

describe('SystemicDetectionEngine', () => {
  let engine: SystemicDetectionEngine;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    engine = new SystemicDetectionEngine(mockPrisma as any, {
      similarityThreshold: 0.85,
      clusterMinComplaints: 3,
      spikeWindowHours: 24,
      spikeThreshold: 50,
    });
  });

  describe('processNewComplaint', () => {
    it('generates embedding and stores it', async () => {
      const result = await engine.processNewComplaint('cmp-1', 'Test complaint', 'tenant-1');

      expect(result.embeddingStored).toBe(true);
      expect(result.complaintId).toBe('cmp-1');
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });

    it('returns no cluster action when few similar complaints', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // similarity search returns empty

      const result = await engine.processNewComplaint('cmp-1', 'Test complaint', 'tenant-1');

      expect(result.clusterAction).toBe('none');
      expect(result.clusterId).toBeNull();
    });

    it('creates new cluster when enough similar complaints found', async () => {
      // Similarity search returns 3+ complaints (meeting threshold of min 3 - 1 = 2)
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { complaintId: 'cmp-2', similarity: 0.92, category: 'misleading_conduct', businessId: 'biz-1', systemicClusterId: null },
          { complaintId: 'cmp-3', similarity: 0.89, category: 'misleading_conduct', businessId: 'biz-2', systemicClusterId: null },
          { complaintId: 'cmp-4', similarity: 0.87, category: 'misleading_conduct', businessId: 'biz-1', systemicClusterId: null },
        ])
        .mockResolvedValueOnce([{ count: BigInt(10) }]); // spike detection

      const result = await engine.processNewComplaint('cmp-1', 'Test complaint about misleading rates', 'tenant-1');

      expect(result.clusterAction).toBe('created');
      expect(result.clusterId).toBe('cluster-new');
      expect(mockPrisma.systemicCluster.create).toHaveBeenCalled();
    });

    it('updates existing cluster when similar complaints belong to one', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { complaintId: 'cmp-2', similarity: 0.92, category: 'misleading_conduct', businessId: 'biz-1', systemicClusterId: 'existing-cluster' },
          { complaintId: 'cmp-3', similarity: 0.89, category: 'misleading_conduct', businessId: 'biz-2', systemicClusterId: 'existing-cluster' },
          { complaintId: 'cmp-4', similarity: 0.87, category: 'misleading_conduct', businessId: 'biz-1', systemicClusterId: null },
        ])
        .mockResolvedValueOnce([{ count: BigInt(10) }]); // spike detection

      const result = await engine.processNewComplaint('cmp-1', 'Test complaint', 'tenant-1');

      expect(result.clusterAction).toBe('updated');
      expect(result.clusterId).toBe('existing-cluster');
      expect(mockPrisma.systemicCluster.update).toHaveBeenCalled();
    });

    it('detects spike when threshold exceeded', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // similarity search
        .mockResolvedValueOnce([{ count: BigInt(100) }]); // spike detection - above threshold

      const result = await engine.processNewComplaint('cmp-1', 'Test', 'tenant-1');

      expect(result.isSpike).toBe(true);
    });

    it('no spike when count below threshold', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // similarity search
        .mockResolvedValueOnce([{ count: BigInt(5) }]); // spike detection - below threshold

      const result = await engine.processNewComplaint('cmp-1', 'Test', 'tenant-1');

      expect(result.isSpike).toBe(false);
    });

    it('stores AI audit record for embedding', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // similarity search
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // spike detection

      await engine.processNewComplaint('cmp-1', 'Test complaint', 'tenant-1');

      expect(mockPrisma.aiOutput.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            complaintId: 'cmp-1',
            outputType: 'embedding',
            model: 'text-embedding-ada-002',
          }),
        }),
      );
    });

    it('handles embedding generation failure gracefully', async () => {
      const { getAiService } = await import('../../../src/server/services/ai/ai-service');
      vi.mocked(getAiService).mockReturnValueOnce({
        generateEmbedding: vi.fn().mockRejectedValue(new Error('API unavailable')),
        analyzeCluster: vi.fn(),
      } as any);

      const failEngine = new SystemicDetectionEngine(mockPrisma as any);
      const result = await failEngine.processNewComplaint('cmp-1', 'Test', 'tenant-1');

      expect(result.embeddingStored).toBe(false);
    });

    it('skips cluster update for cross-tenant cluster', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { complaintId: 'cmp-2', similarity: 0.92, category: 'test', businessId: null, systemicClusterId: 'cross-tenant-cluster' },
        { complaintId: 'cmp-3', similarity: 0.89, category: 'test', businessId: null, systemicClusterId: 'cross-tenant-cluster' },
        { complaintId: 'cmp-4', similarity: 0.87, category: 'test', businessId: null, systemicClusterId: null },
      ]);

      // Cluster belongs to a different tenant
      mockPrisma.systemicCluster.findUnique.mockResolvedValueOnce({ tenantId: 'other-tenant' });

      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // spike

      const result = await engine.processNewComplaint('cmp-1', 'Test', 'tenant-1');

      expect(result.clusterAction).toBe('none');
    });

    it('handles non-systemic AI analysis result', async () => {
      const { getAiService } = await import('../../../src/server/services/ai/ai-service');
      vi.mocked(getAiService).mockReturnValueOnce({
        generateEmbedding: vi.fn(async () => ({
          embedding: Array(1536).fill(0),
          model: 'text-embedding-ada-002',
          tokenUsage: 10,
        })),
        analyzeCluster: vi.fn(async () => ({
          result: { isSystemic: false, confidence: 0.45 },
          record: { model: 'gpt-4o', confidence: 0.45, reasoning: 'Not systemic', prompt: '', rawOutput: '{}', parsedOutput: {}, tokenUsage: {}, latencyMs: 100, outputType: 'clustering_analysis' },
        })),
      } as any);

      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { complaintId: 'cmp-2', similarity: 0.92, category: 'test', businessId: null, systemicClusterId: null },
        { complaintId: 'cmp-3', similarity: 0.89, category: 'test', businessId: null, systemicClusterId: null },
        { complaintId: 'cmp-4', similarity: 0.87, category: 'test', businessId: null, systemicClusterId: null },
      ]);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // spike

      const noClusterEngine = new SystemicDetectionEngine(mockPrisma as any);
      const result = await noClusterEngine.processNewComplaint('cmp-1', 'Test', 'tenant-1');

      expect(result.clusterAction).toBe('none');
      expect(result.clusterId).toBeNull();
    });
  });

  describe('configuration', () => {
    it('uses config defaults when no options provided', () => {
      const defaultEngine = new SystemicDetectionEngine(mockPrisma as any);
      expect(defaultEngine).toBeDefined();
    });

    it('accepts custom configuration', () => {
      const customEngine = new SystemicDetectionEngine(mockPrisma as any, {
        similarityThreshold: 0.9,
        clusterMinComplaints: 5,
        spikeWindowHours: 48,
        spikeThreshold: 100,
      });
      expect(customEngine).toBeDefined();
    });
  });
});
