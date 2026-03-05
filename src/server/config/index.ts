// ============================================================================
// Server Configuration
// ============================================================================

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/complaint_triage'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'azure_openai']).default('openai'),
  AI_MODEL: z.string().default('gpt-4o'),
  EMBEDDING_MODEL: z.string().default('text-embedding-ada-002'),

  // ABR API
  ABR_API_GUID: z.string().optional(),
  ABR_API_URL: z.string().default('https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),

  // App
  CLIENT_URL: z.string().default('http://localhost:3000'),
  API_PREFIX: z.string().default('/api/v1'),

  // Systemic Detection
  SIMILARITY_THRESHOLD: z.coerce.number().default(0.85),
  CLUSTER_MIN_COMPLAINTS: z.coerce.number().default(3),
  SPIKE_DETECTION_WINDOW_HOURS: z.coerce.number().default(24),
  SPIKE_DETECTION_THRESHOLD: z.coerce.number().default(5),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.format());
    // In development, use defaults; in production, fail
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    return envSchema.parse({});
  }

  return parsed.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
