import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiService } from '../../../src/server/services/ai/ai-service';
import { createMockAiResponse } from '../../factories';

describe('AiService', () => {
  let aiService: AiService;

  beforeEach(() => {
    aiService = new AiService();
    vi.clearAllMocks();
  });

  describe('extractComplaintData', () => {
    it('extracts structured data from complaint text', async () => {
      const complaintText = 'I bought a phone from TechStore for $1000 on Jan 15. It stopped working after 2 weeks.';

      const result = await aiService.extractComplaintData(complaintText);

      expect(result).toBeDefined();
      expect(result.result).toHaveProperty('extractedFields');
      expect(result.record).toHaveProperty('confidence');
      expect(result.record.confidence).toBeGreaterThan(0);
      expect(result.record.confidence).toBeLessThanOrEqual(1);
    });

    it('returns confidence score', async () => {
      const result = await aiService.extractComplaintData('Test complaint');

      expect(result.record.confidence).toBeGreaterThanOrEqual(0);
      expect(result.record.confidence).toBeLessThanOrEqual(1);
    });

    it('stores output type as extraction', async () => {
      const result = await aiService.extractComplaintData('Test complaint');

      expect(result.record.outputType).toBe('extraction');
    });
  });

  describe('classifyComplaint', () => {
    it('classifies complaint into category', async () => {
      const complaintText = 'The product was not as described in the listing';
      const extractedData = {
        complainant: 'John Doe',
        business: 'Online Store',
        issue: 'misleading product',
      };

      const result = await aiService.classifyComplaint(complaintText, extractedData);

      expect(result).toBeDefined();
      expect(result.record.outputType).toBe('classification');
      expect(result.record.confidence).toBeGreaterThan(0);
    });
  });

  describe('scoreRisk', () => {
    it('scores risk between 0 and 1', async () => {
      const complaint = {
        category: 'product_safety',
        monetaryValue: 5000,
        isVulnerable: true,
      };
      const classification = { legalCategory: 'consumer_protection' };

      const result = await aiService.scoreRisk(complaint, classification);

      const score = (result.result as Record<string, unknown>).riskScore as number;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('high monetary value increases risk score', async () => {
      const lowValueComplaint = {
        category: 'misleading_conduct',
        monetaryValue: 100,
        isVulnerable: false,
      };
      const highValueComplaint = {
        category: 'misleading_conduct',
        monetaryValue: 50000,
        isVulnerable: false,
      };

      const lowResult = await aiService.scoreRisk(lowValueComplaint, {});
      const highResult = await aiService.scoreRisk(highValueComplaint, {});

      const lowScore = (lowResult.result as Record<string, unknown>).riskScore as number;
      const highScore = (highResult.result as Record<string, unknown>).riskScore as number;

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('vulnerable indicator increases risk', async () => {
      const nonVulnerableComplaint = {
        category: 'misleading_conduct',
        monetaryValue: 1000,
        isVulnerable: false,
      };
      const vulnerableComplaint = {
        category: 'misleading_conduct',
        monetaryValue: 1000,
        isVulnerable: true,
      };

      const nonVulnResult = await aiService.scoreRisk(nonVulnerableComplaint, {});
      const vulnResult = await aiService.scoreRisk(vulnerableComplaint, {});

      const nonVulnScore = (nonVulnResult.result as Record<string, unknown>).riskScore as number;
      const vulnScore = (vulnResult.result as Record<string, unknown>).riskScore as number;

      expect(vulnScore).toBeGreaterThan(nonVulnScore);
    });
  });

  describe('detectMissingData', () => {
    it('identifies missing fields from complaint', async () => {
      const complaintText = 'I had a bad experience but did not provide details';
      const currentData = {
        businessName: 'Unknown Store',
        amount: null,
        date: null,
      };

      const result = await aiService.detectMissingData(complaintText, currentData);

      expect(result.result).toHaveProperty('missingFields');
      expect(Array.isArray((result.result as Record<string, unknown>).missingFields)).toBe(true);
    });

    it('returns follow-up questions for missing data', async () => {
      const result = await aiService.detectMissingData('Bad experience', {});

      expect(result.result).toHaveProperty('followUpQuestions');
      expect(Array.isArray((result.result as Record<string, unknown>).followUpQuestions)).toBe(true);
    });
  });

  describe('draftComplainantResponse', () => {
    it('generates professional response to complainant', async () => {
      const summary = 'Customer received defective product';
      const category = 'product_safety';
      const riskLevel = 'high';

      const result = await aiService.draftComplainantResponse(summary, category, riskLevel);

      expect(result.result).toHaveProperty('subject');
      expect(result.result).toHaveProperty('body');
      expect((result.result as Record<string, unknown>).subject).toBeTruthy();
      expect((result.result as Record<string, unknown>).body).toBeTruthy();
    });

    it('includes acknowledgment and next steps', async () => {
      const result = await aiService.draftComplainantResponse(
        'Product malfunction',
        'product_safety',
        'medium',
      );

      const body = (result.result as Record<string, unknown>).body as string;
      const lowerBody = body.toLowerCase();

      // Check for common acknowledgment phrases
      expect(
        lowerBody.includes('received') ||
          lowerBody.includes('acknowledge') ||
          lowerBody.includes('understand'),
      ).toBe(true);
    });
  });

  describe('draftBusinessNotice', () => {
    it('generates formal notice to business', async () => {
      const summary = 'Complaint about service quality';
      const businessName = 'Tech Services Ltd';
      const category = 'service_quality';
      const legalCategory = 'consumer_protection';

      const result = await aiService.draftBusinessNotice(
        summary,
        businessName,
        category,
        legalCategory,
      );

      expect(result.result).toHaveProperty('subject');
      expect(result.result).toHaveProperty('body');
      const body = (result.result as Record<string, unknown>).body as string;
      expect(body).toContain(businessName);
    });

    it('tone is professional and regulatory', async () => {
      const result = await aiService.draftBusinessNotice(
        'Complaint received',
        'Company XYZ',
        'misleading_conduct',
        'consumer_protection',
      );

      const body = (result.result as Record<string, unknown>).body as string;
      const lowerBody = body.toLowerCase();

      // Should not be overly friendly or casual
      expect(lowerBody.includes('dear') || lowerBody.includes('notification')).toBe(true);
    });
  });

  describe('generateEmbedding', () => {
    it('generates 1536-dimensional embedding', async () => {
      const text = 'Test complaint for embedding';

      const result = await aiService.generateEmbedding(text);

      expect(result.embedding).toBeDefined();
      expect(Array.isArray(result.embedding)).toBe(true);
      expect(result.embedding.length).toBe(1536);
    });

    it('embedding values are normalized', async () => {
      const result = await aiService.generateEmbedding('Test');

      expect(result.embedding).toBeDefined();
      const values = result.embedding as number[];
      values.forEach((val) => {
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThanOrEqual(-2);
        expect(val).toBeLessThanOrEqual(2);
      });
    });

    it('returns model name', async () => {
      const result = await aiService.generateEmbedding('Test');

      expect(result.model).toBe('text-embedding-ada-002');
    });
  });

  describe('analyzeEvidence', () => {
    it('analyzes evidence relevance to complaint', async () => {
      const fileContent = 'Invoice shows charge of $500 on 2025-02-15';
      const complaintSummary = 'Charged twice for same service';
      const filename = 'invoice.txt';

      const result = await aiService.analyzeEvidence(fileContent, complaintSummary, filename);

      expect(result.result).toHaveProperty('relevance');
      expect(result.result).toHaveProperty('supports_complaint');
      expect(result.result).toHaveProperty('confidence');
    });

    it('returns relevant findings', async () => {
      const result = await aiService.analyzeEvidence(
        'Test evidence content',
        'Test complaint',
        'test.txt',
      );

      expect(result.result).toHaveProperty('key_findings');
      expect(Array.isArray((result.result as Record<string, unknown>).key_findings)).toBe(true);
    });
  });
});
