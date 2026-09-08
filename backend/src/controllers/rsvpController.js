import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { releaseRsvpPlace, notifyPromotion, isRsvpNotFoundError } from '../services/rsvpPlaces.js';

/**
 * POST /api/activities/:id/rsvp — signed-in VERIFIED members only (KAN-178)
 * Takes no body: the attendee's details come from the authenticated account, so
 * they cannot be spoofed or mistyped. Enforced upstream by
 * `authenticate` + `requireVerifiedMembership`.
 * - 404 activity not found / unpublished
 * - 409 sold out OR member already registered for this activity
 */
export const createRsvp = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  // The only body field honoured: an explicit opt-in to the waitlist when the
  // event is full. Everything else still comes from the account.
  const joinWaitlist = req.body?.joinWaitlist === true;

  try {
    // Attendee details are snapshotted from the account, never read from the
    // request body — any name/email a client sends is deliberately ignored.
    // requireVerifiedMembership already loaded this row, so reuse it and avoid a
    // second lookup; the fallback keeps this handler correct on its own.
    const account =
      req.user.account ??
      (await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { email: true, info: { select: { firstName: true, lastName: true } } },
      }));

    if (!account) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const cleanEmail = account.email;
    const cleanName =
      [account.info?.firstName, account.info?.lastName].filter(Boolean).join(' ').trim() ||
      account.email;

    // Atomic capacity-check + insert in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { id: true, isPublished: true, capacity: true },
      });

      if (!activity || !activity.isPublished) {
        return { status: 404, body: { error: 'Activity not found' } };
      }

      // Execs run events rather than taking a member's place (KAN-190), so their
      // booking never consumes capacity — and, critically, an exec is therefore
      // never full and never waitlisted. Snapshotted onto the row rather than
      // joined live, so a later promotion/demotion can't rewrite past headcounts.
      const countsTowardCapacity = !(req.user.role === 'ADMIN' || req.user.role === 'OWNER');

      // Full means full *for this person*: capacity counts only CONFIRMED places
      // that count toward it, and an exec is never blocked by it.
      let isFull = false;
      if (
        countsTowardCapacity &&
        activity.capacity !== null &&
        activity.capacity !== undefined
      ) {
        const count = await tx.rsvp.count({
          where: { activityId, status: 'CONFIRMED', countsTowardCapacity: true },
        });
        isFull = count >= activity.capacity;
      }

      // Waitlisting is explicit (KAN-189): a full event reports EVENT_FULL with a
      // machine-readable code, and the member joins the queue only by taking a
      // separate action. Silently waitlisting someone who believes they hold a
      // place is the worst failure at the door.
      if (isFull && !joinWaitlist) {
        return {
          status: 409,
          body: { error: 'This event is full.', code: 'EVENT_FULL' },
        };
      }

      // The route is authenticated (KAN-178), so the booking always carries the
      // member's account id. KAN-171's email-match fallback is gone — it only
      // existed to link anonymous bookings from the old public route.
      try {
        const rsvp = await tx.rsvp.create({
          data: {
            activityId,
            userId: req.user.id,
            name: cleanName,
            email: cleanEmail,
            status: isFull ? 'WAITLISTED' : 'CONFIRMED',
            countsTowardCapacity,
          },
        });
        return { status: 201, body: rsvp };
      } catch (e) {
        // Prisma unique constraint violation on (activityId, userId)
        if (e && e.code === 'P2002') {
          return { status: 409, body: { error: 'You are already registered for this activity' } };
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

    // Same predicate as createRsvp's check — waitlisted entries and exec places
    // never make an event look fuller than it is. Both sites must agree or the
    // UI and the API disagree about whether an event is full, and members see
    // the wrong one.
    const count = await prisma.rsvp.count({
      where: { activityId, status: 'CONFIRMED', countsTowardCapacity: true },
    });
    const capacity = activity.capacity ?? null;
    const isSoldOut = capacity !== null && count >= capacity;

    // The route stays public, but when a signed-in member calls it we also say
    // whether *they* hold a place (KAN-191) — otherwise the UI has no way to
    // know a "Cancel my place" action applies. `attachUserIfPresent` is optional
    // auth: anonymous callers simply don't get the flag.
    let isRegistered = false;
    let myStatus = null;
    if (req.user?.id) {
      const own = await prisma.rsvp.findUnique({
        where: { activityId_userId: { activityId, userId: req.user.id } },
        select: { id: true, status: true },
      });
      isRegistered = Boolean(own);
      // CONFIRMED vs WAITLISTED, so the member is never left guessing which they
      // hold — that ambiguity is the thing explicit opt-in exists to prevent.
      myStatus = own?.status ?? null;
    }

    return res.json({ count, capacity, isSoldOut, isRegistered, myStatus });
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
/**
 * DELETE /api/activities/:id/rsvp — signed-in members (KAN-191)
 *
 * Cancels the caller's OWN place. There is deliberately no RSVP id in the path:
 * the row is identified by (activityId, req.user.id), so cancelling someone
 * else's place is not expressible rather than expressible-and-rejected.
 *
 * Deliberately NOT gated on requireVerifiedMembership. A member whose
 * membership lapsed after booking must still be able to release their place —
 * gating it would trap exactly the people most likely to need it and leave the
 * place stuck. Cancelling is a de-escalation; no privilege is gained by it.
 *
 * No cutoff: blocking a late cancellation doesn't keep anyone in the room, it
 * just turns a cancellation into a no-show and makes attendance data worse. The
 * reallocation limit belongs on KAN-189's promotion cutoff instead.
 */
export const cancelOwnRsvp = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || Number.isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, endTime: true },
    });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // A finished event can't be cancelled out of — the attendance record is
    // already history. Rejected explicitly so this is never a 500.
    if (activity.endTime && activity.endTime.getTime() <= Date.now()) {
      return res.status(409).json({
        error: 'This event has already finished, so your place cannot be cancelled.',
        code: 'EVENT_FINISHED',
      });
    }

    // The vacate and any waitlist promotion happen atomically here.
    const { promoted } = await prisma.$transaction((tx) =>
      releaseRsvpPlace({ activityId, userId: req.user.id, tx }),
    );

    logger.info({ activityId, userId: req.user.id }, 'Member cancelled their RSVP');

    // Only once the transaction has committed. Sending inside it would put an
    // SMTP round-trip in the transaction and blow Prisma's 5s timeout, rolling
    // back the cancellation the member just asked for.
    await notifyPromotion({ activityId, promoted });

    return res.status(204).send();
  } catch (err) {
    if (isRsvpNotFoundError(err)) {
      return res.status(404).json({ error: 'You are not registered for this activity' });
    }
    logger.error({ err, activityId }, 'cancelOwnRsvp error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

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

    // Student ID column removed with KAN-178: the field is no longer collected
    // (it can't be sourced from the account — UserInfo stores a one-way hash —
    // and KAN-185 makes it optional for non-UoA members). Name + email identify
    // the attendee; KAN-174's scanner replaces ID checks at the door.
    const header = 'Name,Email,Registration Date,Checked In,Check-In Time';
    const rows = rsvps.map((r) =>
      [
        csvEscape(r.name),
        csvEscape(r.email),
        csvEscape(r.createdAt.toISOString()),
        csvEscape(r.checkedInAt ? 'Yes' : 'No'),
        csvEscape(r.checkedInAt ? r.checkedInAt.toISOString() : ''),
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
