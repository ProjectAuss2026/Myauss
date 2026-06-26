import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { isUrlValidationError, validateConfigUrlFields } from '../utils/urlValidation.js';

const ALLOWED_FIELDS = {
  communicationLink: ['platform', 'url', 'imgUrl', 'description', 'isActive'],
  mediaConfig: ['mediaDriveUrl'],
  sponsorshipPage: ['pageContent'],
  sponsor: ['name', 'logoUrl', 'heroImageUrl', 'websiteUrl', 'displayOrder', 'sponsorshipPageId'],
};

function filterAllowedFields(type, data) {
  const filteredData = {};

  for (const field of ALLOWED_FIELDS[type]) {
    if (field in data) filteredData[field] = data[field];
  }

  return filteredData;
}

const patchConfigController = async (req, res) => {
  const { type, id, data } = req.body ?? {};

  if (!type || !data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({
      error: 'Bad request',
      message: '`type` and `data` fields are required.',
    });
  }

  const allowedTypes = Object.keys(ALLOWED_FIELDS);
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Invalid type "${type}". Must be one of: ${allowedTypes.join(', ')}.`,
    });
  }

  if (type !== 'mediaConfig') {
    if (id === undefined || id === null) {
      return res.status(400).json({
        error: 'Bad request',
        message: '`id` is required.',
      });
    }
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        error: 'Bad request',
        message: '`id` must be a positive integer.',
      });
    }
  } else if (id !== undefined && id !== null && (typeof id !== 'number' || !Number.isInteger(id) || id < 1)) {
    return res.status(400).json({
      error: 'Bad request',
      message: '`id` must be a positive integer.',
    });
  }

  const filteredData = filterAllowedFields(type, data);

  if (type === 'communicationLink' && filteredData.description && filteredData.description.length > 150) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Description must be 150 characters or fewer.',
    });
  }

  if (Object.keys(filteredData).length === 0) {
    return res.status(400).json({
      error: 'Bad request',
      message: `No valid fields provided for type "${type}". Allowed fields: ${ALLOWED_FIELDS[type].join(', ')}.`,
    });
  }

  try {
    await validateConfigUrlFields(type, filteredData);

    let updated;

    switch (type) {
      case 'communicationLink':
        updated = await prisma.communicationLink.update({
          where: { id },
          data: filteredData,
        });
        break;

      case 'mediaConfig': {
        const newUrl = filteredData.mediaDriveUrl;
        if (id) {
          updated = await prisma.mediaConfig.update({
            where: { id },
            data: { mediaDriveUrl: newUrl },
          });
        } else {
          const existing = await prisma.mediaConfig.findFirst();
          if (existing) {
            updated = await prisma.mediaConfig.update({
              where: { id: existing.id },
              data: { mediaDriveUrl: newUrl },
            });
          } else {
            updated = await prisma.mediaConfig.create({
              data: { mediaDriveUrl: newUrl },
            });
          }
        }
        break;
      }

      case 'sponsorshipPage':
        updated = await prisma.sponsorshipPage.update({
          where: { id },
          data: filteredData,
          include: { sponsors: true },
        });
        break;

      case 'sponsor': {
        if (Object.hasOwn(filteredData, 'sponsorshipPageId')) {
          const pageExists = await prisma.sponsorshipPage.findUnique({
            where: { id: filteredData.sponsorshipPageId },
          });
          if (!pageExists) {
            return res.status(404).json({
              error: 'Not found',
              message: `SponsorshipPage with id=${filteredData.sponsorshipPageId} does not exist.`,
            });
          }
        }

        updated = await prisma.sponsor.update({
          where: { id },
          data: filteredData,
        });
        break;
      }
    }

    return res.status(200).json({
      message: id
        ? `${type} with id=${id} updated successfully.`
        : `${type} saved successfully.`,
      updated,
    });
  } catch (error) {
    if (isUrlValidationError(error)) {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message,
      });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not found',
        message: `No ${type} found with id=${id}.`,
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: `A ${type} with that value already exists (unique constraint violated).`,
      });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Foreign key constraint failed. Ensure related records exist.',
      });
    }
    logger.error({ err: error }, '[patchConfigController] Error updating config:');
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update configuration.',
    });
  }
};

export default patchConfigController;
