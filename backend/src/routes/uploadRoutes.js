import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import { uploadUserLimiter } from '../middleware/rateLimiters.js';
import uploadController, { handleUploadError, upload, serveUploadedImage } from '../controllers/uploadController.js';

const router = Router();

// POST /api/upload
// Accepts a single file field named "image"
router.post('/', authenticate, uploadUserLimiter, upload.single('image'), uploadController);

// GET /api/upload/:id
// Serves the raw image bytes from the UploadedImage table (public — used by
// <img> tags on both authenticated and unauthenticated pages).
router.get('/:id', serveUploadedImage);

router.use(handleUploadError);

export default router;
