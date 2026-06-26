import { z } from 'zod';
import {
  LIMITS,
  atLeastOneProvided,
  optionalBoolean,
  optionalDate,
  optionalNonNegativeInt,
  optionalPublicHttpUrl,
  optionalPublicImageUrl,
  positiveInt,
  requiredDate,
  requiredTrimmedString,
} from './commonSchemas.js';

export const activityIdParamsSchema = z.object({
  id: positiveInt('Activity id'),
});

const createActivityBodySchema = z
  .object({
    title: requiredTrimmedString('Title', LIMITS.title),
    description: requiredTrimmedString('Description', LIMITS.description),
    startTime: requiredDate('Start time'),
    endTime: requiredDate('End time'),
    imageUrl: optionalPublicImageUrl('Activity image URL'),
    externalLink: optionalPublicHttpUrl('External link'),
    isPublished: optionalBoolean,
    capacity: optionalNonNegativeInt('Capacity'),
  })
  .superRefine((value, ctx) => {
    if (value.endTime <= value.startTime) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be after start time',
      });
    }
  });

const updateActivityBodySchema = z
  .object({
    title: requiredTrimmedString('Title', LIMITS.title).optional(),
    description: requiredTrimmedString('Description', LIMITS.description).optional(),
    startTime: optionalDate('Start time'),
    endTime: optionalDate('End time'),
    imageUrl: optionalPublicImageUrl('Activity image URL'),
    externalLink: optionalPublicHttpUrl('External link'),
    isPublished: optionalBoolean,
    capacity: optionalNonNegativeInt('Capacity'),
  })
  .superRefine(atLeastOneProvided('At least one activity field must be provided'));

export const createActivitySchema = { body: createActivityBodySchema };
export const updateActivitySchema = { params: activityIdParamsSchema, body: updateActivityBodySchema };
export const deleteActivitySchema = { params: activityIdParamsSchema };
