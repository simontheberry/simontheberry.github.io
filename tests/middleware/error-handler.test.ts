import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError, ZodIssue, ZodIssueCode } from 'zod';
import { AppError, errorHandler } from '../../src/server/api/middleware/error-handler';

vi.mock('../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

function createApp(errorToThrow: Error) {
  const app = express();
  app.get('/test', () => {
    throw errorToThrow;
  });
  app.use(errorHandler);
  return app;
}

describe('Error Handler', () => {
  describe('AppError', () => {
    it('creates AppError with correct properties', () => {
      const err = new AppError(404, 'NOT_FOUND', 'Resource not found');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Resource not found');
      expect(err.name).toBe('AppError');
    });

    it('creates AppError with details', () => {
      const details = { field: ['is required'] };
      const err = new AppError(400, 'VALIDATION_ERROR', 'Bad request', details);
      expect(err.details).toEqual(details);
    });

    it('extends Error', () => {
      const err = new AppError(500, 'CODE', 'msg');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('errorHandler middleware', () => {
    it('handles AppError with correct status and JSON shape', async () => {
      const app = createApp(new AppError(403, 'FORBIDDEN', 'Access denied'));

      const res = await request(app).get('/test').expect(403);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied',
        },
      });
    });

    it('handles AppError with details', async () => {
      const details = { email: ['is required', 'must be valid'] };
      const app = createApp(new AppError(400, 'VALIDATION_ERROR', 'Bad input', details));

      const res = await request(app).get('/test').expect(400);
      expect(res.body.error.details).toEqual(details);
    });

    it('handles ZodError as 400 with formatted details', async () => {
      const issues: ZodIssue[] = [
        {
          code: ZodIssueCode.too_small,
          minimum: 1,
          type: 'string',
          inclusive: true,
          path: ['name'],
          message: 'Name is required',
        },
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string',
        },
      ];
      const zodErr = new ZodError(issues);
      const app = createApp(zodErr);

      const res = await request(app).get('/test').expect(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toBe('Request validation failed');
      expect(res.body.error.details.name).toContain('Name is required');
      expect(res.body.error.details.email).toContain('Expected string');
    });

    it('handles ZodError with nested path', async () => {
      const issues: ZodIssue[] = [
        {
          code: ZodIssueCode.too_small,
          minimum: 1,
          type: 'string',
          inclusive: true,
          path: ['address', 'street'],
          message: 'Street is required',
        },
      ];
      const zodErr = new ZodError(issues);
      const app = createApp(zodErr);

      const res = await request(app).get('/test').expect(400);
      expect(res.body.error.details['address.street']).toContain('Street is required');
    });

    it('handles unknown errors as 500', async () => {
      const app = createApp(new Error('Something broke'));

      const res = await request(app).get('/test').expect(500);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });

    it('does not leak error message for unknown errors', async () => {
      const app = createApp(new Error('database password exposed'));

      const res = await request(app).get('/test').expect(500);
      expect(res.body.error.message).not.toContain('database password');
      expect(res.body.error.message).toBe('An unexpected error occurred');
    });

    it('handles AppError 429 for rate limiting', async () => {
      const app = createApp(new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests'));

      const res = await request(app).get('/test').expect(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('handles AppError 401 for unauthorized', async () => {
      const app = createApp(new AppError(401, 'UNAUTHORIZED', 'Invalid token'));

      const res = await request(app).get('/test').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
