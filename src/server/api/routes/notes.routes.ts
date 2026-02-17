// ============================================================================
// Internal Notes Routes -- Team collaboration on complaints
// ============================================================================

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';
import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { AppError } from '../middleware/error-handler';
import { createLogger } from '../../utils/logger';

const logger = createLogger('notes-routes');

export const notesRoutes = Router();

notesRoutes.use(authenticate);
notesRoutes.use(requireTenant);

// ---- Validation Schemas ----

const noteSchema = z.object({
  complaintId: z.string().uuid(),
  body: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).default([]),
  isPrivate: z.boolean().default(false),
});

const updateNoteSchema = z.object({
  body: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).optional(),
});

// Note entity type for audit logging
interface InternalNote {
  id: string;
  complaintId: string;
  createdBy: string;
  body: string;
  mentions: string[];
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory storage for notes (Phase 2 MVP - no db table yet)
const notesStore = new Map<string, InternalNote[]>();

// ---- Helper: Generate note ID ----
function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ---- GET /api/v1/notes/:complaintId ----
notesRoutes.get('/:complaintId', async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  // Verify complaint exists
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenantId },
    select: { id: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  const key = `${tenantId}:${complaintId}`;
  const notes = notesStore.get(key) || [];

  // Filter out private notes unless user created them or is supervisor
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const visibleNotes = notes.filter(
    (n) => !n.isPrivate || n.createdBy === userId || user?.role === 'supervisor' || user?.role === 'admin',
  );

  res.json({
    success: true,
    data: visibleNotes,
  });
});

// ---- POST /api/v1/notes/:complaintId ----
notesRoutes.post('/:complaintId', authorize('complaint_officer', 'supervisor', 'admin'), async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const body = noteSchema.parse(req.body);

  // Verify complaint exists
  const complaint = await prisma.complaint.findFirst({
    where: { id: complaintId, tenantId },
    select: { id: true },
  });

  if (!complaint) {
    throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  }

  const noteId = generateNoteId();
  const note: InternalNote = {
    id: noteId,
    complaintId,
    createdBy: userId,
    body: body.body,
    mentions: body.mentions,
    isPrivate: body.isPrivate,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const key = `${tenantId}:${complaintId}`;
  if (!notesStore.has(key)) {
    notesStore.set(key, []);
  }
  notesStore.get(key)!.push(note);

  // Send notifications to mentioned users
  if (body.mentions.length > 0) {
    const mentionedUsers = await prisma.user.findMany({
      where: { id: { in: body.mentions } },
      select: { id: true, email: true },
    });

    logger.info('Users mentioned in note', {
      noteId,
      mentions: mentionedUsers.length,
      complaintId,
    });
  }

  await writeAuditLog({
    tenantId,
    userId,
    action: 'note.created',
    entity: 'InternalNote',
    entityId: noteId,
    newValues: {
      complaintId,
      mentions: body.mentions.length,
      isPrivate: body.isPrivate,
    },
  });

  logger.info('Internal note created', { noteId, complaintId, mentions: body.mentions.length });

  res.json({
    success: true,
    data: note,
  });
});

// ---- PATCH /api/v1/notes/:complaintId/:noteId ----
notesRoutes.patch(
  '/:complaintId/:noteId',
  authorize('complaint_officer', 'supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { complaintId, noteId } = req.params as { complaintId: string; noteId: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const body = updateNoteSchema.parse(req.body);

    const key = `${tenantId}:${complaintId}`;
    const notes = notesStore.get(key) || [];
    const note = notes.find((n) => n.id === noteId);

    if (!note) {
      throw new AppError(404, 'NOT_FOUND', 'Note not found');
    }

    if (note.createdBy !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Can only edit your own notes');
    }

    const oldNote = { body: note.body, mentions: note.mentions };
    note.body = body.body;
    if (body.mentions) {
      note.mentions = body.mentions;
    }
    note.updatedAt = new Date();

    await writeAuditLog({
      tenantId,
      userId,
      action: 'note.updated',
      entity: 'InternalNote',
      entityId: noteId,
      oldValues: oldNote,
      newValues: { body: note.body, mentions: note.mentions },
    });

    logger.info('Internal note updated', { noteId, complaintId });

    res.json({
      success: true,
      data: note,
    });
  },
);

// ---- DELETE /api/v1/notes/:complaintId/:noteId ----
notesRoutes.delete(
  '/:complaintId/:noteId',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { complaintId, noteId } = req.params as { complaintId: string; noteId: string };
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const key = `${tenantId}:${complaintId}`;
    const notes = notesStore.get(key) || [];
    const noteIndex = notes.findIndex((n) => n.id === noteId);

    if (noteIndex === -1) {
      throw new AppError(404, 'NOT_FOUND', 'Note not found');
    }

    const note = notes[noteIndex];
    notes.splice(noteIndex, 1);

    await writeAuditLog({
      tenantId,
      userId,
      action: 'note.deleted',
      entity: 'InternalNote',
      entityId: noteId,
      oldValues: { body: note.body },
    });

    logger.info('Internal note deleted', { noteId, complaintId });

    res.json({
      success: true,
      data: { id: noteId, deleted: true },
    });
  },
);

// ---- GET /api/v1/notes/:complaintId/activity ----
notesRoutes.get('/:complaintId/activity', async (req: Request, res: Response) => {
  const { complaintId } = req.params as { complaintId: string };
  const tenantId = req.tenantId!;

  // Get complaint timeline events
  const events = await prisma.complaintEvent.findMany({
    where: { complaintId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      eventType: true,
      description: true,
      createdBy: true,
      createdAt: true,
      metadata: true,
    },
  });

  // Get internal notes
  const key = `${tenantId}:${complaintId}`;
  const notes = notesStore.get(key) || [];

  // Merge into activity feed
  const activity = [
    ...events.map((e) => ({
      type: 'event',
      id: e.id,
      eventType: e.eventType,
      description: e.description,
      actor: e.createdBy,
      timestamp: e.createdAt,
      metadata: e.metadata,
    })),
    ...notes.map((n) => ({
      type: 'note',
      id: n.id,
      body: n.body,
      actor: n.createdBy,
      mentions: n.mentions,
      timestamp: n.updatedAt,
      private: n.isPrivate,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  res.json({
    success: true,
    data: activity,
  });
});
