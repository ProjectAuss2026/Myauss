import { Router } from 'express';
import { authenticate, authorise } from '../middleware/authMiddleware.js';
import { getActivities, createActivity, deleteActivity } from '../controllers/activityController.js';

const router = Router();

// GET /api/activities — public
router.get('/', getActivities);

// POST /api/activities — admin only
router.post('/', authenticate, authorise('ADMIN'), createActivity);

// DELETE /api/activities/:id — admin only
router.delete('/:id', authenticate, authorise('ADMIN'), deleteActivity);

export default router;
