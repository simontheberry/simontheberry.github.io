import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../../../src/server/services/ai/ai-service';
import type { AiProvider, AiCompletionResult, AiEmbeddingResult, AiMessage, AiCompletionOptions } from '../../../src/server/services/ai/provider';

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
    OPENAI_API_KEY: 'sk-test-key-mock',
    AI_MODEL: 'gpt-4',
  },
}));

vi.mock('../../../src/server/services/metrics/metrics', () => ({
  recordAiCall: vi.fn(),
}));

function createMockProvider(): AiProvider {
  return {
    name: 'mock-model',
    complete: vi.fn(async (messages: AiMessage[], _options?: AiCompletionOptions): Promise<AiCompletionResult> => {
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      const userPrompt = messages.find(m => m.role === 'user')?.content || '';
      let content: Record<string, unknown>;

      if (systemPrompt.includes('extract') || systemPrompt.includes('Extract')) {
        content = {
          confidence: 0.85,
          reasoning: 'Extracted key complaint data from text.',
          extractedFields: {
            businessName: 'TechStore',
            complaintCategory: 'product_safety',
            industry: 'retail',
            monetaryValue: 1000,
            keyFacts: ['Phone stopped working after 2 weeks'],
          },
          businessName: 'TechStore',
          complaintCategory: 'product_safety',
          industry: 'retail',
          monetaryValue: 1000,
          keyFacts: ['Phone stopped working after 2 weeks'],
        };
      } else if (systemPrompt.includes('classif') || systemPrompt.includes('Classif')) {
        content = {
          confidence: 0.88,
          reasoning: 'Classified based on complaint content analysis.',
          primaryCategory: 'product_safety',
          isCivilDispute: false,
          isSystemicRisk: false,
          breachLikelihood: 0.7,
        };
      } else if (userPrompt.includes('Evidence Document') || userPrompt.includes('analyzing supporting evidence')) {
        content = {
          confidence: 0.8,
          reasoning: 'Analyzed evidence relevance.',
          relevance: 'high',
          supports_complaint: true,
          key_findings: ['Document supports the claimed transaction'],
          new_information: [],
          severity_indicators: [],
        };
      } else if (systemPrompt.includes('risk assessment') || systemPrompt.includes('Risk')) {
        const isHighValue = userPrompt.includes('50000') || userPrompt.includes('5000');
        const isVulnerable = userPrompt.includes('vulnerable') || userPrompt.includes('Vulnerable');
        let riskScore = 0.5;
        if (isHighValue) riskScore += 0.2;
        if (isVulnerable) riskScore += 0.15;
        content = {
          confidence: 0.82,
          reasoning: 'Risk scored based on complaint factors.',
          riskScore,
          riskLevel: riskScore > 0.7 ? 'high' : 'medium',
          vulnerabilityIndicator: isVulnerable ? 0.8 : 0.2,
          systemicImpact: 0.3,
        };
      } else if (systemPrompt.includes('missing') || systemPrompt.includes('Missing') || systemPrompt.includes('intake')) {
        content = {
          confidence: 0.75,
          reasoning: 'Identified data gaps in complaint.',
          missingFields: ['date_of_incident', 'receipt_number'],
          followUpQuestions: ['When did this happen?', 'Do you have a receipt?'],
        };
      } else if (systemPrompt.includes('correspondence') || systemPrompt.includes('Correspondence') || systemPrompt.includes('communications')) {
        // Differentiate complainant response vs business notice by user prompt
        if (userPrompt.includes('BUSINESS NAME') || userPrompt.includes('business notice') || userPrompt.includes('regulatory notice')) {
          const businessName = userPrompt.match(/BUSINESS NAME:\s*(.+)/)?.[1]?.trim() ||
            userPrompt.match(/Business Name[:\s]+([^\n,}]+)/)?.[1]?.trim() || 'Company XYZ';
          content = {
            confidence: 0.87,
            reasoning: 'Drafted formal regulatory notification.',
            subject: `Notification of Complaint - ${businessName}`,
            body: `Dear ${businessName},\n\nThis is a formal notification that a complaint has been received regarding your business practices. You are required to respond within 14 business days.`,
          };
        } else {
          content = {
            confidence: 0.9,
            reasoning: 'Drafted professional response.',
            subject: 'Acknowledgment of Your Complaint',
            body: 'Dear Complainant,\n\nWe have received your complaint and acknowledge the issues you have raised.',
          };
        }
      } else if (systemPrompt.includes('cluster') || systemPrompt.includes('systemic')) {
        content = {
          confidence: 0.87,
          reasoning: 'Analyzed clustering patterns.',
          clusters: [],
          patterns: [],
        };
      } else if (systemPrompt.includes('summar') || systemPrompt.includes('Summar')) {
        content = {
          confidence: 0.9,
          reasoning: 'Generated executive summary.',
          summary: 'Customer complaint about defective product from TechStore.',
          executiveSummary: 'A consumer purchased a phone that failed after 2 weeks.',
        };
      } else {
        content = {
          confidence: 0.85,
          reasoning: 'Processed AI request.',
          result: 'Generic response',
        };
      }

      return {
        content: JSON.stringify(content),
        model: 'mock-model',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        latencyMs: 100,
      };
    }),
    embed: vi.fn(async (_text: string): Promise<AiEmbeddingResult> => ({
      embedding: Array(1536).fill(0).map(() => Math.random() * 2 - 1),
      model: 'text-embedding-ada-002',
      tokenUsage: 10,
    })),
  };
}

