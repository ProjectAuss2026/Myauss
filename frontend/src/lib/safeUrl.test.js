import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafeImageSrc, getSafeLinkHref, getUrlHostname } from './safeUrl.ts';

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

test('getUrlHostname returns the lowercased host for http(s) URLs, null otherwise', () => {
  assert.equal(getUrlHostname('https://images.PIXIESET.com/a/b.jpg'), 'images.pixieset.com');
  assert.equal(getUrlHostname('https://pixieset.com/x?pid=1'), 'pixieset.com');
  // Substring / prefix spoof attempts must resolve to their REAL host, so an
  // exact `=== 'pixieset.com'` check correctly rejects them (KAN-168).
  assert.equal(getUrlHostname('https://evil.com/#pixieset.com'), 'evil.com');
  assert.equal(
    getUrlHostname('https://images.pixieset.com.evil.com/x'),
    'images.pixieset.com.evil.com'
  );
  // Non-http(s) and non-URLs.
  assert.equal(getUrlHostname('javascript:alert(1)'), null);
  assert.equal(getUrlHostname('not a url'), null);
  assert.equal(getUrlHostname(''), null);
  assert.equal(getUrlHostname(null), null);
});