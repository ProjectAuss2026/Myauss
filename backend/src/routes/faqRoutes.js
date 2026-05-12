import { Router } from 'express';
import { authenticateApi, authoriseApi } from '../middleware/authMiddleware.js';
import { getFaq, getAdminFaq, createFaq, updateFaq, deleteFaq } from '../controllers/faqController.js';

const router = Router();

// Public
router.get('/faq', getFaq);

// Admin only
router.get('/admin/faq', authenticateApi, authoriseApi('ADMIN'), getAdminFaq);
router.post('/admin/faq', authenticateApi, authoriseApi('ADMIN'), createFaq);
router.put('/admin/faq/:id', authenticateApi, authoriseApi('ADMIN'), updateFaq);
router.delete('/admin/faq/:id', authenticateApi, authoriseApi('ADMIN'), deleteFaq);

export default router;
