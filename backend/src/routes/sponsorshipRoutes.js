import { Router } from 'express';
import { authenticateApi, authoriseApi } from '../middleware/authMiddleware.js';
import {
  getSponsorship,
  patchSponsorship,
  createSponsor,
  patchSponsor,
  deleteSponsor,
} from '../controllers/sponsorshipController.js';

const router = Router();

router.get('/sponsorship', getSponsorship);
router.patch('/sponsorship', authenticateApi, authoriseApi('ADMIN'), patchSponsorship);
router.post('/sponsors', authenticateApi, authoriseApi('ADMIN'), createSponsor);
router.patch('/sponsors/:id', authenticateApi, authoriseApi('ADMIN'), patchSponsor);
router.delete('/sponsors/:id', authenticateApi, authoriseApi('ADMIN'), deleteSponsor);

export default router;
