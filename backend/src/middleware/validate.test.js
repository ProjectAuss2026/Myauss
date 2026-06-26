import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import validate from './validate.js';
import { activityIdParamsSchema, createActivitySchema } from '../schemas/activitySchemas.js';
import { deleteConfigSchema } from '../schemas/configSchemas.js';

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

async function runValidate(schema, req) {
  const res = createRes();
  let nextCalled = false;
  await validate(schema)(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled, req };
}

test('validate middleware returns stable error shape for invalid body', async () => {
  const { res, nextCalled } = await runValidate(deleteConfigSchema, {
    body: { type: 'communicationLink' },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.equal(Array.isArray(res.body.details), true);
  assert.deepEqual(Object.keys(res.body.details[0]), ['path', 'message']);
  assert.equal(res.body.details[0].path, 'body.id');
});

test('validate middleware returns stable error shape for invalid params', async () => {
  const { res, nextCalled } = await runValidate({ params: activityIdParamsSchema }, {
    params: { id: 'abc' },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.equal(res.body.details[0].path, 'params.id');
});

test('validate middleware returns stable error shape for invalid query', async () => {
  const querySchema = z.object({
    page: z.coerce.number().int().min(1),
  });

  const { res, nextCalled } = await runValidate({ query: querySchema }, {
    query: { page: '0' },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.equal(res.body.details[0].path, 'query.page');
});

test('validate middleware rejects overlong strings', async () => {
  const { res, nextCalled } = await runValidate(createActivitySchema, {
    body: {
      title: 'A'.repeat(151),
      description: 'Activity description',
      startTime: '2026-06-01T10:00:00Z',
      endTime: '2026-06-01T11:00:00Z',
    },
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Validation failed');
  assert.equal(res.body.details[0].path, 'body.title');
});

test('validate middleware passes and normalizes valid existing payload shapes', async () => {
  const req = {
    body: {
      title: ' Training Session ',
      description: ' Lift heavy things safely ',
      startTime: '2026-06-01T10:00:00Z',
      endTime: '2026-06-01T11:00:00Z',
      imageUrl: '/uploads/example.png',
      externalLink: 'https://93.184.216.34/event',
      isPublished: 'false',
      capacity: '25',
    },
  };

  const { res, nextCalled } = await runValidate(createActivitySchema, req);

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.equal(req.body.title, 'Training Session');
  assert.equal(req.body.description, 'Lift heavy things safely');
  assert.equal(req.body.startTime instanceof Date, true);
  assert.equal(req.body.endTime instanceof Date, true);
  assert.equal(req.body.isPublished, false);
  assert.equal(req.body.capacity, 25);
  assert.equal(req.body.imageUrl, '/uploads/example.png');
});
