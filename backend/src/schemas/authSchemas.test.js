import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBodySchema } from './authSchemas.js';

const validRegistration = {
  email: 'member@example.com',
  password: 'CorrectHorseBatteryStaple!2026',
  firstName: 'Alex',
  lastName: 'Member',
  privacyPolicyConsent: true,
  membershipAgreementConsent: true,
};

test('registration requires affirmative Privacy Policy consent', () => {
  assert.equal(
    registerBodySchema.safeParse({
      ...validRegistration,
      privacyPolicyConsent: false,
    }).success,
    false,
  );
  const { privacyPolicyConsent: _omitted, ...withoutPrivacyConsent } =
    validRegistration;
  assert.equal(registerBodySchema.safeParse(withoutPrivacyConsent).success, false);
});

test('registration requires affirmative membership agreement consent', () => {
  assert.equal(
    registerBodySchema.safeParse({
      ...validRegistration,
      membershipAgreementConsent: false,
    }).success,
    false,
  );
  const { membershipAgreementConsent: _omitted, ...withoutMembershipConsent } =
    validRegistration;
  assert.equal(registerBodySchema.safeParse(withoutMembershipConsent).success, false);
});

test('registration accepts an omitted student ID', () => {
  const result = registerBodySchema.parse(validRegistration);

  assert.equal(result.studentId, undefined);
});

test('registration normalises blank student IDs to null', () => {
  assert.equal(
    registerBodySchema.parse({ ...validRegistration, studentId: '' }).studentId,
    null,
  );
  assert.equal(
    registerBodySchema.parse({ ...validRegistration, studentId: '   ' }).studentId,
    null,
  );
});

test('registration trims a supplied student ID', () => {
  const result = registerBodySchema.parse({
    ...validRegistration,
    studentId: ' 123456789 ',
  });

  assert.equal(result.studentId, '123456789');
});
