// ============================================================================
// Complaint Domain Types
// Shared between client and server
// ============================================================================

export type ComplaintStatus =
  | 'draft'
  | 'submitted'
  | 'triaging'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_response'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'withdrawn';

export type ComplaintChannel = 'portal' | 'email' | 'webhook' | 'phone' | 'manual';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RoutingDestination = 'line_1_auto' | 'line_2_investigation' | 'systemic_review';

export type ComplaintCategory =
  | 'misleading_conduct'
  | 'unfair_contract_terms'
  | 'product_safety'
  | 'pricing_issues'
  | 'warranty_guarantee'
  | 'refund_dispute'
  | 'service_quality'
  | 'billing_dispute'
  | 'privacy_breach'
  | 'accessibility'
  | 'discrimination'
  | 'scam_fraud'
  | 'unconscionable_conduct'
  | 'other';

export type IndustryClassification =
  | 'financial_services'
  | 'telecommunications'
  | 'energy'
  | 'retail'
  | 'health'
  | 'aged_care'
  | 'building_construction'
  | 'automotive'
  | 'travel_tourism'
  | 'education'
  | 'real_estate'
  | 'insurance'
  | 'food_beverage'
  | 'technology'
  | 'government_services'
  | 'other';

export interface ComplainantDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
  };
  isVulnerable?: boolean;
  vulnerabilityIndicators?: string[];
  preferredContact?: 'email' | 'phone' | 'post';
}

export interface BusinessDetails {
  name: string;
  abn?: string;
  entityName?: string;
  entityType?: string;
  entityStatus?: string;
  website?: string;
  industry?: IndustryClassification;
  address?: string;
  isVerified: boolean;
}

export interface ComplaintTimeline {
  eventDate: string;
  description: string;
  type: 'incident' | 'communication' | 'escalation' | 'evidence';
}

export interface EvidenceItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
  description?: string;
}

export interface ComplaintData {
  id: string;
  tenantId: string;
  referenceNumber: string;
  status: ComplaintStatus;
  channel: ComplaintChannel;

  // Core content
  rawText: string;
  summary?: string;
  complainant: ComplainantDetails;
  business: BusinessDetails;

  // Classification
  category?: ComplaintCategory;
  legalCategory?: string;
  industry?: IndustryClassification;
  productService?: string;

  // Financial
  monetaryValue?: number;
  monetaryCurrency?: string;

  // Timeline & evidence
  timeline: ComplaintTimeline[];
  evidence: EvidenceItem[];
  incidentDate?: string;

  // AI outputs
  triageResult?: TriageResult;
  aiSummary?: string;
  aiConfidence?: number;

  // Routing
  routingDestination?: RoutingDestination;
  assignedTo?: string;
  teamId?: string;

  // Priority
  priorityScore?: number;
  riskLevel?: RiskLevel;

  // Systemic
  systemicClusterId?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  resolvedAt?: string;
  slaDeadline?: string;
}

export interface TriageResult {
  complaintId: string;
  category: ComplaintCategory;
  legalCategory: string;
  riskLevel: RiskLevel;
  complexityScore: number;
  priorityScore: number;
  routingDestination: RoutingDestination;
  isCivilDispute: boolean;
  isSystemicRisk: boolean;
  breachLikelihood: number;
  publicHarmIndicator: number;

  // Complexity breakdown
  complexityFactors: {
    legalNuance: number;
    investigationDepth: number;
    monetaryValue: number;
    partiesInvolved: number;
    novelty: number;
    publicHarm: number;
  };

  // Confidence
  confidence: number;
  reasoning: string;

  // Metadata
  modelUsed: string;
  processedAt: string;
}

export interface PriorityWeights {
  riskScore: number;
  systemicImpact: number;
  monetaryHarm: number;
  vulnerabilityIndicator: number;
  resolutionProbability: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  riskScore: 0.30,
  systemicImpact: 0.25,
  monetaryHarm: 0.15,
  vulnerabilityIndicator: 0.20,
  resolutionProbability: 0.10,
};
