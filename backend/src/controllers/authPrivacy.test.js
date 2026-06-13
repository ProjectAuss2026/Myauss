import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { hashStudentId } from '../utils/studentIdHash.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';
process.env.JWT_SECRET = 'privacy-test-secret';
process.env.STUDENT_ID_PEPPER = 'privacy-test-pepper';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

const STRONG_TEST_PASSWORD = 'CorrectHorseBatteryStaple!2026';

const calls = [];
const usersByEmail = new Map();
const usersById = new Map();

function record(name, args) {
  calls.push({ name, args });
}

function makeUser(data) {
  return {
    id: data.id || `user-${usersById.size + 1}`,
    email: data.email,
    passwordHash: data.passwordHash || 'hashed-password',
    role: data.role || 'USER',
    tokenVersion: data.tokenVersion ?? 0,
    isVerified: data.isVerified ?? false,
    lastCodeSentAt: data.lastCodeSentAt || new Date(),
    verificationExpiresAt: data.verificationExpiresAt || new Date(Date.now() + 60000),
    info: data.info ?? null,
  };
}

function storeUser(user) {
  usersByEmail.set(user.email, user);
  usersById.set(user.id, user);
  return user;
}

globalThis.prisma = {
  user: {
    findUnique: async (args) => {
      record('user.findUnique', args);
      if (args.where.email) return usersByEmail.get(args.where.email) || null;
      if (args.where.id) return usersById.get(args.where.id) || null;
      return null;
    },
    create: async (args) => {
      record('user.create', args);
      const user = makeUser({
        id: 'created-user',
        email: args.data.email,
        passwordHash: args.data.passwordHash,
        role: args.data.role,
        isVerified: args.data.isVerified,
        lastCodeSentAt: args.data.lastCodeSentAt,
        verificationExpiresAt: args.data.verificationExpiresAt,
        info: {
          id: 'info-created-user',
          userId: 'created-user',
          ...args.data.info.create,
        },
      });
      return storeUser(user);
    },
    update: async (args) => {
      record('user.update', args);
      const user = usersByEmail.get(args.where.email);
      if (!user) throw Object.assign(new Error('User not found'), { code: 'P2025' });
      Object.assign(user, args.data);
      if (args.data.info?.upsert) {
        user.info = {
          id: user.info?.id || `info-${user.id}`,
          userId: user.id,
          ...(user.info ? args.data.info.upsert.update : args.data.info.upsert.create),
        };
      }
      return user;
    },
  },
  userInfo: {
    delete: async (args) => {
      record('userInfo.delete', args);
      const user = usersById.get(args.where.userId);
      if (!user?.info) throw Object.assign(new Error('UserInfo not found'), { code: 'P2025' });
      const deleted = user.info;
      user.info = null;
      return deleted;
    },
  },
  otpCode: {
    upsert: async (args) => {
      record('otpCode.upsert', args);
      return { id: 'otp-code-1', userId: args.where.userId, ...args.create, ...args.update };
    },
  },
};

const { default: authController } = await import('./auth.controller.js');

function resetState() {
  calls.length = 0;
  usersByEmail.clear();
  usersById.clear();
  process.env.STUDENT_ID_PEPPER = 'privacy-test-pepper';
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authController);
  return app;
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
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

function authToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, tv: user.tokenVersion, type: 'access' },
    process.env.JWT_SECRET,
    { issuer: 'auss-api', audience: 'auss-web' },
  );
}

test('register stores a hashed student ID instead of plaintext', async () => {
  resetState();

  const response = await requestApp(createApp(), {
    method: 'POST',
    path: '/api/auth/register',
    body: {
      email: 'member@example.com',
      password: STRONG_TEST_PASSWORD,
      firstName: 'Ava',
      lastName: 'Member',
      studentId: ' 123456789 ',
    },
  });

  assert.equal(response.statusCode, 200);
  const createCall = calls.find((call) => call.name === 'user.create');
  const storedStudentId = createCall.args.data.info.create.studentId;
  assert.equal(storedStudentId, hashStudentId('123456789', { pepper: 'privacy-test-pepper' }));
  assert.notEqual(storedStudentId, '123456789');
  assert.notEqual(storedStudentId, ' 123456789 ');
});

test('register fails safely when STUDENT_ID_PEPPER is missing', async () => {
  resetState();
  delete process.env.STUDENT_ID_PEPPER;

  const response = await requestApp(createApp(), {
    method: 'POST',
    path: '/api/auth/register',
    body: {
      email: 'member@example.com',
      password: STRONG_TEST_PASSWORD,
      firstName: 'Ava',
      lastName: 'Member',
      studentId: '123456789',
    },
  });

  assert.equal(response.statusCode, 500);
  assert.equal(response.json.error, 'Student ID storage is not configured');
  assert.equal(calls.some((call) => call.name === 'user.create'), false);
});

test('authenticated user APIs do not return raw or hashed student ID', async () => {
  resetState();
  const user = storeUser(makeUser({
    id: 'user-1',
    email: 'member@example.com',
    role: 'USER',
    isVerified: true,
    info: {
      id: 'info-user-1',
      userId: 'user-1',
      firstName: 'Ava',
      lastName: 'Member',
      studentId: hashStudentId('123456789', { pepper: 'privacy-test-pepper' }),
    },
  }));

  const response = await requestApp(createApp(), {
    path: '/api/auth/me',
    token: authToken(user),
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.user.studentId, null);
  assert.equal(response.text.includes('123456789'), false);
  assert.equal(response.text.includes(user.info.studentId), false);
});

test('authenticated users can delete their stored user info record', async () => {
  resetState();
  const user = storeUser(makeUser({
    id: 'user-2',
    email: 'member2@example.com',
    role: 'USER',
    isVerified: true,
    info: {
      id: 'info-user-2',
      userId: 'user-2',
      firstName: 'Kai',
      lastName: 'Member',
      studentId: hashStudentId('987654321', { pepper: 'privacy-test-pepper' }),
    },
  }));

  const response = await requestApp(createApp(), {
    method: 'DELETE',
    path: '/api/auth/me/info',
    token: authToken(user),
  });

  assert.equal(response.statusCode, 204);
  assert.equal(user.info, null);
  assert.deepEqual(calls.find((call) => call.name === 'userInfo.delete').args, {
    where: { userId: 'user-2' },
  });
});
