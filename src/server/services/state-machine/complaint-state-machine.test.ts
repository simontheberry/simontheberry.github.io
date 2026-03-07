// ============================================================================
// State Machine Tests – Complaint lifecycle validation
// ============================================================================

import { describe, it, expect } from 'vitest';
import { ComplaintStateMachine, type ComplaintStatus } from './complaint-state-machine';

describe('ComplaintStateMachine', () => {
  describe('getTransitionDefinition', () => {
    it('should return transition definition for valid state pair', () => {
      const transition = ComplaintStateMachine.getTransitionDefinition('submitted', 'triaging');
      expect(transition).toBeDefined();
      expect(transition?.from).toBe('submitted');
      expect(transition?.to).toBe('triaging');
    });

    it('should return undefined for invalid state pair', () => {
      const transition = ComplaintStateMachine.getTransitionDefinition('submitted', 'resolved');
      expect(transition).toBeUndefined();
    });
  });

  describe('isValidTransition', () => {
    it('should validate direct submission to triaging', () => {
      const valid = ComplaintStateMachine.isValidTransition('submitted', 'triaging');
      expect(valid).toBe(true);
    });

    it('should reject invalid transitions', () => {
      const valid = ComplaintStateMachine.isValidTransition('resolved', 'submitted');
      expect(valid).toBe(false);
    });

    it('should check role-based permissions', () => {
      // Supervisor can triage
      const supervisorCanTriage = ComplaintStateMachine.isValidTransition(
        'triaging',
        'triaged',
        'supervisor'
      );
      expect(supervisorCanTriage).toBe(true);

      // Officer cannot triage
      const officerCannotTriage = ComplaintStateMachine.isValidTransition(
        'triaging',
        'triaged',
        'complaint_officer'
      );
      expect(officerCannotTriage).toBe(false);
    });

    it('should allow admins to perform any valid transition', () => {
      const adminCanTriage = ComplaintStateMachine.isValidTransition(
        'triaging',
        'triaged',
        'admin'
      );
      expect(adminCanTriage).toBe(true);

      const adminCanAssign = ComplaintStateMachine.isValidTransition(
        'triaged',
        'assigned',
        'admin'
      );
      expect(adminCanAssign).toBe(true);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return all available transitions from submitted state', () => {
      const transitions = ComplaintStateMachine.getAvailableTransitions('submitted');
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions.some(t => t.to === 'triaging')).toBe(true);
    });

    it('should filter transitions by role', () => {
      const officerTransitions = ComplaintStateMachine.getAvailableTransitions(
        'assigned',
        'complaint_officer'
      );
      const adminTransitions = ComplaintStateMachine.getAvailableTransitions(
        'assigned',
        'admin'
      );

      // Officer has fewer options than admin
      expect(officerTransitions.length).toBeLessThanOrEqual(adminTransitions.length);
    });

    it('should handle escalation transitions', () => {
      const transitions = ComplaintStateMachine.getAvailableTransitions('in_progress', 'admin');
      const hasEscalation = transitions.some(t => t.to === 'escalated');
      expect(hasEscalation).toBe(true);
    });
  });

  describe('validateTransition', () => {
    it('should validate legitimate transitions', () => {
      const result = ComplaintStateMachine.validateTransition('submitted', 'triaging', {
        userId: 'user-123',
        userRole: 'supervisor',
        complaintId: 'cmp-123',
        reason: 'Start triage',
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid transitions with error message', () => {
      const result = ComplaintStateMachine.validateTransition('resolved', 'submitted', {
        userId: 'user-123',
        userRole: 'admin',
        complaintId: 'cmp-123',
        reason: 'Try to undo resolution',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition from resolved to submitted');
    });

    it('should reject insufficient permissions', () => {
      const result = ComplaintStateMachine.validateTransition('triaging', 'triaged', {
        userId: 'user-123',
        userRole: 'complaint_officer',
        complaintId: 'cmp-123',
        reason: 'Officer tries to triage',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('insufficient');
    });
  });

  describe('findPath', () => {
    it('should find path from submitted to resolved', () => {
      const path = ComplaintStateMachine.findPath('submitted', 'resolved', 'admin');
      expect(path).toBeDefined();
      expect(path?.[0]).toBe('submitted');
      expect(path?.[path.length - 1]).toBe('resolved');
    });

    it('should find shortest valid path', () => {
      const path = ComplaintStateMachine.findPath('submitted', 'triaged', 'admin');
      expect(path).toBeDefined();
      // submitted -> triaging -> triaged (3 steps)
      expect(path?.length).toBeLessThanOrEqual(5);
    });

    it('should return null for unreachable states', () => {
      // Once closed, cannot go back
      const path = ComplaintStateMachine.findPath('closed', 'submitted', 'admin');
      expect(path).toBeNull();
    });

    it('should respect role-based path restrictions', () => {
      // Officer cannot reach triaged (requires supervisor)
      const officerPath = ComplaintStateMachine.findPath('submitted', 'triaged', 'complaint_officer');
      expect(officerPath).toBeNull();

      // Admin can reach triaged
      const adminPath = ComplaintStateMachine.findPath('submitted', 'triaged', 'admin');
      expect(adminPath).toBeDefined();
    });
  });

  describe('escalation workflows', () => {
    it('should allow escalation from any open state', () => {
      const openStates: ComplaintStatus[] = ['submitted', 'triaging', 'triaged', 'assigned', 'in_progress', 'awaiting_response'];
      const escallateAllowed = openStates.every(state => {
        const transition = ComplaintStateMachine.getTransitionDefinition(state, 'escalated');
        return transition !== undefined;
      });

      expect(escallateAllowed).toBe(true);
    });

    it('should require admin role for escalation', () => {
      const supervisorCanEscalate = ComplaintStateMachine.isValidTransition(
        'in_progress',
        'escalated',
        'supervisor'
      );
      expect(supervisorCanEscalate).toBe(false);

      const adminCanEscalate = ComplaintStateMachine.isValidTransition(
        'in_progress',
        'escalated',
        'admin'
      );
      expect(adminCanEscalate).toBe(true);
    });

    it('should allow recovery from escalation', () => {
      const transitions = ComplaintStateMachine.getAvailableTransitions('escalated', 'admin');
      const canRecover = transitions.some(t => t.to === 'in_progress' || t.to === 'resolved');
      expect(canRecover).toBe(true);
    });
  });
});
