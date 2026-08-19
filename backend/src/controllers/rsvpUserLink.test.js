import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// KAN-178: events are members-only. The route is authenticated and gated on an
// active membership upstream, so createRsvp always has req.user and takes the
// attendee's details from the account rather than the request body.

const ACCOUNT = {
  email: 'member@example.test',
  info: { firstName: 'Ada', lastName: 'Lovelace' },
};

let account = ACCOUNT;
let userFetchCount = 0;
let activity = { id: 1, isPublished: true, capacity: null };
let rsvpCount = 0;
let createShouldConflict = false;
const createdRsvps = [];

globalThis.prisma = {
  $transaction: async (fn) => fn(globalThis.prisma),
  activity: { findUnique: async () => activity },
  user: {
    findUnique: async () => {
      userFetchCount += 1;
      return account;
    },
  },
  rsvp: {
    count: async () => rsvpCount,
    create: async (args) => {
      if (createShouldConflict) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      const rsvp = { id: createdRsvps.length + 1, ...args.data };
      createdRsvps.push(rsvp);
      return rsvp;
    },
  },
};

const { createRsvp } = await import('./rsvpController.js');

function mockRes() {
  return {
    code: null,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function submitRsvp({ user = { id: 'user-1' }, body = undefined } = {}) {
  const res = mockRes();
  await createRsvp({ params: { id: '1' }, body, user }, res);
  return res;
}

test.beforeEach(() => {
  account = ACCOUNT;
  userFetchCount = 0;
  activity = { id: 1, isPublished: true, capacity: null };
  rsvpCount = 0;
  createShouldConflict = false;
  createdRsvps.length = 0;
});

test('books using the authenticated account, not the request body', async () => {
  const res = await submitRsvp();
  assert.equal(res.code, 201);
  assert.equal(createdRsvps[0].userId, 'user-1');
  assert.equal(createdRsvps[0].email, 'member@example.test');
  assert.equal(createdRsvps[0].name, 'Ada Lovelace');
});

test('client-supplied name/email are ignored — details cannot be spoofed', async () => {
  await submitRsvp({
    body: { name: 'Someone Else', email: 'attacker@example.test', studentId: '999' },
  });
  assert.equal(createdRsvps[0].name, 'Ada Lovelace');
  assert.equal(createdRsvps[0].email, 'member@example.test');
});

test('no studentId is stored — the field is no longer collected (KAN-185)', async () => {
  await submitRsvp({ body: { studentId: '1234567' } });
  assert.ok(!('studentId' in createdRsvps[0]));
});

test('falls back to the account email when the profile has no name', async () => {
  account = { email: 'noname@example.test', info: null };
  await submitRsvp();
  assert.equal(createdRsvps[0].name, 'noname@example.test');
});

test('a duplicate booking for the same activity is rejected as 409', async () => {
  createShouldConflict = true;
  const res = await submitRsvp();
  assert.equal(res.code, 409);
  assert.match(res.body.error, /already registered/i);
});

test('sold-out activities are still rejected (capacity unchanged)', async () => {
  activity = { id: 1, isPublished: true, capacity: 5 };
  rsvpCount = 5;
  const res = await submitRsvp();
  assert.equal(res.code, 409);
  assert.match(res.body.error, /sold out/i);
});

test('unpublished or missing activity returns 404', async () => {
  activity = null;
  const res = await submitRsvp();
  assert.equal(res.code, 404);
});

test('returns 401 when the authenticated account no longer exists', async () => {
  account = null;
  const res = await submitRsvp();
  assert.equal(res.code, 401);
});

test('reuses the account stashed by requireVerifiedMembership — no second lookup', async () => {
  const res = mockRes();
  await createRsvp(
    { params: { id: '1' }, body: undefined, user: { id: 'user-1', account: ACCOUNT } },
    res,
  );
  assert.equal(res.code, 201);
  assert.equal(userFetchCount, 0, 'controller should not re-fetch a stashed account');
  assert.equal(createdRsvps[0].email, 'member@example.test');
});

test('falls back to fetching when no account was stashed', async () => {
  // Keeps the handler correct if it is ever used without the middleware.
  const res = await submitRsvp();
  assert.equal(res.code, 201);
  assert.equal(userFetchCount, 1);
});
