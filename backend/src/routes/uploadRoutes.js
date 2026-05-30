import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import uploadController, { upload } from '../controllers/uploadController.js';

const router = Router();

// POST /api/upload
// Accepts a single file field named "image"
router.post('/', authenticate, upload.single('image'), uploadController);

export default router;
