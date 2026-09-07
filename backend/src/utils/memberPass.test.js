import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemberPass,
  parseMemberPass,
  verifyMemberPass,
  isMemberPassError,
} from './memberPass.js';

const SECRET = 'test-qr-pass-secret';
const OTHER_SECRET = 'a-different-secret';
const USER = { id: '5f5ed735-69a0-4f60-93c1-a0f6859404f7', qrVersion: 1 };

const build = (user = USER) => buildMemberPass(user, { secret: SECRET });
const verify = (pass, version, secret = SECRET) =>
  verifyMemberPass(parseMemberPass(pass), version, { secret });

test('a freshly issued pass verifies against the current version', () => {
  assert.equal(verify(build(), 1), true);
});

test('the payload carries the user id so the scanner has a candidate to check', () => {
  const parsed = parseMemberPass(build());
  assert.equal(parsed.userId, USER.id);
  assert.equal(parsed.qrVersion, 1);
});

test('the pass is stable across calls — a screenshot keeps working offline', () => {
  assert.equal(build(), build());
});

test('a forged signature is rejected', () => {
  const [id, version] = build().split(':');
  const forged = `${id}:${version}:${'a'.repeat(64)}`;
  assert.equal(verify(forged, 1), false);
});

test('knowing the user id is not enough to forge a pass', () => {
  // The UUID is already public (/me, admin roster) — the secret is what protects it.
  const attacker = buildMemberPass(USER, { secret: OTHER_SECRET });
  assert.equal(verify(attacker, 1), false);
});

test('a pass for one member does not verify as another', () => {
  const other = buildMemberPass({ id: 'someone-else', qrVersion: 1 }, { secret: SECRET });
  const parsed = parseMemberPass(other);
  // Same shape, but the signature is bound to the other id.
  assert.notEqual(parsed.userId, USER.id);
  assert.equal(verifyMemberPass({ ...parsed, userId: USER.id }, 1, { secret: SECRET }), false);
});

test('bumping qrVersion revokes the old pass (reset my pass)', () => {
  const oldPass = build();
  assert.equal(verify(oldPass, 1), true);

  // Member hits "reset" -> stored qrVersion becomes 2. The screenshot they (or
  // whoever they shared it with) still hold must stop working.
  assert.equal(verify(oldPass, 2), false);

  // ...and the newly issued pass works, with nobody else affected.
  const newPass = build({ ...USER, qrVersion: 2 });
  assert.equal(verify(newPass, 2), true);
  assert.notEqual(oldPass, newPass);
});

test('parse rejects malformed or unreadable codes before any lookup', () => {
  for (const bad of [
    null,
    undefined,
    42,
    '',
    'not-a-pass',
    'a:b',                                  // too few parts
    `${USER.id}:1:2:3`,                     // too many parts
    `${USER.id}:0:${'a'.repeat(64)}`,       // version must be >= 1
    `${USER.id}:x:${'a'.repeat(64)}`,       // non-numeric version
    `${USER.id}:1:zz`,                      // signature not 64 hex chars
    `:1:${'a'.repeat(64)}`,                 // empty id
    `AUSS-MEMBER-someone@example.com`,      // the old pre-KAN-180 payload
  ]) {
    assert.equal(parseMemberPass(bad), null, JSON.stringify(bad));
  }
});

test('verify rejects a null parse rather than throwing', () => {
  assert.equal(verifyMemberPass(null, 1, { secret: SECRET }), false);
});

test('issuing without a configured secret fails loudly', () => {
  assert.throws(
    () => buildMemberPass(USER, { env: {} }),
    (err) => isMemberPassError(err) && /QR_PASS_SECRET/.test(err.message),
  );
});
