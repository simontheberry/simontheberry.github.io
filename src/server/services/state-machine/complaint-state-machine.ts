// ============================================================================
// Complaint State Machine -- Strict complaint lifecycle validation
// ============================================================================

import { createLogger } from '../../utils/logger';

const logger = createLogger('state-machine');

export type ComplaintStatus =
  | 'submitted'
  | 'triaging'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_response'
  | 'resolved'
  | 'closed'
  | 'escalated';

export interface StateTransition {
  from: ComplaintStatus;
  to: ComplaintStatus;
  requiredRole?: string[];
  requiredCondition?: string;
  reason: string;
}

export interface TransitionContext {
  userId: string;
  userRole: string;
  complaintId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

// Valid state transitions
const VALID_TRANSITIONS: StateTransition[] = [
  // Submission flow
  { from: 'submitted', to: 'triaging', reason: 'Start triage process' },

  // Triage flow
  { from: 'triaging', to: 'triaged', reason: 'Complete triage analysis', requiredRole: ['supervisor', 'admin'] },

  // Assignment flow
  { from: 'triaged', to: 'assigned', requiredRole: ['supervisor', 'admin'], reason: 'Assign to officer' },

  // Work flow
  { from: 'assigned', to: 'in_progress', requiredRole: ['complaint_officer', 'supervisor', 'admin'], reason: 'Officer starts work' },
  { from: 'in_progress', to: 'awaiting_response', requiredRole: ['complaint_officer', 'supervisor', 'admin'], reason: 'Waiting for business response' },
  { from: 'awaiting_response', to: 'in_progress', requiredRole: ['complaint_officer', 'supervisor', 'admin'], reason: 'Response received, resume investigation' },

  // Resolution flow
  { from: 'awaiting_response', to: 'resolved', requiredRole: ['complaint_officer', 'supervisor', 'admin'], requiredCondition: 'has_summary', reason: 'Investigation complete, complaint resolved' },
  { from: 'in_progress', to: 'resolved', requiredRole: ['supervisor', 'admin'], requiredCondition: 'has_summary', reason: 'Supervisor closes complaint' },

  // Closure
  { from: 'resolved', to: 'closed', requiredRole: ['supervisor', 'admin'], requiredCondition: 'has_summary', reason: 'Final closure' },

  // Escalation (from any open state)
  { from: 'triaging', to: 'escalated', requiredRole: ['admin'], reason: 'Escalate SLA breach' },
  { from: 'triaged', to: 'escalated', requiredRole: ['admin'], reason: 'Escalate SLA breach' },
  { from: 'assigned', to: 'escalated', requiredRole: ['admin'], reason: 'Escalate SLA breach' },
  { from: 'in_progress', to: 'escalated', requiredRole: ['admin'], reason: 'Escalate SLA breach' },
  { from: 'awaiting_response', to: 'escalated', requiredRole: ['admin'], reason: 'Escalate SLA breach' },

  // Escalation resolution
  { from: 'escalated', to: 'in_progress', requiredRole: ['supervisor', 'admin'], reason: 'Reopen escalated complaint' },
  { from: 'escalated', to: 'resolved', requiredRole: ['admin'], reason: 'Executive resolution of escalated complaint' },
];

export class ComplaintStateMachine {
  /**
   * Get the transition definition for a from/to pair
   */
  static getTransitionDefinition(
    fromStatus: ComplaintStatus,
    toStatus: ComplaintStatus,
  ): StateTransition | undefined {
    return VALID_TRANSITIONS.find(
      t => t.from === fromStatus && t.to === toStatus,
    );
  }

  /**
   * Check if a transition is valid
   */
  static isValidTransition(
    fromStatus: ComplaintStatus,
    toStatus: ComplaintStatus,
    userRole?: string
  ): boolean {
    const transition = VALID_TRANSITIONS.find(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (!transition) return false;

    if (transition.requiredRole && userRole && !transition.requiredRole.includes(userRole)) {
      return false;
    }

    return true;
  }

  /**
   * Get available next states for current status
   */
  static getAvailableTransitions(
    currentStatus: ComplaintStatus,
    userRole?: string
  ): StateTransition[] {
    return VALID_TRANSITIONS.filter(t => {
      if (t.from !== currentStatus) return false;
      if (t.requiredRole && userRole && !t.requiredRole.includes(userRole)) return false;
      return true;
    });
  }

  /**
   * Validate and perform transition
   */
  static validateTransition(
    fromStatus: ComplaintStatus,
    toStatus: ComplaintStatus,
    context: TransitionContext
  ): { valid: boolean; error?: string } {
    // Find the transition definition
    const transition = VALID_TRANSITIONS.find(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (!transition) {
      return {
        valid: false,
        error: `Cannot transition from ${fromStatus} to ${toStatus}`,
      };
    }

    // Check role permission
    if (transition.requiredRole && !transition.requiredRole.includes(context.userRole)) {
      return {
        valid: false,
        error: `Role '${context.userRole}' cannot perform this transition`,
      };
    }

    logger.info('State transition validated', {
      complaintId: context.complaintId,
      from: fromStatus,
      to: toStatus,
      user: context.userId,
      reason: context.reason,
    });

    return { valid: true };
  }

  /**
   * Get all valid paths from current status to target status
   */
  static findPath(
    currentStatus: ComplaintStatus,
    targetStatus: ComplaintStatus,
    userRole?: string,
    visited = new Set<ComplaintStatus>()
  ): ComplaintStatus[] | null {
    if (currentStatus === targetStatus) return [currentStatus];
    if (visited.has(currentStatus)) return null;

    visited.add(currentStatus);

    for (const transition of VALID_TRANSITIONS) {
      if (transition.from !== currentStatus) continue;
      if (transition.requiredRole && userRole && !transition.requiredRole.includes(userRole)) continue;

      const path = this.findPath(transition.to, targetStatus, userRole, visited);
      if (path) return [currentStatus, ...path];
    }

    return null;
  }
}
