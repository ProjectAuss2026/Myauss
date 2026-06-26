import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { isUrlValidationError, validateConfigUrlFields } from '../utils/urlValidation.js';

const REQUIRED_FIELDS = {
  communicationLink: ['platform', 'url', 'imgUrl'],
  mediaConfig: ['mediaDriveUrl'],
  sponsorshipPage: ['pageContent'],
  sponsor: ['name', 'sponsorshipPageId'],
};

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

const postConfigController = async (req, res) => {
  const { type, data } = req.body ?? {};

  if (!type || !data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({
      error: 'Bad request',
      message: '`type` and `data` fields are required.',
    });
  }

  const allowedTypes = Object.keys(REQUIRED_FIELDS);
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Invalid type "${type}". Must be one of: ${allowedTypes.join(', ')}.`,
    });
  }

  const missingFields = REQUIRED_FIELDS[type].filter((field) => !(field in data) || data[field] === undefined || data[field] === null || data[field] === '');
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Missing required fields for type "${type}": ${missingFields.join(', ')}.`,
    });
  }

  const filteredData = filterAllowedFields(type, data);

  if (type === 'communicationLink' && filteredData.description && filteredData.description.length > 150) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Description must be 150 characters or fewer.',
    });
  }

  try {
    await validateConfigUrlFields(type, filteredData);

    let created;

    switch (type) {
      case 'communicationLink':
        created = await prisma.communicationLink.create({
          data: filteredData,
        });
        break;

      case 'mediaConfig':
        created = await prisma.mediaConfig.create({
          data: filteredData,
        });
        break;

      case 'sponsorshipPage':
        created = await prisma.sponsorshipPage.create({
          data: filteredData,
          include: { sponsors: true },
        });
        break;

      case 'sponsor': {
        const pageExists = await prisma.sponsorshipPage.findUnique({
          where: { id: filteredData.sponsorshipPageId },
        });
        if (!pageExists) {
          return res.status(404).json({
            error: 'Not found',
            message: `SponsorshipPage with id=${filteredData.sponsorshipPageId} does not exist.`,
          });
        }
        created = await prisma.sponsor.create({
          data: filteredData,
        });
        break;
      }
    }

    return res.status(201).json({
      message: `${type} created successfully.`,
      created,
    });
  } catch (error) {
    if (isUrlValidationError(error)) {
      return res.status(400).json({
        error: 'Bad request',
        message: error.message,
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
    logger.error({ err: error }, '[postConfigController] Error creating config:');
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create configuration.',
    });
  }
};

export default postConfigController;
