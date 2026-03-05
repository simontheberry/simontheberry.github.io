// ============================================================================
// Systemic Issue Routes – Cluster detection and alerting
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { createLogger } from '../../utils/logger';

const logger = createLogger('systemic-routes');

export const systemicRoutes = Router();

systemicRoutes.use(authenticate);
systemicRoutes.use(requireTenant);

// GET /api/v1/systemic/clusters – List active systemic clusters
systemicRoutes.get('/clusters', async (req: Request, res: Response) => {
  // In production: prisma.systemicCluster.findMany({ where: { tenantId, status: 'active' }, orderBy: { detectedAt: 'desc' } })

  res.json({
    success: true,
    data: [
      {
        id: 'sc-001',
        title: 'Misleading comparison rates in personal lending',
        description: 'Multiple complaints involving personal loan comparison rates that do not include mandatory fees, across several financial service providers.',
        industry: 'Financial Services',
        category: 'misleading_conduct',
        riskLevel: 'critical',
        complaintCount: 14,
        avgSimilarity: 0.91,
        commonPatterns: ['Hidden fees in comparison rate', 'Advertising vs actual rate discrepancy', 'Failure to disclose ongoing charges'],
        affectedBusinesses: ['National Finance Group Pty Ltd', 'QuickLoan Direct', 'Aussie Personal Finance'],
        isAcknowledged: false,
        detectedAt: '2025-01-14T08:00:00Z',
      },
      {
        id: 'sc-002',
        title: 'Energy billing errors during tariff transitions',
        description: 'Cluster of complaints about incorrect billing during tariff structure changes, primarily affecting customers on legacy plans.',
        industry: 'Energy',
        category: 'billing_dispute',
        riskLevel: 'high',
        complaintCount: 11,
        avgSimilarity: 0.87,
        commonPatterns: ['Retroactive tariff application', 'Delayed billing corrections', 'Inconsistent metering data'],
        affectedBusinesses: ['PowerSave Energy', 'GreenGrid Utilities'],
        isAcknowledged: true,
        detectedAt: '2025-01-10T14:30:00Z',
      },
      {
        id: 'sc-003',
        title: 'Building defect warranty claim refusals',
        description: 'Pattern of builders refusing to honour statutory warranty obligations on residential construction within the defect liability period.',
        industry: 'Building & Construction',
        category: 'warranty_guarantee',
        riskLevel: 'high',
        complaintCount: 8,
        avgSimilarity: 0.84,
        commonPatterns: ['Warranty period disputes', 'Blaming subcontractors', 'Ceased trading to avoid obligations'],
        affectedBusinesses: ['Premier Builds Australia', 'HomeStyle Constructions', 'BuildRight Group'],
        isAcknowledged: false,
        detectedAt: '2025-01-12T10:00:00Z',
      },
      {
        id: 'sc-004',
        title: 'Aged care medication management failures',
        description: 'Reports of incorrect medication administration and lack of qualified staff oversight in residential aged care facilities.',
        industry: 'Aged Care',
        category: 'service_quality',
        riskLevel: 'critical',
        complaintCount: 6,
        avgSimilarity: 0.88,
        commonPatterns: ['Missed medications', 'Incorrect dosages', 'Lack of clinical oversight'],
        affectedBusinesses: ['Sunrise Aged Care Holdings', 'Heritage Living Group'],
        isAcknowledged: false,
        detectedAt: '2025-01-13T16:00:00Z',
      },
    ],
  });
});

// GET /api/v1/systemic/clusters/:id – Get cluster detail with member complaints
systemicRoutes.get('/clusters/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    success: true,
    data: {
      id,
      title: 'Misleading comparison rates in personal lending',
      description: 'Multiple complaints involving personal loan comparison rates that do not include mandatory fees.',
      industry: 'Financial Services',
      category: 'misleading_conduct',
      riskLevel: 'critical',
      complaintCount: 14,
      avgSimilarity: 0.91,
      commonPatterns: ['Hidden fees in comparison rate', 'Advertising vs actual rate discrepancy', 'Failure to disclose ongoing charges'],
      affectedBusinesses: [
        { id: 'b-001', name: 'National Finance Group Pty Ltd', complaintCount: 8 },
        { id: 'b-006', name: 'QuickLoan Direct', complaintCount: 4 },
        { id: 'b-007', name: 'Aussie Personal Finance', complaintCount: 2 },
      ],
      complaints: [
        { id: 'cmp-001', referenceNumber: 'CMP-2A4F-XK91', summary: 'Misleading pricing on home loan comparison rate', similarity: 0.94, riskLevel: 'critical' },
        { id: 'cmp-010', referenceNumber: 'CMP-8G1K-VY27', summary: 'Personal loan advertised at 4.9% but actual rate 7.2% with fees', similarity: 0.92, riskLevel: 'high' },
        { id: 'cmp-011', referenceNumber: 'CMP-9H2L-WZ38', summary: 'Car loan comparison rate excluded establishment fee', similarity: 0.89, riskLevel: 'high' },
      ],
      aiAnalysis: {
        confidence: 0.91,
        reasoning: 'Strong cluster with high internal similarity. Common thread is non-disclosure of fees within comparison rates, potentially breaching National Consumer Credit Protection Act 2009.',
        recommendedAction: 'formal_investigation',
        estimatedConsumerHarm: '$2.4M across affected consumers',
      },
      isAcknowledged: false,
      detectedAt: '2025-01-14T08:00:00Z',
    },
  });
});

