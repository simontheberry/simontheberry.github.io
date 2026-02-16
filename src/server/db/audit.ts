// ============================================================================
// Audit Logger – Writes to the AuditLog table
// ============================================================================

import { prisma } from './client';
import { Prisma } from '@prisma/client';
import { createLogger } from '../utils/logger';

const logger = createLogger('audit');

interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        oldValues: entry.oldValues ? (entry.oldValues as Prisma.InputJsonValue) : undefined,
        newValues: entry.newValues ? (entry.newValues as Prisma.InputJsonValue) : undefined,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', { error: (err as Error).message, entry });
  }
}
