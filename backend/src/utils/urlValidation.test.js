import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePublicHttpUrl,
  UrlValidationError,
  validateCommunicationImageUrl,
  validateOptionalPublicHttpUrl,
  validatePublicHttpUrl,
  validatePublicImageUrl,
} from './urlValidation.js';

const publicResolver = async () => ['93.184.216.34'];

async function assertInvalidUrl(promise) {
  await assert.rejects(promise, UrlValidationError);
}

test('validatePublicHttpUrl allows absolute http and https URLs', async () => {
  assert.equal(
    await validatePublicHttpUrl('https://example.com', { resolveHostname: publicResolver }),
    'https://example.com'
  );
  assert.equal(
    await validatePublicHttpUrl('http://example.com', { resolveHostname: publicResolver }),
    'http://example.com'
  );
});

test('validatePublicHttpUrl rejects unsafe schemes, malformed values, relative paths, and internal hosts', async () => {
  const invalidUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com',
    'file:///etc/passwd',
    'http://127.0.0.1',
    'http://localhost',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://0.0.0.0',
    'http://[::1]',
    'http://[fc00::1]',
    'http://[fe80::1]',
    '/admin',
    'not a url',
  ];

  for (const url of invalidUrls) {
    await assertInvalidUrl(validatePublicHttpUrl(url, { resolveHostname: publicResolver }));
  }
});

test('validatePublicHttpUrl rejects public hostnames that resolve to private addresses', async () => {
  await assertInvalidUrl(
    validatePublicHttpUrl('https://example.com', {
      resolveHostname: async () => ['10.0.0.5'],
    })
  );
});

test('resolvePublicHttpUrl returns public resolved addresses for pinned fetches', async () => {
  const resolved = await resolvePublicHttpUrl('https://example.com/path', {
    resolveHostname: publicResolver,
  });

  assert.equal(resolved.url, 'https://example.com/path');
  assert.deepEqual(resolved.resolvedAddresses, ['93.184.216.34']);
});

test('validateOptionalPublicHttpUrl allows missing, null, and empty optional values', async () => {
  assert.equal(await validateOptionalPublicHttpUrl(undefined), null);
  assert.equal(await validateOptionalPublicHttpUrl(null), null);
  assert.equal(await validateOptionalPublicHttpUrl(''), null);
});

test('validatePublicImageUrl allows safe http URLs and uploads paths', async () => {
  assert.equal(
    await validatePublicImageUrl('https://example.com/image.png', { resolveHostname: publicResolver }),
    'https://example.com/image.png'
  );
  assert.equal(
    await validatePublicImageUrl('http://example.com/image.png', { resolveHostname: publicResolver }),
    'http://example.com/image.png'
  );
  assert.equal(await validatePublicImageUrl('/uploads/example.png'), '/uploads/example.png');
});

test('validatePublicImageUrl rejects unsafe schemes and non-upload relative paths', async () => {
  const invalidImageUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com',
    'file:///etc/passwd',
    'http://127.0.0.1',
    'http://localhost',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.1',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://0.0.0.0',
    '/admin',
    '../uploads/example.png',
    '/uploads/../admin.png',
  ];

  for (const url of invalidImageUrls) {
    await assertInvalidUrl(validatePublicImageUrl(url, { resolveHostname: publicResolver }));
  }
});

test('validateCommunicationImageUrl preserves builtin icons but rejects unsafe icon URLs', async () => {
  assert.equal(await validateCommunicationImageUrl('__builtin__'), '__builtin__');
  await assertInvalidUrl(validateCommunicationImageUrl('/admin'));
});
