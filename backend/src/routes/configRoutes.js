import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import getConfigController from '../controllers/getConfigController.js';
import patchConfigController from '../controllers/patchConfigController.js';
import postConfigController from '../controllers/postConfigController.js';
import deleteConfigController from '../controllers/deleteConfigController.js';
import { deleteConfigSchema, patchConfigSchema, postConfigSchema } from '../schemas/configSchemas.js';

const router = Router();

// GET /api/config — public (Social page needs this without auth)
router.get('/', getConfigController);

// PATCH /api/config — protected
router.patch('/', authenticate, validate(patchConfigSchema), patchConfigController);

// POST /api/config — protected
router.post('/', authenticate, validate(postConfigSchema), postConfigController);

// DELETE /api/config — protected
router.delete('/', authenticate, validate(deleteConfigSchema), deleteConfigController);

export default router;
