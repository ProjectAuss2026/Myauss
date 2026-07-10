import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://user:pass@localhost:5432/test';

const {
  getVerifiedDurationDays,
  buildMembershipExpiredEmail,
} = await import('./expireVerifiedMembers.js');

test('getVerifiedDurationDays defaults to 91 when unset', () => {
  delete process.env.MEMBERSHIP_VERIFIED_DURATION_DAYS;
  assert.equal(getVerifiedDurationDays(), 91);
});

test('getVerifiedDurationDays honours a valid override', () => {
  process.env.MEMBERSHIP_VERIFIED_DURATION_DAYS = '182';
  assert.equal(getVerifiedDurationDays(), 182);
  delete process.env.MEMBERSHIP_VERIFIED_DURATION_DAYS;
});

test('getVerifiedDurationDays falls back to default on invalid or non-positive values', () => {
  for (const bad of ['0', '-1', 'abc', '']) {
    process.env.MEMBERSHIP_VERIFIED_DURATION_DAYS = bad;
    assert.equal(getVerifiedDurationDays(), 91);
  }
  delete process.env.MEMBERSHIP_VERIFIED_DURATION_DAYS;
});

test('buildMembershipExpiredEmail greets by name and escapes it', () => {
  const email = buildMembershipExpiredEmail({ name: 'Al <script>' });
  assert.match(email.subject, /expired/i);
  assert.match(email.text, /^Hi Al <script>,/);
  assert.ok(!email.html.includes('<script>'));
  assert.match(email.html, /Al &lt;script&gt;/);
});

test('buildMembershipExpiredEmail handles a missing name', () => {
  const email = buildMembershipExpiredEmail({ name: null });
  assert.match(email.text, /^Hi,/);
});
