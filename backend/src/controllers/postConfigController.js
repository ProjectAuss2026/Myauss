import prisma from '../prismaClient.js';
import { normalizeOptionalImageUrl } from '../utils/imageUrlPolicy.js';
import logger from '../utils/logger.js';

// Fields that must be present, otherwise "400 Bad Request"
const REQUIRED_FIELDS = {
  communicationLink: ['platform', 'url', 'imgUrl'],
  mediaConfig: ['mediaDriveUrl'],
  sponsorshipPage: ['pageContent'],
  sponsor: ['name', 'sponsorshipPageId'],
};

// Whitelist of what's accepted
const ALLOWED_FIELDS = {
  communicationLink: ['platform', 'url', 'imgUrl', 'description', 'isActive'],
  mediaConfig: ['mediaDriveUrl'],
  sponsorshipPage: ['pageContent'],
  sponsor: ['name', 'logoUrl', 'websiteUrl', 'displayOrder', 'sponsorshipPageId'],
};

const IMAGE_URL_FIELDS = {
  communicationLink: ['imgUrl'],
  sponsor: ['logoUrl'],
};

function validateConfigImageUrls(type, filteredData) {
  for (const field of IMAGE_URL_FIELDS[type] ?? []) {
    if (!(field in filteredData)) {
      continue;
    }

    const normalized = normalizeOptionalImageUrl(filteredData[field], field);
    if (!normalized.ok) {
      return normalized;
    }

    filteredData[field] = normalized.value;
  }

  return { ok: true };
}

// POST /api/config
const postConfigController = async (req, res) => {
  const { type, data } = req.body;

  if (!type || !data || typeof data !== 'object') {
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

  // Check all required fields are present
  const missingFields = REQUIRED_FIELDS[type].filter((field) => !(field in data) || data[field] === undefined || data[field] === null || data[field] === '');
  if (missingFields.length > 0) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Missing required fields for type "${type}": ${missingFields.join(', ')}.`,
    });
  }

  // Strip any keys not in the whitelist
  const filteredData = {};
  for (const field of ALLOWED_FIELDS[type]) {
    if (field in data) filteredData[field] = data[field];
  }

  // Validate description length for communicationLink
  if (type === 'communicationLink' && filteredData.description && filteredData.description.length > 150) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Description must be 150 characters or fewer.',
    });
  }

  const imageUrlValidation = validateConfigImageUrls(type, filteredData);
  if (!imageUrlValidation.ok) {
    return res.status(400).json({
      error: 'Bad request',
      message: imageUrlValidation.message,
    });
  }

  try {
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
      
      // Checks if sponsorshipPageId you're linking to exists
      case 'sponsor': {
        const pageExists = await prisma.sponsorshipPage.findUnique({
          where: { id: Number(filteredData.sponsorshipPageId) },
        });
        if (!pageExists) {
          return res.status(404).json({
            error: 'Not found',
            message: `SponsorshipPage with id=${filteredData.sponsorshipPageId} does not exist.`,
          });
        }
        created = await prisma.sponsor.create({
          data: {
            ...filteredData,
            sponsorshipPageId: Number(filteredData.sponsorshipPageId),
          },
        });
        break;
      }
    }

    return res.status(201).json({
      message: `${type} created successfully.`,
      created,
    });
  } catch (error) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Conflict',
        message: `A ${type} with that value already exists (unique constraint violated).`,
      });
    }
    // Foreign key constraint failed
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
