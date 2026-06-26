import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { uploadUserLimiter } from '../middleware/rateLimiters.js';
import uploadController, { handleUploadError, upload } from '../controllers/uploadController.js';

const router = Router();

// POST /api/upload
// Accepts a single file field named "image"
router.post('/', authenticate, uploadUserLimiter, upload.single('image'), uploadController);
router.use(handleUploadError);

export default router;
