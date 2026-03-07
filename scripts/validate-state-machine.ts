#!/usr/bin/env tsx
// ============================================================================
// State Machine Validation Script
// ============================================================================

import { ComplaintStateMachine } from '../src/server/services/state-machine/complaint-state-machine';

console.log('🔍 Validating State Machine Implementation\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ ${message}`);
    passCount++;
  } else {
    console.log(`❌ ${message}`);
    failCount++;
  }
}

// Test 1: Basic transitions
console.log('📋 Test 1: Basic State Transitions');
assert(
  ComplaintStateMachine.isValidTransition('submitted', 'triaging'),
  'submitted → triaging is valid'
);
assert(
  ComplaintStateMachine.isValidTransition('triaging', 'triaged'),
  'triaging → triaged is valid'
);
assert(
  !ComplaintStateMachine.isValidTransition('submitted', 'resolved'),
  'submitted → resolved is invalid (cannot skip steps)'
);
console.log();

// Test 2: Role-based access control
console.log('📋 Test 2: Role-Based Access Control');
assert(
  ComplaintStateMachine.isValidTransition('triaging', 'triaged', 'supervisor'),
  'Supervisor can triage complaints'
);
assert(
  !ComplaintStateMachine.isValidTransition('triaging', 'triaged', 'complaint_officer'),
  'Officer cannot triage (only supervisor/admin)'
);
assert(
  ComplaintStateMachine.isValidTransition('triaging', 'triaged', 'admin'),
  'Admin can triage complaints'
);
console.log();

// Test 3: Available transitions
console.log('📋 Test 3: Available Transitions by Role');
const supervisorTransitions = ComplaintStateMachine.getAvailableTransitions('assigned', 'supervisor');
const officerTransitions = ComplaintStateMachine.getAvailableTransitions('assigned', 'complaint_officer');
assert(
  supervisorTransitions.length > 0,
  `Supervisor has ${supervisorTransitions.length} options from 'assigned' state`
);
assert(
  officerTransitions.length > 0,
  `Officer has ${officerTransitions.length} options from 'assigned' state`
);
console.log();

// Test 4: Escalation workflow
console.log('📋 Test 4: Escalation Workflow');
assert(
  ComplaintStateMachine.isValidTransition('in_progress', 'escalated', 'admin'),
  'Admin can escalate from in_progress'
);
assert(
  !ComplaintStateMachine.isValidTransition('in_progress', 'escalated', 'supervisor'),
  'Supervisor cannot escalate (admin only)'
);
const escalatedTransitions = ComplaintStateMachine.getAvailableTransitions('escalated', 'admin');
assert(
  escalatedTransitions.some(t => t.to === 'in_progress' || t.to === 'resolved'),
  'Can recover from escalated state'
);
console.log();

// Test 5: Path finding
console.log('📋 Test 5: State Path Finding');
const path = ComplaintStateMachine.findPath('submitted', 'resolved', 'admin');
assert(
  path !== null && path[0] === 'submitted' && path[path.length - 1] === 'resolved',
  `Found path from submitted to resolved (${path?.length} steps)`
);

const officerPath = ComplaintStateMachine.findPath('submitted', 'triaged', 'complaint_officer');
assert(
  officerPath === null,
  'Officer cannot reach triaged state (invalid path)'
);
console.log();

// Test 6: Transition definitions
console.log('📋 Test 6: Transition Definitions');
const def1 = ComplaintStateMachine.getTransitionDefinition('in_progress', 'awaiting_response');
assert(
  def1?.reason === 'Waiting for business response',
  'Transition has proper reason/description'
);

const def2 = ComplaintStateMachine.getTransitionDefinition('submitted', 'triaging');
assert(
  def2?.requiredRole === undefined,
  'Some transitions have no role restriction'
);

const def3 = ComplaintStateMachine.getTransitionDefinition('triaging', 'triaged');
assert(
  def3?.requiredRole?.includes('supervisor'),
  'Some transitions require supervisor role'
);
console.log();

// Test 7: Validation context
console.log('📋 Test 7: Validation Context');
const validation1 = ComplaintStateMachine.validateTransition('submitted', 'triaging', {
  userId: 'user-123',
  userRole: 'admin',
  complaintId: 'cmp-123',
  reason: 'Start triage',
});
assert(validation1.valid, 'Valid transition passes validation');

const validation2 = ComplaintStateMachine.validateTransition('resolved', 'submitted', {
  userId: 'user-123',
  userRole: 'admin',
  complaintId: 'cmp-123',
  reason: 'Try invalid transition',
});
assert(!validation2.valid && validation2.error, 'Invalid transition has error message');
console.log();

// Summary
console.log('═══════════════════════════════════════════════════════════════');
console.log(`✅ Passed: ${passCount} | ❌ Failed: ${failCount}`);
if (failCount === 0) {
  console.log('🎉 All state machine validations passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some validations failed');
  process.exit(1);
}
