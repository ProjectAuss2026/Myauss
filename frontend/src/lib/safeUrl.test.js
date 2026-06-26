import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafeImageSrc, getSafeLinkHref } from './safeUrl.ts';

test('getSafeLinkHref rejects private IPv6 and IPv4-mapped IPv6 hosts', () => {
  const blockedUrls = [
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:7f00:1]/',
    'http://[::ffff:10.0.0.1]/',
    'http://[::ffff:a00:1]/',
    'http://[::ffff:192.168.1.1]/',
    'http://[::ffff:c0a8:101]/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[fe80::1]/',
  ];

  for (const url of blockedUrls) {
    assert.equal(getSafeLinkHref(url), null, url);
  }
});

test('getSafeLinkHref allows public IPv6 hosts', () => {
  const url = 'http://[2001:4860:4860::8888]/';
  assert.equal(getSafeLinkHref(url), url);
});

test('getSafeImageSrc applies the same external URL host checks', () => {
  assert.equal(getSafeImageSrc('http://[::ffff:127.0.0.1]/image.png'), null);
  assert.equal(
    getSafeImageSrc('http://[2001:4860:4860::8888]/image.png'),
    'http://[2001:4860:4860::8888]/image.png'
  );
});