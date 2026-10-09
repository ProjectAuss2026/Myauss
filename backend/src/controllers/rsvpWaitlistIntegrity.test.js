import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

/**
 * Review fixes for KAN-189 (#84). Every one of these bugs passed the existing
 * suite, because those mocks answer `count` from a fixed number and ignore the
 * `where` on `findMany` — so a missing status filter is invisible to them.
 *
 * This mock derives every read from `rows` and honours `where`, which is what
 * makes "the door list includes the queue" or "a newcomer jumps the queue"
 * expressible as a test at all.
 */

const HOUR = 60 * 60 * 1000;

let activity;
let rows;
let nextId;
let mailed;

function matches(row, where = {}) {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.activityId !== undefined && row.activityId !== where.activityId) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.status !== undefined && row.status !== where.status) return false;
  if (where.countsTowardCapacity !== undefined
      && row.countsTowardCapacity !== where.countsTowardCapacity) return false;
  return true;
}

function byKey(where) {
  const key = where.activityId_userId;
  return key ? { activityId: key.activityId, userId: key.userId } : where;
}

globalThis.prisma = {
  $transaction: async (fn) => fn(globalThis.prisma),
  activity: { findUnique: async () => activity },
  rsvp: {
    count: async ({ where }) => rows.filter((r) => matches(r, where)).length,
    findMany: async ({ where }) => rows.filter((r) => matches(r, where)),
    findFirst: async ({ where }) =>
      rows.filter((r) => matches(r, where)).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
    findUnique: async ({ where }) => rows.find((r) => matches(r, byKey(where))) ?? null,
    create: async ({ data }) => {
      const row = { id: nextId++, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    delete: async ({ where }) => {
      rows = rows.filter((r) => r.id !== where.id);
      return { id: where.id };
    },
    deleteMany: async ({ where }) => {
      const before = rows.length;
      rows = rows.filter((r) => !matches(r, where));
      return { count: before - rows.length };
    },
    updateMany: async ({ where, data }) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  },
};

const { createRsvp, getRsvpCount, listRsvps, deleteRsvp, exportRsvpsCsv } =
  await import('./rsvpController.js');

function res() {
  return {
    statusCode: 200, body: undefined, headers: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
    setHeader(n, v) { this.headers[n] = v; },
  };
}

function member(id, role = 'MEMBER') {
  return { id, role, account: { email: `${id}@x.test`, info: { firstName: id, lastName: 'M' } } };
}

function row(id, userId, status, createdAtMs, countsTowardCapacity = true) {
  return {
    id, activityId: 1, userId, status, countsTowardCapacity,
    createdAt: new Date(createdAtMs), name: userId, email: `${userId}@x.test`,
  };
}

test.beforeEach(() => {
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.BREVO_API_KEY;
  activity = {
    id: 1, isPublished: true, capacity: 2,
    title: 'Deadlift Night', startTime: new Date(Date.now() + 48 * HOUR),
  };
  rows = [];
  nextId = 100;
  mailed = [];
});

// --- 1. Queue jumping (review #84, item 1) -----------------------------------

test('a newcomer joins the back of the queue when one exists, even with a free place', async () => {
  // Capacity 2, one confirmed, one queued: a place is free on paper, but it was
  // freed by a cancellation inside the cutoff and belongs to the queue.
  rows = [row(1, 'holder', 'CONFIRMED', 1), row(2, 'queued', 'WAITLISTED', 2)];

  const r = res();
  await createRsvp({ params: { id: '1' }, body: { joinWaitlist: true }, user: member('newcomer') }, r);

  assert.equal(r.statusCode, 201);
  assert.equal(r.body.status, 'WAITLISTED', 'must not take a place the queue is waiting for');
});

test('without the opt-in, a newcomer facing a queue gets EVENT_FULL rather than a place', async () => {
  rows = [row(1, 'holder', 'CONFIRMED', 1), row(2, 'queued', 'WAITLISTED', 2)];

  const r = res();
  await createRsvp({ params: { id: '1' }, body: {}, user: member('newcomer') }, r);

  assert.equal(r.statusCode, 409);
  assert.equal(r.body.code, 'EVENT_FULL');
  assert.equal(rows.length, 2, 'no row is created for a refused registration');
});

test('an empty queue with room still confirms immediately', async () => {
  rows = [row(1, 'holder', 'CONFIRMED', 1)];

  const r = res();
  await createRsvp({ params: { id: '1' }, body: {}, user: member('newcomer') }, r);

  assert.equal(r.statusCode, 201);
  assert.equal(r.body.status, 'CONFIRMED', 'a real free place must still be usable');
});

test('an exec is never queued behind members — they never took a member place', async () => {
  rows = [row(1, 'holder', 'CONFIRMED', 1), row(2, 'queued', 'WAITLISTED', 2)];

  const r = res();
  await createRsvp({ params: { id: '1' }, body: {}, user: member('exec', 'ADMIN') }, r);

  assert.equal(r.body.status, 'CONFIRMED');
  assert.equal(r.body.countsTowardCapacity, false);
});

test('an uncapped event with a stale queue still drains in order', async () => {
  // Capacity was lowered then removed; the queue must not be jumped.
  activity = { ...activity, capacity: null };
  rows = [row(2, 'queued', 'WAITLISTED', 2)];

  const r = res();
  await createRsvp({ params: { id: '1' }, body: { joinWaitlist: true }, user: member('newcomer') }, r);

  assert.equal(r.body.status, 'WAITLISTED');
});

test('getRsvpCount agrees with createRsvp, or the page offers a place the server queues', async () => {
  rows = [row(1, 'holder', 'CONFIRMED', 1), row(2, 'queued', 'WAITLISTED', 2)];

  const r = res();
  await getRsvpCount({ params: { id: '1' }, user: null }, r);

  assert.equal(r.body.isSoldOut, true, 'a queue means no place is available to a newcomer');
  assert.equal(r.body.count, 1, 'the queue must not inflate the headcount');
});

// --- 3. The door list (review #84, item 3) -----------------------------------

test('listRsvps returns attendees only, not the queue', async () => {
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'queued', 'WAITLISTED', 2),
    row(3, 'alsoIn', 'CONFIRMED', 3),
  ];

  const r = res();
  await listRsvps({ params: { id: '1' } }, r);

  assert.deepEqual(r.body.map((x) => x.userId).sort(), ['alsoIn', 'holder']);
});

