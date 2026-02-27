import prisma from '../prismaClient.js';

const ALLOWED_TYPES = ['communicationLink', 'mediaConfig', 'sponsorshipPage', 'sponsor'];

// DELETE /api/config
const deleteConfigController = async (req, res) => {
  const { type, id } = req.body;

  if (!type || !id) {
    return res.status(400).json({
      error: 'Bad request',
      message: '`type` and `id` fields are required.',
    });
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Invalid type "${type}". Must be one of: ${ALLOWED_TYPES.join(', ')}.`,
    });
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
    return res.status(400).json({
      error: 'Bad request',
      message: '`id` must be a positive integer.',
    });
  }

  try {
    switch (type) {
      case 'communicationLink':
        await prisma.communicationLink.delete({ where: { id } });
        break;
      case 'mediaConfig':
        await prisma.mediaConfig.delete({ where: { id } });
        break;
      case 'sponsorshipPage':
        await prisma.sponsorshipPage.delete({ where: { id } });
        break;
      case 'sponsor':
        await prisma.sponsor.delete({ where: { id } });
        break;
    }

    return res.status(200).json({
      message: `${type} with id=${id} deleted successfully.`,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not found',
        message: `No ${type} found with id=${id}.`,
      });
    }
    console.error('[deleteConfigController] Error deleting config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete configuration.',
    });
  }
};

export default deleteConfigController;
