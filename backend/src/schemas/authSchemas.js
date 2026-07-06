import { z } from 'zod';
import { LIMITS, requiredTrimmedString, optionalTrimmedString } from './commonSchemas.js';

const email = requiredTrimmedString('Email', LIMITS.email).email({ message: 'Email must be a valid email address' });
const password = z
  .string()
  .min(12, { message: 'Password must be at least 12 characters' })
  .max(LIMITS.password, { message: `Password must be ${LIMITS.password} characters or fewer` });

export const registerBodySchema = z.object({
  email,
  password,
  role: z.enum(['executive']).optional(),
  execCode: optionalTrimmedString('Executive invitation code', LIMITS.execCode),
  firstName: requiredTrimmedString('First name', LIMITS.personName),
  lastName: requiredTrimmedString('Last name', LIMITS.personName),
  studentId: requiredTrimmedString('Student ID', LIMITS.studentId),
});

export const loginBodySchema = z.object({
  email,
  password,
});

export const resendCodeBodySchema = z.object({
  email,
});

export const verifyBodySchema = z.object({
  email,
  code: requiredTrimmedString('Verification code', 6).regex(/^\d{6}$/, {
    message: 'Verification code must be 6 digits',
  }),
});

export const registerSchema = { body: registerBodySchema };
export const loginSchema = { body: loginBodySchema };
export const resendCodeSchema = { body: resendCodeBodySchema };
export const verifySchema = { body: verifyBodySchema };