test('the CSV export is a door list, so the queue is excluded', async () => {
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'queued', 'WAITLISTED', 2),
  ];

  const r = res();
  await exportRsvpsCsv({ params: { id: '1' } }, r);

  assert.ok(r.body.includes('holder'), 'confirmed attendee must appear');
  assert.ok(!r.body.includes('queued'), 'a waitlisted member is not an attendee');
});

// --- 1b. Admin removal frees a place for the QUEUE (review #84) --------------

test('admin removal promotes the front of the queue, not whoever registers next', async () => {
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'other', 'CONFIRMED', 2),
    row(3, 'first', 'WAITLISTED', 3),
    row(4, 'second', 'WAITLISTED', 4),
  ];

  const r = res();
  await deleteRsvp({ params: { id: '1', rsvpId: '1' }, user: member('admin', 'ADMIN') }, r);

  assert.equal(r.statusCode, 204);
  assert.equal(rows.find((x) => x.userId === 'first').status, 'CONFIRMED', 'earliest queued promoted');
  assert.equal(rows.find((x) => x.userId === 'second').status, 'WAITLISTED', 'the rest stay queued');
  assert.equal(rows.find((x) => x.userId === 'holder'), undefined, 'the removed row is gone');
});

test('admin removal of a legacy unlinked row still works', async () => {
  // Pre-KAN-178 rows have no userId and cannot go through the (activityId,
  // userId) seam. They predate the waitlist, so a plain delete is correct.
  rows = [{ ...row(1, null, 'CONFIRMED', 1), userId: null }];

  const r = res();
  await deleteRsvp({ params: { id: '1', rsvpId: '1' }, user: member('admin', 'ADMIN') }, r);

  assert.equal(r.statusCode, 204);
  assert.equal(rows.length, 0);
});

test('removing a WAITLISTED member frees no place, so nobody is promoted', async () => {
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'first', 'WAITLISTED', 2),
    row(3, 'second', 'WAITLISTED', 3),
  ];

  const r = res();
  await deleteRsvp({ params: { id: '1', rsvpId: '2' }, user: member('admin', 'ADMIN') }, r);

  assert.equal(r.statusCode, 204);
  assert.equal(rows.find((x) => x.userId === 'second').status, 'WAITLISTED');
});
