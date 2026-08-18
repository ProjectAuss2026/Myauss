import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

let createdData = null;
let exportRows = [];

globalThis.prisma = {
  $transaction: async (callback) => callback(globalThis.prisma),
  activity: {
    findUnique: async () => ({ id: 1, isPublished: true, capacity: null }),
  },
  rsvp: {
    count: async () => 0,
    create: async ({ data }) => {
      createdData = data;
      return { id: 1, ...data, createdAt: new Date('2026-08-18T00:00:00.000Z') };
    },
    findMany: async () => exportRows,
  },
};

const { createRsvp, exportRsvpsCsv } = await import('./rsvpController.js');

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

test('RSVP accepts an omitted student ID and stores null', async () => {
  createdData = null;
  const response = responseMock();

  await createRsvp(
    {
      params: { id: '1' },
      body: { name: ' Alex Member ', email: ' ALEX@example.com ' },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.deepEqual(createdData, {
    activityId: 1,
    name: 'Alex Member',
    email: 'alex@example.com',
    studentId: null,
  });
});

test('RSVP trims a supplied student ID', async () => {
  createdData = null;
  const response = responseMock();

  await createRsvp(
    {
      params: { id: '1' },
      body: {
        name: 'Alex Member',
        email: 'alex@example.com',
        studentId: ' 123456789 ',
      },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(createdData.studentId, '123456789');
});

test('RSVP CSV export renders a missing student ID as an empty cell', async () => {
  exportRows = [
    {
      id: 1,
      activityId: 1,
      name: 'Alex Member',
      email: 'alex@example.com',
      studentId: null,
      createdAt: new Date('2026-08-18T00:00:00.000Z'),
    },
  ];
  const response = responseMock();

  await exportRsvpsCsv({ params: { id: '1' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.body,
    'Name,Email,Student ID,Registration Date\r\n' +
      'Alex Member,alex@example.com,,2026-08-18T00:00:00.000Z\r\n',
  );
  assert.equal(response.body.includes('null'), false);
  assert.equal(response.body.includes('undefined'), false);
});
