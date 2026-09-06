import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// KAN-167. The controller is only ever reached after authenticate +
// requireVerifiedMembership have run (see memberContentRoutes.test.js for that
// contract); these tests pin the query filter and the row→section mapping.

let findManyArgs = null;
let rows = [];
let findManyShouldThrow = false;

globalThis.prisma = {
  memberContent: {
    findMany: async (args) => {
      findManyArgs = args;
      if (findManyShouldThrow) throw new Error('connection lost');
      return rows;
    },
  },
};

const { getMemberContent, getAnnouncements } = await import('./memberContentController.js');

function mockRes() {
  return {
    code: 200,
    body: null,
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

async function run() {
  const res = mockRes();
  await getMemberContent({}, res);
  return res;
}

async function runAnnouncements() {
  const res = mockRes();
  await getAnnouncements({}, res);
  return res;
}

test.beforeEach(() => {
  findManyArgs = null;
  rows = [];
  findManyShouldThrow = false;
});

test('queries only active, members-only rows — never public content', async () => {
  await run();
  assert.deepEqual(findManyArgs.where, { visibility: 'MEMBERS', isActive: true });
});

test('maps discount-code rows into the sponsor section, exposing the gated code', async () => {
  rows = [
    { id: 1, type: 'DISCOUNT_CODE', title: 'FitNutrition', body: '20% off', code: 'AUSS20', metadata: { tier: 'Platinum' } },
  ];
  const res = await run();
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.discountCodes, [
    { id: 1, sponsor: 'FitNutrition', discount: '20% off', code: 'AUSS20', tier: 'Platinum' },
  ]);
  assert.deepEqual(res.body.exclusiveContent, []);
  assert.deepEqual(res.body.privateLinks, []);
});

test('maps exclusive-content and private-link rows into their sections', async () => {
  rows = [
    { id: 4, type: 'EXCLUSIVE_CONTENT', title: 'Program', body: '12-week plan', metadata: { tag: 'New' }, url: null },
    { id: 7, type: 'PRIVATE_LINK', title: 'Discord', body: '', url: 'https://discord.gg/auss', metadata: null },
  ];
  const res = await run();
  assert.deepEqual(res.body.exclusiveContent, [
    { id: 4, title: 'Program', description: '12-week plan', tag: 'New', url: null },
  ]);
  assert.deepEqual(res.body.privateLinks, [
    { id: 7, title: 'Discord', description: null, url: 'https://discord.gg/auss' },
  ]);
});

test('tolerates missing metadata and unknown types without leaking them', async () => {
  rows = [
    { id: 1, type: 'DISCOUNT_CODE', title: 'Sponsor', body: 'deal', code: null, metadata: null },
    { id: 2, type: 'ANNOUNCEMENT', title: 'Notice', body: 'text', metadata: null },
  ];
  const res = await run();
  assert.deepEqual(res.body.discountCodes, [
    { id: 1, sponsor: 'Sponsor', discount: 'deal', code: '', tier: null },
  ]);
  // ANNOUNCEMENT is handled elsewhere and must not appear in any perk section.
  assert.deepEqual(res.body.exclusiveContent, []);
  assert.deepEqual(res.body.privateLinks, []);
});

test('returns 500 when the query fails, without throwing', async () => {
  findManyShouldThrow = true;
  const res = await run();
  assert.equal(res.code, 500);
  assert.equal(res.body.error, 'Internal server error');
});

// ── getAnnouncements — PUBLIC, ungated club updates ────────────────────────

test('announcements query only PUBLIC, active ANNOUNCEMENT rows — never members-only perks', async () => {
  await runAnnouncements();
  assert.deepEqual(findManyArgs.where, {
    type: 'ANNOUNCEMENT',
    visibility: 'PUBLIC',
    isActive: true,
  });
});

test('maps announcement rows, deriving isNew from metadata and exposing publishedAt', async () => {
  const publishedAt = new Date('2026-05-10T00:00:00.000Z');
  rows = [
    { id: 11, type: 'ANNOUNCEMENT', title: 'Schedule', body: 'New times', metadata: { isNew: true }, publishedAt },
    { id: 13, type: 'ANNOUNCEMENT', title: 'AGM', body: 'Notes', metadata: { isNew: false }, publishedAt },
    { id: 14, type: 'ANNOUNCEMENT', title: 'Legacy', body: 'No meta', metadata: null, publishedAt },
  ];
  const res = await runAnnouncements();
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, [
    { id: 11, title: 'Schedule', content: 'New times', publishedAt, isNew: true },
    { id: 13, title: 'AGM', content: 'Notes', publishedAt, isNew: false },
    { id: 14, title: 'Legacy', content: 'No meta', publishedAt, isNew: false },
  ]);
});

test('announcements return 500 when the query fails, without throwing', async () => {
  findManyShouldThrow = true;
  const res = await runAnnouncements();
  assert.equal(res.code, 500);
  assert.equal(res.body.error, 'Internal server error');
});
