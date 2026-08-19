import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBodySchema } from './authSchemas.js';

const validRegistration = {
  email: 'member@example.com',
  password: 'CorrectHorseBatteryStaple!2026',
  firstName: 'Alex',
  lastName: 'Member',
};

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