describe('AiService', () => {
  let aiService: AiService;

  beforeEach(() => {
    aiService = new AiService(createMockProvider());
    vi.clearAllMocks();
  });

  describe('extractComplaintData', () => {
    it('extracts structured data from complaint text', async () => {
      const result = await aiService.extractComplaintData(
        'I bought a phone from TechStore for $1000 on Jan 15. It stopped working after 2 weeks.',
      );
      expect(result).toBeDefined();
      expect(result.result).toBeDefined();
      expect(result.record.confidence).toBeGreaterThan(0);
      expect(result.record.confidence).toBeLessThanOrEqual(1);
    });

    it('stores output type as extraction', async () => {
      const result = await aiService.extractComplaintData('Test complaint about product');
      expect(result.record.outputType).toBe('extraction');
    });
  });

  describe('classifyComplaint', () => {
    it('classifies complaint into category', async () => {
      const result = await aiService.classifyComplaint('The product was not as described', {
        complainant: 'John Doe',
        business: 'Online Store',
      });
      expect(result.record.outputType).toBe('classification');
      expect(result.record.confidence).toBeGreaterThan(0);
    });
  });

  describe('scoreRisk', () => {
    it('scores risk between 0 and 1', async () => {
      const result = await aiService.scoreRisk(
        'Dangerous product worth $5000',
        { legalCategory: 'consumer_protection' },
        { previousComplaintCount: 2, industry: 'retail', businessStatus: 'active' },
      );
      const score = (result.result as Record<string, unknown>).riskScore as number;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('high monetary value increases risk score', async () => {
      const lowResult = await aiService.scoreRisk(
        'Small issue worth $100',
        {},
        { previousComplaintCount: 0, industry: 'retail', businessStatus: 'active' },
      );
      const highResult = await aiService.scoreRisk(
        'Major issue worth $50000',
        {},
        { previousComplaintCount: 0, industry: 'retail', businessStatus: 'active' },
      );
      const lowScore = (lowResult.result as Record<string, unknown>).riskScore as number;
      const highScore = (highResult.result as Record<string, unknown>).riskScore as number;
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('vulnerable indicator increases risk', async () => {
      const nonVulnResult = await aiService.scoreRisk(
        'Regular complaint about product',
        {},
        { previousComplaintCount: 0, industry: 'retail', businessStatus: 'active' },
      );
      const vulnResult = await aiService.scoreRisk(
        'Vulnerable consumer complaint about product',
        {},
        { previousComplaintCount: 0, industry: 'retail', businessStatus: 'active' },
      );
      const nonVulnScore = (nonVulnResult.result as Record<string, unknown>).riskScore as number;
      const vulnScore = (vulnResult.result as Record<string, unknown>).riskScore as number;
      expect(vulnScore).toBeGreaterThan(nonVulnScore);
    });
  });

  describe('summariseComplaint', () => {
    it('generates executive summary', async () => {
      const result = await aiService.summariseComplaint('Long complaint text about product issues.');
      expect(result.record.outputType).toBe('summarisation');
      expect(result.record.confidence).toBeGreaterThan(0);
    });
  });

  describe('detectMissingData', () => {
    it('identifies missing fields', async () => {
      const result = await aiService.detectMissingData('Bad experience', { amount: null });
      expect(result.result).toHaveProperty('missingFields');
      expect(Array.isArray((result.result as Record<string, unknown>).missingFields)).toBe(true);
    });

    it('returns follow-up questions', async () => {
      const result = await aiService.detectMissingData('Bad experience', {});
      expect(result.result).toHaveProperty('followUpQuestions');
    });
  });

  describe('draftComplainantResponse', () => {
    it('generates professional response', async () => {
      const result = await aiService.draftComplainantResponse(
        'Customer received defective product',
        'product_safety',
        'high',
      );
      expect(result.result).toHaveProperty('subject');
      expect(result.result).toHaveProperty('body');
    });

    it('includes acknowledgment language', async () => {
      const result = await aiService.draftComplainantResponse('Product issue', 'product_safety', 'medium');
      const body = (result.result as Record<string, unknown>).body as string;
      expect(body.toLowerCase()).toMatch(/received|acknowledge|understand/);
    });
  });

  describe('draftBusinessNotice', () => {
    it('generates formal notice', async () => {
      const result = await aiService.draftBusinessNotice(
        'Complaint about service quality',
        'Tech Services Ltd',
        'service_quality',
        'Misleading advertising',
      );
      expect(result.result).toHaveProperty('subject');
      expect(result.result).toHaveProperty('body');
    });

    it('uses professional tone', async () => {
      const result = await aiService.draftBusinessNotice(
        'Complaint received',
        'Company XYZ',
        'misleading_conduct',
        'False claims',
      );
      const body = (result.result as Record<string, unknown>).body as string;
      expect(body.toLowerCase()).toMatch(/dear|notification|formal/);
    });
  });

  describe('generateEmbedding', () => {
    it('generates 1536-dimensional embedding', async () => {
      const result = await aiService.generateEmbedding('Test complaint for embedding');
      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(1536);
    });

    it('returns model name', async () => {
      const result = await aiService.generateEmbedding('Test');
      expect(result.model).toBe('text-embedding-ada-002');
    });
  });

  describe('analyzeEvidence', () => {
    it('analyzes evidence relevance', async () => {
      const result = await aiService.analyzeEvidence(
        'Invoice shows charge of $500',
        'Charged twice for same service',
        'invoice.txt',
      );
      expect(result.record.outputType).toBe('evidence_analysis');
      expect(result.record.confidence).toBeGreaterThan(0);
    });

    it('returns findings', async () => {
      const result = await aiService.analyzeEvidence('Test content', 'Test complaint', 'test.txt');
      expect(result.result).toHaveProperty('key_findings');
    });
  });

  describe('token usage tracking', () => {
    it('records token usage in output record', async () => {
      const result = await aiService.extractComplaintData('test complaint about product');
      expect(result.record.tokenUsage).toBeDefined();
    });

    it('records latency in output record', async () => {
      const result = await aiService.extractComplaintData('test complaint about product');
      expect(result.record.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
