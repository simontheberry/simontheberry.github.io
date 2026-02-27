import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

describe('API Input Validation with Zod', () => {
  describe('Complaint Creation Schema', () => {
    const createComplaintSchema = z.object({
      rawText: z.string().min(10).max(50000),
      channel: z.enum(['portal', 'email', 'phone', 'webform']),
      complainantFirstName: z.string().min(1).max(100),
      complainantLastName: z.string().min(1).max(100),
      complainantEmail: z.string().email(),
      complainantPhone: z.string().optional(),
      complainantAddress: z.string().optional(),
      isVulnerable: z.boolean().optional().default(false),
    });

    it('validates valid complaint creation payload', () => {
      const payload = {
        rawText: 'I bought a defective product from TechStore for $1000 on January 15. It stopped working after 2 weeks.',
        channel: 'portal',
        complainantFirstName: 'John',
        complainantLastName: 'Doe',
        complainantEmail: 'john@example.com',
      };

      const result = createComplaintSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isVulnerable).toBe(false);
      }
    });

    it('rejects too short complaint text', () => {
      const payload = {
        rawText: 'Too short',
        channel: 'portal',
        complainantFirstName: 'John',
        complainantLastName: 'Doe',
        complainantEmail: 'john@example.com',
      };

      const result = createComplaintSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const payload = {
        rawText: 'A complaint about a defective product I purchased recently.',
        channel: 'portal',
        complainantFirstName: 'John',
        complainantLastName: 'Doe',
        complainantEmail: 'not-an-email',
      };

      const result = createComplaintSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects invalid channel', () => {
      const payload = {
        rawText: 'A complaint about a defective product I purchased recently.',
        channel: 'invalid_channel',
        complainantFirstName: 'John',
        complainantLastName: 'Doe',
        complainantEmail: 'john@example.com',
      };

      const result = createComplaintSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('validates with optional fields present', () => {
      const payload = {
        rawText: 'A complaint about a defective product I purchased recently.',
        channel: 'email',
        complainantFirstName: 'John',
        complainantLastName: 'Doe',
        complainantEmail: 'john@example.com',
        complainantPhone: '555-1234',
        complainantAddress: '123 Main St',
        isVulnerable: true,
      };

      const result = createComplaintSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isVulnerable).toBe(true);
        expect(result.data.complainantPhone).toBe('555-1234');
      }
    });
  });

  describe('Complaint Update Schema', () => {
    const updateComplaintSchema = z.object({
      status: z
        .enum([
          'submitted',
          'triaging',
          'triaged',
          'assigned',
          'in_progress',
          'awaiting_response',
          'resolved',
          'closed',
          'escalated',
        ])
        .optional(),
      riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category: z.string().optional(),
      summary: z.string().max(5000).optional(),
      monetaryValue: z.number().positive().optional(),
    });

    it('allows partial updates', () => {
      const payload = { status: 'in_progress' };
      const result = updateComplaintSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('validates status transitions', () => {
      const validTransitions = [
        'submitted',
        'triaging',
        'triaged',
        'assigned',
        'in_progress',
        'awaiting_response',
        'resolved',
        'closed',
        'escalated',
      ];

      validTransitions.forEach((status) => {
        const result = updateComplaintSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid status', () => {
      const payload = { status: 'invalid_status' };
      const result = updateComplaintSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('validates monetary values', () => {
      const validPayload = { monetaryValue: 1500.50 };
      expect(updateComplaintSchema.safeParse(validPayload).success).toBe(true);

      const negativePayload = { monetaryValue: -100 };
      expect(updateComplaintSchema.safeParse(negativePayload).success).toBe(false);

      const zeroPayload = { monetaryValue: 0 };
      expect(updateComplaintSchema.safeParse(zeroPayload).success).toBe(false);
    });
  });

  describe('Evidence Upload Schema', () => {
    const evidenceSchema = z.object({
      filename: z.string().min(1),
      mimeType: z.enum([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'text/plain',
        'application/msword',
      ]),
      size: z.number().max(10 * 1024 * 1024), // 10MB
      description: z.string().max(1000).optional(),
    });

    it('validates PDF uploads', () => {
      const payload = {
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        size: 500000,
      };

      const result = evidenceSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('rejects oversized files', () => {
      const payload = {
        filename: 'huge_file.pdf',
        mimeType: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB
      };

      const result = evidenceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('rejects unsupported file types', () => {
      const payload = {
        filename: 'script.exe',
        mimeType: 'application/x-msdownload',
        size: 500000,
      };

      const result = evidenceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Template Schema', () => {
    const templateSchema = z.object({
      name: z.string().min(1).max(200),
      type: z.enum(['response_to_complainant', 'notice_to_business', 'escalation_notice']),
      subject: z.string().min(1).max(500),
      body: z.string().min(10).max(10000),
      variables: z.array(z.string()).optional(),
      isActive: z.boolean().default(true),
    });

    it('validates template creation', () => {
      const payload = {
        name: 'Acknowledgment to Complainant',
        type: 'response_to_complainant',
        subject: 'We have received your complaint - {{reference_number}}',
        body: 'Dear {{first_name}}, we have received your complaint on {{submission_date}}.',
        variables: ['reference_number', 'first_name', 'submission_date'],
      };

      const result = templateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('validates enum values for template type', () => {
      const validTypes = [
        'response_to_complainant',
        'notice_to_business',
        'escalation_notice',
      ];

      validTypes.forEach((type) => {
        const payload = {
          name: 'Test Template',
          type,
          subject: 'Subject line',
          body: 'Body content here',
        };

        const result = templateSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid template type', () => {
      const payload = {
        name: 'Test Template',
        type: 'invalid_type',
        subject: 'Subject',
        body: 'Body content here',
      };

      const result = templateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Pagination Schema', () => {
    const paginationSchema = z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    });

    it('validates pagination defaults', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('enforces page boundaries', () => {
      const invalidPage = { page: 0 };
      expect(paginationSchema.safeParse(invalidPage).success).toBe(false);

      const negativePage = { page: -1 };
      expect(paginationSchema.safeParse(negativePage).success).toBe(false);
    });

    it('enforces limit boundaries', () => {
      const validLimit = { limit: 50 };
      expect(paginationSchema.safeParse(validLimit).success).toBe(true);

      const tooLarge = { limit: 101 };
      expect(paginationSchema.safeParse(tooLarge).success).toBe(false);
    });
  });

  describe('Error Response Format', () => {
    const errorResponseSchema = z.object({
      success: z.boolean(),
      error: z.object({
        message: z.string(),
        code: z.string().optional(),
        details: z.array(z.string()).optional(),
      }),
    });

    it('validates error response structure', () => {
      const errorResponse = {
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: ['Email is invalid', 'Name is required'],
        },
      };

      const result = errorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });

    it('allows error without optional fields', () => {
      const errorResponse = {
        success: false,
        error: {
          message: 'Internal server error',
        },
      };

      const result = errorResponseSchema.safeParse(errorResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('Success Response Format', () => {
    const successResponseSchema = z.object({
      success: z.literal(true),
      data: z.unknown(),
      meta: z
        .object({
          page: z.number().optional(),
          limit: z.number().optional(),
          total: z.number().optional(),
        })
        .optional(),
    });

    it('validates success response', () => {
      const response = {
        success: true,
        data: { id: '123', name: 'Test' },
      };

      const result = successResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('validates paginated response', () => {
      const response = {
        success: true,
        data: [{ id: '1' }, { id: '2' }],
        meta: { page: 1, limit: 20, total: 42 },
      };

      const result = successResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});