// POST /api/v1/systemic/clusters/:id/acknowledge – Acknowledge an alert
systemicRoutes.post(
  '/clusters/:id/acknowledge',
  authorize('supervisor', 'executive', 'admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

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
  res.json({
    success: true,
    data: [
      { clusterId: 'sc-001', title: 'Misleading comparison rates in personal lending', riskLevel: 'critical', complaintCount: 14, detectedAt: '2025-01-14T08:00:00Z' },
      { clusterId: 'sc-003', title: 'Building defect warranty claim refusals', riskLevel: 'high', complaintCount: 8, detectedAt: '2025-01-12T10:00:00Z' },
      { clusterId: 'sc-004', title: 'Aged care medication management failures', riskLevel: 'critical', complaintCount: 6, detectedAt: '2025-01-13T16:00:00Z' },
    ],
  });
});

// GET /api/v1/systemic/heatmap – Industry heat map data
systemicRoutes.get('/heatmap', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      industries: [
        { industry: 'Financial Services', categories: { misleading_conduct: 18, unfair_contract_terms: 12, scam_fraud: 8, billing_dispute: 5, other: 4 } },
        { industry: 'Telecommunications', categories: { billing_dispute: 14, unfair_contract_terms: 11, service_quality: 8, misleading_conduct: 3, other: 2 } },
        { industry: 'Energy', categories: { billing_dispute: 16, pricing_issues: 7, misleading_conduct: 3, service_quality: 2, other: 1 } },
        { industry: 'Building & Construction', categories: { warranty_guarantee: 12, scam_fraud: 9, service_quality: 6, misleading_conduct: 3, other: 1 } },
        { industry: 'Aged Care', categories: { service_quality: 14, privacy_breach: 4, discrimination: 3, billing_dispute: 1, other: 1 } },
        { industry: 'Insurance', categories: { unfair_contract_terms: 10, misleading_conduct: 6, refund_dispute: 4, other: 2 } },
        { industry: 'Retail', categories: { refund_dispute: 14, product_safety: 8, misleading_conduct: 6, warranty_guarantee: 4, other: 2 } },
      ],
    },
  });
});

// GET /api/v1/systemic/repeat-offenders – Businesses with high complaint counts
systemicRoutes.get('/repeat-offenders', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { businessId: 'b-001', name: 'National Finance Group Pty Ltd', abn: '12 345 678 901', industry: 'Financial Services', complaintCount: 18, avgRiskScore: 0.82, systemicClusters: 2, latestComplaint: '2025-01-15T09:30:00Z' },
      { businessId: 'b-003', name: 'Premier Builds Australia', abn: '45 678 901 234', industry: 'Building & Construction', complaintCount: 14, avgRiskScore: 0.71, systemicClusters: 1, latestComplaint: '2025-01-12T16:45:00Z' },
      { businessId: 'b-002', name: 'Sunrise Aged Care Holdings', abn: '98 765 432 109', industry: 'Aged Care', complaintCount: 12, avgRiskScore: 0.79, systemicClusters: 1, latestComplaint: '2025-01-14T14:15:00Z' },
      { businessId: 'b-004', name: 'PowerSave Energy', abn: '56 789 012 345', industry: 'Energy', complaintCount: 11, avgRiskScore: 0.58, systemicClusters: 1, latestComplaint: '2025-01-10T08:00:00Z' },
      { businessId: 'b-005', name: 'QuickConnect Telecom', abn: '67 890 123 456', industry: 'Telecommunications', complaintCount: 9, avgRiskScore: 0.52, systemicClusters: 0, latestComplaint: '2025-01-13T11:00:00Z' },
    ],
  });
});
