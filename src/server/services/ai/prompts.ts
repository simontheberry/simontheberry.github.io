// ============================================================================
// AI Prompt Templates
// Core prompts for all AI pipelines
// ============================================================================

// ---- System Prompts ----

export const SYSTEM_PROMPTS = {
  COMPLAINT_ANALYST: `You are an expert complaint analyst working for a government consumer protection regulator.
You analyze consumer complaints with precision and objectivity. You identify legal issues, assess risk,
and determine appropriate regulatory responses. You are thorough, accurate, and always cite specific
facts from the complaint text to support your analysis.

You must respond ONLY with valid JSON matching the requested schema. Do not include any text outside the JSON.`,

  INTAKE_ASSISTANT: `You are a helpful assistant guiding a consumer through submitting a complaint to a government regulator.
Your role is to:
1. Understand what the consumer is describing
2. Identify what key information is missing
3. Ask clear, simple follow-up questions to gather structured data
4. Never provide legal advice
5. Be empathetic but professional
6. Keep questions focused and one at a time

You respond in plain, accessible language suitable for all literacy levels.`,

  CORRESPONDENCE_DRAFTER: `You are a regulatory correspondence specialist. You draft professional communications
on behalf of a government regulator. Your tone is formal, clear, and authoritative but not aggressive.
You cite relevant consumer protection principles without providing specific legal advice.
All drafts must be suitable for official government correspondence.`,
};

// ---- Extraction Prompt ----

export const EXTRACTION_PROMPT = `Analyze the following consumer complaint and extract structured information.

COMPLAINT TEXT:
"""
{{complaintText}}
"""

Extract the following fields. If a field cannot be determined from the text, set it to null.

Respond with this exact JSON schema:
{
  "businessName": string | null,
  "productOrService": string | null,
  "complaintCategory": "misleading_conduct" | "unfair_contract_terms" | "product_safety" | "pricing_issues" | "warranty_guarantee" | "refund_dispute" | "service_quality" | "billing_dispute" | "privacy_breach" | "accessibility" | "discrimination" | "scam_fraud" | "unconscionable_conduct" | "other" | null,
  "industry": "financial_services" | "telecommunications" | "energy" | "retail" | "health" | "aged_care" | "building_construction" | "automotive" | "travel_tourism" | "education" | "real_estate" | "insurance" | "food_beverage" | "technology" | "government_services" | "other" | null,
  "monetaryValue": number | null,
  "monetaryCurrency": "AUD",
  "incidentDate": string | null,
  "timeline": [{ "date": string | null, "event": string }],
  "parties": [{ "name": string, "role": "complainant" | "business" | "third_party" }],
  "evidenceMentioned": [string],
  "urgencyIndicators": [string],
  "vulnerabilityIndicators": [string],
  "keyFacts": [string],
  "reasoning": string,
  "confidence": number
}`;

// ---- Classification Prompt ----

export const CLASSIFICATION_PROMPT = `Classify this consumer complaint for regulatory triage.

COMPLAINT TEXT:
"""
{{complaintText}}
"""

EXTRACTED DATA:
{{extractedData}}

Analyze and classify this complaint across multiple dimensions. Consider Australian Consumer Law (ACL),
relevant industry regulations, and regulatory precedent.

Respond with this exact JSON schema:
{
  "primaryCategory": string,
  "secondaryCategories": [string],
  "legalCategory": string,
  "relevantLegislation": [string],
  "isCivilDispute": boolean,
  "isSystemicRisk": boolean,
  "breachLikelihood": number,
  "breachType": string | null,
  "regulatoryJurisdiction": string,
  "reasoning": string,
  "confidence": number
}`;

// ---- Risk Scoring Prompt ----

export const RISK_SCORING_PROMPT = `Assess the risk level and complexity of this consumer complaint for regulatory prioritization.

COMPLAINT TEXT:
"""
{{complaintText}}
"""

CLASSIFICATION:
{{classification}}

BUSINESS CONTEXT:
- Previous complaints against this business: {{previousComplaintCount}}
- Business industry: {{industry}}
- Business status: {{businessStatus}}

Score each factor from 0.0 to 1.0 and provide overall risk assessment.

Respond with this exact JSON schema:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "complexityFactors": {
    "legalNuance": number,
    "investigationDepth": number,
    "monetaryValue": number,
    "partiesInvolved": number,
    "novelty": number,
    "publicHarm": number
  },
  "complexityScore": number,
  "publicHarmIndicator": number,
  "vulnerabilityScore": number,
  "systemicImpactScore": number,
  "resolutionProbability": number,
  "recommendedRouting": "line_1_auto" | "line_2_investigation" | "systemic_review",
  "reasoning": string,
  "confidence": number
}`;

