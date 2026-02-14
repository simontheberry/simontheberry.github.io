// ============================================================================
// Priority Score Calculator
// Configurable weighted priority formula
// ============================================================================

import type { PriorityWeights } from '../../../shared/types/complaint';

export interface PriorityInputs {
  /** Risk score 0-1 derived from risk level */
  riskScore: number;
  /** Systemic impact indicator 0-1 */
  systemicImpact: number;
  /** Monetary harm normalized 0-1 */
  monetaryHarm: number;
  /** Consumer vulnerability indicator 0-1 */
  vulnerabilityIndicator: number;
  /** Probability of resolution without intervention 0-1 (inverted in formula) */
  resolutionProbability: number;
}

/**
 * Calculate priority score using configurable weighted formula.
 *
 * Priority Score =
 *   (Risk Score × w1) +
 *   (Systemic Impact × w2) +
 *   (Monetary Harm × w3) +
 *   (Vulnerability Indicator × w4) +
 *   ((1 - Resolution Probability) × w5)
 *
 * Each weight is configurable per regulator/tenant.
 * All inputs should be normalized to 0-1 range.
 * Output is 0-1 where higher = higher priority.
 */
export function calculatePriorityScore(
  inputs: PriorityInputs,
  weights: PriorityWeights,
): number {
  const score =
    (clamp01(inputs.riskScore) * weights.riskScore) +
    (clamp01(inputs.systemicImpact) * weights.systemicImpact) +
    (clamp01(inputs.monetaryHarm) * weights.monetaryHarm) +
    (clamp01(inputs.vulnerabilityIndicator) * weights.vulnerabilityIndicator) +
    (clamp01(1 - inputs.resolutionProbability) * weights.resolutionProbability);

  // Normalize by total weight to keep output in 0-1 range
  const totalWeight =
    weights.riskScore +
    weights.systemicImpact +
    weights.monetaryHarm +
    weights.vulnerabilityIndicator +
    weights.resolutionProbability;

  return Math.round((score / totalWeight) * 1000) / 1000;
}

/**
 * Normalize monetary value to 0-1 scale using logarithmic mapping.
 * $0 = 0, $100 = ~0.25, $1,000 = ~0.5, $10,000 = ~0.75, $100,000+ = ~1.0
 */
export function normalizeMonetaryValue(value: number): number {
  if (value <= 0) return 0;
  // Log scale: log10(100000) ≈ 5
  return clamp01(Math.log10(value) / 5);
}

/**
 * Map risk level string to numeric score.
 */
export function riskLevelToNumeric(level: string): number {
  switch (level) {
    case 'critical': return 1.0;
    case 'high': return 0.75;
    case 'medium': return 0.5;
    case 'low': return 0.25;
    default: return 0.5;
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
