import prisma from '../prismaClient.js';

// POST /api/config
const postConfigController = async (req, res) => {
  const { type, data } = req.body;

  try {
    let created;

    switch (type) {
      case 'communicationLink':
        created = await prisma.communicationLink.create({
          data,
        });
        break;

      case 'mediaConfig':
        created = await prisma.mediaConfig.create({
          data,
        });
        break;

      case 'sponsorshipPage':
        created = await prisma.sponsorshipPage.create({
          data,
          include: { sponsors: true },
        });
        break;
      
      // Checks if sponsorshipPageId you're linking to exists
      case 'sponsor': {
        const pageExists = await prisma.sponsorshipPage.findUnique({
          where: { id: data.sponsorshipPageId },
        });
        if (!pageExists) {
          return res.status(404).json({
            error: 'Not found',
            message: `SponsorshipPage with id=${data.sponsorshipPageId} does not exist.`,
          });
        }
        created = await prisma.sponsor.create({
          data,
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
    console.error('[postConfigController] Error creating config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create configuration.',
    });
  }
};

export default postConfigController;
