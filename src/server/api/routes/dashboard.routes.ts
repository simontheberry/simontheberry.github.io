// ============================================================================
// Dashboard Routes – Analytics & Stats
// Provides structured data for officer, supervisor, and executive dashboards
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { createLogger } from '../../utils/logger';

const logger = createLogger('dashboard-routes');

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);
dashboardRoutes.use(requireTenant);

// GET /api/v1/dashboard/stats – Overview statistics
dashboardRoutes.get('/stats', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  // In production: aggregate from DB via prisma.complaint.groupBy({ by: ['status', 'riskLevel'], where: { tenantId }, _count: true })

  logger.info('Dashboard stats requested', { tenantId, userId: req.userId });

  res.json({
    success: true,
    data: {
      totalComplaints: 247,
      openComplaints: 83,
      criticalComplaints: 12,
      avgResolutionDays: 4.2,
      complaintsToday: 8,
      systemicAlerts: 4,
      pendingTriage: 6,
      slaBreaches: 3,
      statusBreakdown: {
        submitted: 6,
        triaging: 3,
        triaged: 14,
        assigned: 22,
        in_progress: 31,
        awaiting_response: 13,
        escalated: 7,
        resolved: 128,
        closed: 23,
      },
      riskBreakdown: {
        critical: 12,
        high: 34,
        medium: 89,
        low: 112,
      },
      routingBreakdown: {
        line_1_auto: 142,
        line_2_investigation: 87,
        systemic_review: 18,
      },
    },
  });
});

// GET /api/v1/dashboard/officer – Complaint officer personal queue
dashboardRoutes.get('/officer', async (req: Request, res: Response) => {
  const userId = req.userId!;

  // In production: prisma.complaint.findMany({
  //   where: { tenantId, assignedToId: userId, status: { in: ['assigned', 'in_progress', 'awaiting_response'] } },
  //   orderBy: { priorityScore: 'desc' },
  //   include: { business: { select: { name: true } } },
  // })

  res.json({
    success: true,
    data: {
      queue: [
        {
          id: 'cmp-001',
          referenceNumber: 'CMP-2A4F-XK91',
          summary: 'Misleading pricing on home loan comparison rate — advertised 3.49% but actual rate with fees is 5.2%. Consumer locked into 3-year term.',
          business: 'National Finance Group Pty Ltd',
          category: 'misleading_conduct',
          riskLevel: 'critical',
          priorityScore: 0.92,
          status: 'assigned',
          submittedAt: '2025-01-15T09:30:00Z',
          slaDeadline: '2025-01-17T09:30:00Z',
          aiConfidence: 0.89,
          isEdited: false,
        },
        {
          id: 'cmp-002',
          referenceNumber: 'CMP-3B5G-LM72',
          summary: 'Aged care facility failing to provide adequate nutrition. Resident lost 8kg in 3 months. Family complaints ignored by management.',
          business: 'Sunrise Aged Care Holdings',
          category: 'service_quality',
          riskLevel: 'high',
          priorityScore: 0.84,
          status: 'in_progress',
          submittedAt: '2025-01-14T14:15:00Z',
          slaDeadline: '2025-01-19T14:15:00Z',
          aiConfidence: 0.91,
          isEdited: false,
        },
        {
          id: 'cmp-003',
          referenceNumber: 'CMP-4C6H-NP83',
          summary: 'Telco refusing cooling-off period cancellation for business broadband contract signed under pressure by door-to-door salesperson.',
          business: 'QuickConnect Telecom',
          category: 'unfair_contract_terms',
          riskLevel: 'medium',
          priorityScore: 0.61,
          status: 'awaiting_response',
          submittedAt: '2025-01-13T11:00:00Z',
          slaDeadline: '2025-01-20T11:00:00Z',
          aiConfidence: 0.85,
          isEdited: true,
        },
        {
          id: 'cmp-004',
          referenceNumber: 'CMP-5D7I-QR94',
          summary: 'Building contractor took $45,000 deposit then abandoned renovation. Company now uncontactable. ABN still active.',
          business: 'Premier Builds Australia',
          category: 'scam_fraud',
          riskLevel: 'high',
          priorityScore: 0.78,
          status: 'assigned',
          submittedAt: '2025-01-12T16:45:00Z',
          slaDeadline: '2025-01-19T16:45:00Z',
          aiConfidence: 0.93,
          isEdited: false,
        },
        {
          id: 'cmp-005',
          referenceNumber: 'CMP-6E8J-ST05',
          summary: 'Insurance claim denied citing fine-print exclusion for "pre-existing damage" after storm. Assessor spent 5 minutes on site.',
          business: 'SafeGuard Insurance Ltd',
          category: 'unfair_contract_terms',
          riskLevel: 'medium',
          priorityScore: 0.55,
          status: 'in_progress',
          submittedAt: '2025-01-11T10:20:00Z',
          slaDeadline: '2025-01-18T10:20:00Z',
          aiConfidence: 0.82,
          isEdited: false,
        },
      ],
      stats: {
        assigned: 2,
        inProgress: 2,
        awaitingResponse: 1,
        resolvedThisWeek: 4,
      },
    },
  });
});

