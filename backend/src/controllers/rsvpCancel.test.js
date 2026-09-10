import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// KAN-191: a member cancels their OWN place. The route carries no RSVP id, so
// the row is identified by (activityId, req.user.id) — cancelling someone
// else's place isn't expressible rather than expressible-and-rejected.

const FUTURE = new Date(Date.now() + 36e5);
const PAST = new Date(Date.now() - 36e5);

let activity = { id: 1, endTime: FUTURE };
let rsvpRow = { id: 10 };
let deletedIds = [];
let lookupArgs = [];
let deletedRowCount = 1; // 0 simulates a concurrent cancellation winning the row

globalThis.prisma = {
  $transaction: async (fn) => fn(globalThis.prisma),
  activity: { findUnique: async () => activity },
  rsvp: {
    findUnique: async (args) => {
      lookupArgs.push(args?.where);
      return rsvpRow;
    },
    // Conditional delete (review, #84): the release claims the row rather than
    // deleting it unconditionally, so a second cancellation of the same place
    // reads as "not registered" instead of a P2025-driven 500.
    deleteMany: async (args) => {
      deletedIds.push(args.where.id);
      return { count: deletedRowCount };
    },
  },
};

const { cancelOwnRsvp } = await import('./rsvpController.js');

function mockRes() {
  return {
    code: null,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    send() { this.body = null; return this; },
  };
}

async function cancel({ id = '1', user = { id: 'user-1' } } = {}) {
  const res = mockRes();
  await cancelOwnRsvp({ params: { id }, user }, res);
  return res;
}

test.beforeEach(() => {
  activity = { id: 1, endTime: FUTURE };
  rsvpRow = { id: 10 };
  deletedIds = [];
  lookupArgs = [];
  deletedRowCount = 1;
});

test('a member can cancel their own place (204)', async () => {
  const res = await cancel();
  assert.equal(res.code, 204);
  assert.deepEqual(deletedIds, [10]);
});

test('the row is looked up by (activityId, userId) — not by a client-supplied id', async () => {
  await cancel({ user: { id: 'user-7' } });
  assert.deepEqual(lookupArgs[0], { activityId_userId: { activityId: 1, userId: 'user-7' } });
});

test('cancelling scopes to the caller — a different user targets a different row', async () => {
  await cancel({ user: { id: 'user-1' } });
  await cancel({ user: { id: 'user-2' } });
  assert.equal(lookupArgs[0].activityId_userId.userId, 'user-1');
  assert.equal(lookupArgs[1].activityId_userId.userId, 'user-2');
});

test('returns 404 when the member holds no place — not a silent success', async () => {
  rsvpRow = null;
  const res = await cancel();
  assert.equal(res.code, 404);
  assert.match(res.body.error, /not registered/i);
  assert.deepEqual(deletedIds, []);
});

test('a double-clicked cancel reads as "not registered", not a 500', async () => {
  // Both requests read the row, then one wins the delete. The loser used to hit
  // Prisma's P2025 on an unconditional delete and surface as an internal error
  // on what is really "already cancelled" (review, #84).
  deletedRowCount = 0;
  const res = await cancel();
  assert.equal(res.code, 404);
  assert.match(res.body.error, /not registered/i);
});

test('returns 404 when the activity does not exist', async () => {
  activity = null;
  const res = await cancel();
  assert.equal(res.code, 404);
});

test('a finished event is rejected cleanly, never a 500 (PO addition)', async () => {
  activity = { id: 1, endTime: PAST };
  const res = await cancel();
  assert.equal(res.code, 409);
  assert.equal(res.body.code, 'EVENT_FINISHED');
  assert.deepEqual(deletedIds, [], 'must not delete after the event has finished');
});

test('an event still running can be cancelled right up to the end', async () => {
  // No cutoff by design: blocking a late cancellation just turns it into a
  // no-show and makes attendance data worse.
  activity = { id: 1, endTime: new Date(Date.now() + 60_000) };
  const res = await cancel();
  assert.equal(res.code, 204);
});

test('an invalid activity id is rejected with 400', async () => {
  const res = await cancel({ id: 'abc' });
  assert.equal(res.code, 400);
});
