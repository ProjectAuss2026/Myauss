import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// KAN-171: the RSVP route is public, so a booking is linked to a member account
// two ways — an authenticated submitter (authoritative), else a normalised email
// match (mirrors the migration backfill so logged-out members still link).

const usersByEmail = new Map();
const createdRsvps = [];

const ACTIVITY = { id: 1, isPublished: true, capacity: null };

globalThis.prisma = {
  $transaction: async (fn) => fn(globalThis.prisma),
  activity: {
    findUnique: async () => ACTIVITY,
  },
  user: {
    findUnique: async (args) => {
      const email = args?.where?.email;
      const user = email ? usersByEmail.get(email) || null : null;
      return user ? { id: user.id } : null;
    },
  },
  rsvp: {
    count: async () => 0,
    create: async (args) => {
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

async function submitRsvp({ email, user }) {
  const res = mockRes();
  await createRsvp(
    {
      params: { id: '1' },
      body: { name: 'Test Member', email, studentId: '123456789' },
      user, // set by attachUserIfPresent when a valid token was supplied
    },
    res,
  );
  return res;
}

test.beforeEach(() => {
  usersByEmail.clear();
  createdRsvps.length = 0;
});

test('links to the authenticated member when one is signed in', async () => {
  const res = await submitRsvp({ email: 'member@example.test', user: { id: 'user-1' } });
  assert.equal(res.code, 201);
  assert.equal(createdRsvps[0].userId, 'user-1');
});

test('authenticated identity wins over the submitted email', async () => {
  // Signed in as user-1 but typing someone else's address must not link to them.
  usersByEmail.set('someone.else@example.test', { id: 'user-2' });
  await submitRsvp({ email: 'someone.else@example.test', user: { id: 'user-1' } });
  assert.equal(createdRsvps[0].userId, 'user-1');
});

test('falls back to an email match when the submitter is anonymous', async () => {
  usersByEmail.set('member@example.test', { id: 'user-9' });
  const res = await submitRsvp({ email: 'member@example.test', user: undefined });
  assert.equal(res.code, 201);
  assert.equal(createdRsvps[0].userId, 'user-9');
});

test('email match is normalised (trimmed + lowercased) like the backfill', async () => {
  usersByEmail.set('member@example.test', { id: 'user-9' });
  await submitRsvp({ email: '  MEMBER@Example.TEST  ', user: undefined });
  assert.equal(createdRsvps[0].userId, 'user-9');
  assert.equal(createdRsvps[0].email, 'member@example.test');
});

test('stays null for a non-member RSVP — public bookings are still supported', async () => {
  const res = await submitRsvp({ email: 'stranger@example.test', user: undefined });
  assert.equal(res.code, 201);
  assert.equal(createdRsvps[0].userId, null);
});
