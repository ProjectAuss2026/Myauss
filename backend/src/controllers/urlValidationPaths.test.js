import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

const calls = [];

const validExistingActivity = {
  id: 1,
  title: 'Existing activity',
  description: 'Existing description',
  startTime: new Date('2026-06-01T10:00:00Z'),
  endTime: new Date('2026-06-01T11:00:00Z'),
  imageUrl: null,
  externalLink: null,
};

function record(name, args, result) {
  calls.push({ name, args });
  return result;
}

globalThis.prisma = {
  communicationLink: {
    create: async (args) => record('communicationLink.create', args, { id: 1, ...args.data }),
    update: async (args) => record('communicationLink.update', args, { id: args.where.id, ...args.data }),
  },
  mediaConfig: {
    create: async (args) => record('mediaConfig.create', args, { id: 1, ...args.data }),
    update: async (args) => record('mediaConfig.update', args, { id: args.where.id, ...args.data }),
    findFirst: async () => record('mediaConfig.findFirst', {}, { id: 1, mediaDriveUrl: 'https://93.184.216.34' }),
  },
  sponsorshipPage: {
    findUnique: async (args) => record('sponsorshipPage.findUnique', args, { id: args.where.id }),
    findFirst: async () => record('sponsorshipPage.findFirst', {}, { id: 1, pageContent: 'Content' }),
    create: async (args) => record('sponsorshipPage.create', args, { id: 1, ...args.data, sponsors: [] }),
    update: async (args) => record('sponsorshipPage.update', args, { id: args.where.id, ...args.data, sponsors: [] }),
  },
  sponsor: {
    create: async (args) => record('sponsor.create', args, { id: 1, ...args.data }),
    update: async (args) => record('sponsor.update', args, { id: args.where.id, ...args.data }),
  },
  activity: {
    create: async (args) => record('activity.create', args, { id: 1, ...args.data }),
    update: async (args) => record('activity.update', args, { id: args.where.id, ...args.data }),
    findUnique: async () => record('activity.findUnique', {}, { ...validExistingActivity }),
  },
};

const { default: validate } = await import('../middleware/validate.js');
const { postConfigSchema, patchConfigSchema } = await import('../schemas/configSchemas.js');
const { createActivitySchema, updateActivitySchema } = await import('../schemas/activitySchemas.js');
const { default: postConfigController } = await import('./postConfigController.js');
const { default: patchConfigController } = await import('./patchConfigController.js');
const { createActivity, updateActivity } = await import('./activityController.js');

function resetCalls() {
  calls.length = 0;
  globalThis.prisma.activity.findUnique = async () => record('activity.findUnique', {}, { ...validExistingActivity });
}

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runValidated(schema, controller, req) {
  const res = createRes();
  let nextCalled = false;
  await validate(schema)(req, res, async () => {
    nextCalled = true;
    await controller(req, res);
  });
  return { res, nextCalled, req };
}

function activityBody(overrides = {}) {
  return {
    title: 'Activity',
    description: 'Activity description',
    startTime: '2026-06-01T10:00:00Z',
    endTime: '2026-06-01T11:00:00Z',
    ...overrides,
  };
}

