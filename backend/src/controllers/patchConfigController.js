import prisma from '../prismaClient.js';

// PATCH /api/config
const patchConfigController = async (req, res) => {
  const { type, id, data } = req.body;

  try {
    let updated;

    switch (type) {
      case 'communicationLink':
        updated = await prisma.communicationLink.update({
          where: { id },
          data,
        });
        break;

      case 'mediaConfig': {
        const newUrl = data.mediaDriveUrl;
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
          data,
          include: { sponsors: true },
        });
        break;

      case 'sponsor':
        updated = await prisma.sponsor.update({
          where: { id },
          data,
        });
        break;
    }

    return res.status(200).json({
      message: id
        ? `${type} with id=${id} updated successfully.`
        : `${type} saved successfully.`,
      updated,
    });
  } catch (error) {
    // P2025 means record with that ID doesn't exist
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not found',
        message: `No ${type} found with id=${id}.`,
      });
    }
    // P2002 means unique constraint violated to set a platform that already exists
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