// GET /api/v1/dashboard/supervisor – Supervisor team overview
dashboardRoutes.get('/supervisor', authorize('supervisor', 'admin'), async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      teamWorkload: [
        { userId: 'u-001', name: 'Sarah Chen', role: 'complaint_officer', assigned: 8, inProgress: 3, avgDaysToResolve: 3.2, slaCompliance: 0.94 },
        { userId: 'u-002', name: 'James Olgilvie', role: 'complaint_officer', assigned: 6, inProgress: 4, avgDaysToResolve: 4.1, slaCompliance: 0.88 },
        { userId: 'u-003', name: 'Priya Sharma', role: 'complaint_officer', assigned: 7, inProgress: 2, avgDaysToResolve: 2.8, slaCompliance: 0.96 },
        { userId: 'u-004', name: 'Michael Torres', role: 'complaint_officer', assigned: 5, inProgress: 5, avgDaysToResolve: 5.4, slaCompliance: 0.78 },
      ],
      avgHandlingTime: 3.9,
      slaComplianceRate: 0.89,
      bottlenecks: [
        { type: 'high_load', officerId: 'u-004', name: 'Michael Torres', reason: '5 complaints in progress, all high complexity', severity: 'high' },
        { type: 'sla_risk', complaintId: 'cmp-008', referenceNumber: 'CMP-9H2L-WZ38', hoursRemaining: 4, severity: 'critical' },
        { type: 'unassigned', count: 6, avgPriorityScore: 0.71, severity: 'medium' },
      ],
      systemicAlerts: [
        { clusterId: 'sc-001', title: 'Misleading comparison rates in personal lending', complaintCount: 14, riskLevel: 'critical', isAcknowledged: false },
        { clusterId: 'sc-004', title: 'Aged care medication management failures', complaintCount: 6, riskLevel: 'critical', isAcknowledged: false },
      ],
      triageQueue: {
        pending: 6,
        avgWaitMinutes: 12,
        oldestWaitMinutes: 34,
      },
      trendData: [
        { date: '2025-01-09', submitted: 11, resolved: 8, escalated: 1 },
        { date: '2025-01-10', submitted: 14, resolved: 10, escalated: 2 },
        { date: '2025-01-11', submitted: 9, resolved: 12, escalated: 0 },
        { date: '2025-01-12', submitted: 16, resolved: 7, escalated: 3 },
        { date: '2025-01-13', submitted: 12, resolved: 11, escalated: 1 },
        { date: '2025-01-14', submitted: 8, resolved: 9, escalated: 0 },
        { date: '2025-01-15', submitted: 13, resolved: 6, escalated: 2 },
      ],
    },
  });
});

