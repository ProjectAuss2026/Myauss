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
let updated = [];

// Hooks for the concurrency tests, one per write, because WHICH write the
// competing transaction lands before is the whole point. `beforeClaim` fires
// between our read of the queue head and our claim on it — the window the race
// lives in. A single shared hook fired on the delete instead, landing before the
// queue was ever read, and the race test then passed against the unfixed code.
let beforeClaim = null;
let beforeDelete = null;
let alwaysLoseRace = false;
let writeAttempts = 0;

// Deliberately derives every read from `rows` rather than returning canned
// values. The previous mock answered `count` from a fixed variable, so a
// simulated concurrent write was invisible to the next read and no test could
// express contention at all — which is how the unconditional promotion write
// got through review (#84).
function matches(row, where) {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.status !== undefined && row.status !== where.status) return false;
  if (where.countsTowardCapacity !== undefined
      && row.countsTowardCapacity !== where.countsTowardCapacity) return false;
  return true;
}

globalThis.prisma = {
  $transaction: async (fn) => fn(globalThis.prisma),
  activity: { findUnique: async () => activity },
  rsvp: {
    findUnique: async ({ where }) =>
      rows.find((r) => r.userId === where.activityId_userId.userId) ?? null,
    findFirst: async ({ where }) =>
      rows
        .filter((r) => matches(r, where))
        .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
    count: async ({ where }) => rows.filter((r) => matches(r, where)).length,
    deleteMany: async ({ where }) => {
      if (beforeDelete) beforeDelete();
      const before = rows.length;
      rows = rows.filter((r) => !matches(r, where));
      return { count: before - rows.length };
    },
    // Mirrors Postgres' behaviour on a contended row: the loser blocks on the
    // lock, then re-evaluates its WHERE against the row the winner committed. A
    // status that has moved on since our read matches nothing, so we claim
    // nothing — that re-evaluation is the entire safety property here.
    updateMany: async ({ where, data }) => {
      writeAttempts += 1;
      if (beforeClaim) beforeClaim();
      if (alwaysLoseRace) return { count: 0 };
      const row = rows.find((r) => matches(r, where));
      if (!row) return { count: 0 };
      Object.assign(row, data);
      updated.push({ id: where.id, ...data });
      return { count: 1 };
    },
  },
};

const {
  releaseRsvpPlace, notifyPromotion, buildPromotionEmail, getPromotionCutoffHours, fillFreedPlaces,
} = await import('./rsvpPlaces.js');

function row(id, userId, status, createdAtMs, countsTowardCapacity = true) {
  return {
    id,
    userId,
    status,
    countsTowardCapacity,
    createdAt: new Date(createdAtMs),
    name: userId,
    email: `${userId}@x.test`,
  };
}

function seed() {
  // Capacity 2, one counting place taken. Cancelling `holder` frees it.
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'first', 'WAITLISTED', 2),
    row(3, 'second', 'WAITLISTED', 3),
  ];
  updated = [];
  beforeClaim = null;
  beforeDelete = null;
  alwaysLoseRace = false;
  writeAttempts = 0;
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

test('an invalid cutoff falls back to the default instead of disabling itself', async () => {
  // A mistyped value in Railway must not silently change promotion behaviour.
  for (const bad of ['-1', 'abc', 'twelve']) {
    process.env.WAITLIST_PROMOTION_CUTOFF_HOURS = bad;
    assert.equal(getPromotionCutoffHours(), 12, `${bad} should fall back`);
  }
  // An empty value reads as unset, not as 0. Number('') is 0, so this used to
  // turn the cutoff off entirely — the one fallback that changes behaviour
  // rather than preserving it.
  process.env.WAITLIST_PROMOTION_CUTOFF_HOURS = '';
  assert.equal(getPromotionCutoffHours(), 12);
  // 0 stays valid and meaningful: promote right up to the start time.
  process.env.WAITLIST_PROMOTION_CUTOFF_HOURS = '0';
  assert.equal(getPromotionCutoffHours(), 0);
});

test('an uncapped event never promotes — it has no waitlist', async () => {
  activity = { ...activity, capacity: null };
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted, null);
});

test('no promotion when the event is still at capacity', async () => {
  // The freed place was an exec's, which never counted toward capacity, so
  // vacating it leaves the event just as full as it was.
  rows = [
    row(1, 'holder', 'CONFIRMED', 1, false),
    row(4, 'memberA', 'CONFIRMED', 4),
    row(5, 'memberB', 'CONFIRMED', 5),
    row(2, 'first', 'WAITLISTED', 2),
  ];
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  assert.equal(res.promoted, null);
  assert.deepEqual(updated, []);
});

// --- Concurrency (review, #84) ------------------------------------------------
// Read Committed means two simultaneous cancellations each see a free place and
// the same member at the head of the queue. These simulate the competing
// transaction committing in the window between our read and our write, which is
// exactly where the unconditional update used to lose.

test('a member claimed by a concurrent cancellation is skipped, not promoted twice', async () => {
  // Capacity 2, both places taken, two waiting. We cancel `holder`; another
  // request cancels `other` at the same moment and promotes `first`.
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(6, 'other', 'CONFIRMED', 6),
    row(2, 'first', 'WAITLISTED', 2),
    row(3, 'second', 'WAITLISTED', 3),
  ];

  let landed = false;
  beforeClaim = () => {
    if (landed) return;
    landed = true;
    // The competing transaction commits in the window after we read `first` as
    // the queue head and before we claim them: its holder is gone and `first` is
    // already CONFIRMED. Our claim must therefore match nothing.
    rows = rows.filter((r) => r.userId !== 'other');
    rows.find((r) => r.userId === 'first').status = 'CONFIRMED';
  };

  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });

  // Two places were freed, so two different members must end up with one each.
  assert.equal(res.promoted?.userId, 'second', 'must not re-promote the member already claimed');
  assert.deepEqual(updated, [{ id: 3, status: 'CONFIRMED' }], 'exactly one claim, and not on `first`');
  assert.equal(rows.filter((r) => r.status === 'CONFIRMED').length, 2, 'neither place left unfilled');
});

