import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockInfo, mockWarn } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../../src/server/utils/logger', () => ({
  createLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../src/server/services/metrics/metrics', () => ({
  recordHttpRequest: vi.fn(),
}));

import { requestLogger } from '../../src/server/api/middleware/request-logger';

describe('Request Logger', () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
  });

  it('logs successful requests at info level', async () => {
    const app = express();
    app.use(requestLogger);
    app.get('/test', (_req, res) => {
      res.json({ success: true });
    });

    await request(app).get('/test').expect(200);
    expect(mockInfo).toHaveBeenCalled();
    const logMessage = mockInfo.mock.calls[0][0];
    expect(logMessage).toContain('GET');
    expect(logMessage).toContain('/test');
    expect(logMessage).toContain('200');
  });

  it('logs 4xx errors at warn level', async () => {
    const app = express();
    app.use(requestLogger);
    app.get('/test', (_req, res) => {
      res.status(404).json({ error: 'not found' });
    });

    await request(app).get('/test').expect(404);
    expect(mockWarn).toHaveBeenCalled();
    const logMessage = mockWarn.mock.calls[0][0];
    expect(logMessage).toContain('404');
  });

  it('logs 5xx errors at warn level', async () => {
    const app = express();
    app.use(requestLogger);
    app.get('/test', (_req, res) => {
      res.status(500).json({ error: 'internal error' });
    });

    await request(app).get('/test').expect(500);
    expect(mockWarn).toHaveBeenCalled();
  });

  it('includes request method and URL in log', async () => {
    const app = express();
    app.use(requestLogger);
    app.post('/api/v1/complaints', (_req, res) => {
      res.status(201).json({});
    });

    await request(app).post('/api/v1/complaints').expect(201);
    expect(mockInfo).toHaveBeenCalled();
    const logMessage = mockInfo.mock.calls[0][0];
    expect(logMessage).toContain('POST');
    expect(logMessage).toContain('/api/v1/complaints');
    expect(logMessage).toContain('201');
  });

  it('includes duration in log message', async () => {
    const app = express();
    app.use(requestLogger);
    app.get('/test', (_req, res) => {
      res.json({});
    });

    await request(app).get('/test').expect(200);
    expect(mockInfo).toHaveBeenCalled();
    const logMessage = mockInfo.mock.calls[0][0];
    expect(logMessage).toMatch(/\d+ms/);
  });

  it('calls next to pass control to next middleware', async () => {
    const app = express();
    app.use(requestLogger);
    const nextCalled = vi.fn();
    app.get('/test', (_req, res) => {
      nextCalled();
      res.json({});
    });

    await request(app).get('/test').expect(200);
    expect(nextCalled).toHaveBeenCalled();
  });
});
