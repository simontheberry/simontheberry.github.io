// ============================================================================
// Dashboard Routes – Analytics & Stats
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);
dashboardRoutes.use(requireTenant);

// GET /api/v1/dashboard/stats -- Overview statistics (all authenticated users)
dashboardRoutes.get('/stats', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalComplaints,
    openComplaints,
    criticalComplaints,
    complaintsToday,
    pendingTriage,
    systemicAlerts,
    slaBreaches,
  ] = await Promise.all([
    prisma.complaint.count({ where: { tenantId } }),
    prisma.complaint.count({
      where: { tenantId, status: { notIn: ['resolved', 'closed', 'withdrawn'] } },
    }),
    prisma.complaint.count({
      where: { tenantId, riskLevel: 'critical', status: { notIn: ['resolved', 'closed'] } },
    }),
    prisma.complaint.count({
      where: { tenantId, createdAt: { gte: todayStart } },
    }),
    prisma.complaint.count({
      where: { tenantId, status: { in: ['submitted', 'triaging'] } },
    }),
    prisma.systemicCluster.count({
      where: { tenantId, isActive: true, isAcknowledged: false },
    }),
    prisma.complaint.count({
      where: { tenantId, slaDeadline: { lt: now }, status: { notIn: ['resolved', 'closed'] } },
    }),
  ]);

  // Calculate average resolution days from resolved complaints
  const resolvedComplaints = await prisma.complaint.findMany({
    where: { tenantId, resolvedAt: { not: null }, submittedAt: { not: null } },
    select: { submittedAt: true, resolvedAt: true },
    take: 100,
    orderBy: { resolvedAt: 'desc' },
  });

  let avgResolutionDays = 0;
  if (resolvedComplaints.length > 0) {
    const totalDays = resolvedComplaints.reduce((sum, c) => {
      if (c.submittedAt && c.resolvedAt) {
        return sum + (c.resolvedAt.getTime() - c.submittedAt.getTime()) / (1000 * 60 * 60 * 24);
      }
      return sum;
    }, 0);
    avgResolutionDays = Math.round((totalDays / resolvedComplaints.length) * 10) / 10;
  }

  res.json({
    success: true,
    data: {
      totalComplaints,
      openComplaints,
      criticalComplaints,
      avgResolutionDays,
      complaintsToday,
      systemicAlerts,
      pendingTriage,
      slaBreaches,
    },
  });
});

// GET /api/v1/dashboard/officer -- Complaint officer personal queue
// Accessible by complaint_officer, supervisor, admin
dashboardRoutes.get('/officer', async (req: Request, res: Response) => {
  const userId = req.userId!;
  const tenantId = req.tenantId!;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [queue, assigned, inProgress, awaitingResponse, resolvedThisWeek] = await Promise.all([
    prisma.complaint.findMany({
      where: { tenantId, assignedToId: userId, status: { notIn: ['resolved', 'closed', 'withdrawn'] } },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        business: { select: { id: true, name: true } },
      },
    }),
    prisma.complaint.count({
      where: { tenantId, assignedToId: userId, status: 'assigned' },
    }),
    prisma.complaint.count({
      where: { tenantId, assignedToId: userId, status: 'in_progress' },
    }),
    prisma.complaint.count({
      where: { tenantId, assignedToId: userId, status: 'awaiting_response' },
    }),
    prisma.complaint.count({
      where: { tenantId, assignedToId: userId, status: 'resolved', resolvedAt: { gte: weekAgo } },
    }),
  ]);

  res.json({
    success: true,
    data: {
      queue,
      stats: {
        assigned,
        inProgress,
        awaitingResponse,
        resolvedThisWeek,
      },
    },
  });
});

