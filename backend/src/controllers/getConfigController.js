import prisma from '../prismaClient.js';

// GET /api/config
const getConfigController = async (req, res) => {
  try {
    const [communicationLinks, mediaConfig, sponsorshipPages] = await Promise.all([
      prisma.communicationLink.findMany({
        orderBy: { platform: 'asc' },
      }),

      prisma.mediaConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
      }),

      prisma.sponsorshipPage.findMany({
        include: {
          sponsors: {
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return res.status(200).json({
      communicationLinks,
      mediaConfig: mediaConfig ?? null,
      sponsorshipPages,
    });
  } catch (error) {
    console.error('[getConfigController] Error fetching config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch configuration.',
    });
  }
};

export default getConfigController;
