import { z } from 'zod';
import {
  LIMITS,
  atLeastOneProvided,
  communicationImageUrl,
  nonNegativeInt,
  optionalBoolean,
  optionalPublicHttpUrl,
  optionalPublicImageUrl,
  optionalTrimmedString,
  positiveInt,
  publicHttpUrl,
  requiredTrimmedString,
} from './commonSchemas.js';

const configType = z.enum(['communicationLink', 'mediaConfig', 'sponsorshipPage', 'sponsor']);

const communicationLinkCreateData = z.object({
  platform: requiredTrimmedString('Platform', LIMITS.platform),
  url: publicHttpUrl('Communication link URL'),
  imgUrl: communicationImageUrl(),
  description: optionalTrimmedString('Description', LIMITS.shortDescription),
  isActive: optionalBoolean,
});

const communicationLinkPatchData = communicationLinkCreateData
  .partial()
  .superRefine(atLeastOneProvided('At least one communication link field must be provided'));

const mediaConfigData = z.object({
  mediaDriveUrl: publicHttpUrl('Photo Drive URL'),
});

const sponsorshipPageCreateData = z.object({
  pageContent: requiredTrimmedString('Page content', LIMITS.pageContent),
});

const sponsorshipPagePatchData = sponsorshipPageCreateData
  .partial()
  .superRefine(atLeastOneProvided('At least one sponsorship page field must be provided'));

const sponsorCreateData = z.object({
  name: requiredTrimmedString('Sponsor name', 120),
  logoUrl: optionalPublicImageUrl('Sponsor logo URL'),
  heroImageUrl: optionalPublicImageUrl('Sponsor hero image URL'),
  websiteUrl: optionalPublicHttpUrl('Sponsor website URL'),
  displayOrder: nonNegativeInt('Display order').optional(),
  sponsorshipPageId: positiveInt('Sponsorship page id'),
});

const sponsorPatchData = sponsorCreateData
  .partial()
  .superRefine(atLeastOneProvided('At least one sponsor field must be provided'));

export const postConfigBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('communicationLink'), data: communicationLinkCreateData }),
  z.object({ type: z.literal('mediaConfig'), data: mediaConfigData }),
  z.object({ type: z.literal('sponsorshipPage'), data: sponsorshipPageCreateData }),
  z.object({ type: z.literal('sponsor'), data: sponsorCreateData }),
]);

export const patchConfigBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('communicationLink'), id: positiveInt('id'), data: communicationLinkPatchData }),
  z.object({ type: z.literal('mediaConfig'), id: positiveInt('id').optional(), data: mediaConfigData }),
  z.object({ type: z.literal('sponsorshipPage'), id: positiveInt('id'), data: sponsorshipPagePatchData }),
  z.object({ type: z.literal('sponsor'), id: positiveInt('id'), data: sponsorPatchData }),
]);

export const deleteConfigBodySchema = z.object({
  type: configType,
  id: positiveInt('id'),
});

export const postConfigSchema = { body: postConfigBodySchema };
export const patchConfigSchema = { body: patchConfigBodySchema };
export const deleteConfigSchema = { body: deleteConfigBodySchema };
