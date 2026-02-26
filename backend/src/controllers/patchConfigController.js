import prisma from '../prismaClient.js';

const ALLOWED_FIELDS = {
  communicationLink: ['platform', 'url', 'isActive'],
  mediaConfig: ['mediaDriveUrl'],
  sponsorshipPage: ['pageContent'],
  sponsor: ['name', 'logoUrl', 'websiteUrl', 'sponsorshipPageId'],
};

// PATCH /api/config
const patchConfigController = async (req, res) => {
  const { type, id, data } = req.body;

  if (!type || !id || !data || typeof data !== 'object') {
    return res.status(400).json({
      error: 'Bad request',
      message: '`type`, `id`, and `data` fields are all required.',
    });
  }

  const allowedTypes = Object.keys(ALLOWED_FIELDS);
  if (!allowedTypes.includes(type)) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Invalid type "${type}". Must be one of: ${allowedTypes.join(', ')}.`,
    });
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      error: 'Bad request',
      message: '`id` must be a positive integer.',
    });
  }

  // Strip any keys not in the whitelist
  const filteredData = {};
  for (const field of ALLOWED_FIELDS[type]) {
    if (field in data) filteredData[field] = data[field];
  }

  if (Object.keys(filteredData).length === 0) {
    return res.status(400).json({
      error: 'Bad request',
      message: `No valid fields provided for type "${type}". Allowed fields: ${ALLOWED_FIELDS[type].join(', ')}.`,
    });
  }

  try {
    let updated;

    switch (type) {
      case 'communicationLink':
        updated = await prisma.communicationLink.update({
          where: { id },
          data: filteredData,
        });
        break;

      case 'mediaConfig':
        updated = await prisma.mediaConfig.update({
          where: { id },
          data: filteredData,
        });
        break;

      case 'sponsorshipPage':
        updated = await prisma.sponsorshipPage.update({
          where: { id },
          data: filteredData,
          include: { sponsors: true },
        });
        break;

      case 'sponsor':
        updated = await prisma.sponsor.update({
          where: { id },
          data: filteredData,
        });
        break;
    }

    return res.status(200).json({
      message: `${type} with id=${id} updated successfully.`,
      updated,
    });
  } catch (error) {
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
    console.error('[patchConfigController] Error updating config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update configuration.',
    });
  }
};

export default patchConfigController;
