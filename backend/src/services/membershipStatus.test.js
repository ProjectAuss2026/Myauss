import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

const {
  MEMBERSHIP_STATUS,
  MEMBERSHIP_STATUS_VALUES,
  MEMBERSHIP_TRANSITIONS,
  isValidMembershipStatus,
  isValidTransition,
  MembershipTransitionError,
} = await import('./membershipStatus.js');

test('enum exposes exactly the three lifecycle states', () => {
  assert.deepEqual(MEMBERSHIP_STATUS_VALUES, ['INACTIVE', 'NEED_REVIEW', 'VERIFIED']);
});

test('legal transitions match the agreed frozen map', () => {
  assert.ok(isValidTransition('INACTIVE', 'NEED_REVIEW'));
  assert.ok(isValidTransition('NEED_REVIEW', 'VERIFIED'));
  assert.ok(isValidTransition('NEED_REVIEW', 'INACTIVE'));
  assert.ok(isValidTransition('VERIFIED', 'INACTIVE'));
});

test('illegal transitions are rejected', () => {
  // Skipping the review step is not allowed.
  assert.ok(!isValidTransition('INACTIVE', 'VERIFIED'));
  // Cannot jump straight back to review from verified.
  assert.ok(!isValidTransition('VERIFIED', 'NEED_REVIEW'));
  // No-op / same-state is not a valid transition.
  assert.ok(!isValidTransition('INACTIVE', 'INACTIVE'));
  // Unknown states never validate.
  assert.ok(!isValidTransition('INACTIVE', 'BOGUS'));
  assert.ok(!isValidTransition('BOGUS', 'VERIFIED'));
});

test('isValidMembershipStatus guards the enum', () => {
  assert.ok(isValidMembershipStatus('VERIFIED'));
  assert.ok(!isValidMembershipStatus('verified'));
  assert.ok(!isValidMembershipStatus('BOGUS'));
});

test('transition map is deeply frozen so rules cannot be mutated at runtime', () => {
  assert.ok(Object.isFrozen(MEMBERSHIP_TRANSITIONS));
  assert.ok(Object.isFrozen(MEMBERSHIP_TRANSITIONS.INACTIVE));
  assert.throws(() => {
    MEMBERSHIP_TRANSITIONS.INACTIVE.push('VERIFIED');
  });
});

test('MembershipTransitionError carries from/to and a stable code', () => {
  const err = new MembershipTransitionError('INACTIVE', 'VERIFIED');
  assert.equal(err.from, 'INACTIVE');
  assert.equal(err.to, 'VERIFIED');
  assert.equal(err.code, 'ILLEGAL_TRANSITION');
});
