import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StudentIdHashError,
  hashStudentId,
  normalizeStudentId,
} from './studentIdHash.js';

test('normalizeStudentId trims whitespace', () => {
  assert.equal(normalizeStudentId('  123456789  '), '123456789');
});

test('hashStudentId stores a deterministic hash, not plaintext', () => {
  const hash = hashStudentId('123456789', { pepper: 'pepper-one' });

  assert.notEqual(hash, '123456789');
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, hashStudentId('123456789', { pepper: 'pepper-one' }));
});

test('hashStudentId normalizes whitespace before hashing', () => {
  const hash = hashStudentId('123456789', { pepper: 'pepper-one' });
  const whitespaceHash = hashStudentId('  123456789  ', { pepper: 'pepper-one' });

  assert.equal(whitespaceHash, hash);
});

test('hashStudentId fails safely when STUDENT_ID_PEPPER is missing', () => {
  assert.throws(
    () => hashStudentId('123456789', { env: {} }),
    StudentIdHashError
  );
});
