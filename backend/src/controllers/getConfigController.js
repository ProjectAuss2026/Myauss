import prisma from '../prismaClient.js';

// Default Photo Drive URL used to seed the singleton MediaConfig row
// the first time GET /api/config runs without an existing row.
const DEFAULT_MEDIA_DRIVE_URL = 'https://danbainvisuals.pixieset.com/auss/landing/';

// GET /api/config
const getConfigController = async (req, res) => {
  try {
    const [communicationLinks, existingMediaConfig, sponsorshipPages] = await Promise.all([
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

    // Auto-seed the singleton MediaConfig row on first access so the
    // Photo Drive link is always available (and editable) from the admin UI.
    let mediaConfig = existingMediaConfig;
    if (!mediaConfig) {
      try {
        mediaConfig = await prisma.mediaConfig.create({
          data: { mediaDriveUrl: DEFAULT_MEDIA_DRIVE_URL },
        });
      } catch (seedErr) {
        console.error('[getConfigController] Failed to seed MediaConfig:', seedErr);
      }
    }

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