// GET /api/v1/dashboard/executive – Executive overview
dashboardRoutes.get('/executive', authorize('executive', 'admin'), async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      industryRiskMap: [
        { industry: 'Financial Services', totalComplaints: 47, criticalCount: 6, highCount: 14, avgPriorityScore: 0.72, trend: 'increasing' },
        { industry: 'Aged Care', totalComplaints: 23, criticalCount: 4, highCount: 8, avgPriorityScore: 0.79, trend: 'increasing' },
        { industry: 'Building & Construction', totalComplaints: 31, criticalCount: 2, highCount: 11, avgPriorityScore: 0.64, trend: 'stable' },
        { industry: 'Telecommunications', totalComplaints: 38, criticalCount: 1, highCount: 9, avgPriorityScore: 0.51, trend: 'decreasing' },
        { industry: 'Energy', totalComplaints: 29, criticalCount: 2, highCount: 7, avgPriorityScore: 0.58, trend: 'increasing' },
        { industry: 'Insurance', totalComplaints: 22, criticalCount: 1, highCount: 6, avgPriorityScore: 0.55, trend: 'stable' },
        { industry: 'Retail', totalComplaints: 34, criticalCount: 0, highCount: 4, avgPriorityScore: 0.38, trend: 'stable' },
      ],
      enforcementCandidates: [
        {
          businessId: 'b-001',
          name: 'National Finance Group Pty Ltd',
          abn: '12 345 678 901',
          industry: 'Financial Services',
          complaintCount: 18,
          avgRiskScore: 0.82,
          systemicClusters: 2,
          estimatedConsumerHarm: '$2.4M',
          recommendation: 'Formal investigation recommended - systemic misleading conduct across lending products',
        },
        {
          businessId: 'b-002',
          name: 'Sunrise Aged Care Holdings',
          abn: '98 765 432 109',
          industry: 'Aged Care',
          complaintCount: 12,
          avgRiskScore: 0.79,
          systemicClusters: 1,
          estimatedConsumerHarm: 'Non-monetary (health/safety)',
          recommendation: 'Referral to Aged Care Quality and Safety Commission - pattern of care standard failures',
        },
      ],
      repeatOffenderIndex: [
        { businessId: 'b-001', name: 'National Finance Group Pty Ltd', complaintCount: 18, avgRisk: 0.82, industry: 'Financial Services' },
        { businessId: 'b-003', name: 'Premier Builds Australia', complaintCount: 14, avgRisk: 0.71, industry: 'Building & Construction' },
        { businessId: 'b-002', name: 'Sunrise Aged Care Holdings', complaintCount: 12, avgRisk: 0.79, industry: 'Aged Care' },
        { businessId: 'b-004', name: 'PowerSave Energy', complaintCount: 11, avgRisk: 0.58, industry: 'Energy' },
        { businessId: 'b-005', name: 'QuickConnect Telecom', complaintCount: 9, avgRisk: 0.52, industry: 'Telecommunications' },
      ],
      complaintVolumeTrend: [
        { week: '2024-W49', count: 42 },
        { week: '2024-W50', count: 38 },
        { week: '2024-W51', count: 45 },
        { week: '2024-W52', count: 31 },
        { week: '2025-W01', count: 51 },
        { week: '2025-W02', count: 58 },
        { week: '2025-W03', count: 47 },
      ],
    },
  });
});

// GET /api/v1/dashboard/trends – Complaint trends over time
dashboardRoutes.get('/trends', async (req: Request, res: Response) => {
  const { period = '30d', groupBy = 'day' } = req.query;

  res.json({
    success: true,
    data: {
      period,
      groupBy,
      series: [
        { date: '2025-01-01', total: 12, byRisk: { critical: 1, high: 3, medium: 5, low: 3 } },
        { date: '2025-01-02', total: 9, byRisk: { critical: 0, high: 2, medium: 4, low: 3 } },
        { date: '2025-01-03', total: 15, byRisk: { critical: 2, high: 4, medium: 6, low: 3 } },
        { date: '2025-01-04', total: 7, byRisk: { critical: 0, high: 1, medium: 3, low: 3 } },
        { date: '2025-01-05', total: 11, byRisk: { critical: 1, high: 3, medium: 4, low: 3 } },
        { date: '2025-01-06', total: 14, byRisk: { critical: 1, high: 4, medium: 5, low: 4 } },
        { date: '2025-01-07', total: 10, byRisk: { critical: 0, high: 2, medium: 5, low: 3 } },
      ],
    },
  });
});
