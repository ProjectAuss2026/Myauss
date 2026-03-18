import { Router } from 'express';
import { authenticate, authorise } from '../middleware/authMiddleware.js';
import { getActivities, getAllActivitiesAdmin, createActivity, updateActivity, deleteActivity } from '../controllers/activityController.js';

const router = Router();

// GET /api/activities/all — admin only (includes unpublished)
router.get('/all', authenticate, authorise('ADMIN'), getAllActivitiesAdmin);

// GET /api/activities — public
router.get('/', getActivities);

// POST /api/activities — admin only
router.post('/', authenticate, authorise('ADMIN'), createActivity);

// PATCH /api/activities/:id — admin only
router.patch('/:id', authenticate, authorise('ADMIN'), updateActivity);

// DELETE /api/activities/:id — admin only
router.delete('/:id', authenticate, authorise('ADMIN'), deleteActivity);

export default router;
