import prisma from '../prismaClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const ALLOWED_TYPES = ['communicationLink', 'mediaConfig', 'sponsorshipPage', 'sponsor'];

// If the imgUrl is a local upload (e.g. http://localhost:5000/uploads/file.jpg),
// extract the filename and delete it from disk.
const deleteLocalUpload = (imgUrl) => {
  if (!imgUrl) return;
  try {
    const url = new URL(imgUrl);
    // Only delete files served from our own /uploads/ path
    if (!url.pathname.startsWith('/uploads/')) return;
    const filename = path.basename(url.pathname);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[deleteConfigController] Deleted file: ${filePath}`);
    }
  } catch {
    // Not a valid URL or not a local file — skip silently
  }
};

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
      case 'communicationLink': {
        // Fetch first so we have the imgUrl before deleting
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
    console.error('[deleteConfigController] Error deleting config:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete configuration.',
    });
  }
};

export default deleteConfigController;
