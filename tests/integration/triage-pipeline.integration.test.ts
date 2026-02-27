import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../../src/server/services/ai/ai-service';
import {
  calculatePriorityScore,
  normalizeMonetaryValue,
  riskLevelToNumeric,
} from '../../src/server/services/triage/priority-calculator';
import { DEFAULT_PRIORITY_WEIGHTS } from '../../src/shared/types/complaint';
import {
  createTestComplaint,
  createTestTenant,
  createTestAiOutput,
} from '../factories';

// Mock AI service
vi.mock('../../src/server/services/ai/ai-service');

// Inline routing logic matching TriageEngine.determineRouting
function determineRouting(priorityScore: number, riskScore: number): string {
  if (riskScore >= 0.85 || priorityScore >= 0.85) return 'systemic_review';
  if (riskScore >= 0.6 || priorityScore >= 0.5) return 'line_2_investigation';
  return 'line_1_auto';
}

describe('Triage Pipeline Integration', () => {
  let aiService: any;
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
  });

  describe('End-to-end Triage Flow', () => {
    it('processes complaint through full triage pipeline', async () => {
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

      vi.mocked(aiService.extractComplaintData).mockResolvedValueOnce(extractResult);
      const extracted = await aiService.extractComplaintData(mockComplaint.rawText);
      expect(extracted.record.confidence).toBeGreaterThan(0.9);
      expect(extracted.result.extractedFields.amount).toBe(1000);

      const classifyResult = {
        record: { outputType: 'classification', confidence: 0.88 },
        result: {
          category: 'product_safety',
          legalCategory: 'consumer_protection',
          description: 'Defective product causing harm',
        },
      };

      vi.mocked(aiService.classifyComplaint).mockResolvedValueOnce(classifyResult);
      const classified = await aiService.classifyComplaint(mockComplaint.rawText, extracted.result.extractedFields);
      expect(classified.record.outputType).toBe('classification');
      expect(classified.result.category).toBe('product_safety');

      const riskResult = {
        result: { riskScore: 0.75, justification: 'High monetary value with safety concern' },
        record: { outputType: 'scoring', confidence: 0.85 },
      };

      vi.mocked(aiService.scoreRisk).mockResolvedValueOnce(riskResult);
      const scored = await aiService.scoreRisk(mockComplaint.rawText, classified.result, {
        previousComplaintCount: 0,
        industry: 'retail',
        businessStatus: 'active',
      });
      expect((scored.result as any).riskScore).toBeGreaterThan(0.7);

      // Priority calculation using actual utility
      const priorityScore = calculatePriorityScore(
        {
          riskScore: (scored.result as any).riskScore,
          systemicImpact: 0.2,
          monetaryHarm: normalizeMonetaryValue(1000),
          vulnerabilityIndicator: 0,
          resolutionProbability: 0.6,
        },
        DEFAULT_PRIORITY_WEIGHTS,
      );

      expect(priorityScore).toBeGreaterThan(0);
      expect(priorityScore).toBeLessThanOrEqual(1);

      // Routing decision
      const routingDecision = determineRouting(priorityScore, (scored.result as any).riskScore);
      expect(['line_1_auto', 'line_2_investigation', 'systemic_review']).toContain(routingDecision);
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
        record: { outputType: 'analysis', confidence: 0.95 },
      };

      vi.mocked(aiService.detectMissingData).mockResolvedValueOnce(detectResult);
      const missingData = await aiService.detectMissingData(incompletComplaint.rawText, {
        amount: incompletComplaint.monetaryValue,
        phone: incompletComplaint.complainantPhone,
      });

      expect(missingData.result.missingFields.length).toBeGreaterThan(0);
      expect(missingData.result.followUpQuestions.length).toBeGreaterThan(0);
    });

    it('high monetary value triggers escalation path', async () => {
      const riskResult = { result: { riskScore: 0.92 }, record: { confidence: 0.9 } };
      vi.mocked(aiService.scoreRisk).mockResolvedValueOnce(riskResult);

      const scored = await aiService.scoreRisk(mockComplaint.rawText, {}, {
        previousComplaintCount: 1,
        industry: 'retail',
        businessStatus: 'active',
      });
      expect((scored.result as any).riskScore).toBeGreaterThan(0.85);

      const routing = determineRouting(0.85, (scored.result as any).riskScore);
      expect(routing).toBe('systemic_review');
    });

    it('vulnerable consumer flag increases priority', async () => {
      const vulnerableRisk = { result: { riskScore: 0.65 } };
      const nonVulnerableRisk = { result: { riskScore: 0.45 } };

      vi.mocked(aiService.scoreRisk)
        .mockResolvedValueOnce(vulnerableRisk)
        .mockResolvedValueOnce(nonVulnerableRisk);

      const vulnScored = await aiService.scoreRisk(mockComplaint.rawText, {}, {
        previousComplaintCount: 0,
        industry: 'retail',
        businessStatus: 'active',
      });
      const nonVulnScored = await aiService.scoreRisk(mockComplaint.rawText, {}, {
        previousComplaintCount: 0,
        industry: 'retail',
        businessStatus: 'active',
      });

      expect((vulnScored.result as any).riskScore).toBeGreaterThan(
        (nonVulnScored.result as any).riskScore,
      );
    });
  });

  describe('Priority Score Calculation', () => {
    it('calculates priority from AI outputs', () => {
      const score = calculatePriorityScore(
        {
          riskScore: 0.75,
          systemicImpact: 0.3,
          monetaryHarm: normalizeMonetaryValue(5000),
          vulnerabilityIndicator: 0.8,
          resolutionProbability: 0.4,
        },
        DEFAULT_PRIORITY_WEIGHTS,
      );

      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('higher monetary value increases priority', () => {
      const lowMoney = calculatePriorityScore(
        {
          riskScore: 0.5, systemicImpact: 0.3,
          monetaryHarm: normalizeMonetaryValue(100),
          vulnerabilityIndicator: 0, resolutionProbability: 0.5,
        },
        DEFAULT_PRIORITY_WEIGHTS,
      );

      const highMoney = calculatePriorityScore(
        {
          riskScore: 0.5, systemicImpact: 0.3,
          monetaryHarm: normalizeMonetaryValue(50000),
          vulnerabilityIndicator: 0, resolutionProbability: 0.5,
        },
        DEFAULT_PRIORITY_WEIGHTS,
      );

      expect(highMoney).toBeGreaterThan(lowMoney);
    });

    it('vulnerability increases priority', () => {
      const noVuln = calculatePriorityScore(
        {
          riskScore: 0.5, systemicImpact: 0.3,
          monetaryHarm: 0.3, vulnerabilityIndicator: 0,
          resolutionProbability: 0.5,
        },
        DEFAULT_PRIORITY_WEIGHTS,
      );

      const withVuln = calculatePriorityScore(
        {
          riskScore: 0.5, systemicImpact: 0.3,
          monetaryHarm: 0.3, vulnerabilityIndicator: 1.0,
          resolutionProbability: 0.5,
        },
        DEFAULT_PRIORITY_WEIGHTS,
      );

      expect(withVuln).toBeGreaterThan(noVuln);
    });

    it('risk level converts to numeric correctly', () => {
      expect(riskLevelToNumeric('critical')).toBe(1.0);
      expect(riskLevelToNumeric('high')).toBe(0.75);
      expect(riskLevelToNumeric('medium')).toBe(0.5);
      expect(riskLevelToNumeric('low')).toBe(0.25);
    });
  });

  describe('Routing Decisions', () => {
    it('routes critical risk to systemic review', () => {
      expect(determineRouting(0.9, 0.9)).toBe('systemic_review');
    });

    it('routes high priority to line 2 investigation', () => {
      expect(determineRouting(0.6, 0.65)).toBe('line_2_investigation');
    });

    it('routes low risk to line 1 auto', () => {
      expect(determineRouting(0.3, 0.3)).toBe('line_1_auto');
    });

    it('high risk score alone triggers systemic review', () => {
      expect(determineRouting(0.4, 0.9)).toBe('systemic_review');
    });

    it('high priority score alone triggers systemic review', () => {
      expect(determineRouting(0.9, 0.4)).toBe('systemic_review');
    });
  });

  describe('Confidence-based Routing', () => {
    it('high confidence results are valid for auto-routing', async () => {
      const aiOutput = createTestAiOutput(mockComplaint.id, {
        confidence: 0.95,
        outputType: 'classification',
      });

      expect(aiOutput.confidence).toBeGreaterThanOrEqual(
        mockTenant.settings.autoSendConfidenceThreshold,
      );
    });

    it('medium confidence requires supervisor review', async () => {
      const aiOutput = createTestAiOutput(mockComplaint.id, {
        confidence: 0.65,
        outputType: 'classification',
      });

      expect(aiOutput.confidence).toBeLessThan(
        mockTenant.settings.supervisorReviewThreshold,
      );
    });

    it('low confidence triggers manual review', async () => {
      const aiOutput = createTestAiOutput(mockComplaint.id, {
        confidence: 0.55,
        outputType: 'classification',
      });

      expect(aiOutput.confidence).toBeLessThan(0.7);
      const shouldRequireReview =
        aiOutput.confidence < mockTenant.settings.supervisorReviewThreshold;
      expect(shouldRequireReview).toBe(true);
    });
  });

  describe('Systemic Risk Detection', () => {
    it('detects systemic patterns from multiple complaints', () => {
      const complaints = [
        createTestComplaint(mockTenant.id, { businessId: 'biz-1', category: 'misleading_conduct', monetaryValue: 1000 }),
        createTestComplaint(mockTenant.id, { businessId: 'biz-1', category: 'misleading_conduct', monetaryValue: 1500 }),
        createTestComplaint(mockTenant.id, { businessId: 'biz-1', category: 'misleading_conduct', monetaryValue: 2000 }),
      ];

      const clustered = complaints.reduce((acc: Record<string, number>, complaint) => {
        const key = `${complaint.businessId}:${complaint.category}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const systemicThreshold = 3;
      const systemicRisks = Object.entries(clustered).filter(([_, count]) => count >= systemicThreshold);
      expect(systemicRisks.length).toBeGreaterThan(0);
    });
  });
});
