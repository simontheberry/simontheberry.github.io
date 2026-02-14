// ============================================================================
// AI Service – Orchestrates all AI operations
// ============================================================================

import { createLogger } from '../../utils/logger';
import {
  type AiProvider,
  type AiCompletionResult,
  type AiEmbeddingResult,
  type AiMessage,
  type AiCompletionOptions,
  createAiProvider,
} from './provider';
import {
  SYSTEM_PROMPTS,
  EXTRACTION_PROMPT,
  CLASSIFICATION_PROMPT,
  RISK_SCORING_PROMPT,
  SUMMARISATION_PROMPT,
  MISSING_DATA_PROMPT,
  DRAFT_RESPONSE_COMPLAINANT_PROMPT,
  DRAFT_BUSINESS_NOTICE_PROMPT,
  CLUSTERING_ANALYSIS_PROMPT,
  interpolatePrompt,
} from './prompts';
import { config } from '../../config';

const logger = createLogger('ai-service');

export interface AiOutputRecord {
  outputType: string;
  model: string;
  prompt: string;
  rawOutput: string;
  parsedOutput: unknown;
  confidence: number | null;
  reasoning: string | null;
  tokenUsage: Record<string, number>;
  latencyMs: number;
}

export class AiService {
  private provider: AiProvider;

  constructor(provider?: AiProvider) {
    this.provider = provider || createAiProvider(
      config.AI_PROVIDER,
      config.OPENAI_API_KEY || config.ANTHROPIC_API_KEY || '',
      config.AI_MODEL,
      config.EMBEDDING_MODEL,
    );
  }

  // ---- Core AI Operations ----

  private async runPipeline<T>(
    systemPrompt: string,
    userPrompt: string,
    outputType: string,
    options?: AiCompletionOptions,
  ): Promise<{ result: T; record: AiOutputRecord }> {
    const messages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const completion = await this.provider.complete(messages, {
      jsonMode: true,
      temperature: 0.1,
      ...options,
    });

    let parsed: T;
    try {
      parsed = JSON.parse(completion.content) as T;
    } catch {
      logger.error('Failed to parse AI JSON response', { outputType, content: completion.content });
      throw new Error(`AI returned invalid JSON for ${outputType}`);
    }

    const record: AiOutputRecord = {
      outputType,
      model: completion.model,
      prompt: userPrompt.slice(0, 500), // Truncate for storage
      rawOutput: completion.content,
      parsedOutput: parsed,
      confidence: (parsed as Record<string, unknown>)?.confidence as number ?? null,
      reasoning: (parsed as Record<string, unknown>)?.reasoning as string ?? null,
      tokenUsage: completion.tokenUsage,
      latencyMs: completion.latencyMs,
    };

    logger.info(`AI pipeline completed: ${outputType}`, {
      model: completion.model,
      tokens: completion.tokenUsage.totalTokens,
      latencyMs: completion.latencyMs,
    });

    return { result: parsed, record };
  }

  // ---- Extraction ----

  async extractComplaintData(complaintText: string) {
    const prompt = interpolatePrompt(EXTRACTION_PROMPT, { complaintText });
    return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'extraction');
  }

  // ---- Classification ----

  async classifyComplaint(complaintText: string, extractedData: unknown) {
    const prompt = interpolatePrompt(CLASSIFICATION_PROMPT, {
      complaintText,
      extractedData: JSON.stringify(extractedData, null, 2),
    });
    return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'classification');
  }

  // ---- Risk Scoring ----

  async scoreRisk(
    complaintText: string,
    classification: unknown,
    context: { previousComplaintCount: number; industry: string; businessStatus: string },
  ) {
    const prompt = interpolatePrompt(RISK_SCORING_PROMPT, {
      complaintText,
      classification: JSON.stringify(classification, null, 2),
      previousComplaintCount: String(context.previousComplaintCount),
      industry: context.industry,
      businessStatus: context.businessStatus,
    });
    return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'risk_scoring');
  }

  // ---- Summarisation ----

  async summariseComplaint(complaintText: string) {
    const prompt = interpolatePrompt(SUMMARISATION_PROMPT, { complaintText });
    return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'summarisation');
  }

  // ---- Missing Data Detection (Intake Guidance) ----

  async detectMissingData(complaintText: string, currentData: Record<string, unknown>) {
    const prompt = interpolatePrompt(MISSING_DATA_PROMPT, {
      complaintText,
      currentData: JSON.stringify(currentData, null, 2),
    });
    return this.runPipeline(SYSTEM_PROMPTS.INTAKE_ASSISTANT, prompt, 'missing_data');
  }

  // ---- Draft Correspondence ----

  async draftComplainantResponse(
    summary: string,
    category: string,
    riskLevel: string,
  ) {
    const prompt = interpolatePrompt(DRAFT_RESPONSE_COMPLAINANT_PROMPT, {
      summary,
      category,
      riskLevel,
    });
    return this.runPipeline(SYSTEM_PROMPTS.CORRESPONDENCE_DRAFTER, prompt, 'draft_response');
  }

  async draftBusinessNotice(
    summary: string,
    businessName: string,
    category: string,
    issues: string,
  ) {
    const prompt = interpolatePrompt(DRAFT_BUSINESS_NOTICE_PROMPT, {
      summary,
      businessName,
      category,
      issues,
    });
    return this.runPipeline(SYSTEM_PROMPTS.CORRESPONDENCE_DRAFTER, prompt, 'draft_notice');
  }

  // ---- Clustering Analysis ----

  async analyzeCluster(complaints: Array<{ id: string; summary: string; category: string }>) {
    const prompt = interpolatePrompt(CLUSTERING_ANALYSIS_PROMPT, {
      complaints: JSON.stringify(complaints, null, 2),
    });
    return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'clustering_analysis');
  }

  // ---- Embeddings ----

  async generateEmbedding(text: string): Promise<AiEmbeddingResult> {
    return this.provider.embed(text);
  }
}

// Singleton instance
let aiServiceInstance: AiService | null = null;

export function getAiService(): AiService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AiService();
  }
  return aiServiceInstance;
}
