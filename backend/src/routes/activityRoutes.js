import { Router } from 'express';
import { authenticate, authorise, requireVerifiedMembership } from '../middleware/authMiddleware.js';
import validate from '../middleware/validate.js';
import { getActivities, getAllActivitiesAdmin, createActivity, updateActivity, deleteActivity } from '../controllers/activityController.js';
import { createActivitySchema, deleteActivitySchema, updateActivitySchema } from '../schemas/activitySchemas.js';
import {
  createRsvp,
  getRsvpCount,
  listRsvps,
  deleteRsvp,
  exportRsvpsCsv,
} from '../controllers/rsvpController.js';
import { checkInByPass, listCheckInAttendees } from '../controllers/checkInController.js';
import { checkInScanLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// GET /api/activities/all — admin only (includes unpublished)
router.get('/all', authenticate, authorise('ADMIN'), getAllActivitiesAdmin);

// GET /api/activities — public
router.get('/', getActivities);

// POST /api/activities — admin only
router.post('/', authenticate, authorise('ADMIN'), validate(createActivitySchema), createActivity);

// PATCH /api/activities/:id — admin only
router.patch('/:id', authenticate, authorise('ADMIN'), validate(updateActivitySchema), updateActivity);

// DELETE /api/activities/:id — admin only
router.delete('/:id', authenticate, authorise('ADMIN'), validate(deleteActivitySchema), deleteActivity);

// --- RSVP routes ---
// POST /api/activities/:id/rsvp — signed-in VERIFIED members only (KAN-178).
// Events are members-only with no walk-ins, so RSVP requires an active
// membership and the booking is made from the account rather than typed in.
router.post('/:id/rsvp', authenticate, requireVerifiedMembership, createRsvp);

// GET /api/activities/:id/rsvp/count — public (count + sold-out flag)
router.get('/:id/rsvp/count', getRsvpCount);

// GET /api/activities/:id/rsvps — admin only (list attendees)
router.get('/:id/rsvps', authenticate, authorise('ADMIN'), listRsvps);

// GET /api/activities/:id/rsvps/export — admin only (CSV export)
router.get('/:id/rsvps/export', authenticate, authorise('ADMIN'), exportRsvpsCsv);

// --- Event check-in (KAN-180) ---
// POST /api/activities/:id/check-in — admin only (scan a member's pass)
router.post(
  '/:id/check-in',
  authenticate,
  authorise('ADMIN'),
  checkInScanLimiter,
  checkInByPass,
);

// GET /api/activities/:id/check-in/attendees — admin only (pre-fetch for offline verification)
router.get(
  '/:id/check-in/attendees',
  authenticate,
  authorise('ADMIN'),
  listCheckInAttendees,
);

// DELETE /api/activities/:id/rsvps/:rsvpId — admin only (remove attendee)
router.delete('/:id/rsvps/:rsvpId', authenticate, authorise('ADMIN'), deleteRsvp);

export default router;
