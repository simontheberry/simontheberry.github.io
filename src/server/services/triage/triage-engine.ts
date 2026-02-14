// ============================================================================
// Triage Engine
// Orchestrates the full AI triage pipeline for a complaint
// ============================================================================

import { createLogger } from '../../utils/logger';
import { getAiService, type AiOutputRecord } from '../ai/ai-service';
import type {
  RiskLevel,
  RoutingDestination,
  TriageResult,
  PriorityWeights,
  DEFAULT_PRIORITY_WEIGHTS,
} from '../../../shared/types/complaint';

const logger = createLogger('triage-engine');

export interface TriageInput {
  complaintId: string;
  rawText: string;
  businessContext: {
    previousComplaintCount: number;
    industry: string;
    businessStatus: string;
  };
  priorityWeights?: PriorityWeights;
}

export interface TriageOutput {
  triageResult: TriageResult;
  aiOutputs: AiOutputRecord[];
  summary: string;
}

export class TriageEngine {
  private aiService = getAiService();

  async triageComplaint(input: TriageInput): Promise<TriageOutput> {
    const aiOutputs: AiOutputRecord[] = [];
    const startTime = Date.now();

    logger.info(`Starting triage for complaint ${input.complaintId}`);

    // ---- Step 1: Extract structured data ----
    const { result: extractedData, record: extractionRecord } =
      await this.aiService.extractComplaintData(input.rawText);
    aiOutputs.push(extractionRecord);

    // ---- Step 2: Classify complaint ----
    const { result: classification, record: classificationRecord } =
      await this.aiService.classifyComplaint(input.rawText, extractedData);
    aiOutputs.push(classificationRecord);

    // ---- Step 3: Score risk ----
    const { result: riskAssessment, record: riskRecord } =
      await this.aiService.scoreRisk(input.rawText, classification, input.businessContext);
    aiOutputs.push(riskRecord);

    // ---- Step 4: Summarise ----
    const { result: summary, record: summaryRecord } =
      await this.aiService.summariseComplaint(input.rawText);
    aiOutputs.push(summaryRecord);

    // ---- Step 5: Calculate priority score ----
    const risk = riskAssessment as Record<string, unknown>;
    const complexityFactors = risk.complexityFactors as Record<string, number>;
    const classificationData = classification as Record<string, unknown>;

    const weights = input.priorityWeights || {
      riskScore: 0.30,
      systemicImpact: 0.25,
      monetaryHarm: 0.15,
      vulnerabilityIndicator: 0.20,
      resolutionProbability: 0.10,
    };

    const riskScore = this.riskLevelToScore(risk.riskLevel as string);
    const systemicImpact = risk.systemicImpactScore as number || 0;
    const monetaryHarm = complexityFactors.monetaryValue || 0;
    const vulnerability = risk.vulnerabilityScore as number || 0;
    const resolutionProb = risk.resolutionProbability as number || 0.5;

    const priorityScore =
      (riskScore * weights.riskScore) +
      (systemicImpact * weights.systemicImpact) +
      (monetaryHarm * weights.monetaryHarm) +
      (vulnerability * weights.vulnerabilityIndicator) +
      ((1 - resolutionProb) * weights.resolutionProbability);

    // ---- Step 6: Determine routing ----
    const routingDestination = this.determineRouting(
      risk.riskLevel as string,
      risk.complexityScore as number,
      classificationData.isSystemicRisk as boolean,
      priorityScore,
    );

    const triageResult: TriageResult = {
      complaintId: input.complaintId,
      category: (classificationData.primaryCategory as string) || 'other',
      legalCategory: classificationData.legalCategory as string || 'unknown',
      riskLevel: risk.riskLevel as RiskLevel,
      complexityScore: risk.complexityScore as number,
      priorityScore: Math.round(priorityScore * 1000) / 1000,
      routingDestination,
      isCivilDispute: classificationData.isCivilDispute as boolean || false,
      isSystemicRisk: classificationData.isSystemicRisk as boolean || false,
      breachLikelihood: classificationData.breachLikelihood as number || 0,
      publicHarmIndicator: risk.publicHarmIndicator as number || 0,
      complexityFactors: complexityFactors as TriageResult['complexityFactors'],
      confidence: Math.min(
        extractionRecord.confidence || 0,
        classificationRecord.confidence || 0,
        riskRecord.confidence || 0,
      ),
      reasoning: risk.reasoning as string || '',
      modelUsed: extractionRecord.model,
      processedAt: new Date().toISOString(),
    };

    const totalTime = Date.now() - startTime;
    logger.info(`Triage completed for ${input.complaintId}`, {
      priorityScore: triageResult.priorityScore,
      riskLevel: triageResult.riskLevel,
      routing: triageResult.routingDestination,
      totalTimeMs: totalTime,
    });

    return {
      triageResult,
      aiOutputs,
      summary: (summary as Record<string, unknown>).executiveSummary as string || '',
    };
  }

  private riskLevelToScore(level: string): number {
    switch (level) {
      case 'critical': return 1.0;
      case 'high': return 0.75;
      case 'medium': return 0.5;
      case 'low': return 0.25;
      default: return 0.5;
    }
  }

  private determineRouting(
    riskLevel: string,
    complexityScore: number,
    isSystemicRisk: boolean,
    priorityScore: number,
  ): RoutingDestination {
    // Systemic issues always go to systemic review
    if (isSystemicRisk) {
      return 'systemic_review';
    }

    // Critical risk or high complexity -> investigation
    if (riskLevel === 'critical' || complexityScore > 0.7) {
      return 'line_2_investigation';
    }

    // High risk with moderate complexity -> investigation
    if (riskLevel === 'high' && complexityScore > 0.4) {
      return 'line_2_investigation';
    }

    // High priority score -> investigation
    if (priorityScore > 0.6) {
      return 'line_2_investigation';
    }

    // Everything else -> Line 1 assisted auto
    return 'line_1_auto';
  }
}
