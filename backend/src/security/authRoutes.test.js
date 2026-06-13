import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import {
  ADMIN_ROUTE_KEYS,
  AUTHENTICATED_ROUTE_KEYS,
  CLASSIFIED_ROUTE_KEYS,
  PUBLIC_ROUTE_KEYS,
  PUBLIC_ROUTES,
  routeKey,
} from './publicRoutes.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';
process.env.JWT_SECRET = 'route-auth-test-secret';
process.env.STUDENT_ID_PEPPER ||= 'route-auth-test-pepper';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const prismaCalls = [];

function record(name, args) {
  prismaCalls.push({ name, args });
}

globalThis.prisma = {
  user: {
    findUnique: async (args) => {
      record('user.findUnique', args);
      if (args.where.id === 'user-token') {
        return {
          id: 'user-token',
          email: 'member@example.com',
          role: 'USER',
          tokenVersion: 0,
          info: { firstName: 'Member', lastName: 'User', studentId: 'redacted-hash' },
        };
      }
      if (args.where.id === 'admin-token') {
        return {
          id: 'admin-token',
          email: 'admin@example.com',
          role: 'ADMIN',
          tokenVersion: 0,
          info: { firstName: 'Admin', lastName: 'User', studentId: 'redacted-hash' },
        };
      }
      return null;
    },
    deleteMany: async (args) => {
      record('user.deleteMany', args);
      return { count: 0 };
    },
  },
  userInfo: {
    delete: async (args) => {
      record('userInfo.delete', args);
      return { id: 'info-1', userId: args.where.userId };
    },
  },
  activity: {
    findMany: async (args) => {
      record('activity.findMany', args);
      return [];
    },
    findUnique: async (args) => {
      record('activity.findUnique', args);
      return { id: args.where.id, isPublished: true, capacity: null, imageUrl: null, startTime: new Date(), endTime: new Date() };
    },
    create: async (args) => {
      record('activity.create', args);
      return { id: 1, ...args.data };
    },
    update: async (args) => {
      record('activity.update', args);
      return { id: args.where.id, ...args.data };
    },
    delete: async (args) => {
      record('activity.delete', args);
      return { id: args.where.id };
    },
  },
  rsvp: {
    count: async (args) => {
      record('rsvp.count', args);
      return 0;
    },
    findMany: async (args) => {
      record('rsvp.findMany', args);
      return [];
    },
    findUnique: async (args) => {
      record('rsvp.findUnique', args);
      return { id: args.where.id, activityId: 1 };
    },
    delete: async (args) => {
      record('rsvp.delete', args);
      return { id: args.where.id };
    },
  },
  communicationLink: {
    findMany: async (args) => {
      record('communicationLink.findMany', args);
      return [];
    },
  },
  mediaConfig: {
    findFirst: async (args) => {
      record('mediaConfig.findFirst', args);
      return { id: 1, mediaDriveUrl: 'https://example.com/photos' };
    },
  },
  sponsorshipPage: {
    findMany: async (args) => {
      record('sponsorshipPage.findMany', args);
      return [];
    },
    findFirst: async (args) => {
      record('sponsorshipPage.findFirst', args);
      return { id: 1, pageContent: 'Sponsors', sponsors: [], updatedAt: new Date() };
    },
  },
  sponsor: {
    delete: async (args) => {
      record('sponsor.delete', args);
      return { id: args.where.id };
    },
  },
  mediaEntry: {
    findFirst: async (args) => {
      record('mediaEntry.findFirst', args);
      return null;
    },
    findMany: async (args) => {
      record('mediaEntry.findMany', args);
      return [];
    },
    delete: async (args) => {
      record('mediaEntry.delete', args);
      return { id: args.where.id };
    },
  },
};

const { createApp } = await import('../app.js');

