import prisma from '../prismaClient.js';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../utils/logger.js';
import { UPLOADS_DIR } from './uploadController.js';

const ALLOWED_TYPES = ['communicationLink', 'mediaConfig', 'sponsorshipPage', 'sponsor'];

function deleteLocalUpload(imgUrl) {
  if (!imgUrl) return;

  try {
    const url = new URL(imgUrl, 'http://localhost');
    const pathname = url.pathname;
    if (!pathname.startsWith('/uploads/')) return;

    const relativePath = pathname.slice('/uploads/'.length);
    const filePath = path.resolve(UPLOADS_DIR, relativePath);
    if (!filePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) return;

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({ filePath }, '[deleteConfigController] Deleted local upload');
    }
  } catch {
    // Not a valid URL or not a local file — skip silently.
  }
}

const deleteConfigController = async (req, res) => {
  const { type, id } = req.body;

  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Bad request',
      message: `Unsupported config type: ${type}`,
    });
  }

  try {
    switch (type) {
      case 'communicationLink': {
        const link = await prisma.communicationLink.findUnique({ where: { id } });
        if (!link) {
          return res.status(404).json({ error: 'Not found', message: `No communicationLink found with id=${id}.` });
        }
        await prisma.communicationLink.delete({ where: { id } });
        deleteLocalUpload(link.imgUrl);
        break;
      }
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
    logger.error({ err: error }, '[deleteConfigController] Error deleting config:');
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete configuration.',
    });
  }
};

export default deleteConfigController;
