import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';

// KAN-167 AC2: the member-content endpoint must return 401 without a token and
// 403 for a non-VERIFIED member, and never serve members-only rows publicly.
// This drives the real Express app through authenticate + requireVerifiedMembership.

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';
process.env.JWT_SECRET = 'member-content-route-test-secret';
process.env.STUDENT_ID_PEPPER ||= 'member-content-test-pepper';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const ACCOUNTS = {
  'verified-user': { id: 'verified-user', role: 'USER', tokenVersion: 0, membershipStatus: 'VERIFIED', email: 'verified@example.test', info: { firstName: 'Vera', lastName: 'Fied' } },
  'inactive-user': { id: 'inactive-user', role: 'USER', tokenVersion: 0, membershipStatus: 'INACTIVE', email: 'inactive@example.test', info: { firstName: 'Ina', lastName: 'Ctive' } },
  'admin-user': { id: 'admin-user', role: 'ADMIN', tokenVersion: 0, membershipStatus: 'INACTIVE', email: 'admin@example.test', info: { firstName: 'Ad', lastName: 'Min' } },
};

const SEEDED_CONTENT = [
  { id: 1, type: 'DISCOUNT_CODE', title: 'FitNutrition', body: '20% off', code: 'AUSS20', metadata: { tier: 'Platinum' }, visibility: 'MEMBERS', isActive: true },
];

let lastFindManyArgs = null;

globalThis.prisma = {
  user: {
    // Serves both authenticate (selects id/role/tokenVersion) and
    // requireVerifiedMembership (selects email/membershipStatus/info); the mock
    // ignores `select` and returns the whole account row.
    findUnique: async (args) => ACCOUNTS[args.where.id] ?? null,
  },
  memberContent: {
    findMany: async (args) => {
      lastFindManyArgs = args;
      return SEEDED_CONTENT;
    },
  },
};

const { createApp } = await import('../app.js');

function tokenFor(id) {
  const account = ACCOUNTS[id];
  return jwt.sign(
    { sub: id, role: account.role, tv: 0, type: 'access' },
    process.env.JWT_SECRET,
    { issuer: 'auss-api', audience: 'auss-web' },
  );
}

async function get(app, { token } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/member/content',
          method: 'GET',
          headers: { Host: 'example.com', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json = null;
            try { json = text ? JSON.parse(text) : null; } catch { json = null; }
            resolve({ statusCode: res.statusCode, json, text });
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

test('rejects an unauthenticated request with 401 and returns no content', async () => {
  const res = await get(createApp());
  assert.equal(res.statusCode, 401);
  assert.equal(res.json?.discountCodes, undefined);
});

test('rejects a non-VERIFIED member with 403', async () => {
  const res = await get(createApp(), { token: tokenFor('inactive-user') });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json.code, 'MEMBERSHIP_REQUIRED');
});

test('serves gated content to a VERIFIED member, filtered to members-only rows', async () => {
  lastFindManyArgs = null;
  const res = await get(createApp(), { token: tokenFor('verified-user') });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(lastFindManyArgs.where, { visibility: 'MEMBERS', isActive: true });
  assert.equal(res.json.discountCodes[0].code, 'AUSS20');
});

test('lets ADMIN through even with a non-VERIFIED membership (staff exemption)', async () => {
  const res = await get(createApp(), { token: tokenFor('admin-user') });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.json.discountCodes));
});
