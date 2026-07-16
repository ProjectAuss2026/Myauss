import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

const {
  getRetentionDays,
  getWarningDays,
  buildInactiveWarningEmail,
} = await import('./cleanupInactiveMembers.js');

test('getRetentionDays defaults to 21 when unset', () => {
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
  assert.equal(getRetentionDays(), 21);
});

test('getRetentionDays honours a valid override', () => {
  process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS = '30';
  assert.equal(getRetentionDays(), 30);
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
});

test('getRetentionDays falls back to default on invalid or non-positive values', () => {
  for (const bad of ['0', '-5', 'abc', '']) {
    process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS = bad;
    assert.equal(getRetentionDays(), 21);
  }
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
});

test('getWarningDays defaults to 7 and is clamped below the retention window', () => {
  delete process.env.MEMBERSHIP_INACTIVE_WARNING_DAYS;
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
  assert.equal(getWarningDays(), 7);

  // Never exceed the retention window (a warning must be possible).
  process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS = '5';
  assert.equal(getWarningDays(), 5);
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
});

test('getWarningDays honours a valid override', () => {
  process.env.MEMBERSHIP_INACTIVE_WARNING_DAYS = '3';
  assert.equal(getWarningDays(), 3);
  delete process.env.MEMBERSHIP_INACTIVE_WARNING_DAYS;
});

test('buildInactiveWarningEmail includes the countdown and escapes the name', () => {
  const email = buildInactiveWarningEmail({ name: 'Sam <b>', daysUntilDeletion: 7 });
  assert.match(email.subject, /inactive/i);
  assert.match(email.text, /7 days/);
  assert.match(email.html, /7 days/);
  // Raw name must not leak unescaped into HTML.
  assert.ok(!email.html.includes('<b>'));
  assert.match(email.html, /Sam &lt;b&gt;/);
});

test('buildInactiveWarningEmail handles a missing name and singular day', () => {
  const email = buildInactiveWarningEmail({ name: null, daysUntilDeletion: 1 });
  assert.match(email.text, /^Hi,/);
  assert.match(email.text, /1 day\b/);
  assert.ok(!/1 days/.test(email.text));
});
