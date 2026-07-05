import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

const { getRetentionDays } = await import('./cleanupInactiveMembers.js');

test('getRetentionDays defaults to 90 when unset', () => {
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
  assert.equal(getRetentionDays(), 90);
});

test('getRetentionDays honours a valid override', () => {
  process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS = '30';
  assert.equal(getRetentionDays(), 30);
});

test('getRetentionDays falls back to default on invalid or non-positive values', () => {
  for (const bad of ['0', '-5', 'abc', '']) {
    process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS = bad;
    assert.equal(getRetentionDays(), 90);
  }
  delete process.env.MEMBERSHIP_INACTIVE_RETENTION_DAYS;
});
