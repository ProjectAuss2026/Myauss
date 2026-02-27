import { Router } from 'express';
import getConfigController from '../controllers/getConfigController.js';
import patchConfigController from '../controllers/patchConfigController.js';
import postConfigController from '../controllers/postConfigController.js';
import deleteConfigController from '../controllers/deleteConfigController.js';

const router = Router();

// GET /api/config
router.get('/', getConfigController);

// PATCH /api/config
router.patch('/', patchConfigController);

// POST /api/config
router.post('/', postConfigController);

// DELETE /api/config
router.delete('/', deleteConfigController);

export default router;
