import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// KAN-178. Deliberately generic so gated-content routes (KAN-167) can reuse it
// unchanged — these tests pin the contract that KAN-167 will rely on.

let account = { membershipStatus: 'VERIFIED' };
globalThis.prisma = {
  user: { findUnique: async () => account },
};

const { requireVerifiedMembership } = await import('./authMiddleware.js');

function mockRes() {
  return {
    code: null,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function run(user) {
  const req = { user };
  const res = mockRes();
  let nextCalled = false;
  await requireVerifiedMembership(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test.beforeEach(() => {
  account = { membershipStatus: 'VERIFIED' };
});

test('allows a VERIFIED member through', async () => {
  const { res, nextCalled } = await run({ id: 'u1', role: 'USER' });
  assert.equal(nextCalled, true);
  assert.equal(res.code, null);
});

test('exposes the resolved status on req.user for downstream handlers', async () => {
  const { req } = await run({ id: 'u1', role: 'USER' });
  assert.equal(req.user.membershipStatus, 'VERIFIED');
});

test('rejects non-VERIFIED members with 403 and a machine-readable code', async () => {
  for (const status of ['INACTIVE', 'IN_REVIEW']) {
    account = { membershipStatus: status };
    const { res, nextCalled } = await run({ id: 'u1', role: 'USER' });
    assert.equal(nextCalled, false);
    assert.equal(res.code, 403);
    // The frontend switches on `code`, never on the message text.
    assert.equal(res.body.code, 'MEMBERSHIP_REQUIRED');
    assert.equal(res.body.membershipStatus, status);
  }
});

test('returns 401 when no authenticated user is attached', async () => {
  const { res, nextCalled } = await run(undefined);
  assert.equal(nextCalled, false);
  assert.equal(res.code, 401);
});

test('returns 401 when the account no longer exists', async () => {
  account = null;
  const { res, nextCalled } = await run({ id: 'gone', role: 'USER' });
  assert.equal(nextCalled, false);
  assert.equal(res.code, 401);
});

test('ADMIN and OWNER bypass the membership requirement', async () => {
  // Staff run events; their own membership state must not lock them out.
  account = { membershipStatus: 'INACTIVE' };
  for (const role of ['ADMIN', 'OWNER']) {
    const { res, nextCalled } = await run({ id: 'staff', role });
    assert.equal(nextCalled, true, `${role} should pass`);
    assert.equal(res.code, null);
  }
});
