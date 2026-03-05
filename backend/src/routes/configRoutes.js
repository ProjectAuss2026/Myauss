import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import getConfigController from '../controllers/getConfigController.js';
import patchConfigController from '../controllers/patchConfigController.js';
import postConfigController from '../controllers/postConfigController.js';
import deleteConfigController from '../controllers/deleteConfigController.js';

const router = Router();

// GET /api/config — public (Social page needs this without auth)
router.get('/', getConfigController);

// PATCH /api/config — protected
router.patch('/', authenticate, patchConfigController);

// POST /api/config — protected
router.post('/', authenticate, postConfigController);

// DELETE /api/config — protected
router.delete('/', authenticate, deleteConfigController);

export default router;
