import { Router } from 'express';
import { authenticate, authorise } from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import getConfigController from '../controllers/getConfigController.js';
import patchConfigController from '../controllers/patchConfigController.js';
import postConfigController from '../controllers/postConfigController.js';
import deleteConfigController from '../controllers/deleteConfigController.js';
import { deleteConfigSchema, patchConfigSchema, postConfigSchema } from '../schemas/configSchemas.js';

const router = Router();

// GET /api/config — public (Social page needs this without auth)
router.get('/', getConfigController);

// PATCH /api/config — admin only
router.patch('/', authenticate, authorise('ADMIN'), validate(patchConfigSchema), patchConfigController);

// POST /api/config — admin only
router.post('/', authenticate, authorise('ADMIN'), validate(postConfigSchema), postConfigController);

// DELETE /api/config — admin only
router.delete('/', authenticate, authorise('ADMIN'), validate(deleteConfigSchema), deleteConfigController);

export default router;
