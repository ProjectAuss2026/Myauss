import { Router } from 'express';
import adminAuth from '../middleware/adminAuth.js';
import getConfigController from '../controllers/getConfigController.js';
import patchConfigController from '../controllers/patchConfigController.js';
import postConfigController from '../controllers/postConfigController.js';

const router = Router();

// GET /api/config
router.get('/', getConfigController);

// PATCH /api/config
router.patch('/', adminAuth, patchConfigController);

// POST /api/config
router.post('/', adminAuth, postConfigController);

export default router;
