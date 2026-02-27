import { describe, it, expect } from 'vitest';
import {
  calculatePriorityScore,
  normalizeMonetaryValue,
  riskLevelToNumeric,
  type PriorityInputs,
} from '../../../src/server/services/triage/priority-calculator';

const DEFAULT_WEIGHTS = {
  riskScore: 0.30,
  systemicImpact: 0.25,
  monetaryHarm: 0.15,
  vulnerabilityIndicator: 0.20,
  resolutionProbability: 0.10,
};

describe('Priority Calculator', () => {
  describe('calculatePriorityScore', () => {
    it('returns 0 when all inputs are 0', () => {
      const inputs: PriorityInputs = {
        riskScore: 0,
        systemicImpact: 0,
        monetaryHarm: 0,
        vulnerabilityIndicator: 0,
        resolutionProbability: 1, // inverted to 0
      };

      const score = calculatePriorityScore(inputs, DEFAULT_WEIGHTS);
      expect(score).toBe(0);
    });

    it('returns 1 when all inputs are max', () => {
      const inputs: PriorityInputs = {
        riskScore: 1,
        systemicImpact: 1,
        monetaryHarm: 1,
        vulnerabilityIndicator: 1,
        resolutionProbability: 0, // inverted to 1
      };

      const score = calculatePriorityScore(inputs, DEFAULT_WEIGHTS);
      expect(score).toBe(1);
    });

    it('returns value between 0 and 1 for mixed inputs', () => {
      const inputs: PriorityInputs = {
        riskScore: 0.75,
        systemicImpact: 0.5,
        monetaryHarm: 0.3,
        vulnerabilityIndicator: 0.4,
        resolutionProbability: 0.6,
      };

      const score = calculatePriorityScore(inputs, DEFAULT_WEIGHTS);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('risk score has highest weight impact', () => {
      const highRisk: PriorityInputs = {
        riskScore: 1,
        systemicImpact: 0,
        monetaryHarm: 0,
        vulnerabilityIndicator: 0,
        resolutionProbability: 1,
      };

      const highSystemic: PriorityInputs = {
        riskScore: 0,
        systemicImpact: 1,
        monetaryHarm: 0,
        vulnerabilityIndicator: 0,
        resolutionProbability: 1,
      };

      const riskScore = calculatePriorityScore(highRisk, DEFAULT_WEIGHTS);
      const systemicScore = calculatePriorityScore(highSystemic, DEFAULT_WEIGHTS);

      expect(riskScore).toBeGreaterThan(systemicScore);
    });

    it('clamps input values to 0-1 range', () => {
      const inputs: PriorityInputs = {
        riskScore: 1.5,
        systemicImpact: -0.5,
        monetaryHarm: 2.0,
        vulnerabilityIndicator: 0.5,
        resolutionProbability: 0.5,
      };

      const score = calculatePriorityScore(inputs, DEFAULT_WEIGHTS);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('uses custom weights correctly', () => {
      const inputs: PriorityInputs = {
        riskScore: 1,
        systemicImpact: 0,
        monetaryHarm: 0,
        vulnerabilityIndicator: 0,
        resolutionProbability: 1,
      };

      // Make riskScore weight very high
      const customWeights = {
        riskScore: 0.9,
        systemicImpact: 0.025,
        monetaryHarm: 0.025,
        vulnerabilityIndicator: 0.025,
        resolutionProbability: 0.025,
      };

      const score = calculatePriorityScore(inputs, customWeights);
      expect(score).toBeGreaterThan(0.8);
    });

    it('normalizes by total weight', () => {
      const inputs: PriorityInputs = {
        riskScore: 1,
        systemicImpact: 1,
        monetaryHarm: 1,
        vulnerabilityIndicator: 1,
        resolutionProbability: 0,
      };

      // Even with unbalanced weights, max should be 1
      const unequalWeights = {
        riskScore: 0.5,
        systemicImpact: 0.5,
        monetaryHarm: 0.5,
        vulnerabilityIndicator: 0.5,
        resolutionProbability: 0.5,
      };

      const score = calculatePriorityScore(inputs, unequalWeights);
      expect(score).toBe(1);
    });
  });

  describe('normalizeMonetaryValue', () => {
    it('returns 0 for $0', () => {
      expect(normalizeMonetaryValue(0)).toBe(0);
    });

    it('returns 0 for negative values', () => {
      expect(normalizeMonetaryValue(-100)).toBe(0);
    });

    it('returns approximately 0.4 for $100', () => {
      const result = normalizeMonetaryValue(100);
      expect(result).toBeGreaterThan(0.3);
      expect(result).toBeLessThan(0.5);
    });

    it('returns approximately 0.6 for $1,000', () => {
      const result = normalizeMonetaryValue(1000);
      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(0.7);
    });

    it('returns approximately 0.8 for $10,000', () => {
      const result = normalizeMonetaryValue(10000);
      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThan(0.9);
    });

    it('caps at 1 for very large values', () => {
      expect(normalizeMonetaryValue(100000)).toBe(1);
      expect(normalizeMonetaryValue(1000000)).toBe(1);
    });

    it('is monotonically increasing', () => {
      const values = [10, 100, 1000, 10000, 100000];
      const normalized = values.map(normalizeMonetaryValue);

      for (let i = 1; i < normalized.length; i++) {
        expect(normalized[i]).toBeGreaterThanOrEqual(normalized[i - 1]);
      }
    });
  });

  describe('riskLevelToNumeric', () => {
    it('maps critical to 1.0', () => {
      expect(riskLevelToNumeric('critical')).toBe(1.0);
    });

    it('maps high to 0.75', () => {
      expect(riskLevelToNumeric('high')).toBe(0.75);
    });

    it('maps medium to 0.5', () => {
      expect(riskLevelToNumeric('medium')).toBe(0.5);
    });

    it('maps low to 0.25', () => {
      expect(riskLevelToNumeric('low')).toBe(0.25);
    });

    it('defaults unknown levels to 0.5', () => {
      expect(riskLevelToNumeric('unknown')).toBe(0.5);
      expect(riskLevelToNumeric('')).toBe(0.5);
    });
  });
});
