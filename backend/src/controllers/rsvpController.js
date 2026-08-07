import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { isValidEmail } from '../utils/emailValidation.js';
import { LIMITS } from '../schemas/commonSchemas.js';

/**
 * POST /api/activities/:id/rsvp — public
 * Body: { name, email, studentId }
 * Creates an RSVP linked to the activity.
 * - 400 invalid input
 * - 404 activity not found / unpublished
 * - 409 sold out OR email already registered for this activity
 */
export const createRsvp = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  const { name, email, studentId } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (String(name).trim().length > LIMITS.personName) {
    return res.status(400).json({ error: `name must be ${LIMITS.personName} characters or fewer` });
  }
  if (!email || !String(email).trim()) {
    return res.status(400).json({ error: 'email is required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'email is not a valid email address' });
  }
  if (!studentId || !String(studentId).trim()) {
    return res.status(400).json({ error: 'studentId is required' });
  }
  if (String(studentId).trim().length > LIMITS.studentId) {
    return res.status(400).json({ error: `studentId must be ${LIMITS.studentId} characters or fewer` });
  }

  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanStudentId = String(studentId).trim();

  try {
    // Atomic capacity-check + insert in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { id: true, isPublished: true, capacity: true },
      });

      if (!activity || !activity.isPublished) {
        return { status: 404, body: { error: 'Activity not found' } };
      }

      if (activity.capacity !== null && activity.capacity !== undefined) {
        const count = await tx.rsvp.count({ where: { activityId } });
        if (count >= activity.capacity) {
          return { status: 409, body: { error: 'Activity is sold out' } };
        }
      }

      try {
        const rsvp = await tx.rsvp.create({
          data: {
            activityId,
            name: cleanName,
            email: cleanEmail,
            studentId: cleanStudentId,
          },
        });
        return { status: 201, body: rsvp };
      } catch (e) {
        // Prisma unique constraint violation on (activityId, email)
        if (e && e.code === 'P2002') {
          return { status: 409, body: { error: 'This email is already registered for this activity' } };
        }
        throw e;
      }
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ err }, 'createRsvp error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/activities/:id/rsvp/count — public
 * Returns { count, capacity, isSoldOut }
 */
export const getRsvpCount = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, isPublished: true, capacity: true },
    });

    if (!activity || !activity.isPublished) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const count = await prisma.rsvp.count({ where: { activityId } });
    const capacity = activity.capacity ?? null;
    const isSoldOut = capacity !== null && count >= capacity;

    return res.json({ count, capacity, isSoldOut });
  } catch (err) {
    logger.error({ err }, 'getRsvpCount error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/activities/:id/rsvps — admin only
 * Returns all RSVPs for the activity ordered by createdAt asc.
 */
export const listRsvps = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true },
    });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const rsvps = await prisma.rsvp.findMany({
      where: { activityId },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(rsvps);
  } catch (err) {
    logger.error({ err }, 'listRsvps error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /api/activities/:id/rsvps/:rsvpId — admin only
 * Deletes a single RSVP record if it exists and belongs to that activity.
 */
export const deleteRsvp = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const rsvpId = parseInt(req.params.rsvpId, 10);
  if (!activityId || isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }
  if (!rsvpId || isNaN(rsvpId)) {
    return res.status(400).json({ error: 'Valid rsvp id is required' });
  }

  try {
    const rsvp = await prisma.rsvp.findUnique({ where: { id: rsvpId } });
    if (!rsvp || rsvp.activityId !== activityId) {
      return res.status(404).json({ error: 'RSVP not found' });
    }

    await prisma.rsvp.delete({ where: { id: rsvpId } });
    return res.status(204).send();
  } catch (err) {
    logger.error({ err }, 'deleteRsvp error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Escape a value for inclusion in a CSV cell (RFC 4180-style).
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * GET /api/activities/:id/rsvps/export — admin only
 * Streams a CSV of all attendees for the activity.
 */
export const exportRsvpsCsv = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true },
    });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const rsvps = await prisma.rsvp.findMany({
      where: { activityId },
      orderBy: { createdAt: 'asc' },
    });

    const header = 'Name,Email,Student ID,Registration Date';
    const rows = rsvps.map((r) =>
      [
        csvEscape(r.name),
        csvEscape(r.email),
        csvEscape(r.studentId),
        csvEscape(r.createdAt.toISOString()),
      ].join(','),
    );
    const csv = [header, ...rows].join('\r\n') + '\r\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rsvps-${activityId}.csv"`,
    );
    return res.status(200).send(csv);
  } catch (err) {
    logger.error({ err }, 'exportRsvpsCsv error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