function normalizePath(path) {
  if (path === '/') return '';
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function joinPaths(prefix, path) {
  const normalizedPrefix = normalizePath(prefix);
  const normalizedPath = normalizePath(path);
  if (!normalizedPath) return normalizedPrefix || '/';
  const pathSegment = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  const joined = `${normalizedPrefix}${pathSegment}`;
  return joined || '/';
}

function regexpMountPath(regexp) {
  if (regexp.fast_slash) return '';
  let source = regexp.source
    .replace(String.raw`^\/`, '/')
    .replace(String.raw`\/?(?=\/|$)`, '')
    .replace(String.raw`(?=\/|$)`, '')
    .replace(String.raw`\/?$`, '')
    .replaceAll(String.raw`\/`, '/')
    .replaceAll(String.raw`\.`, '.')
    .replace(/\$$/, '');

  if (source === '^') return '';
  if (!source.startsWith('/')) source = `/${source}`;
  return source;
}

function middlewareNames(routeStack) {
  return routeStack.map((layer) => layer.handle.authType || layer.handle.name || '<anonymous>');
}

function routeRequiresAuthenticate(routeStack) {
  return routeStack.some((layer) => layer.handle.authType === 'authenticate');
}

function routeRequiresAdmin(routeStack) {
  return routeStack.some(
    (layer) => layer.handle.authType === 'authorise' && layer.handle.requiredRoles?.includes('ADMIN'),
  );
}

function collectRoutes(stack, prefix = '') {
  const routes = [];

  for (const layer of stack) {
    if (layer.route) {
      const path = joinPaths(prefix, layer.route.path);
      for (const methodName of Object.keys(layer.route.methods)) {
        const method = methodName.toUpperCase();
        routes.push({
          method,
          path,
          key: routeKey({ method, path }),
          stack: layer.route.stack,
          middleware: middlewareNames(layer.route.stack),
        });
      }
      continue;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      routes.push(...collectRoutes(layer.handle.stack, joinPaths(prefix, regexpMountPath(layer.regexp))));
    }
  }

  return routes;
}

function appRoutes() {
  return collectRoutes(createApp()._router.stack).sort((a, b) => a.key.localeCompare(b.key));
}

function authToken(role) {
  const id = role === 'ADMIN' ? 'admin-token' : 'user-token';
  return jwt.sign(
    { sub: id, role, tv: 0, type: 'access' },
    process.env.JWT_SECRET,
    { issuer: 'auss-api', audience: 'auss-web' },
  );
}

async function requestApp(app, { method = 'GET', path, body, token } = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            Host: 'example.com',
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let json = null;
            if (text) {
              try {
                json = JSON.parse(text);
              } catch {
                json = null;
              }
            }
            resolve({ statusCode: res.statusCode, headers: res.headers, text, json });
          });
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function assertStatusNotAuthFailure(response) {
  assert.notEqual(response.statusCode, 401, response.text);
  assert.notEqual(response.statusCode, 403, response.text);
}

test('PUBLIC_ROUTES has no duplicate entries', () => {
  assert.equal(PUBLIC_ROUTE_KEYS.size, PUBLIC_ROUTES.length);
});

test('all route security classifications are unique', () => {
  const totalClassified = PUBLIC_ROUTE_KEYS.size + AUTHENTICATED_ROUTE_KEYS.size + ADMIN_ROUTE_KEYS.size;
  assert.equal(CLASSIFIED_ROUTE_KEYS.size, totalClassified);
});

test('every Express route is classified as public, authenticated, or admin', () => {
  const actualRouteKeys = appRoutes().map((route) => route.key);
  assert.deepEqual(
    actualRouteKeys.filter((key) => !CLASSIFIED_ROUTE_KEYS.has(key)),
    [],
  );
});

test('every non-public Express route requires authentication', () => {
  const missingAuth = appRoutes()
    .filter((route) => !PUBLIC_ROUTE_KEYS.has(route.key))
    .filter((route) => !routeRequiresAuthenticate(route.stack))
    .map((route) => `${route.key} via ${route.middleware.join(' -> ')}`);

  assert.deepEqual(missingAuth, []);
});

test('every admin route requires authorise ADMIN', () => {
  const missingAdminAuthorise = appRoutes()
    .filter((route) => ADMIN_ROUTE_KEYS.has(route.key))
    .filter((route) => !routeRequiresAdmin(route.stack))
    .map((route) => `${route.key} via ${route.middleware.join(' -> ')}`);

  assert.deepEqual(missingAdminAuthorise, []);
});

test('every unauthenticated Express route is intentionally public', () => {
  const unlistedPublicRoutes = appRoutes()
    .filter((route) => !routeRequiresAuthenticate(route.stack))
    .filter((route) => !PUBLIC_ROUTE_KEYS.has(route.key))
    .map((route) => route.key);

  assert.deepEqual(unlistedPublicRoutes, []);
});

