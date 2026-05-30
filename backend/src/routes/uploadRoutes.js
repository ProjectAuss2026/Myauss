import { Router } from 'express';
import uploadController, { handleUploadError, upload } from '../controllers/uploadController.js';

const router = Router();

// POST /api/upload
// Accepts a single file field named "image"
router.post('/', upload.single('image'), uploadController);
router.use(handleUploadError);

export default router;
