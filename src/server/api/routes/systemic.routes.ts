// ============================================================================
// Systemic Issue Routes – Cluster detection and alerting
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { createLogger } from '../../utils/logger';
import { prisma } from '../../db/client';

const logger = createLogger('systemic-routes');

export const systemicRoutes = Router();

systemicRoutes.use(authenticate);
systemicRoutes.use(requireTenant);

// GET /api/v1/systemic/clusters – List active systemic clusters
systemicRoutes.get('/clusters', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const clusters = await prisma.systemicCluster.findMany({
    where: { tenantId, isActive: true },
    orderBy: { detectedAt: 'desc' },
  }) as any[];

  const data = clusters.map((cluster) => ({
    id: cluster.id,
    title: cluster.title,
    description: cluster.description,
    industry: cluster.industry,
    category: cluster.category,
    riskLevel: cluster.riskLevel,
    complaintCount: cluster.complaintCount,
    avgSimilarity: cluster.avgSimilarity,
    commonPatterns: cluster.commonPatterns ?? [],
    affectedBusinesses: [],
    isAcknowledged: cluster.isAcknowledged,
    detectedAt: cluster.detectedAt.toISOString(),
  }));

  res.json({ success: true, data });
});

// GET /api/v1/systemic/clusters/:id – Get cluster detail with member complaints
systemicRoutes.get('/clusters/:id', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const id = req.params.id as string;

  const cluster = await prisma.systemicCluster.findFirst({
    where: { id, tenantId },
  }) as any;

  if (!cluster) {
    res.status(404).json({ success: false, error: { message: 'Cluster not found' } });
    return;
  }

  // Group businesses with complaint counts
  const businessCounts = new Map<string, { id: string; name: string; count: number }>();

  res.json({
    success: true,
    data: {
      id: cluster.id,
      title: cluster.title,
      description: cluster.description,
      industry: cluster.industry,
      category: cluster.category,
      riskLevel: cluster.riskLevel,
      complaintCount: cluster.complaintCount,
      avgSimilarity: cluster.avgSimilarity,
      commonPatterns: cluster.commonPatterns ?? [],
      affectedBusinesses: Array.from(businessCounts.values()).map((b) => ({
        id: b.id,
        name: b.name,
        complaintCount: b.count,
      })),
      complaints: [],
      aiAnalysis: null,
      isAcknowledged: cluster.isAcknowledged,
      acknowledgedBy: cluster.acknowledgedBy,
      acknowledgedAt: cluster.acknowledgedAt?.toISOString() ?? null,
      detectedAt: cluster.detectedAt.toISOString(),
    },
  });
});

// POST /api/v1/systemic/clusters/:id/acknowledge – Acknowledge an alert
systemicRoutes.post(
  '/clusters/:id/acknowledge',
  authorize('supervisor', 'executive', 'admin'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const id = req.params.id as string;
    const userId = req.userId!;

    const cluster = await prisma.systemicCluster.findFirst({
      where: { id, tenantId } as any,
    });

    if (!cluster) {
      res.status(404).json({ success: false, error: { message: 'Cluster not found' } });
      return;
    }

    await prisma.systemicCluster.update({
      where: { id } as any,
      data: {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'acknowledge',
        entity: 'systemic_cluster',
        entityId: id,
        newValues: { acknowledgedAt: new Date().toISOString() },
      },
    });

    logger.info('Systemic cluster acknowledged', { clusterId: id, acknowledgedBy: userId });

    res.json({
      success: true,
      data: {
        clusterId: id,
        acknowledgedBy: userId,
        acknowledgedAt: new Date().toISOString(),
      },
    });
  },
);

// GET /api/v1/systemic/alerts – Active unacknowledged alerts
systemicRoutes.get('/alerts', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const alerts = await prisma.systemicCluster.findMany({
    where: {
      tenantId,
      isActive: true,
      isAcknowledged: false,
    },
    orderBy: { detectedAt: 'desc' },
    select: {
      id: true,
      title: true,
      riskLevel: true,
      complaintCount: true,
      detectedAt: true,
    },
  });

  res.json({
    success: true,
    data: alerts.map((a) => ({
      clusterId: a.id,
      title: a.title,
      riskLevel: a.riskLevel,
      complaintCount: a.complaintCount,
      detectedAt: a.detectedAt.toISOString(),
    })),
  });
});

// GET /api/v1/systemic/heatmap – Industry heat map data
systemicRoutes.get('/heatmap', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const results = await prisma.complaint.groupBy({
    by: ['industry', 'category'],
    where: {
      tenantId,
      industry: { not: null },
      category: { not: null },
      createdAt: { gt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    _count: { id: true },
  });

  // Pivot into { industry -> { category -> count } }
  const industryMap = new Map<string, Record<string, number>>();
  for (const row of results) {
    if (!row.industry || !row.category) continue;
    const existing = industryMap.get(row.industry) ?? {};
    existing[row.category] = row._count.id;
    industryMap.set(row.industry, existing);
  }

  const industries = Array.from(industryMap.entries()).map(([industry, categories]) => ({
    industry,
    categories,
  }));

  res.json({ success: true, data: { industries } });
});

// GET /api/v1/systemic/repeat-offenders – Businesses with high complaint counts
systemicRoutes.get('/repeat-offenders', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const limitSchema = z.coerce.number().int().min(1).max(50).default(10);
  const limit = limitSchema.parse(Array.isArray(req.query.limit) ? req.query.limit[0] : (req.query.limit ?? 10));

  const businesses = await prisma.business.findMany({
    where: {
      tenantId,
      complaintCount: { gt: 0 },
    },
    orderBy: { complaintCount: 'desc' },
    take: limit,
    select: {
      id: true,
      name: true,
      abn: true,
      industry: true,
      complaintCount: true,
      avgRiskScore: true,
      complaints: {
        where: { systemicClusterId: { not: null } },
        select: { systemicClusterId: true },
        distinct: ['systemicClusterId'],
      },
      _count: {
        select: { complaints: true },
      },
    },
  });

  // Get latest complaint date per business
  const businessIds = businesses.map((b) => b.id);
  const latestComplaints = businessIds.length > 0
    ? await prisma.complaint.groupBy({
        by: ['businessId'],
        where: { businessId: { in: businessIds }, tenantId },
        _max: { createdAt: true },
      })
    : [];

  const latestMap = new Map<string, Date>();
  for (const row of latestComplaints) {
    if (row.businessId && row._max.createdAt) {
      latestMap.set(row.businessId, row._max.createdAt);
    }
  }

  res.json({
    success: true,
    data: businesses.map((b) => ({
      businessId: b.id,
      name: b.name,
      abn: b.abn,
      industry: b.industry,
      complaintCount: b.complaintCount,
      avgRiskScore: b.avgRiskScore,
      systemicClusters: b.complaints.length,
      latestComplaint: latestMap.get(b.id)?.toISOString() ?? null,
    })),
  });
});
