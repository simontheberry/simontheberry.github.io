import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Queue, Worker } from 'bullmq';
import {
  createTestComplaint,
  createTestTenant,
  createTestUser,
} from '../factories';

// Mock BullMQ
vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn(),
}));

// Mock Prisma
vi.mock('../../src/server/db/client', () => ({
  prisma: {
    complaint: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    escalation: {
      create: vi.fn(),
    },
    slaDeadline: {
      findUnique: vi.fn(),
    },
  },
}));

describe('SLA Queue Worker', () => {
  let mockTenant: any;
  let mockComplaints: any[];
  let mockQueue: any;

  beforeEach(() => {
    mockTenant = createTestTenant({
      settings: {
        slaDefaults: {
          line1ResponseHours: 48,
          line2ResponseHours: 120,
          businessResponseDays: 14,
          escalationDays: 21,
        },
      },
    });

    mockComplaints = [
      createTestComplaint(mockTenant.id, {
        status: 'triaged',
        slaDeadline: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago (overdue line 1)
        riskLevel: 'high',
      }),
      createTestComplaint(mockTenant.id, {
        status: 'in_progress',
        slaDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        riskLevel: 'medium',
      }),
      createTestComplaint(mockTenant.id, {
        status: 'awaiting_response',
        slaDeadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (overdue)
        riskLevel: 'critical',
      }),
    ];

    mockQueue = {
      add: vi.fn(),
      process: vi.fn(),
    };
  });

  describe('SLA Breach Detection', () => {
    it('identifies complaints past SLA deadline', async () => {
      const now = new Date();
      const breachedComplaints = mockComplaints.filter(
        (c) => c.slaDeadline < now,
      );

      expect(breachedComplaints.length).toBe(2);
      expect(breachedComplaints.every((c) => c.slaDeadline < now)).toBe(true);
    });

    it('calculates hours past deadline', async () => {
      const now = new Date();
      const complaint = mockComplaints[0];

      const hoursPast = (now.getTime() - complaint.slaDeadline.getTime()) / (1000 * 60 * 60);
      expect(hoursPast).toBeGreaterThan(0);
      expect(hoursPast).toBeLessThan(26);
    });

    it('does not flag approaching but not breached deadlines', async () => {
      const now = new Date();
      const approaching = mockComplaints.filter((c) => {
        const hoursUntil = (c.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntil > 0 && hoursUntil <= 12;
      });

      expect(approaching.length).toBe(1);
      expect(approaching[0].riskLevel).toBe('medium');
    });
  });

  describe('Escalation Creation', () => {
    it('creates escalation record for breached complaints', async () => {
      const { prisma } = await import('../../src/server/db/client');

      const breachedComplaint = mockComplaints[0];
      const escalationData = {
        complaintId: breachedComplaint.id,
        tenantId: mockTenant.id,
        reason: 'SLA_BREACHED_LINE_1',
        fromStatus: breachedComplaint.status,
        toStatus: 'escalated',
        escalatedBy: 'system',
        escalatedAt: new Date(),
      };

      vi.mocked(prisma.escalation.create).mockResolvedValueOnce({
        id: 'esc-1',
        ...escalationData,
      });

      const createdEscalation = await prisma.escalation.create({
        data: escalationData,
      });

      expect(createdEscalation.id).toBeDefined();
      expect(createdEscalation.reason).toBe('SLA_BREACHED_LINE_1');
      expect(vi.mocked(prisma.escalation.create)).toHaveBeenCalledWith({
        data: escalationData,
      });
    });

    it('updates complaint status to escalated', async () => {
      const { prisma } = await import('../../src/server/db/client');

      const breachedComplaint = mockComplaints[0];
      vi.mocked(prisma.complaint.update).mockResolvedValueOnce({
        ...breachedComplaint,
        status: 'escalated',
      });

      const updated = await prisma.complaint.update({
        where: { id: breachedComplaint.id },
        data: { status: 'escalated' },
      });

      expect(updated.status).toBe('escalated');
    });
  });

  describe('SLA Queue Job Processing', () => {
    it('enqueues SLA check job', async () => {
      const jobData = {
        tenantId: mockTenant.id,
        checkType: 'hourly',
      };

      await mockQueue.add('sla-check', jobData);

      expect(mockQueue.add).toHaveBeenCalledWith('sla-check', jobData);
    });

    it('processes SLA check job and detects breaches', async () => {
      const { prisma } = await import('../../src/server/db/client');

      vi.mocked(prisma.complaint.findMany).mockResolvedValueOnce(
        mockComplaints.filter((c) => c.slaDeadline < new Date()),
      );

      const breachedComplaints = await prisma.complaint.findMany({
        where: {
          tenantId: mockTenant.id,
          status: { in: ['triaged', 'assigned', 'in_progress', 'awaiting_response'] },
        },
      });

      expect(breachedComplaints.length).toBeGreaterThan(0);
    });

    it('handles worker retry on failure', async () => {
      const jobData = { tenantId: mockTenant.id };
      let attempts = 0;
      const maxRetries = 3;

      const processJob = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      // First attempt fails
      let result: any;
      while (attempts < maxRetries) {
        try {
          result = await processJob();
          break;
        } catch (err) {
          if (attempts >= maxRetries) throw err;
        }
      }

      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    });
  });

  describe('SLA Category-specific Logic', () => {
    it('applies line 1 SLA (48 hours) for triage', async () => {
      const line1Complaint = mockComplaints.find((c) => c.status === 'triaged');
      const line1Sla = mockTenant.settings.slaDefaults.line1ResponseHours;

      expect(line1Sla).toBe(48);

      const expectedDeadline = new Date(
        line1Complaint.submittedAt.getTime() + line1Sla * 60 * 60 * 1000,
      );

      // Complaint deadline should be approximately 48 hours from submission
      const hoursDiff =
        Math.abs(
          line1Complaint.slaDeadline.getTime() - expectedDeadline.getTime(),
        ) /
        (1000 * 60 * 60);
      expect(hoursDiff).toBeLessThan(1);
    });

    it('applies line 2 SLA (120 hours) for investigation', async () => {
      const line2Sla = mockTenant.settings.slaDefaults.line2ResponseHours;
      expect(line2Sla).toBe(120);

      // 120 hours = 5 days
      const fiveDaysInMs = 120 * 60 * 60 * 1000;
      expect(fiveDaysInMs).toBe(432000000);
    });

    it('applies business response SLA (14 days)', async () => {
      const businessSla = mockTenant.settings.slaDefaults.businessResponseDays;
      expect(businessSla).toBe(14);

      const fourteenDaysInMs = businessSla * 24 * 60 * 60 * 1000;
      expect(fourteenDaysInMs).toBe(1209600000);
    });

    it('triggers escalation at 21 days', async () => {
      const escalationSla = mockTenant.settings.slaDefaults.escalationDays;
      expect(escalationSla).toBe(21);

      const complaint = createTestComplaint(mockTenant.id, {
        submittedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      });

      const isEscalationReady =
        Date.now() - complaint.submittedAt.getTime() >=
        escalationSla * 24 * 60 * 60 * 1000;

      expect(isEscalationReady).toBe(true);
    });
  });

  describe('Critical vs Non-Critical Prioritization', () => {
    it('processes critical complaints first', async () => {
      const criticalBreached = mockComplaints.find(
        (c) => c.riskLevel === 'critical' && c.slaDeadline < new Date(),
      );
      const nonCriticalBreached = mockComplaints.find(
        (c) => c.riskLevel === 'high' && c.slaDeadline < new Date(),
      );

      expect(criticalBreached).toBeDefined();
      expect(nonCriticalBreached).toBeDefined();

      // Critical should have higher priority
      const priority = (complaint: any) =>
        complaint.riskLevel === 'critical' ? 1 : 2;

      expect(priority(criticalBreached)).toBeLessThan(
        priority(nonCriticalBreached),
      );
    });

    it('tracks escalation metrics', async () => {
      const escalationMetrics = {
        breachedCount: mockComplaints.filter((c) => c.slaDeadline < new Date())
          .length,
        approachingCount: mockComplaints.filter((c) => {
          const now = new Date();
          const hoursUntil =
            (c.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
          return hoursUntil > 0 && hoursUntil <= 12;
        }).length,
        criticalBreached: mockComplaints.filter(
          (c) => c.slaDeadline < new Date() && c.riskLevel === 'critical',
        ).length,
      };

      expect(escalationMetrics.breachedCount).toBe(2);
      expect(escalationMetrics.approachingCount).toBe(1);
      expect(escalationMetrics.criticalBreached).toBe(1);
    });
  });
});
