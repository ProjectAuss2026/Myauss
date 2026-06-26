import { createHash } from 'node:crypto';

export class StudentIdHashError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StudentIdHashError';
  }
}

export function normalizeStudentId(studentId) {
  return String(studentId ?? '').trim();
}

export function getStudentIdPepper(env = process.env) {
  const pepper = env.STUDENT_ID_PEPPER;
  if (!pepper) {
    throw new StudentIdHashError('STUDENT_ID_PEPPER is required to store student IDs.');
  }
  return pepper;
}

export function hashStudentId(studentId, options = {}) {
  const normalized = normalizeStudentId(studentId);
  if (!normalized) {
    throw new StudentIdHashError('Student ID is required.');
  }

  const pepper = options.pepper ?? getStudentIdPepper(options.env);
  return createHash('sha256').update(`${normalized}${pepper}`).digest('hex');
}

export function isStudentIdHashError(error) {
  return error instanceof StudentIdHashError;
}
