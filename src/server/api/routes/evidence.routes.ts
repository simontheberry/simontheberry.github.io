// ============================================================================
// Evidence Routes -- File upload and management
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';

const logger = createLogger('evidence-routes');

export const evidenceRoutes = Router();

evidenceRoutes.use(authenticate);
evidenceRoutes.use(requireTenant);

// POST /api/v1/complaints/:complaintId/evidence – Upload evidence file
evidenceRoutes.post(
  '/complaints/:complaintId/evidence',
  authorize('complaint_officer', 'supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const complaintId = req.params.complaintId as string;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    try {
      // In production: Parse multipart/form-data with multer or similar
      // For now: Accept JSON with base64 encoded file
      const { filename, mimeType, size, data, description } = req.body;

      // Validation
      if (!filename || !mimeType || !data) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields: filename, mimeType, data');
      }

      if (size > 10 * 1024 * 1024) {
        throw new AppError(413, 'FILE_TOO_LARGE', 'File exceeds 10MB limit');
      }

      // Verify complaint exists and belongs to tenant
      const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, tenantId },
      });

      if (!complaint) {
        throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
      }

      // Create evidence record
      const storageKey = `${tenantId}/${complaintId}/${uuidv4()}-${filename}`;
      const evidence = await prisma.evidence.create({
        data: {
          complaintId,
          filename,
          mimeType,
          size,
          storageKey,
          description,
        },
      });

      // Audit log
      await writeAuditLog({
        tenantId,
        userId,
        action: 'evidence_uploaded',
        entity: 'Evidence',
        entityId: evidence.id,
        newValues: {
          filename,
          size,
          complaintId,
        },
      });

      logger.info('Evidence file uploaded', {
        fileId: evidence.id,
        filename,
        complaintId,
        userId,
      });

      res.status(201).json({
        success: true,
        data: {
          id: evidence.id,
          filename: evidence.filename,
          mimeType: evidence.mimeType,
          size: evidence.size,
          uploadedAt: evidence.uploadedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }

      logger.error('Evidence upload failed', {
        complaintId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(500).json({
        success: false,
        error: { message: 'File upload failed' },
      });
    }
  }
);

// GET /api/v1/evidence/:fileId – Get evidence file details
evidenceRoutes.get(
  '/:fileId',
  authorize('complaint_officer', 'supervisor', 'admin', 'executive'),
  async (req: Request, res: Response) => {
    const fileId = req.params.fileId as string;
    const tenantId = req.tenantId!;

    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          id: fileId,
          complaint: { tenantId },
        },
      });

      if (!evidence) {
        throw new AppError(404, 'NOT_FOUND', 'File not found');
      }

      res.json({
        success: true,
        data: {
          id: evidence.id,
          filename: evidence.filename,
          mimeType: evidence.mimeType,
          size: evidence.size,
          uploadedAt: evidence.uploadedAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }

      logger.error('Evidence retrieval failed', {
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to retrieve file' },
      });
    }
  }
);

// DELETE /api/v1/evidence/:fileId – Delete evidence file
evidenceRoutes.delete(
  '/:fileId',
  authorize('complaint_officer', 'supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const fileId = req.params.fileId as string;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    try {
      const evidence = await prisma.evidence.findFirst({
        where: {
          id: fileId,
          complaint: { tenantId },
        },
        include: { complaint: true },
      });

      if (!evidence) {
        throw new AppError(404, 'NOT_FOUND', 'File not found');
      }

      // Delete from storage (if implemented)
      // await deleteFromStorage(evidence.storageKey);

      // Delete from database
      await prisma.evidence.delete({
        where: { id: fileId },
      });

      // Audit log
      await writeAuditLog({
        tenantId,
        userId,
        action: 'evidence_deleted',
        entity: 'Evidence',
        entityId: fileId,
        newValues: { filename: evidence.filename },
      });

      logger.info('Evidence file deleted', {
        fileId,
        filename: evidence.filename,
        userId,
      });

      res.json({
        success: true,
        data: { deletedId: fileId },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }

      logger.error('Evidence deletion failed', {
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(500).json({
        success: false,
        error: { message: 'File deletion failed' },
      });
    }
  }
);
