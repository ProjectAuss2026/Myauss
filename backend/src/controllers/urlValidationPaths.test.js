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
    findFirst: async () => record('mediaConfig.findFirst', {}, { id: 1, mediaDriveUrl: 'https://example.com' }),
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
  mediaEntry: {
    create: async (args) => record('mediaEntry.create', args, { id: 1, ...args.data, activity: { id: args.data.activityId, title: 'Activity' } }),
    update: async (args) => record('mediaEntry.update', args, { id: args.where.id, ...args.data, activity: { id: 1, title: 'Activity' } }),
  },
};

const { default: postConfigController } = await import('./postConfigController.js');
const { default: patchConfigController } = await import('./patchConfigController.js');
const { createActivity, updateActivity } = await import('./activityController.js');
const { createSponsor, patchSponsor } = await import('./sponsorshipController.js');

function resetCalls() {
  calls.length = 0;
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

function activityBody(overrides = {}) {
  return {
    title: 'Activity',
    description: 'Activity description',
    startTime: '2026-06-01T10:00:00Z',
    endTime: '2026-06-01T11:00:00Z',
    ...overrides,
  };
}

test('postConfigController rejects unsafe CommunicationLink.url before saving', async () => {
  resetCalls();
  const res = createRes();

  await postConfigController({
    body: {
      type: 'communicationLink',
      data: { platform: 'Discord', url: 'javascript:alert(1)', imgUrl: '__builtin__' },
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Communication link URL/i);
  assert.equal(calls.some((call) => call.name === 'communicationLink.create'), false);
});

test('postConfigController rejects private MediaConfig.mediaDriveUrl before saving', async () => {
  resetCalls();
  const res = createRes();

  await postConfigController({
    body: {
      type: 'mediaConfig',
      data: { mediaDriveUrl: 'http://169.254.169.254/latest/meta-data' },
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Photo Drive URL/i);
  assert.equal(calls.some((call) => call.name === 'mediaConfig.create'), false);
});

test('postConfigController rejects unsafe Sponsor.websiteUrl before saving', async () => {
  resetCalls();
  const res = createRes();

  await postConfigController({
    body: {
      type: 'sponsor',
      data: { name: 'Sponsor', sponsorshipPageId: 1, websiteUrl: 'file:///etc/passwd' },
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Sponsor website URL/i);
  assert.equal(calls.some((call) => call.name === 'sponsor.create'), false);
});

test('patchConfigController rejects provided unsafe URL fields', async () => {
  resetCalls();
  const res = createRes();

  await patchConfigController({
    body: {
      type: 'communicationLink',
      id: 1,
      data: { url: 'data:text/html,<script>alert(1)</script>' },
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'communicationLink.update'), false);

  resetCalls();
  const imageRes = createRes();
  await patchConfigController({
    body: {
      type: 'communicationLink',
      id: 1,
      data: { imgUrl: '/admin' },
    },
  }, imageRes);

  assert.equal(imageRes.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'communicationLink.update'), false);

  resetCalls();
  const mediaRes = createRes();
  await patchConfigController({
    body: {
      type: 'mediaConfig',
      data: { mediaDriveUrl: 'http://10.0.0.1' },
    },
  }, mediaRes);

  assert.equal(mediaRes.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'mediaConfig.update'), false);
});

test('patchConfigController only validates URL fields that are provided', async () => {
  resetCalls();
  const res = createRes();

  await patchConfigController({
    body: {
      type: 'sponsor',
      id: 1,
      data: { name: 'Updated Sponsor' },
    },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find((call) => call.name === 'sponsor.update').args.data, { name: 'Updated Sponsor' });
});

test('sponsorship routes reject unsafe Sponsor.websiteUrl on create and update', async () => {
  resetCalls();
  const createResObj = createRes();
  await createSponsor({
    body: {
      name: 'Sponsor',
      sponsorshipPageId: 1,
      websiteUrl: 'ftp://example.com',
    },
  }, createResObj);

  assert.equal(createResObj.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'sponsor.create'), false);

  resetCalls();
  const patchResObj = createRes();
  await patchSponsor({
    params: { id: '1' },
    body: { websiteUrl: 'http://127.0.0.1' },
  }, patchResObj);

  assert.equal(patchResObj.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'sponsor.update'), false);
});

test('createActivity rejects unsafe externalLink and imageUrl before saving', async () => {
  resetCalls();
  const externalLinkRes = createRes();
  await createActivity({ body: activityBody({ externalLink: 'data:text/html,<script>alert(1)</script>' }) }, externalLinkRes);

  assert.equal(externalLinkRes.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.create'), false);

  resetCalls();
  const imageUrlRes = createRes();
  await createActivity({ body: activityBody({ imageUrl: '/admin' }) }, imageUrlRes);

  assert.equal(imageUrlRes.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.create'), false);
});

test('updateActivity rejects unsafe imageUrl when it is provided', async () => {
  resetCalls();
  const res = createRes();

  await updateActivity({
    params: { id: '1' },
    body: { imageUrl: '../uploads/example.png' },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.update'), false);

  resetCalls();
  const externalLinkRes = createRes();
  await updateActivity({
    params: { id: '1' },
    body: { externalLink: 'javascript:alert(1)' },
  }, externalLinkRes);

  assert.equal(externalLinkRes.statusCode, 400);
  assert.equal(calls.some((call) => call.name === 'activity.update'), false);
});

test('updateActivity only validates URL fields that are provided on PATCH', async () => {
  resetCalls();
  const res = createRes();

  globalThis.prisma.activity.findUnique = async () => record('activity.findUnique', {}, {
    ...validExistingActivity,
    imageUrl: 'javascript:alert(1)',
    externalLink: 'data:text/html,<script>alert(1)</script>',
  });

  await updateActivity({
    params: { id: '1' },
    body: { title: 'Renamed activity' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.find((call) => call.name === 'activity.update').args.data, { title: 'Renamed activity' });

  globalThis.prisma.activity.findUnique = async () => record('activity.findUnique', {}, { ...validExistingActivity });
});
