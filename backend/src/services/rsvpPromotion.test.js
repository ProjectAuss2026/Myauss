import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// KAN-189 promotion. These cover the decisions that are easy to regress:
// promotion is atomic with the vacate, ordered by createdAt, stops inside the
// cutoff, and never fires when leaving the waitlist (which frees nothing).

const HOUR = 60 * 60 * 1000;

let activity = { id: 1, title: 'Deadlift Night', capacity: 2, startTime: new Date(Date.now() + 48 * HOUR) };
let rows = [];
let confirmedCount = 0;
let updated = [];

globalThis.prisma = {
  $transaction: async (fn) => fn(globalThis.prisma),
  activity: { findUnique: async () => activity },
  rsvp: {
    findUnique: async ({ where }) =>
      rows.find((r) => r.userId === where.activityId_userId.userId) ?? null,
    findFirst: async ({ where, orderBy }) => {
      const waiting = rows
        .filter((r) => r.status === where.status)
        .sort((a, b) => a.createdAt - b.createdAt);
      return orderBy?.createdAt === 'asc' ? (waiting[0] ?? null) : (waiting[0] ?? null);
    },
    count: async () => confirmedCount,
    delete: async ({ where }) => {
      rows = rows.filter((r) => r.id !== where.id);
      return { id: where.id };
    },
    update: async ({ where, data }) => {
      updated.push({ id: where.id, ...data });
      const row = rows.find((r) => r.id === where.id);
      if (row) Object.assign(row, data);
      return row;
    },
  },
};

const { releaseRsvpPlace, notifyPromotion, buildPromotionEmail, getPromotionCutoffHours } =
  await import('./rsvpPlaces.js');

function seed() {
  rows = [
    { id: 1, userId: 'holder', status: 'CONFIRMED', createdAt: new Date(1), name: 'Holder', email: 'h@x.test' },
    { id: 2, userId: 'first', status: 'WAITLISTED', createdAt: new Date(2), name: 'First', email: 'f@x.test' },
    { id: 3, userId: 'second', status: 'WAITLISTED', createdAt: new Date(3), name: 'Second', email: 's@x.test' },
  ];
  confirmedCount = 1; // after the delete, one place is free of capacity 2
  updated = [];
}

// Cleared per-test rather than once at the top: importing prismaClient runs
// dotenv.config(), which repopulates these from .env after any earlier delete.
// Left set, the promotion email opens a real SMTP connection and each test
// waits ~5s for it to time out.
test.beforeEach(() => {
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  activity = { id: 1, title: 'Deadlift Night', capacity: 2, startTime: new Date(Date.now() + 48 * HOUR) };
  delete process.env.WAITLIST_PROMOTION_CUTOFF_HOURS;
  seed();
});

test('cancelling a confirmed place promotes the earliest waitlisted member', async () => {
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted?.userId, 'first', 'earliest by createdAt, not newest');
  assert.deepEqual(updated, [{ id: 2, status: 'CONFIRMED' }]);
});

test('leaving the WAITLIST promotes nobody — it frees no place', async () => {
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'second' });
  assert.equal(res.promoted, null);
  assert.deepEqual(updated, []);
});

test('no promotion inside the cutoff — the queue passes to the exec at the desk', async () => {
  activity = { ...activity, startTime: new Date(Date.now() + 2 * HOUR) };
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted, null);
  assert.deepEqual(updated, [], 'must not promote someone who cannot reach the event');
});

test('promotion resumes outside the cutoff', async () => {
  activity = { ...activity, startTime: new Date(Date.now() + 13 * HOUR) };
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted?.userId, 'first');
});

test('the cutoff is configurable', async () => {
  process.env.WAITLIST_PROMOTION_CUTOFF_HOURS = '1';
  assert.equal(getPromotionCutoffHours(), 1);
  activity = { ...activity, startTime: new Date(Date.now() + 2 * HOUR) };
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted?.userId, 'first', 'a 1h cutoff should allow a 2h-away event');
});

test('an uncapped event never promotes — it has no waitlist', async () => {
  activity = { ...activity, capacity: null };
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted, null);
});

test('no promotion when the event is still at capacity', async () => {
  confirmedCount = 2; // capacity 2 — the freed place was an exec's, say
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted, null);
});

test('cancelling when not registered throws rather than promoting anyone', async () => {
  await assert.rejects(
    () => releaseRsvpPlace({ activityId: 1, userId: 'nobody' }),
    (err) => err.code === 'RSVP_NOT_FOUND',
  );
  assert.deepEqual(updated, []);
});

test('the promotion email links to the event page and never performs a cancel', async () => {
  const email = buildPromotionEmail({
    name: 'Ada',
    activityTitle: 'Deadlift Night',
    activityUrl: 'https://auss.test/activities/42',
    startTime: new Date('2026-10-01T18:00:00Z'),
  });
  assert.match(email.subject, /You're in/);
  assert.match(email.text, /https:\/\/auss\.test\/activities\/42/);
  // An email click is a GET; cancellation is a DELETE (KAN-191). The link must
  // land on the page where the Cancel action lives, never act on its own.
  assert.ok(!/cancel\?|\/cancel\b|action=cancel/i.test(email.html), 'must not be an acting cancel link');
  assert.match(email.html, /View the event/);
});

test('promotion email handles a missing name', async () => {
  const email = buildPromotionEmail({
    name: null,
    activityTitle: 'Deadlift Night',
    activityUrl: 'https://auss.test/activities/42',
    startTime: null,
  });
  assert.match(email.text, /^Hi,/);
});

test('releaseRsvpPlace performs NO email inside the transaction', async () => {
  // Regression for P2028. The notification used to be sent inside the caller's
  // transaction; with SMTP actually configured the round-trip exceeded Prisma's
  // 5s interactive-transaction timeout, rolling back BOTH the cancellation and
  // the promotion. The earlier tests missed it precisely because they cleared
  // the SMTP vars, making the send a fast no-op.
  process.env.SMTP_USER = 'someone@example.test';
  process.env.SMTP_PASS = 'not-a-real-password';

  const started = Date.now();
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  const elapsed = Date.now() - started;

  assert.equal(res.promoted?.userId, 'first');
  // No SMTP work happened here, so this must be immediate rather than seconds.
  assert.ok(elapsed < 500, `release should not send mail (took ${elapsed}ms)`);
});

test('notifyPromotion is a safe no-op when nothing was promoted', async () => {
  await notifyPromotion({ activityId: 1, promoted: null });
});

test('notifyPromotion never throws, so a mailer failure cannot fail the cancel', async () => {
  process.env.SMTP_USER = 'someone@example.test';
  process.env.SMTP_PASS = 'not-a-real-password';
  await notifyPromotion({
    activityId: 1,
    promoted: { userId: 'u', name: 'N', email: 'not a valid address', activityTitle: 'X', startTime: null },
  });
});
