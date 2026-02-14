// ============================================================================
// Shared Constants
// ============================================================================

export const COMPLAINT_CATEGORIES = {
  misleading_conduct: 'Misleading or deceptive conduct',
  unfair_contract_terms: 'Unfair contract terms',
  product_safety: 'Product safety',
  pricing_issues: 'Pricing issues',
  warranty_guarantee: 'Warranty / guarantee',
  refund_dispute: 'Refund dispute',
  service_quality: 'Service quality',
  billing_dispute: 'Billing dispute',
  privacy_breach: 'Privacy breach',
  accessibility: 'Accessibility',
  discrimination: 'Discrimination',
  scam_fraud: 'Scam / fraud',
  unconscionable_conduct: 'Unconscionable conduct',
  other: 'Other',
} as const;

export const INDUSTRY_CLASSIFICATIONS = {
  financial_services: 'Financial Services',
  telecommunications: 'Telecommunications',
  energy: 'Energy',
  retail: 'Retail',
  health: 'Health',
  aged_care: 'Aged Care',
  building_construction: 'Building & Construction',
  automotive: 'Automotive',
  travel_tourism: 'Travel & Tourism',
  education: 'Education',
  real_estate: 'Real Estate',
  insurance: 'Insurance',
  food_beverage: 'Food & Beverage',
  technology: 'Technology',
  government_services: 'Government Services',
  other: 'Other',
} as const;

export const RISK_LEVEL_CONFIG = {
  low: { label: 'Low', color: '#22c55e', priority: 1 },
  medium: { label: 'Medium', color: '#f59e0b', priority: 2 },
  high: { label: 'High', color: '#f97316', priority: 3 },
  critical: { label: 'Critical', color: '#ef4444', priority: 4 },
} as const;

export const ROUTING_LABELS = {
  line_1_auto: 'Line 1 – Assisted Automated Response',
  line_2_investigation: 'Line 2 – Compliance Investigation',
  systemic_review: 'Systemic Issue Review',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  triaging: 'Triaging',
  triaged: 'Triaged',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_response: 'Awaiting Response',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
};
