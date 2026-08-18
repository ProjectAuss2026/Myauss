import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail } from './emailValidation.js';

test('accepts well-formed emails (and trims first)', () => {
  for (const e of [
    'a@b.co',
    'user.name+tag@example.com',
    '  spaced@example.org  ',
    'x@sub.domain.ac.nz',
  ]) {
    assert.equal(isValidEmail(e), true, e);
  }
});

test('rejects malformed emails', () => {
  for (const e of ['', '   ', 'no-at', 'no@domain', 'trailing@dot.', '@example.com', 'a b@example.com']) {
    assert.equal(isValidEmail(e), false, JSON.stringify(e));
  }
});

test('rejects single-char TLD (standardised on the stricter >=2 variant)', () => {
  assert.equal(isValidEmail('a@b.c'), false);
});

test('rejects non-string input', () => {
  for (const v of [null, undefined, 123, {}, [], true]) {
    assert.equal(isValidEmail(v), false);
  }
});

test('rejects emails over the 254-char limit but accepts at the boundary', () => {
  const at = 'a'.repeat(64) + '@' + 'b'.repeat(185) + '.com'; // exactly 254, valid shape
  assert.equal(at.length, 254);
  assert.equal(isValidEmail(at), true);

  const over = 'a'.repeat(65) + '@' + 'b'.repeat(185) + '.com'; // 255
  assert.equal(over.length, 255);
  assert.equal(isValidEmail(over), false);
});

test('returns fast on a hostile ReDoS input — length cap short-circuits before the regex', () => {
  // The email regex has polynomial backtracking; without the pre-regex length
  // cap this input would take seconds. Asserting bounded time (not just false)
  // is the regression guard: if someone reorders/removes the cap, this fails.
  const hostile = '!@!.' + '!.'.repeat(50000); // ~100k chars, classic ReDoS trigger
  const start = performance.now();
  const result = isValidEmail(hostile);
  const elapsedMs = performance.now() - start;

  assert.equal(result, false);
  assert.ok(
    elapsedMs < 100,
    `expected <100ms, took ${elapsedMs.toFixed(1)}ms — the length cap may have been bypassed`,
  );
});