test('postConfigController rejects unsafe CommunicationLink.url through Zod before saving', async () => {
  resetCalls();

  const { res, nextCalled } = await runValidated(postConfigSchema, postConfigController, {
    body: {
      type: 'communicationLink',
      data: { platform: 'Discord', url: 'javascript:alert(1)', imgUrl: '__builtin__' },
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.equal(res.body.details[0].path, 'body.data.url');
  assert.match(res.body.details[0].message, /Communication link URL/i);
  assert.equal(calls.some((call) => call.name === 'communicationLink.create'), false);
});

test('postConfigController accepts valid existing CommunicationLink payload shape', async () => {
  resetCalls();

  const { res, nextCalled, req } = await runValidated(postConfigSchema, postConfigController, {
    body: {
      type: 'communicationLink',
      data: {
        platform: ' Instagram ',
        url: 'https://93.184.216.34/instagram',
        imgUrl: '__builtin__',
        description: ' Updates ',
        isActive: 'true',
        ignored: 'not persisted',
      },
    },
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 201);
  const createCall = calls.find((call) => call.name === 'communicationLink.create');
  assert.deepEqual(createCall.args.data, {
    platform: 'Instagram',
    url: 'https://93.184.216.34/instagram',
    imgUrl: '__builtin__',
    description: 'Updates',
    isActive: true,
  });
  assert.equal(Object.hasOwn(req.body.data, 'ignored'), false);
});

test('postConfigController rejects unsafe Sponsor.websiteUrl through Zod before saving', async () => {
  resetCalls();

  const { res, nextCalled } = await runValidated(postConfigSchema, postConfigController, {
    body: {
      type: 'sponsor',
      data: { name: 'Sponsor', sponsorshipPageId: 1, websiteUrl: 'file:///etc/passwd' },
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.equal(res.body.details[0].path, 'body.data.websiteUrl');
  assert.equal(calls.some((call) => call.name === 'sponsor.create'), false);
});

test('patchConfigController rejects invalid provided URL fields through Zod before saving', async () => {
  resetCalls();

  const communicationRes = await runValidated(patchConfigSchema, patchConfigController, {
    body: {
      type: 'communicationLink',
      id: 1,
      data: { url: 'data:text/html,<script>alert(1)</script>' },
    },
  });

  assert.equal(communicationRes.nextCalled, false);
  assert.equal(communicationRes.res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'communicationLink.update'), false);

  resetCalls();
  const mediaRes = await runValidated(patchConfigSchema, patchConfigController, {
    body: {
      type: 'mediaConfig',
      data: { mediaDriveUrl: 'http://10.0.0.1' },
    },
  });

  assert.equal(mediaRes.nextCalled, false);
  assert.equal(mediaRes.res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'mediaConfig.update'), false);
});

test('patchConfigController accepts partial valid updates and only validates provided fields', async () => {
  resetCalls();

  const { res, nextCalled } = await runValidated(patchConfigSchema, patchConfigController, {
    body: {
      type: 'sponsor',
      id: '1',
      data: { name: ' Updated Sponsor ' },
    },
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find((call) => call.name === 'sponsor.update').args, {
    where: { id: 1 },
    data: { name: 'Updated Sponsor' },
  });
});

test('createActivity accepts valid payloads after Zod normalization', async () => {
  resetCalls();

  const { res, nextCalled } = await runValidated(createActivitySchema, createActivity, {
    body: activityBody({
      title: ' Powerlifting 101 ',
      description: ' Learn the basics ',
      imageUrl: '/uploads/activity.png',
      externalLink: 'https://93.184.216.34/event',
      isPublished: 'false',
      capacity: '40',
    }),
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 201);
  const createCall = calls.find((call) => call.name === 'activity.create');
  assert.equal(createCall.args.data.title, 'Powerlifting 101');
  assert.equal(createCall.args.data.description, 'Learn the basics');
  assert.equal(createCall.args.data.startTime instanceof Date, true);
  assert.equal(createCall.args.data.endTime instanceof Date, true);
  assert.equal(createCall.args.data.imageUrl, '/uploads/activity.png');
  assert.equal(createCall.args.data.externalLink, 'https://93.184.216.34/event');
  assert.equal(createCall.args.data.isPublished, false);
  assert.equal(createCall.args.data.capacity, 40);
});

test('createActivity rejects unsafe externalLink and imageUrl through Zod before saving', async () => {
  resetCalls();
  const externalLinkResult = await runValidated(createActivitySchema, createActivity, {
    body: activityBody({ externalLink: 'data:text/html,<script>alert(1)</script>' }),
  });

  assert.equal(externalLinkResult.nextCalled, false);
  assert.equal(externalLinkResult.res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.create'), false);

  resetCalls();
  const imageUrlResult = await runValidated(createActivitySchema, createActivity, {
    body: activityBody({ imageUrl: '/admin' }),
  });

  assert.equal(imageUrlResult.nextCalled, false);
  assert.equal(imageUrlResult.res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.create'), false);
});

test('updateActivity rejects invalid provided URL fields through Zod before saving', async () => {
  resetCalls();

  const { res, nextCalled } = await runValidated(updateActivitySchema, updateActivity, {
    params: { id: '1' },
    body: { externalLink: 'javascript:alert(1)' },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.update'), false);
});

test('updateActivity accepts partial valid updates without revalidating stored URL fields', async () => {
  resetCalls();
  globalThis.prisma.activity.findUnique = async () => record('activity.findUnique', {}, {
    ...validExistingActivity,
    imageUrl: 'javascript:alert(1)',
    externalLink: 'data:text/html,<script>alert(1)</script>',
  });

  const { res, nextCalled } = await runValidated(updateActivitySchema, updateActivity, {
    params: { id: '1' },
    body: { title: ' Renamed activity ' },
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find((call) => call.name === 'activity.update').args, {
    where: { id: 1 },
    data: { title: 'Renamed activity' },
  });
});
