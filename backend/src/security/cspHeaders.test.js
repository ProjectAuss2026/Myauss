import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// The QR check-in scanner (KAN-180) decodes frames in a worker qr-scanner
// creates from a blob URL. The Vite dev/preview policy allowed it, but the
// Express helmet policy that governs the single-service production deploy built
// its directives separately and had no worker-src at all — so it fell back to
// script-src, blob: was blocked, and scanning produced no verdict whatsoever in
// production while working locally. These assert the header the browser
// actually receives, not the helper that builds it: the defect was the two
// policies drifting apart, which a helper-level test would not have caught.

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';
process.env.JWT_SECRET = 'csp-header-test-secret';
process.env.STUDENT_ID_PEPPER ||= 'csp-header-test-pepper';

globalThis.prisma = {};

const { createApp } = await import('../app.js');
const { getCspDirectives } = await import('../../../shared/securityHeaders.mjs');

// Must be a route that returns 200: Express's finalhandler replaces the CSP
// with "default-src 'none'" on a 404, which would mask the header under test.
async function cspHeaderFor(path) {
  const server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path, method: 'GET', headers: { Host: 'example.com' } },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.headers['content-security-policy'] ?? ''));
        },
      );
      req.on('error', reject);
      req.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function directive(csp, name) {
  const found = csp.split(';').map((d) => d.trim()).find((d) => d === name || d.startsWith(`${name} `));
  return found ? found.slice(name.length).trim().split(/\s+/) : null;
}

test('the served CSP allows the blob: worker the QR scanner needs', async () => {
  const csp = await cspHeaderFor('/api/test');
  const workerSrc = directive(csp, 'worker-src');

  // Must be an explicit directive: worker-src falls back to script-src, so
  // relying on the fallback is exactly the bug this guards.
  assert.notEqual(workerSrc, null, `worker-src missing from CSP: ${csp}`);
  assert.ok(workerSrc.includes('blob:'), `worker-src must allow blob:, got: ${workerSrc}`);
  assert.ok(workerSrc.includes("'self'"), `worker-src must allow 'self', got: ${workerSrc}`);
});

test('allowing the scanner worker does not widen script-src to blob:', async () => {
  const csp = await cspHeaderFor('/api/test');
  const scriptSrc = directive(csp, 'script-src');

  assert.ok(scriptSrc, `script-src missing from CSP: ${csp}`);
  assert.ok(!scriptSrc.includes('blob:'), `script-src must not allow blob:, got: ${scriptSrc}`);
  assert.ok(!scriptSrc.includes("'unsafe-eval'"), `script-src must not allow unsafe-eval, got: ${scriptSrc}`);
});

function parseCsp(csp) {
  return Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );
}

// Guards the whole class of bug, not just worker-src: someone adding a directive
// (media-src for a video feature, say) will edit shared/securityHeaders.mjs, see
// it work on the Vite dev server, and never touch app.js. This fails if the
// served header adds, drops or changes anything relative to the shared policy —
// a directive hand-written back into app.js, or helmet defaults merged in again.
test('the served CSP is exactly the shared policy, directive for directive', async () => {
  const served = parseCsp(await cspHeaderFor('/api/test'));
  const expected = getCspDirectives({
    env: process.env,
    allowWebSockets: process.env.NODE_ENV !== 'production',
    upgradeInsecureRequests: true,
  });

  assert.deepEqual(served, expected);
});
