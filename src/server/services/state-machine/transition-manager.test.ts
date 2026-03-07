// ============================================================================
// Transition Manager Tests – Database-backed state transitions
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TransitionManager } from './transition-manager';

// Mock Prisma and audit logger
vi.mock('../../db/client', () => ({
  prisma: {
    complaint: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    complaintEvent: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../../db/audit', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';

describe('TransitionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeTransition', () => {
    it('should fail if complaint not found', async () => {
      vi.mocked(prisma.complaint.findFirst).mockResolvedValue(null);

      const result = await TransitionManager.executeTransition(
        'cmp-123',
        'triaging',
        {
          userId: 'user-123',
          userRole: 'admin',
          complaintId: 'cmp-123',
          reason: 'Start triage',
        },
        'tenant-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate transition before executing', async () => {
      vi.mocked(prisma.complaint.findFirst).mockResolvedValue({
        id: 'cmp-123',
        status: 'submitted',
        summary: null,
        assignedToId: null,
        tenantId: 'tenant-123',
      } as any);

      // Try invalid transition (resolved -> submitted)
      const result = await TransitionManager.executeTransition(
        'cmp-123',
        'submitted',
        {
          userId: 'user-123',
          userRole: 'admin',
          complaintId: 'cmp-123',
          reason: 'Try invalid transition',
        },
        'tenant-123'
      );

      expect(result.success).toBe(false);
    });

    it('should require summary before resolving', async () => {
      vi.mocked(prisma.complaint.findFirst).mockResolvedValue({
        id: 'cmp-123',
        status: 'in_progress',
        summary: null, // No summary
        assignedToId: 'user-456',
        tenantId: 'tenant-123',
      } as any);

      const result = await TransitionManager.executeTransition(
        'cmp-123',
        'resolved',
        {
          userId: 'user-123',
          userRole: 'admin',
          complaintId: 'cmp-123',
          reason: 'Try to resolve without summary',
        },
        'tenant-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('summary');
    });

    it('should execute valid transition and create audit log', async () => {
      vi.mocked(prisma.complaint.findFirst).mockResolvedValue({
        id: 'cmp-123',
        status: 'submitted',
        summary: null,
        assignedToId: null,
        tenantId: 'tenant-123',
      } as any);

      vi.mocked(prisma.complaint.update).mockResolvedValue({
        status: 'triaging',
      } as any);

      vi.mocked(prisma.complaintEvent.create).mockResolvedValue({
        id: 'event-123',
      } as any);

      const result = await TransitionManager.executeTransition(
        'cmp-123',
        'triaging',
        {
          userId: 'user-123',
          userRole: 'admin',
          complaintId: 'cmp-123',
          reason: 'Start triage',
        },
        'tenant-123'
      );

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('submitted');
      expect(result.newStatus).toBe('triaging');

      // Verify Prisma update was called
      expect(prisma.complaint.update).toHaveBeenCalledWith({
        where: { id: 'cmp-123' },
        data: { status: 'triaging' },
        select: { status: true },
      });

      // Verify audit log was written
      expect(writeAuditLog).toHaveBeenCalled();
    });

    it('should handle transition errors gracefully', async () => {
      vi.mocked(prisma.complaint.findFirst).mockResolvedValue({
        id: 'cmp-123',
        status: 'submitted',
        summary: null,
        assignedToId: null,
        tenantId: 'tenant-123',
      } as any);

      vi.mocked(prisma.complaint.update).mockRejectedValue(new Error('DB error'));

      const result = await TransitionManager.executeTransition(
        'cmp-123',
        'triaging',
        {
          userId: 'user-123',
          userRole: 'admin',
          complaintId: 'cmp-123',
          reason: 'Start triage',
        },
        'tenant-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to execute');
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return transitions filtered by role', () => {
      const adminTransitions = TransitionManager.getAvailableTransitions('in_progress', 'admin');
      const officerTransitions = TransitionManager.getAvailableTransitions('in_progress', 'complaint_officer');

      expect(adminTransitions.length).toBeGreaterThanOrEqual(officerTransitions.length);
    });

    it('should include transition reasons in output', () => {
      const transitions = TransitionManager.getAvailableTransitions('assigned', 'admin');
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions[0]).toHaveProperty('reason');
      expect(transitions[0]).toHaveProperty('description');
    });
  });
});