// GET /api/v1/dashboard/supervisor -- Supervisor team overview
// Only supervisors, executives, and admins
dashboardRoutes.get(
  '/supervisor',
  authorize('supervisor', 'executive', 'admin'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;

    // Team workload: complaints per officer
    const teamWorkload = await prisma.user.findMany({
      where: { tenantId, isActive: true, role: 'complaint_officer' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        assignedComplaints: {
          where: { status: { notIn: ['resolved', 'closed', 'withdrawn'] } },
          select: { id: true, status: true, priorityScore: true, riskLevel: true },
        },
      },
    });

    const workloadSummary = teamWorkload.map((officer) => ({
      officerId: officer.id,
      name: `${officer.firstName} ${officer.lastName}`,
      totalOpen: officer.assignedComplaints.length,
      critical: officer.assignedComplaints.filter((c) => c.riskLevel === 'critical').length,
      high: officer.assignedComplaints.filter((c) => c.riskLevel === 'high').length,
    }));

    // Unassigned complaints (bottlenecks)
    const bottlenecks = await prisma.complaint.findMany({
      where: {
        tenantId,
        assignedToId: null,
        status: { in: ['triaged', 'submitted'] },
      },
      select: {
        id: true,
        referenceNumber: true,
        riskLevel: true,
        priorityScore: true,
        createdAt: true,
      },
      orderBy: { priorityScore: 'desc' },
      take: 20,
    });

    // Systemic alerts
    const systemicAlerts = await prisma.systemicCluster.findMany({
      where: { tenantId, isActive: true, isAcknowledged: false },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        teamWorkload: workloadSummary,
        bottlenecks,
        systemicAlerts,
      },
    });
  },
);

// GET /api/v1/dashboard/executive -- Executive overview
// Only executives and admins
dashboardRoutes.get(
  '/executive',
  authorize('executive', 'admin'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;

    // Industry risk map: complaints grouped by industry with risk counts
    const complaints = await prisma.complaint.groupBy({
      by: ['industry'],
      where: { tenantId, industry: { not: null } },
      _count: { id: true },
    });

    const industryRiskMap = complaints.map((group) => ({
      industry: group.industry,
      complaintCount: group._count.id,
    }));

    // Repeat offenders
    const repeatOffenders = await prisma.business.findMany({
      where: { tenantId, repeatOffenderFlag: true },
      select: {
        id: true,
        name: true,
        abn: true,
        industry: true,
        complaintCount: true,
        avgRiskScore: true,
      },
      orderBy: { complaintCount: 'desc' },
      take: 10,
    });

    // Enforcement candidates: high/critical risk with many complaints
    const enforcementCandidates = await prisma.business.findMany({
      where: {
        tenantId,
        complaintCount: { gte: 3 },
        avgRiskScore: { gte: 0.7 },
      },
      select: {
        id: true,
        name: true,
        abn: true,
        industry: true,
        complaintCount: true,
        avgRiskScore: true,
      },
      orderBy: { avgRiskScore: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        industryRiskMap,
        enforcementCandidates,
        repeatOffenderIndex: repeatOffenders,
      },
    });
  },
);

// GET /api/v1/dashboard/trends -- Complaint trends over time
// All authenticated users can view trends
dashboardRoutes.get('/trends', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { period = '30d' } = req.query as { period?: string };

  const daysBack = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const complaints = await prisma.complaint.findMany({
    where: { tenantId, createdAt: { gte: startDate } },
    select: { createdAt: true, riskLevel: true, category: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by date
  const seriesMap = new Map<string, { total: number; critical: number; high: number; medium: number; low: number }>();

  for (const c of complaints) {
    const dateKey = c.createdAt.toISOString().split('T')[0];
    const entry = seriesMap.get(dateKey) || { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    entry.total++;
    if (c.riskLevel === 'critical') entry.critical++;
    else if (c.riskLevel === 'high') entry.high++;
    else if (c.riskLevel === 'medium') entry.medium++;
    else if (c.riskLevel === 'low') entry.low++;
    seriesMap.set(dateKey, entry);
  }

  const series = Array.from(seriesMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  res.json({
    success: true,
    data: {
      period,
      series,
    },
  });
});
