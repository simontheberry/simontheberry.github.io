// ============================================================================
// Evidence Routes -- File upload and AI scanning
// ============================================================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';
import { getStorageService } from '../../services/storage/storage.service';
import { getAiService } from '../../services/ai/ai-service';

const logger = createLogger('evidence-routes');

export const evidenceRoutes = Router();

// Multer setup for file uploads (10MB limit, multiple files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', `File type ${file.mimetype} not allowed`));
    }
  },
});

evidenceRoutes.use(authenticate);
evidenceRoutes.use(requireTenant);

// ---- POST /api/v1/evidence/:complaintId/upload ----
evidenceRoutes.post(
  '/:complaintId/upload',
  authorize('complaint_officer', 'supervisor', 'admin'),
  upload.array('files', 5),
  async (req: Request, res: Response) => {
    const { complaintId } = req.params as { complaintId: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError(400, 'NO_FILES', 'No files provided');
    }

    // Verify complaint exists and belongs to tenant
    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, tenantId },
    });

    if (!complaint) {
      throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
    }

    const storageService = getStorageService();
    const aiService = getAiService();
    const uploadedEvidence = [];
    const aiAnalyses = [];

    for (const file of files) {
      try {
        // Store file
        const stored = await storageService.upload(
          {
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            buffer: file.buffer,
          },
          `complaints/${complaintId}`,
        );

        // Create evidence record
        const evidence = await prisma.evidence.create({
          data: {
            complaintId,
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            storageKey: stored.storageKey,
            description: `Uploaded by ${userId}`,
          },
        });

        uploadedEvidence.push({
          id: evidence.id,
          filename: evidence.filename,
          size: evidence.size,
          mimeType: evidence.mimeType,
          url: stored.url,
        });

        // AI analysis for text/PDF files
        if (['application/pdf', 'text/plain'].includes(file.mimetype)) {
          try {
            let textContent = '';
            if (file.mimetype === 'text/plain') {
              textContent = file.buffer.toString('utf-8');
            }
            // For PDF, would need pdf-parse library (Phase 5 enhancement)

            if (textContent) {
              const { result: analysis, record } = await aiService.analyzeEvidence(
                textContent,
                complaint.rawText,
                file.originalname,
              );

              await prisma.aiOutput.create({
                data: {
                  complaintId,
                  outputType: 'evidence_analysis',
                  model: record.model,
                  prompt: record.prompt,
                  rawOutput: record.rawOutput,
                  parsedOutput: analysis as Record<string, unknown>,
                  confidence: (analysis as Record<string, unknown>).confidence as number,
                  reasoning: (analysis as Record<string, unknown>).reasoning as string,
                  tokenUsage: record.tokenUsage,
                  latencyMs: record.latencyMs,
                },
              });

              aiAnalyses.push({
                evidenceId: evidence.id,
                filename: file.originalname,
                analysis,
              });

              logger.info('Evidence AI analysis complete', {
                complaintId,
                filename: file.originalname,
              });
            }
          } catch (err) {
            logger.warn('Evidence AI analysis failed', {
              complaintId,
              filename: file.originalname,
              error: (err as Error).message,
            });
          }
        }

        // Audit log
        await writeAuditLog({
          tenantId,
          userId,
          action: 'evidence.uploaded',
          entity: 'Evidence',
          entityId: evidence.id,
          newValues: {
            filename: evidence.filename,
            size: evidence.size,
          },
        });
      } catch (err) {
        logger.error('File upload failed', {
          filename: file.originalname,
          error: (err as Error).message,
        });
      }
    }

    res.json({
      success: true,
      data: {
        complaintId,
        filesUploaded: uploadedEvidence.length,
        files: uploadedEvidence,
        analyses: aiAnalyses,
      },
    });
  },
);

// ---- GET /api/v1/evidence/:complaintId ----
evidenceRoutes.get('/:complaintId', async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;

  // Verify complaint exists
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenantId },
    select: { id: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  const evidence = await prisma.evidence.findMany({
    where: { complaintId },
    orderBy: { uploadedAt: 'desc' },
  });

  res.json({
    success: true,
    data: evidence,
  });
});

// ---- DELETE /api/v1/evidence/:id ----
evidenceRoutes.delete(
  '/:id',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { id } = req.params as { id: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const evidence = await prisma.evidence.findUnique({
      where: { id },
      include: { complaint: { select: { tenantId: true } } },
    });

    if (!evidence || evidence.complaint.tenantId !== tenantId) {
      throw new AppError(404, 'NOT_FOUND', 'Evidence not found');
    }

    // Delete from storage
    const storageService = getStorageService();
    await storageService.delete(evidence.storageKey);

    // Delete from database
    await prisma.evidence.delete({
      where: { id },
    });

    await writeAuditLog({
      tenantId,
      userId,
      action: 'evidence.deleted',
      entity: 'Evidence',
      entityId: id,
      oldValues: { filename: evidence.filename },
    });

    logger.info('Evidence deleted', { id, userId });

    res.json({
      success: true,
      data: { id, deleted: true },
    });
  },
);
