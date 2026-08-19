import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

// Originally added in #59 to pin the optional-student-ID behaviour. KAN-178
// removed the field from RSVP entirely (it can't be sourced from the account —
// UserInfo stores a one-way hash — and KAN-185 makes it optional at
// registration), so these now pin the exact export output under the new schema.

let exportRows = [];

globalThis.prisma = {
  $transaction: async (callback) => callback(globalThis.prisma),
  activity: {
    findUnique: async () => ({ id: 1, isPublished: true, capacity: null }),
  },
  rsvp: {
    count: async () => 0,
    findMany: async () => exportRows,
  },
};

const { exportRsvpsCsv } = await import('./rsvpController.js');

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
  };
}

test('RSVP CSV export has no Student ID column (KAN-178)', async () => {
  exportRows = [
    {
      id: 1,
      activityId: 1,
      name: 'Alex Member',
      email: 'alex@example.com',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
  ];
  const response = responseMock();

  await exportRsvpsCsv({ params: { id: '1' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.body,
    'Name,Email,Registration Date\r\n' +
      'Alex Member,alex@example.com,2026-08-18T00:00:00.000Z\r\n',
  );
  // Carried over from #59: no placeholder text should leak into the file.
  assert.equal(response.body.includes('null'), false);
  assert.equal(response.body.includes('undefined'), false);
  assert.equal(response.body.includes('Student ID'), false);
});

test('RSVP CSV export escapes values containing commas and quotes', async () => {
  exportRows = [
    {
      id: 2,
      activityId: 1,
      name: 'Member, Awkward "Quoted"',
      email: 'awkward@example.com',
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
  ];
  const response = responseMock();

  await exportRsvpsCsv({ params: { id: '1' } }, response);

  assert.match(response.body, /"Member, Awkward ""Quoted"""/);
});

test('RSVP CSV export sets download headers', async () => {
  exportRows = [];
  const response = responseMock();

  await exportRsvpsCsv({ params: { id: '1' } }, response);

  assert.match(response.headers['Content-Type'], /text\/csv/);
  assert.match(response.headers['Content-Disposition'], /attachment; filename="rsvps-1\.csv"/);
});
