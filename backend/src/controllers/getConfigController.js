import prisma from '../prismaClient.js';

// GET /api/config
const getConfigController = async (req, res) => {
  try {
    const [communicationLinks, mediaConfig, sponsorshipPages] = await Promise.all([
      // Sort communication links A-Z by platform
      prisma.communicationLink.findMany({
        orderBy: { platform: 'asc' },
      }),

      // Single global media config row, or null if not set
      prisma.mediaConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
      }),

      // All sponsorship pages, each with their nested sponsors included
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
