// ============================================================================
// Compliance Routes -- Audit reports and regulatory compliance
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { createLogger } from '../../utils/logger';
import { getAuditService } from '../../services/compliance/audit-service';

const logger = createLogger('compliance-routes');

export const complianceRoutes = Router();

complianceRoutes.use(authenticate);
complianceRoutes.use(requireTenant);

// ---- Validation Schemas ----

const reportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const exportSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  format: z.enum(['csv', 'json']).default('json'),
});

// ---- GET /api/v1/compliance/report ----
complianceRoutes.get(
  '/report',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const query = reportSchema.parse({
      startDate: req.query.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: req.query.endDate || new Date(),
    });

    const auditService = getAuditService();
    const report = await auditService.generateComplianceReport(
      tenantId,
      new Date(query.startDate),
      new Date(query.endDate),
    );

    logger.info('Compliance report generated', { tenantId });

    res.json({
      success: true,
      data: report,
    });
  },
);

// ---- POST /api/v1/compliance/export ----
complianceRoutes.post('/export', authorize('admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const body = exportSchema.parse(req.body);

  const auditService = getAuditService();
  const exportData = await auditService.exportAuditTrail(
    tenantId,
    new Date(body.startDate),
    new Date(body.endDate),
    body.format,
  );

  const mimeType = body.format === 'csv' ? 'text/csv' : 'application/json';
  const filename = `audit-trail-${new Date().toISOString()}.${body.format}`;

  logger.info('Audit trail exported', { tenantId, format: body.format });

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(exportData);
});

// ---- POST /api/v1/compliance/archive ----
complianceRoutes.post('/archive', authorize('admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const auditService = getAuditService();
  const result = await auditService.archiveOldRecords(tenantId);

  logger.info('Audit records archived', { tenantId, ...result });

  res.json({
    success: true,
    data: {
      message: 'Archival complete',
      ...result,
    },
  });
});

// ---- GET /api/v1/compliance/retention-policy ----
complianceRoutes.get('/retention-policy', authorize('admin'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const auditService = getAuditService();
  const policy = await auditService.getRetentionPolicy(tenantId);

  res.json({
    success: true,
    data: policy,
  });
});
