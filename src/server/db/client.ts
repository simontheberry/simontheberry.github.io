// ============================================================================
// Prisma Client Singleton
// Prevents multiple instances during hot-reloading in development
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { recordDbQuery } from '../services/metrics/metrics';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

// Track database query latency for metrics
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  recordDbQuery(Date.now() - start);
  return result;
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
