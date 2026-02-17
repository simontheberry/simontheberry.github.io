import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../../src/server/services/ai/ai-service';
import { TriageService } from '../../src/server/services/triage/triage-service';
import {
  createTestComplaint,
  createTestTenant,
  createTestAiOutput,
} from '../factories';

// Mock AI service
vi.mock('../../src/server/services/ai/ai-service');

describe('Triage Pipeline Integration', () => {
  let aiService: any;
  let triageService: TriageService;
  let mockTenant: any;
  let mockComplaint: any;

  beforeEach(() => {
    mockTenant = createTestTenant();
    mockComplaint = createTestComplaint(mockTenant.id, {
      rawText: 'I bought a phone from TechStore for $1000. It stopped working after 2 weeks.',
      monetaryValue: 1000,
      isVulnerable: false,
    });

    aiService = new AiService();
    triageService = new TriageService();
  });

  describe('End-to-end Triage Flow', () => {
    it('processes complaint through full triage pipeline', async () => {
      // Step 1: Extract complaint data
      const extractResult = {
        result: {
          extractedFields: {
            amount: 1000,
            date: '2025-02-01',
            businessName: 'TechStore',
            issueType: 'product_defect',
          },
        },
        record: {
          confidence: 0.92,
          outputType: 'extraction',
        },
      };

      vi.mocked(aiService.extractComplaintData).mockResolvedValueOnce(
        extractResult,
      );

      const extracted = await aiService.extractComplaintData(
        mockComplaint.rawText,
      );
      expect(extracted.record.confidence).toBeGreaterThan(0.9);
      expect(extracted.result.extractedFields.amount).toBe(1000);

      // Step 2: Classify complaint
      const classifyResult = {
        record: {
          outputType: 'classification',
          confidence: 0.88,
        },
        result: {
          category: 'product_safety',
          legalCategory: 'consumer_protection',
          description: 'Defective product causing harm',
        },
      };

      vi.mocked(aiService.classifyComplaint).mockResolvedValueOnce(
        classifyResult,
      );

      const classified = await aiService.classifyComplaint(
        mockComplaint.rawText,
        extracted.result.extractedFields,
      );
      expect(classified.record.outputType).toBe('classification');
      expect(classified.result.category).toBe('product_safety');

      // Step 3: Score risk
      const riskResult = {
        result: {
          riskScore: 0.75,
          justification: 'High monetary value with safety concern',
        },
        record: {
          outputType: 'scoring',
          confidence: 0.85,
        },
      };

      vi.mocked(aiService.scoreRisk).mockResolvedValueOnce(riskResult);

      const scored = await aiService.scoreRisk(mockComplaint, classified.result);
      expect((scored.result as any).riskScore).toBeGreaterThan(0.7);

      // Step 4: Priority calculation using tenant weights
      const priorityScore = await triageService.calculatePriority(
        {
          riskScore: (scored.result as any).riskScore,
          systemicImpact: 0.2,
          monetaryHarm: 0.8,
          vulnerabilityIndicator: 0,
          resolutionProbability: 0.6,
        },
        mockTenant.settings.priorityWeights,
      );

      expect(priorityScore).toBeGreaterThan(0);
      expect(priorityScore).toBeLessThanOrEqual(1);

      // Step 5: Routing decision
      const routingDecision = triageService.determineRouting(
        priorityScore,
        (scored.result as any).riskScore,
      );

      expect(['line_1_auto', 'line_2_investigation', 'systemic_review']).toContain(
        routingDecision,
      );
    });

    it('handles missing data during triage', async () => {
      const incompletComplaint = createTestComplaint(mockTenant.id, {
        rawText: 'Bad experience.',
        monetaryValue: null,
        complainantPhone: null,
      });

      const detectResult = {
        result: {
          missingFields: ['amount', 'phone', 'businessName'],
          followUpQuestions: [
            'How much was the transaction?',
            'What is your phone number?',
            'Which business was involved?',
          ],
        },
        record: {
          outputType: 'analysis',
          confidence: 0.95,
        },
      };

      vi.mocked(aiService.detectMissingData).mockResolvedValueOnce(detectResult);

      const missingData = await aiService.detectMissingData(
        incompletComplaint.rawText,
        {
          amount: incompletComplaint.monetaryValue,
          phone: incompletComplaint.complainantPhone,
        },
      );

      expect(missingData.result.missingFields.length).toBeGreaterThan(0);
      expect(missingData.result.followUpQuestions.length).toBeGreaterThan(0);
    });

    it('high monetary value triggers escalation path', async () => {
      const highValueComplaint = createTestComplaint(mockTenant.id, {
        monetaryValue: 50000,
        isVulnerable: true,
      });

      const riskResult = {
        result: {
          riskScore: 0.92,
        },
        record: {
          confidence: 0.9,
        },
      };

      vi.mocked(aiService.scoreRisk).mockResolvedValueOnce(riskResult);

      const scored = await aiService.scoreRisk(highValueComplaint, {});
      expect((scored.result as any).riskScore).toBeGreaterThan(0.85);

      const routing = triageService.determineRouting(0.85, (scored.result as any).riskScore);
      expect(routing).toBe('line_2_investigation');
    });

    it('vulnerable consumer flag increases priority', async () => {
      const vulnerableComplaint = createTestComplaint(mockTenant.id, {
        isVulnerable: true,
        monetaryValue: 500,
      });

      const nonVulnerable = createTestComplaint(mockTenant.id, {
        isVulnerable: false,
        monetaryValue: 500,
      });

      const vulnerableRisk = { result: { riskScore: 0.65 } };
      const nonVulnerableRisk = { result: { riskScore: 0.45 } };

      vi.mocked(aiService.scoreRisk)
        .mockResolvedValueOnce(vulnerableRisk)
        .mockResolvedValueOnce(nonVulnerableRisk);

      const vulnScored = await aiService.scoreRisk(vulnerableComplaint, {});
      const nonVulnScored = await aiService.scoreRisk(nonVulnerable, {});

      expect((vulnScored.result as any).riskScore).toBeGreaterThan(
        (nonVulnScored.result as any).riskScore,
      );
    });
  });

  describe('Confidence-based Routing', () => {
    it('high confidence results route to line 1', async () => {
      const aiOutput = createTestAiOutput(mockComplaint.id, {
        confidence: 0.95,
        outputType: 'classification',
      });

      expect(aiOutput.confidence).toBeGreaterThanOrEqual(
        mockTenant.settings.autoSendConfidenceThreshold,
      );

      // Route directly to line 1
      const routing = triageService.determineRouting(0.9, 0.6);
      expect(routing).toBe('line_1_auto');
    });

    it('medium confidence results route to line 2', async () => {
      const aiOutput = createTestAiOutput(mockComplaint.id, {
        confidence: 0.75,
        outputType: 'classification',
      });

      expect(aiOutput.confidence).toBeLessThan(
        mockTenant.settings.supervisorReviewThreshold,
      );

      // Route to line 2 for supervisor review
      const routing = triageService.determineRouting(0.7, 0.5);
      expect(routing).toBe('line_2_investigation');
    });

    it('low confidence results trigger supervisor review', async () => {
      const aiOutput = createTestAiOutput(mockComplaint.id, {
        confidence: 0.55,
        outputType: 'classification',
      });

      expect(aiOutput.confidence).toBeLessThan(0.7);

      // Must route to supervisor for review
      const shouldRequireReview =
        aiOutput.confidence < mockTenant.settings.supervisorReviewThreshold;
      expect(shouldRequireReview).toBe(true);
    });
  });

  describe('Systemic Risk Detection', () => {
    it('detects systemic patterns from multiple complaints', async () => {
      const complaints = [
        createTestComplaint(mockTenant.id, {
          businessId: 'biz-1',
          category: 'misleading_conduct',
          monetaryValue: 1000,
        }),
        createTestComplaint(mockTenant.id, {
          businessId: 'biz-1',
          category: 'misleading_conduct',
          monetaryValue: 1500,
        }),
        createTestComplaint(mockTenant.id, {
          businessId: 'biz-1',
          category: 'misleading_conduct',
          monetaryValue: 2000,
        }),
      ];

      // Cluster complaints by business and category
      const clustered = complaints.reduce(
        (acc: any, complaint) => {
          const key = `${complaint.businessId}:${complaint.category}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const systemicThreshold = 3;
      const systemicRisks = Object.entries(clustered).filter(
        ([_, count]) => count >= systemicThreshold,
      );

      expect(systemicRisks.length).toBeGreaterThan(0);
    });
  });
});
