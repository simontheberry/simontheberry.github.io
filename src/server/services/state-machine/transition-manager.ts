// ============================================================================
// Transition Manager -- Handle complaint state transitions with audit trail
// ============================================================================

import { prisma } from '../../db/client';
import { writeAuditLog } from '../../db/audit';
import { createLogger } from '../../utils/logger';
import { ComplaintStateMachine, ComplaintStatus, TransitionContext } from './complaint-state-machine';

const logger = createLogger('transition-manager');

export interface TransitionResult {
  success: boolean;
  error?: string;
  previousStatus?: ComplaintStatus;
  newStatus?: ComplaintStatus;
}

export class TransitionManager {
  /**
   * Execute complaint state transition with full audit trail
   */
  static async executeTransition(
    complaintId: string,
    toStatus: ComplaintStatus,
    context: TransitionContext,
    tenantId: string
  ): Promise<TransitionResult> {
    // Get current complaint with fields needed for condition checks
    const complaint = await prisma.complaint.findFirst({
      where: { id: complaintId, tenantId },
      select: { status: true, summary: true, assignedToId: true },
    });

    if (!complaint) {
      return { success: false, error: 'Complaint not found' };
    }

    const fromStatus = complaint.status as ComplaintStatus;

    // Validate transition
    const validation = ComplaintStateMachine.validateTransition(
      fromStatus,
      toStatus,
      context
    );

    if (!validation.valid) {
      logger.warn('Transition validation failed', {
        complaintId,
        from: fromStatus,
        to: toStatus,
        error: validation.error,
      });
      return { success: false, error: validation.error };
    }

    // Check contextual conditions
    const transition = ComplaintStateMachine.getTransitionDefinition(fromStatus, toStatus);
    if (transition?.requiredCondition === 'has_summary' && !complaint.summary) {
      return {
        success: false,
        error: 'A resolution summary is required before this transition',
      };
    }

    try {
      // Update complaint status
      const updated = await prisma.complaint.update({
        where: { id: complaintId },
        data: { status: toStatus },
        select: { status: true },
      });

      // Log transition
      await writeAuditLog({
        tenantId,
        userId: context.userId,
        action: 'complaint.status_transition',
        entity: 'Complaint',
        entityId: complaintId,
        oldValues: { status: fromStatus },
        newValues: {
          status: toStatus,
          reason: context.reason,
          transitionType: `${fromStatus}_to_${toStatus}`,
          ...context.metadata,
        },
      });

      // Create complaint event for timeline
      await prisma.complaintEvent.create({
        data: {
          complaintId,
          eventType: 'status_change',
          description: `Status changed from ${fromStatus} to ${toStatus}: ${context.reason}`,
          metadata: {
            fromStatus,
            toStatus,
            reason: context.reason,
          },
          createdBy: context.userId,
        },
      });

      logger.info('Transition executed', {
        complaintId,
        from: fromStatus,
        to: toStatus,
        user: context.userId,
      });

      return {
        success: true,
        previousStatus: fromStatus,
        newStatus: toStatus,
      };
    } catch (error) {
      logger.error('Transition execution failed', {
        complaintId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: 'Failed to execute transition',
      };
    }
  }

  /**
   * Get transition history for complaint
   */
  static async getTransitionHistory(complaintId: string, tenantId: string) {
    const events = await prisma.complaintEvent.findMany({
      where: {
        complaintId,
        eventType: 'status_change',
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        description: true,
        metadata: true,
        createdAt: true,
        createdBy: true,
      },
    });

    return events.map(e => ({
      id: e.id,
      timestamp: e.createdAt,
      initiatedBy: e.createdBy,
      description: e.description,
      metadata: e.metadata,
    }));
  }

  /**
   * Get available next transitions for complaint
   */
  static getAvailableTransitions(
    currentStatus: ComplaintStatus,
    userRole: string
  ) {
    const transitions = ComplaintStateMachine.getAvailableTransitions(
      currentStatus,
      userRole
    );

    return transitions.map(t => ({
      from: t.from,
      to: t.to,
      reason: t.reason,
      description: `${t.from} → ${t.to}: ${t.reason}`,
    }));
  }
}
