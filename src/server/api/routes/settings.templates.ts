// ============================================================================
// Communication Templates Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('templates-routes');

export const templatesRoutes = Router();

templatesRoutes.use(authenticate);
templatesRoutes.use(requireTenant);

// ---- Validation Schemas ----

const templateSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['response_to_complainant', 'notice_to_business', 'escalation_notice']),
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

// ---- Helper: Variable Interpolation ----

function interpolateTemplate(template: string, context: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ---- GET /api/v1/settings/templates ----
templatesRoutes.get('/', async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;

  const templates = await prisma.communicationTemplate.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      type: true,
      subject: true,
      body: true,
      variables: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: templates,
  });
});

// ---- GET /api/v1/settings/templates/:id ----
templatesRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;

  const template = await prisma.communicationTemplate.findFirst({
    where: { id, tenantId },
  });

  if (!template) {
    throw new AppError(404, 'NOT_FOUND', 'Template not found');
  }

  res.json({
    success: true,
    data: template,
  });
});

// ---- POST /api/v1/settings/templates ----
templatesRoutes.post(
  '/',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const body = templateSchema.parse(req.body);

    const template = await prisma.communicationTemplate.create({
      data: {
        tenantId,
        name: body.name,
        type: body.type,
        subject: body.subject,
        body: body.body,
        variables: body.variables as unknown as any,
        isActive: body.isActive,
      },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'template.created',
      entity: 'CommunicationTemplate',
      entityId: template.id,
      newValues: {
        name: template.name,
        type: template.type,
      },
    });

    logger.info('Communication template created', { templateId: template.id, tenantId });

    res.json({
      success: true,
      data: template,
    });
  },
);

// ---- PATCH /api/v1/settings/templates/:id ----
templatesRoutes.patch(
  '/:id',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const body = templateSchema.partial().parse(req.body);

    const template = await prisma.communicationTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new AppError(404, 'NOT_FOUND', 'Template not found');
    }

    const updated = await prisma.communicationTemplate.update({
      where: { id },
      data: {
        name: body.name ?? template.name,
        type: body.type ?? template.type,
        subject: body.subject ?? template.subject,
        body: body.body ?? template.body,
        variables: body.variables ?? template.variables,
        isActive: body.isActive ?? template.isActive,
      },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'template.updated',
      entity: 'CommunicationTemplate',
      entityId: id,
      oldValues: {
        name: template.name,
        subject: template.subject,
      },
      newValues: {
        name: updated.name,
        subject: updated.subject,
      },
    });

    logger.info('Communication template updated', { templateId: id, userId });

    res.json({
      success: true,
      data: updated,
    });
  },
);

// ---- DELETE /api/v1/settings/templates/:id ----
templatesRoutes.delete(
  '/:id',
  authorize('admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const template = await prisma.communicationTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      throw new AppError(404, 'NOT_FOUND', 'Template not found');
    }

    // Soft delete
    await prisma.communicationTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'template.deleted',
      entity: 'CommunicationTemplate',
      entityId: id,
      oldValues: { isActive: true },
      newValues: { isActive: false },
    });

    logger.info('Communication template deleted', { templateId: id, userId });

    res.json({
      success: true,
      data: { id, deleted: true },
    });
  },
);

// ---- POST /api/v1/settings/templates/:id/preview ----
templatesRoutes.post('/:id/preview', async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const tenantId = req.tenantId!;
  const contextSchema = z.record(z.string());
  const context = contextSchema.parse(req.body);

  const template = await prisma.communicationTemplate.findFirst({
    where: { id, tenantId },
  });

  if (!template) {
    throw new AppError(404, 'NOT_FOUND', 'Template not found');
  }

  const interpolatedSubject = interpolateTemplate(template.subject, context);
  const interpolatedBody = interpolateTemplate(template.body, context);

  res.json({
    success: true,
    data: {
      id: template.id,
      name: template.name,
      type: template.type,
      subject: interpolatedSubject,
      body: interpolatedBody,
      variables: template.variables,
    },
  });
});
