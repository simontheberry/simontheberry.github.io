// ============================================================================
// AI Service – Orchestrates all AI operations
// ============================================================================

import { z } from 'zod';
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
  TASK_TEMPERATURES,
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
import { recordAiCall, recordAiError } from '../metrics/metrics';

// ---- Zod Schemas for AI Output Validation ----

const baseOutputSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

const extractionOutputSchema = baseOutputSchema.extend({
  businessName: z.string().nullable(),
  complaintCategory: z.string().nullable(),
  industry: z.string().nullable(),
  monetaryValue: z.number().nullable(),
  keyFacts: z.array(z.string()),
});

const classificationOutputSchema = baseOutputSchema.extend({
  primaryCategory: z.string(),
  isCivilDispute: z.boolean(),
  isSystemicRisk: z.boolean(),
  breachLikelihood: z.number().min(0).max(1),
});

const riskScoringOutputSchema = baseOutputSchema.extend({
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  complexityScore: z.number().min(0).max(1),
  vulnerabilityScore: z.number().min(0).max(1),
  systemicImpactScore: z.number().min(0).max(1),
  resolutionProbability: z.number().min(0).max(1),
  recommendedRouting: z.enum(['line_1_auto', 'line_2_investigation', 'systemic_review']),
});

const summarisationOutputSchema = baseOutputSchema.extend({
  executiveSummary: z.string().min(1),
  keyIssues: z.array(z.string()).min(1),
  recommendedActions: z.array(z.string()).min(1),
});

const OUTPUT_SCHEMAS: Record<string, z.ZodType> = {
  extraction: extractionOutputSchema,
  classification: classificationOutputSchema,
  risk_scoring: riskScoringOutputSchema,
  summarisation: summarisationOutputSchema,
};

const logger = createLogger('ai-service');

// ---- Embedding Preprocessing ----

/**
 * Preprocess complaint text for embedding generation.
 * Improves clustering quality by normalizing noise that hurts similarity search.
 */
