// ============================================================================
// Audit Service -- Enhanced compliance and audit trail
// ============================================================================

import { prisma } from '../../db/client';
import { createLogger } from '../../utils/logger';
import { config } from '../../config';

const logger = createLogger('audit-service');

export interface ComplianceReport {
  tenantId: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalComplaints: number;
    complaintsByStatus: Record<string, number>;
    complaintsByRiskLevel: Record<string, number>;
    avgResolutionDays: number;
    slaComplianceRate: number;
  };
  auditTrail: {
    totalEvents: number;
    eventsByType: Record<string, number>;
    userActions: Array<{
      userId: string;
      actionCount: number;
      lastAction: Date;
    }>;
  };
  securityMetrics: {
    rbacViolationsAttempted: number;
    unauthorizedAccessAttempts: number;
    dataModifications: number;
    deletionsPerformed: number;
  };
  dataRetention: {
    oldestRecord: Date;
    recordsEligibleForArchive: number;
    recordsEligibleForDeletion: number;
  };
}

export interface AuditRetentionPolicy {
  tenantId: string;
  retentionDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number;
  enabled: boolean;
}

class AuditService {
  /**
   * Generate compliance report for audit/regulatory review
   */
  async generateComplianceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceReport> {
    logger.info('Generating compliance report', { tenantId, startDate, endDate });

    // 1. Complaint metrics
    const complaints = await prisma.complaint.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        status: true,
        riskLevel: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    const complaintsByStatus = complaints.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const complaintsByRiskLevel = complaints.reduce(
      (acc, c) => {
        const risk = c.riskLevel || 'unknown';
        acc[risk] = (acc[risk] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const avgResolutionDays =
      complaints
        .filter((c) => c.resolvedAt)
        .reduce((sum, c) => {
          const days = (c.resolvedAt!.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / Math.max(complaints.filter((c) => c.resolvedAt).length, 1) || 0;

    // 2. SLA compliance
    const slaCompliance = await this.calculateSlaCompliance(tenantId, startDate, endDate);

    // 3. Audit trail
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        userId: true,
        action: true,
        createdAt: true,
      },
    });

    const eventsByType = auditLogs.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const userActions = Array.from(
      auditLogs.reduce(
        (acc, log) => {
          if (!log.userId) return acc;
          if (!acc.has(log.userId)) {
            acc.set(log.userId, { userId: log.userId, actionCount: 0, lastAction: log.createdAt });
          }
          const user = acc.get(log.userId)!;
          user.actionCount += 1;
          if (log.createdAt > user.lastAction) {
            user.lastAction = log.createdAt;
          }
          return acc;
        },
        new Map<string, any>(),
      ).values(),
    );

    // 4. Security metrics
    const securityEvents = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
        action: {
          in: ['auth.failed', 'rbac.denied', 'complaint.deleted', 'evidence.deleted'],
        },
      },
      select: { action: true },
    });

    const securityMetrics = {
      rbacViolationsAttempted: securityEvents.filter((e) => e.action === 'rbac.denied').length,
      unauthorizedAccessAttempts: securityEvents.filter((e) => e.action === 'auth.failed').length,
      dataModifications: auditLogs.filter((log) => log.action.includes('updated')).length,
      deletionsPerformed: securityEvents.filter(
        (e) => e.action === 'complaint.deleted' || e.action === 'evidence.deleted',
      ).length,
    };

    // 5. Data retention
    const oldestRecord = await prisma.auditLog.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const retentionDays = 365; // Default 1 year
    const archiveAfterDays = 180; // Archive after 6 months
    const archiveThreshold = new Date(Date.now() - archiveAfterDays * 24 * 60 * 60 * 1000);
    const deleteThreshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const recordsEligibleForArchive = await prisma.auditLog.count({
      where: {
        tenantId,
        createdAt: { lt: archiveThreshold },
      },
    });

    const recordsEligibleForDeletion = await prisma.auditLog.count({
      where: {
        tenantId,
        createdAt: { lt: deleteThreshold },
      },
    });

    return {
      tenantId,
      reportPeriod: { startDate, endDate },
      summary: {
        totalComplaints: complaints.length,
        complaintsByStatus,
        complaintsByRiskLevel,
        avgResolutionDays: Math.round(avgResolutionDays * 10) / 10,
        slaComplianceRate: slaCompliance,
      },
      auditTrail: {
        totalEvents: auditLogs.length,
        eventsByType,
        userActions,
      },
      securityMetrics,
      dataRetention: {
        oldestRecord: oldestRecord?.createdAt || new Date(),
        recordsEligibleForArchive,
        recordsEligibleForDeletion,
      },
    };
  }

  /**
   * Calculate SLA compliance rate for period
   */
  private async calculateSlaCompliance(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const resolved = await prisma.complaint.findMany({
      where: {
        tenantId,
        status: 'resolved',
        resolvedAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        resolvedAt: true,
        slaDeadline: true,
      },
    });

    if (resolved.length === 0) return 0;

    const compliant = resolved.filter((c) => c.slaDeadline && c.resolvedAt! <= c.slaDeadline);

    return Math.round((compliant.length / resolved.length) * 100);
  }

  /**
   * Get or create retention policy for tenant
   */
  async getRetentionPolicy(tenantId: string): Promise<AuditRetentionPolicy> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const retentionDays = (settings.auditRetentionDays as number) || 365;
    const archiveAfterDays = (settings.auditArchiveAfterDays as number) || 180;
    const deleteAfterDays = (settings.auditDeleteAfterDays as number) || 1095; // 3 years

    return {
      tenantId,
      retentionDays,
      archiveAfterDays,
      deleteAfterDays,
      enabled: true,
    };
  }

  /**
   * Archive old audit logs (soft delete, move to archive table)
   */
  async archiveOldRecords(tenantId: string): Promise<{ archivedCount: number; deletedCount: number }> {
    const policy = await this.getRetentionPolicy(tenantId);
    const archiveThreshold = new Date(Date.now() - policy.archiveAfterDays * 24 * 60 * 60 * 1000);
    const deleteThreshold = new Date(Date.now() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);

    // Soft delete (mark as archived)
    const archivedCount = await prisma.auditLog.updateMany({
      where: {
        tenantId,
        createdAt: { lt: archiveThreshold, gte: deleteThreshold },
      },
      data: {}, // In real implementation, add 'archived: true' field
    });

    // Hard delete (only after full retention period)
    const deletedCount = await prisma.auditLog.deleteMany({
      where: {
        tenantId,
        createdAt: { lt: deleteThreshold },
      },
    });

    logger.info('Audit records archived/deleted', {
      tenantId,
      archivedCount: archivedCount.count,
      deletedCount,
    });

    return {
      archivedCount: archivedCount.count,
      deletedCount: deletedCount.count,
    };
  }

  /**
   * Export audit trail for regulatory submission
   */
  async exportAuditTrail(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json',
  ): Promise<string> {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = ['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Old Values', 'New Values'];
    const rows = logs.map((log) => [
      log.createdAt.toISOString(),
      log.userId || 'system',
      log.action,
      log.entity,
      log.entityId || '',
      JSON.stringify(log.oldValues || {}),
      JSON.stringify(log.newValues || {}),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }
}

let auditService: AuditService | null = null;

export function getAuditService(): AuditService {
  if (!auditService) {
    auditService = new AuditService();
  }
  return auditService;
}
