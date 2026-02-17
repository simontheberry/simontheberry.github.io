import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock environment variables for testing
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long';
  process.env.OPENAI_API_KEY = 'sk-test-key-mock';
  process.env.AI_PROVIDER = 'openai';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_USER = 'test@example.com';
  process.env.SMTP_PASS = 'test-password';
});

// Cleanup after all tests
afterAll(() => {
  vi.clearAllMocks();
});

// Clear mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
