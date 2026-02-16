// ============================================================================
// Systemic Issue Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';

export const systemicRoutes = Router();

systemicRoutes.use(authenticate);
systemicRoutes.use(requireTenant);

// GET /api/v1/systemic/clusters -- List active systemic clusters
systemicRoutes.get('/clusters', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const clusters = await prisma.systemicCluster.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ riskLevel: 'desc' }, { complaintCount: 'desc' }],
    include: {
      complaints: {
        select: { id: true, referenceNumber: true, category: true, riskLevel: true },
        take: 5,
      },
    },
  });

  res.json({
    success: true,
    data: clusters,
  });
});

// GET /api/v1/systemic/clusters/:id -- Get cluster detail
systemicRoutes.get('/clusters/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;

  const cluster = await prisma.systemicCluster.findFirst({
    where: { id, tenantId },
    include: {
      complaints: {
        select: {
          id: true,
          referenceNumber: true,
          summary: true,
          category: true,
          riskLevel: true,
          priorityScore: true,
          status: true,
          createdAt: true,
          business: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!cluster) {
    throw new AppError(404, 'NOT_FOUND', 'Systemic cluster not found');
  }

  res.json({
    success: true,
    data: cluster,
  });
});

// POST /api/v1/systemic/clusters/:id/acknowledge -- Acknowledge an alert
systemicRoutes.post(
  '/clusters/:id/acknowledge',
  authorize('supervisor', 'executive', 'admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const cluster = await prisma.systemicCluster.findFirst({
      where: { id, tenantId },
    });

    if (!cluster) {
      throw new AppError(404, 'NOT_FOUND', 'Systemic cluster not found');
    }

    await prisma.systemicCluster.update({
      where: { id },
      data: {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'systemic.acknowledged',
      entity: 'SystemicCluster',
      entityId: id,
      newValues: { acknowledgedBy: userId },
    });

    res.json({
      success: true,
      data: { clusterId: id, acknowledgedBy: userId },
    });
  },
);

// GET /api/v1/systemic/alerts -- Active unacknowledged alerts
systemicRoutes.get('/alerts', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const alerts = await prisma.systemicCluster.findMany({
    where: { tenantId, isActive: true, isAcknowledged: false },
    orderBy: [{ riskLevel: 'desc' }, { detectedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      description: true,
      industry: true,
      category: true,
      riskLevel: true,
      complaintCount: true,
      avgSimilarity: true,
      detectedAt: true,
    },
  });

  res.json({
    success: true,
    data: alerts,
  });
});

// GET /api/v1/systemic/heatmap -- Industry heat map data
systemicRoutes.get('/heatmap', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  // Aggregate complaints by industry and risk level
  const groups = await prisma.complaint.groupBy({
    by: ['industry', 'riskLevel'],
    where: { tenantId, industry: { not: null }, riskLevel: { not: null } },
    _count: { id: true },
  });

  // Reshape into a map: { industry: { low, medium, high, critical, total } }
  const heatmap = new Map<string, { low: number; medium: number; high: number; critical: number; total: number }>();

  for (const group of groups) {
    if (!group.industry) continue;
    const entry = heatmap.get(group.industry) || { low: 0, medium: 0, high: 0, critical: 0, total: 0 };
    const level = group.riskLevel as string;
    if (level === 'low') entry.low += group._count.id;
    else if (level === 'medium') entry.medium += group._count.id;
    else if (level === 'high') entry.high += group._count.id;
    else if (level === 'critical') entry.critical += group._count.id;
    entry.total += group._count.id;
    heatmap.set(group.industry, entry);
  }

  const industries = Array.from(heatmap.entries()).map(([industry, counts]) => ({
    industry,
    ...counts,
  }));

  res.json({
    success: true,
    data: { industries },
  });
});

// GET /api/v1/systemic/repeat-offenders -- Businesses with high complaint counts
systemicRoutes.get('/repeat-offenders', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const offenders = await prisma.business.findMany({
    where: { tenantId, complaintCount: { gte: 2 } },
    orderBy: [{ complaintCount: 'desc' }, { avgRiskScore: 'desc' }],
    select: {
      id: true,
      name: true,
      abn: true,
      industry: true,
      complaintCount: true,
      avgRiskScore: true,
      repeatOffenderFlag: true,
    },
    take: 25,
  });

  res.json({
    success: true,
    data: offenders,
  });
});