test('PUBLIC_ROUTES only lists implemented API routes or static uploads', () => {
  const actualRouteKeys = new Set(appRoutes().map((route) => route.key));
  const stalePublicRoutes = PUBLIC_ROUTES
    .map(routeKey)
    .filter((key) => key !== 'GET /uploads/*')
    .filter((key) => !actualRouteKeys.has(key));

  assert.deepEqual(stalePublicRoutes, []);
});

test('admin config mutation rejects missing token, rejects USER, and accepts ADMIN to validation', async () => {
  const app = createApp();
  const noToken = await requestApp(app, { method: 'PATCH', path: '/api/config', body: {} });
  const userToken = await requestApp(app, { method: 'PATCH', path: '/api/config', body: {}, token: authToken('USER') });
  const adminToken = await requestApp(app, { method: 'PATCH', path: '/api/config', body: {}, token: authToken('ADMIN') });

  assert.equal(noToken.statusCode, 401);
  assert.equal(userToken.statusCode, 403);
  assert.equal(adminToken.statusCode, 400);
  assert.equal(adminToken.json.error, 'Validation failed');
});

test('activity creation rejects missing token, rejects USER, and accepts ADMIN to validation', async () => {
  const app = createApp();
  const noToken = await requestApp(app, { method: 'POST', path: '/api/activities', body: {} });
  const userToken = await requestApp(app, { method: 'POST', path: '/api/activities', body: {}, token: authToken('USER') });
  const adminToken = await requestApp(app, { method: 'POST', path: '/api/activities', body: {}, token: authToken('ADMIN') });

  assert.equal(noToken.statusCode, 401);
  assert.equal(userToken.statusCode, 403);
  assert.equal(adminToken.statusCode, 400);
  assert.equal(adminToken.json.error, 'Validation failed');
});

test('activity update and delete are admin-only', async () => {
  const app = createApp();

  const updateNoToken = await requestApp(app, { method: 'PATCH', path: '/api/activities/1', body: {} });
  const updateUser = await requestApp(app, { method: 'PATCH', path: '/api/activities/1', body: {}, token: authToken('USER') });
  const updateAdmin = await requestApp(app, { method: 'PATCH', path: '/api/activities/1', body: {}, token: authToken('ADMIN') });
  const deleteNoToken = await requestApp(app, { method: 'DELETE', path: '/api/activities/1' });
  const deleteUser = await requestApp(app, { method: 'DELETE', path: '/api/activities/1', token: authToken('USER') });
  const deleteAdmin = await requestApp(app, { method: 'DELETE', path: '/api/activities/1', token: authToken('ADMIN') });

  assert.equal(updateNoToken.statusCode, 401);
  assert.equal(updateUser.statusCode, 403);
  assert.equal(updateAdmin.statusCode, 400);
  assert.equal(deleteNoToken.statusCode, 401);
  assert.equal(deleteUser.statusCode, 403);
  assertStatusNotAuthFailure(deleteAdmin);
});

test('RSVP attendee admin routes reject USER and allow ADMIN through ownership checks', async () => {
  const app = createApp();

  const listNoToken = await requestApp(app, { path: '/api/activities/1/rsvps' });
  const listUser = await requestApp(app, { path: '/api/activities/1/rsvps', token: authToken('USER') });
  const listAdmin = await requestApp(app, { path: '/api/activities/1/rsvps', token: authToken('ADMIN') });
  const deleteWrongActivity = await requestApp(app, {
    method: 'DELETE',
    path: '/api/activities/2/rsvps/1',
    token: authToken('ADMIN'),
  });

  assert.equal(listNoToken.statusCode, 401);
  assert.equal(listUser.statusCode, 403);
  assertStatusNotAuthFailure(listAdmin);
  assert.equal(deleteWrongActivity.statusCode, 404);
  assert.equal(deleteWrongActivity.json.error, 'RSVP not found');
});

test('authenticated profile route rejects missing token and returns only the matching user', async () => {
  const app = createApp();
  prismaCalls.length = 0;

  const noToken = await requestApp(app, { path: '/api/auth/me' });
  const userToken = await requestApp(app, { path: '/api/auth/me', token: authToken('USER') });

  assert.equal(noToken.statusCode, 401);
  assert.equal(userToken.statusCode, 200);
  assert.equal(userToken.json.user.id, 'user-token');
  assert.equal(userToken.json.user.studentId, null);
  assert.deepEqual(prismaCalls.find((call) => call.name === 'user.findUnique').args.where, { id: 'user-token' });
});