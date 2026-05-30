import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { configureSecurity } from './security.js';

function createTestApp(env) {
  const app = express();
  configureSecurity(app, { env, trustProxy: 1 });
  app.get('/ok', (_req, res) => res.status(200).send('ok'));
  app.get('/deep/path', (_req, res) => res.status(200).send('deep'));
  return app;
}

async function requestApp(app, { path = '/ok', headers = {} } = {}) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();

  try {
    return await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers: {
            Host: 'example.com',
            ...headers,
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        }
      );

      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('configureSecurity sets trust proxy to one hop', () => {
  const app = express();
  configureSecurity(app, { env: 'test', trustProxy: 1 });

  assert.equal(app.get('trust proxy'), 1);
});

test('HTTPS redirect is skipped in development and test', async () => {
  for (const env of ['development', 'test']) {
    const response = await requestApp(createTestApp(env), {
      path: '/ok?from=http',
      headers: { 'X-Forwarded-Proto': 'http' },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers.location, undefined);
  }
});

test('production redirects HTTP requests to HTTPS', async () => {
  const response = await requestApp(createTestApp('production'), {
    path: '/ok',
    headers: { 'X-Forwarded-Proto': 'http' },
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, 'https://example.com/ok');
});

test('production redirect preserves path and query string', async () => {
  const response = await requestApp(createTestApp('production'), {
    path: '/deep/path?next=%2Fadmin&tab=security',
    headers: { 'X-Forwarded-Proto': 'http' },
  });

  assert.equal(response.statusCode, 308);
  assert.equal(response.headers.location, 'https://example.com/deep/path?next=%2Fadmin&tab=security');
});

test('production does not redirect HTTPS forwarded requests', async () => {
  const response = await requestApp(createTestApp('production'), {
    path: '/ok',
    headers: { 'X-Forwarded-Proto': 'https' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.location, undefined);
  assert.equal(response.body, 'ok');
});

test('production HTTPS requests include HSTS header from Helmet', async () => {
  const response = await requestApp(createTestApp('production'), {
    path: '/ok',
    headers: { 'X-Forwarded-Proto': 'https' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers['strict-transport-security'],
    'max-age=31536000; includeSubDomains'
  );
});
