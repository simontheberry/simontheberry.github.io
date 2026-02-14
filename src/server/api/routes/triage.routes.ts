// ============================================================================
// Triage Routes
// ============================================================================

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant-resolver';

export const triageRoutes = Router();

triageRoutes.use(authenticate);
triageRoutes.use(requireTenant);

// POST /api/v1/triage/:complaintId – Trigger triage for a complaint
triageRoutes.post('/:complaintId', async (req: Request, res: Response) => {
  const { complaintId } = req.params;

  // TODO: Queue triage job via BullMQ
  res.json({
    success: true,
    data: { complaintId, status: 'triage_queued' },
  });
});

// POST /api/v1/triage/:complaintId/override – Manually override triage result
triageRoutes.post(
  '/:complaintId/override',
  authorize('supervisor', 'admin'),
  async (req: Request, res: Response) => {
    const { complaintId } = req.params;
    const { riskLevel, routingDestination, priorityScore, reason } = req.body;

    // TODO: Update complaint triage fields, log audit event with reason
    res.json({
      success: true,
      data: { complaintId, riskLevel, routingDestination, priorityScore, overriddenBy: req.userId },
    });
  },
);

// GET /api/v1/triage/:complaintId/result – Get triage result for a complaint
triageRoutes.get('/:complaintId/result', async (req: Request, res: Response) => {
  const { complaintId } = req.params;

  // TODO: Fetch latest triage AI output
  res.json({
    success: true,
    data: null,
  });
});
