import { Router } from 'express';
import { authenticate, authorise } from '../middleware/authMiddleware.js';
import { getActivities, getAllActivitiesAdmin, createActivity, updateActivity, deleteActivity } from '../controllers/activityController.js';
import {
  createRsvp,
  getRsvpCount,
  listRsvps,
  deleteRsvp,
  exportRsvpsCsv,
} from '../controllers/rsvpController.js';

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

// --- RSVP routes ---
// POST /api/activities/:id/rsvp — public (submit RSVP)
router.post('/:id/rsvp', createRsvp);

// GET /api/activities/:id/rsvp/count — public (count + sold-out flag)
router.get('/:id/rsvp/count', getRsvpCount);

// GET /api/activities/:id/rsvps — admin only (list attendees)
router.get('/:id/rsvps', authenticate, authorise('ADMIN'), listRsvps);

// GET /api/activities/:id/rsvps/export — admin only (CSV export)
router.get('/:id/rsvps/export', authenticate, authorise('ADMIN'), exportRsvpsCsv);

// DELETE /api/activities/:id/rsvps/:rsvpId — admin only (remove attendee)
router.delete('/:id/rsvps/:rsvpId', authenticate, authorise('ADMIN'), deleteRsvp);

export default router;