test('losing every claim promotes nobody rather than reporting an unclaimed member', async () => {
  // The pathological case: the queue always reads as WAITLISTED but every claim
  // is taken first. Returning `first` here would email someone a place they do
  // not hold, which is worse than leaving it to the exec at the desk.
  alwaysLoseRace = true;

  const res = await releaseRsvpPlace({ activityId: 1, userId: 'holder' });

  assert.equal(res.promoted, null, 'never report a promotion that was not claimed');
  assert.deepEqual(updated, []);
  assert.equal(writeAttempts, 5, 'retries are bounded — no unbounded spin under contention');
});

test('the claim is conditional on WAITLISTED, so it cannot re-confirm a taken place', async () => {
  // Guards the shape itself: a future edit back to an unconditional
  // update({ where: { id } }) reintroduces the double promotion silently.
  const seen = [];
  const realUpdateMany = globalThis.prisma.rsvp.updateMany;
  globalThis.prisma.rsvp.updateMany = async (args) => {
    seen.push(args.where);
    return realUpdateMany(args);
  };
  try {
    await releaseRsvpPlace({ activityId: 1, userId: 'holder' });
  } finally {
    globalThis.prisma.rsvp.updateMany = realUpdateMany;
  }
  assert.deepEqual(seen, [{ id: 2, status: 'WAITLISTED' }]);
});

test('two cancellations of the SAME place free it once and promote once', async () => {
  // A double-clicked Cancel. The loser must not also promote — only one place
  // was actually freed — and must read as "not registered", not a 500.
  let landed = false;
  beforeDelete = () => {
    if (landed) return;
    landed = true;
    rows = rows.filter((r) => r.userId !== 'holder'); // the other request got there first
  };

  await assert.rejects(
    () => releaseRsvpPlace({ activityId: 1, userId: 'holder' }),
    (err) => err.code === 'RSVP_NOT_FOUND',
  );
  assert.deepEqual(updated, [], 'the losing cancellation must not promote anyone');
});

test('a member promoted mid-cancel frees their NEW place, not their old queue slot', async () => {
  // Review #84, item 2. `second` is queued and cancels. At the same moment
  // another cancellation promotes them to CONFIRMED. Reading the status before
  // the delete would act on the stale WAITLISTED: the place they now hold goes
  // to nobody, and they'd be emailed "you're in" for a place they just gave up.
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'first', 'WAITLISTED', 2),
    row(3, 'second', 'WAITLISTED', 3),
  ];

  let landed = false;
  beforeDelete = () => {
    if (landed) return;
    landed = true;
    // The competing promotion commits between our read and our delete.
    rows.find((r) => r.userId === 'second').status = 'CONFIRMED';
  };

  const res = await releaseRsvpPlace({ activityId: 1, userId: 'second' });

  assert.equal(res.promoted?.userId, 'first', 'the place they were promoted into must be refilled');
  assert.equal(rows.find((r) => r.userId === 'second'), undefined, 'their row is gone either way');
});

test('leaving the queue while still queued frees nothing, even under a racing read', async () => {
  // The mirror case: nothing promotes them, so the delete must take the
  // WAITLISTED branch and promote nobody.
  const res = await releaseRsvpPlace({ activityId: 1, userId: 'second' });
  assert.equal(res.promoted, null);
  assert.deepEqual(updated, []);
});

test('fillFreedPlaces drains the queue into places freed in bulk', async () => {
  // Raising capacity 2 → 4 with two queued: both get in, earliest first.
  activity = { ...activity, capacity: 4 };
  rows = [
    row(1, 'holder', 'CONFIRMED', 1),
    row(2, 'first', 'WAITLISTED', 2),
    row(3, 'second', 'WAITLISTED', 3),
  ];

  const promoted = await fillFreedPlaces({ activityId: 1 });

  assert.deepEqual(promoted.map((p) => p.userId), ['first', 'second'], 'earliest first');
  assert.equal(rows.filter((r) => r.status === 'WAITLISTED').length, 0);
});

test('fillFreedPlaces stops at capacity rather than draining the whole queue', async () => {
  // Capacity 2, one confirmed: exactly one new place, two waiting.
  const promoted = await fillFreedPlaces({ activityId: 1 });

  assert.deepEqual(promoted.map((p) => p.userId), ['first']);
  assert.equal(rows.find((r) => r.userId === 'second').status, 'WAITLISTED');
});

test('fillFreedPlaces promotes nobody when there is no queue', async () => {
  rows = [row(1, 'holder', 'CONFIRMED', 1)];
  assert.deepEqual(await fillFreedPlaces({ activityId: 1 }), []);
});

test('the promotion email shows Auckland time, not the server\'s UTC', async () => {
  // Review #84, item 5. Railway runs in UTC, so without an explicit zone a 7pm
  // NZ event was emailed as the UTC instant and members were told the wrong
  // hour entirely.
  const startTime = new Date('2026-10-01T06:00:00Z'); // 7pm NZDT (UTC+13)
  const email = buildPromotionEmail({
    name: 'Ada', activityTitle: 'Deadlift Night',
    activityUrl: 'https://auss.test/activities/42', startTime,
  });

  assert.match(email.text, /7:00\s*pm/i, `expected 7pm Auckland, got: ${email.text}`);
  assert.ok(!/6:00\s*am/i.test(email.text), 'must not render the raw UTC hour');
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