// ---- Summarisation Prompt ----

export const SUMMARISATION_PROMPT = `Summarize this consumer complaint for a regulatory officer who needs to quickly understand the key issues.

COMPLAINT TEXT:
"""
{{complaintText}}
"""

Provide:
1. A 2-3 sentence executive summary
2. Key issues identified
3. Recommended next steps

Respond with this exact JSON schema:
{
  "executiveSummary": string,
  "keyIssues": [string],
  "recommendedActions": [string],
  "reasoning": string,
  "confidence": number
}`;

// ---- Missing Data Detection Prompt ----

export const MISSING_DATA_PROMPT = `Analyze this partial complaint submission and identify what critical information is missing.

CURRENT TEXT:
"""
{{complaintText}}
"""

ALREADY COLLECTED DATA:
{{currentData}}

Identify missing fields that are important for a regulatory complaint. For each missing field,
provide a clear, simple question to ask the complainant. Prioritize the most critical missing
information first.

Respond with this exact JSON schema:
{
  "extractedData": {
    "businessName": string | null,
    "category": string | null,
    "monetaryValue": number | null,
    "incidentDate": string | null
  },
  "missingFields": [
    {
      "field": string,
      "importance": "critical" | "important" | "helpful",
      "question": string
    }
  ],
  "followUpQuestions": [string],
  "completenessScore": number,
  "reasoning": string,
  "confidence": number
}`;

// ---- Draft Response Prompt (Line 1) ----

export const DRAFT_RESPONSE_COMPLAINANT_PROMPT = `Draft a response to a consumer who submitted a complaint to a government regulator.

COMPLAINT SUMMARY:
{{summary}}

COMPLAINT CATEGORY: {{category}}
RISK LEVEL: {{riskLevel}}
ROUTING: Line 1 – Assisted Automated Response

The response should:
1. Acknowledge receipt of the complaint
2. Summarize the understood issue (to confirm understanding)
3. Explain what steps the regulator will take
4. Provide relevant general information about consumer rights
5. Set expectations about timeline
6. Never provide specific legal advice

Tone: Professional, empathetic, clear, government-appropriate.

Respond with this exact JSON schema:
{
  "subject": string,
  "body": string,
  "reasoning": string,
  "confidence": number
}`;

// ---- Draft Business Notice Prompt ----

export const DRAFT_BUSINESS_NOTICE_PROMPT = `Draft a regulatory notice to a business regarding a consumer complaint.

COMPLAINT SUMMARY:
{{summary}}

BUSINESS NAME: {{businessName}}
COMPLAINT CATEGORY: {{category}}
ALLEGED ISSUES: {{issues}}

The notice should:
1. Formally notify the business of the complaint
2. Summarize the allegation(s) without making findings
3. Request a response within a specified timeframe
4. Reference general regulatory obligations
5. Maintain neutral, authoritative tone

This is an initial inquiry, not an enforcement action.

Respond with this exact JSON schema:
{
  "subject": string,
  "body": string,
  "responseDeadlineDays": number,
  "reasoning": string,
  "confidence": number
}`;

// ---- Clustering Analysis Prompt ----

export const CLUSTERING_ANALYSIS_PROMPT = `Analyze this group of similar consumer complaints to identify systemic patterns.

COMPLAINTS:
{{complaints}}

Identify:
1. Common fact patterns across complaints
2. Shared contract terms, fee structures, or business practices
3. Whether this represents a systemic issue vs coincidental similar complaints
4. The nature of potential regulatory concern
5. Recommended regulatory response

Respond with this exact JSON schema:
{
  "isSystemic": boolean,
  "title": string,
  "description": string,
  "commonPatterns": [string],
  "sharedPractices": [string],
  "affectedConsumerProfile": string,
  "potentialRegulatoryConcern": string,
  "recommendedAction": string,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "reasoning": string,
  "confidence": number
}`;

// ---- Input Sanitization ----

/**
 * Sanitize user-provided text before interpolation into prompts.
 * Escapes triple-quote delimiters that could break prompt structure.
 * Strips control characters that could confuse model parsing.
 */
export function sanitizePromptInput(input: string): string {
  return input
    .replace(/"""/g, '"\u200B"\u200B"')  // Break triple-quote sequences with zero-width spaces
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Strip control chars (preserve \n \r \t)
}

// ---- Template Interpolation Utility ----

/**
 * Keys listed here contain user-supplied text and will be sanitized
 * before interpolation to mitigate prompt injection.
 */
const USER_INPUT_KEYS = new Set([
  'complaintText',
  'summary',
  'businessName',
  'issues',
  'currentData',
]);

export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = USER_INPUT_KEYS.has(key) ? sanitizePromptInput(value) : value;
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue);
  }
  return result;
}