function preprocessForEmbedding(text: string): string {
  let processed = text;

  // Normalize whitespace (multiple spaces, tabs, excessive newlines)
  processed = processed.replace(/[\t ]+/g, ' ');
  processed = processed.replace(/\n{3,}/g, '\n\n');

  // Remove common complaint boilerplate that adds noise
  processed = processed.replace(/dear sir\/madam[,.]?/gi, '');
  processed = processed.replace(/to whom it may concern[,.]?/gi, '');
  processed = processed.replace(/yours? (sincerely|faithfully|truly)[,.]?/gi, '');
  processed = processed.replace(/kind regards[,.]?/gi, '');
  processed = processed.replace(/best regards[,.]?/gi, '');

  // Normalize monetary formats for consistent matching
  processed = processed.replace(/\$\s*(\d)/g, '$$$1');  // "$  100" → "$100"
  processed = processed.replace(/AUD\s*\$?/gi, '$');     // "AUD $100" → "$100"

  // Normalize Australian phone numbers (not relevant for semantic similarity)
  processed = processed.replace(/(\+?61|0)\s?\d{1,2}\s?\d{3,4}\s?\d{3,4}/g, '[PHONE]');

  // Normalize email addresses (privacy + noise reduction)
  processed = processed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // Normalize reference numbers and case IDs
  processed = processed.replace(/\b(ref|reference|case|complaint)\s*#?\s*:?\s*[A-Z0-9-]{4,}/gi, '[REF]');

  // Collapse remaining excessive whitespace
  processed = processed.trim().replace(/  +/g, ' ');

  // Truncate to reasonable embedding input length (ada-002 handles 8191 tokens, ~32k chars)
  if (processed.length > 8000) {
    processed = processed.slice(0, 8000);
  }

  return processed;
}

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
    const apiKey = config.AI_PROVIDER === 'anthropic'
      ? config.ANTHROPIC_API_KEY || ''
      : config.OPENAI_API_KEY || '';
    this.provider = provider || createAiProvider(
      config.AI_PROVIDER,
      apiKey,
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

    const taskTemperature = TASK_TEMPERATURES[outputType] ?? 0.1;

    let completion: AiCompletionResult;
    try {
      completion = await this.provider.complete(messages, {
        jsonMode: true,
        temperature: taskTemperature,
        ...options,
      });
    } catch (error) {
      recordAiError();
      throw error;
    }

    let parsed: T;
    try {
      parsed = JSON.parse(completion.content) as T;
    } catch {
      logger.error('Failed to parse AI JSON response', { outputType, content: completion.content.slice(0, 200) });
      throw new Error(`AI returned invalid JSON for ${outputType}`);
    }

    // Validate output against Zod schema if one exists for this task
    const schema = OUTPUT_SCHEMAS[outputType];
    if (schema) {
      const validation = schema.safeParse(parsed);
      if (!validation.success) {
        logger.warn(`AI output schema validation failed for ${outputType}`, {
          errors: validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
          model: completion.model,
        });
      }
    }

    const confidence = (parsed as Record<string, unknown>)?.confidence as number ?? null;
    const reasoning = (parsed as Record<string, unknown>)?.reasoning as string ?? null;

    // Confidence calibration: clamp to valid range and flag anomalies
    const calibratedConfidence = confidence !== null
      ? Math.max(0, Math.min(1, confidence))
      : null;

    // Anomaly detection: perfect confidence on complex analyses is suspicious
    if (calibratedConfidence === 1.0 && ['classification', 'risk_scoring', 'extraction'].includes(outputType)) {
      logger.warn(`Suspicious perfect confidence on ${outputType}`, {
        model: completion.model,
        outputType,
      });
    }

    // Anomaly detection: very high confidence with short reasoning suggests poor calibration
    if (calibratedConfidence !== null && calibratedConfidence > 0.9 && reasoning && reasoning.length < 20) {
      logger.warn(`High confidence with minimal reasoning on ${outputType}`, {
        confidence: calibratedConfidence,
        reasoningLength: reasoning.length,
      });
    }

    const record: AiOutputRecord = {
      outputType,
      model: completion.model,
      prompt: userPrompt.slice(0, 500), // Truncate for storage
      rawOutput: completion.content,
      parsedOutput: parsed,
      confidence: calibratedConfidence,
      reasoning,
      tokenUsage: completion.tokenUsage,
      latencyMs: completion.latencyMs,
    };

    recordAiCall(completion.latencyMs, {
      prompt: completion.tokenUsage.promptTokens,
      completion: completion.tokenUsage.completionTokens,
      total: completion.tokenUsage.totalTokens,
    });

    logger.info(`AI pipeline completed: ${outputType}`, {
      model: completion.model,
      tokens: completion.tokenUsage.totalTokens,
      latencyMs: completion.latencyMs,
      confidence: calibratedConfidence,
      temperature: taskTemperature,
    });

    return { result: parsed, record };
  }

  // ---- Extraction ----

  async extractComplaintData(complaintText: string) {
    const prompt = interpolatePrompt(EXTRACTION_PROMPT, { complaintText });
    return this.runPipeline(SYSTEM_PROMPTS.EXTRACTION, prompt, 'extraction');
  }

  // ---- Classification ----

  async classifyComplaint(complaintText: string, extractedData: unknown) {
    const prompt = interpolatePrompt(CLASSIFICATION_PROMPT, {
      complaintText,
      extractedData: JSON.stringify(extractedData, null, 2),
    });
    return this.runPipeline(SYSTEM_PROMPTS.CLASSIFICATION, prompt, 'classification');
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
    return this.runPipeline(SYSTEM_PROMPTS.RISK_SCORING, prompt, 'risk_scoring');
  }

  // ---- Summarisation ----

  async summariseComplaint(complaintText: string) {
    const prompt = interpolatePrompt(SUMMARISATION_PROMPT, { complaintText });
    return this.runPipeline(SYSTEM_PROMPTS.SUMMARISATION, prompt, 'summarisation');
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

  // ---- Evidence Analysis ----

  async analyzeEvidence(fileContent: string, complaintSummary: string, filename: string) {
    const prompt = `
You are analyzing supporting evidence attached to a complaint.

**Complaint Summary:**
${complaintSummary}

**Evidence Document:** ${filename}

**Document Content:**
${fileContent.substring(0, 2000)}

Analyze this evidence and identify:
1. How it supports or contradicts the complaint
2. Key factual claims that can be verified
3. Any new information not mentioned in the complaint
4. Severity indicators if any

Respond in JSON with:
{
  "relevance": "high|medium|low",
  "supports_complaint": true|false,
  "key_findings": ["finding1", "finding2"],
  "new_information": ["info1", "info2"],
  "severity_indicators": ["indicator1"],
  "reasoning": "Brief explanation",
  "confidence": 0.0-1.0
}
`;

    return this.runPipeline(SYSTEM_PROMPTS.COMPLAINT_ANALYST, prompt, 'evidence_analysis');
  }

  // ---- Embeddings ----

  /**
   * Generate embedding with domain-specific preprocessing.
   * Normalizes text to improve clustering quality for systemic detection.
   */
  async generateEmbedding(text: string): Promise<AiEmbeddingResult> {
    const preprocessed = preprocessForEmbedding(text);
    return this.provider.embed(preprocessed);
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
