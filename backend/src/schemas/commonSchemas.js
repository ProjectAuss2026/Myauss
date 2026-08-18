import { z } from 'zod';
import {
  validateCommunicationImageUrl,
  validateOptionalPublicHttpUrl,
  validateOptionalPublicImageUrl,
  validatePublicHttpUrl,
  validatePublicImageUrl,
  UrlValidationError,
} from '../utils/urlValidation.js';

export const LIMITS = {
  email: 254,
  password: 128,
  personName: 80,
  studentId: 40,
  platform: 80,
  title: 150,
  description: 5000,
  shortDescription: 150,
  pageContent: 10000,
  url: 2048,
  execCode: 128,
};

export function requiredTrimmedString(fieldName, maxLength) {
  return z
    .string()
    .trim()
    .min(1, { message: `${fieldName} is required` })
    .max(maxLength, { message: `${fieldName} must be ${maxLength} characters or fewer` });
}

export function optionalTrimmedString(fieldName, maxLength) {
  return z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? null : value,
    z
      .string()
      .trim()
      .max(maxLength, { message: `${fieldName} must be ${maxLength} characters or fewer` })
      .nullable()
      .optional()
  );
}

function normalizeNumericString(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
}

export function positiveInt(fieldName) {
  return z.preprocess(
    normalizeNumericString,
    z
      .number()
      .int({ message: `${fieldName} must be a positive integer` })
      .min(1, { message: `${fieldName} must be a positive integer` })
  );
}

export function nonNegativeInt(fieldName) {
  return z.preprocess(
    normalizeNumericString,
    z
      .number()
      .int({ message: `${fieldName} must be a non-negative integer` })
      .min(0, { message: `${fieldName} must be a non-negative integer` })
  );
}

export function optionalNonNegativeInt(fieldName) {
  return z.preprocess(
    (value) => {
      if (value === '' || value === null) return null;
      if (value === undefined) return undefined;
      return normalizeNumericString(value);
    },
    z
      .number()
      .int({ message: `${fieldName} must be a non-negative integer` })
      .min(0, { message: `${fieldName} must be a non-negative integer` })
      .nullable()
      .optional()
  );
}

export const optionalBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean().optional());

export function requiredDate(fieldName) {
  return requiredTrimmedString(fieldName, 64).transform((value, ctx) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: `${fieldName} must be a valid date` });
      return z.NEVER;
    }
    return date;
  });
}

export function optionalDate(fieldName) {
  return z.string().trim().max(64, { message: `${fieldName} must be 64 characters or fewer` }).optional().transform((value, ctx) => {
    if (value === undefined) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: 'custom', message: `${fieldName} must be a valid date` });
      return z.NEVER;
    }
    return date;
  });
}

function asUrlValidationIssue(ctx, error, fallbackMessage) {
  ctx.addIssue({
    code: 'custom',
    message: error instanceof UrlValidationError ? error.message : fallbackMessage,
  });
  return z.NEVER;
}

export function publicHttpUrl(fieldName) {
  return requiredTrimmedString(fieldName, LIMITS.url).transform(async (value, ctx) => {
    try {
      return await validatePublicHttpUrl(value, { fieldName });
    } catch (error) {
      return asUrlValidationIssue(ctx, error, `${fieldName} must be a valid http or https URL.`);
    }
  });
}

export function optionalPublicHttpUrl(fieldName) {
  return z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(LIMITS.url, { message: `${fieldName} must be ${LIMITS.url} characters or fewer` }).nullable().optional()
  ).transform(async (value, ctx) => {
    if (value === undefined) return undefined;
    try {
      return await validateOptionalPublicHttpUrl(value, { fieldName });
    } catch (error) {
      return asUrlValidationIssue(ctx, error, `${fieldName} must be a valid http or https URL.`);
    }
  });
}

export function publicImageUrl(fieldName) {
  return requiredTrimmedString(fieldName, LIMITS.url).transform(async (value, ctx) => {
    try {
      return await validatePublicImageUrl(value, { fieldName });
    } catch (error) {
      return asUrlValidationIssue(ctx, error, `${fieldName} must be a valid image URL.`);
    }
  });
}

export function optionalPublicImageUrl(fieldName) {
  return z.preprocess(
    (value) => (value === '' ? null : value),
    z.string().trim().max(LIMITS.url, { message: `${fieldName} must be ${LIMITS.url} characters or fewer` }).nullable().optional()
  ).transform(async (value, ctx) => {
    if (value === undefined) return undefined;
    try {
      return await validateOptionalPublicImageUrl(value, { fieldName });
    } catch (error) {
      return asUrlValidationIssue(ctx, error, `${fieldName} must be a valid image URL.`);
    }
  });
}

export function communicationImageUrl() {
  return requiredTrimmedString('Communication link image URL', LIMITS.url).transform(async (value, ctx) => {
    try {
      return await validateCommunicationImageUrl(value);
    } catch (error) {
      return asUrlValidationIssue(ctx, error, 'Communication link image URL must be valid.');
    }
  });
}

export function atLeastOneProvided(message = 'At least one field must be provided') {
  return (value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({ code: 'custom', message });
    }
  };
}
