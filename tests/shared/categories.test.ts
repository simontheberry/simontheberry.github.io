import { describe, it, expect } from 'vitest';
import {
  COMPLAINT_CATEGORIES,
  INDUSTRY_CLASSIFICATIONS,
  RISK_LEVEL_CONFIG,
  ROUTING_LABELS,
  STATUS_LABELS,
} from '../../src/shared/constants/categories';

describe('Shared Constants', () => {
  describe('COMPLAINT_CATEGORIES', () => {
    it('contains all 14 required categories', () => {
      const keys = Object.keys(COMPLAINT_CATEGORIES);
      expect(keys).toHaveLength(14);
    });

    it('includes all documented categories', () => {
      const required = [
        'misleading_conduct',
        'unfair_contract_terms',
        'product_safety',
        'pricing_issues',
        'warranty_guarantee',
        'refund_dispute',
        'service_quality',
        'billing_dispute',
        'privacy_breach',
        'accessibility',
        'discrimination',
        'scam_fraud',
        'unconscionable_conduct',
        'other',
      ];
      for (const key of required) {
        expect(COMPLAINT_CATEGORIES).toHaveProperty(key);
      }
    });

    it('has non-empty labels for all categories', () => {
      for (const [key, label] of Object.entries(COMPLAINT_CATEGORIES)) {
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });

  describe('INDUSTRY_CLASSIFICATIONS', () => {
    it('contains all 16 industries', () => {
      expect(Object.keys(INDUSTRY_CLASSIFICATIONS)).toHaveLength(16);
    });

    it('includes key regulated industries', () => {
      expect(INDUSTRY_CLASSIFICATIONS).toHaveProperty('financial_services');
      expect(INDUSTRY_CLASSIFICATIONS).toHaveProperty('telecommunications');
      expect(INDUSTRY_CLASSIFICATIONS).toHaveProperty('energy');
      expect(INDUSTRY_CLASSIFICATIONS).toHaveProperty('aged_care');
      expect(INDUSTRY_CLASSIFICATIONS).toHaveProperty('insurance');
    });

    it('has human-readable labels', () => {
      expect(INDUSTRY_CLASSIFICATIONS.financial_services).toBe('Financial Services');
      expect(INDUSTRY_CLASSIFICATIONS.building_construction).toBe('Building & Construction');
    });
  });

  describe('RISK_LEVEL_CONFIG', () => {
    it('defines 4 risk levels', () => {
      expect(Object.keys(RISK_LEVEL_CONFIG)).toHaveLength(4);
    });

    it('has ascending priority values', () => {
      expect(RISK_LEVEL_CONFIG.low.priority).toBeLessThan(RISK_LEVEL_CONFIG.medium.priority);
      expect(RISK_LEVEL_CONFIG.medium.priority).toBeLessThan(RISK_LEVEL_CONFIG.high.priority);
      expect(RISK_LEVEL_CONFIG.high.priority).toBeLessThan(RISK_LEVEL_CONFIG.critical.priority);
    });

    it('has valid hex color codes', () => {
      for (const config of Object.values(RISK_LEVEL_CONFIG)) {
        expect(config.color).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it('has labels for all levels', () => {
      expect(RISK_LEVEL_CONFIG.low.label).toBe('Low');
      expect(RISK_LEVEL_CONFIG.critical.label).toBe('Critical');
    });
  });

  describe('ROUTING_LABELS', () => {
    it('defines all 3 routing destinations', () => {
      expect(Object.keys(ROUTING_LABELS)).toHaveLength(3);
      expect(ROUTING_LABELS).toHaveProperty('line_1_auto');
      expect(ROUTING_LABELS).toHaveProperty('line_2_investigation');
      expect(ROUTING_LABELS).toHaveProperty('systemic_review');
    });
  });

  describe('STATUS_LABELS', () => {
    it('covers the full complaint lifecycle', () => {
      const lifecycle = ['submitted', 'triaging', 'triaged', 'assigned', 'in_progress', 'awaiting_response', 'resolved', 'closed'];
      for (const status of lifecycle) {
        expect(STATUS_LABELS).toHaveProperty(status);
      }
    });

    it('includes escalated and withdrawn states', () => {
      expect(STATUS_LABELS).toHaveProperty('escalated');
      expect(STATUS_LABELS).toHaveProperty('withdrawn');
    });

    it('has human-readable labels', () => {
      expect(STATUS_LABELS.in_progress).toBe('In Progress');
      expect(STATUS_LABELS.awaiting_response).toBe('Awaiting Response');
    });
  });
});
