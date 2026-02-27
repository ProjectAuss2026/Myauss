import { Router } from 'express';
import uploadController, { upload } from '../controllers/uploadController.js';

const router = Router();

// POST /api/upload
// Accepts a single file field named "image"
router.post('/', upload.single('image'), uploadController);

export default router;
