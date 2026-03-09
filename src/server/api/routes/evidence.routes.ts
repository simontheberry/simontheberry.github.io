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

// GET /api/v1/evidence/:complaintId – List evidence files for a complaint
evidenceRoutes.get(
  '/:complaintId',
  async (req: Request, res: Response) => {
    const complaintId = req.params.complaintId as string;
    const tenantId = req.tenantId!;

    try {
      // Verify complaint exists and belongs to tenant
      const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, tenantId },
      });

      if (!complaint) {
        throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
      }

      // Get all evidence files for this complaint
      const evidenceFiles = await prisma.evidence.findMany({
        where: { complaintId },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          storageKey: true,
          description: true,
          uploadedAt: true,
        },
      });

      res.json({
        success: true,
        data: evidenceFiles,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
      }

      logger.error('Evidence listing failed', {
        complaintId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to list evidence' },
      });
    }
  }
);

// POST /api/v1/evidence/:complaintId/upload – Upload evidence files (multipart/form-data)
// Note: Requires multer middleware in production for proper file handling
evidenceRoutes.post(
  '/:complaintId/upload',
  authorize('complaint_officer', 'supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const complaintId = req.params.complaintId as string;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    try {
      // TODO: Use multer middleware for production multipart/form-data handling
      // For MVP: Accept JSON with file metadata
      const { files } = req.body;

      if (!files || !Array.isArray(files) || files.length === 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'No files provided');
      }

      if (files.length > 5) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Maximum 5 files per upload');
      }

      // Verify complaint exists and belongs to tenant
      const complaint = await prisma.complaint.findFirst({
        where: { id: complaintId, tenantId },
      });

      if (!complaint) {
        throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
      }

      // Create evidence records for each file
      const uploadedEvidence = [];

      for (const file of files) {
        const { filename, mimeType, size, description } = file;

        // Validation
        if (!filename || !mimeType) {
          throw new AppError(400, 'VALIDATION_ERROR', 'Missing required fields in file');
        }

        if (size > 50 * 1024 * 1024) {
          throw new AppError(413, 'FILE_TOO_LARGE', `File ${filename} exceeds 50MB limit`);
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
            description: description || null,
          },
        });

        uploadedEvidence.push({
          id: evidence.id,
          filename: evidence.filename,
          mimeType: evidence.mimeType,
          size: evidence.size,
          uploadedAt: evidence.uploadedAt.toISOString(),
        });

        // Audit log for each file
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
      }

      logger.info('Evidence files uploaded', {
        count: uploadedEvidence.length,
        complaintId,
        userId,
      });

      res.status(201).json({
        success: true,
        data: uploadedEvidence,
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
