import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBodySchema } from './authSchemas.js';

const validRegistration = {
  email: 'member@example.com',
  password: 'CorrectHorseBatteryStaple!2026',
  firstName: 'Alex',
  lastName: 'Member',
  privacyPolicyAccepted: true,
  membershipAgreementAccepted: true,
};

test('registration requires Privacy Policy acceptance', () => {
  const omitted = { ...validRegistration };
  delete omitted.privacyPolicyAccepted;

  assert.equal(registerBodySchema.safeParse(omitted).success, false);
  assert.equal(
    registerBodySchema.safeParse({
      ...validRegistration,
      privacyPolicyAccepted: false,
    }).success,
    false,
  );
});

test('registration requires the membership agreement', () => {
  const omitted = { ...validRegistration };
  delete omitted.membershipAgreementAccepted;

  assert.equal(registerBodySchema.safeParse(omitted).success, false);
  assert.equal(
    registerBodySchema.safeParse({
      ...validRegistration,
      membershipAgreementAccepted: false,
    }).success,
    false,
  );
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
