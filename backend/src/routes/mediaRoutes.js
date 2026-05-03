import { Router } from 'express';
import { authenticateApi, authoriseApi } from '../middleware/authMiddleware.js';
import {
  getMediaEntries,
  createMediaEntry,
  patchMediaEntry,
  deleteMediaEntry,
  resolveCoverUrl,
} from '../controllers/mediaController.js';

const router = Router();

router.get('/media-entries', getMediaEntries);
router.post('/media-entries', authenticateApi, authoriseApi('ADMIN'), createMediaEntry);
router.patch('/media-entries/:id', authenticateApi, authoriseApi('ADMIN'), patchMediaEntry);
router.delete('/media-entries/:id', authenticateApi, authoriseApi('ADMIN'), deleteMediaEntry);
router.post('/resolve-cover', authenticateApi, authoriseApi('ADMIN'), resolveCoverUrl);

export default router;
