import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { parseMemberPass, verifyMemberPass, isMemberPassError } from '../utils/memberPass.js';

/**
 * Event check-in (KAN-180). Exec-facing, admin-only, arrival only.
 *
 * Verdicts are deliberately a small closed set so the scanner UI can switch on
 * `verdict` rather than parsing prose:
 *   CHECKED_IN        — registered, recorded now
 *   ALREADY_CHECKED_IN — with the time of the first scan
 *   NOT_REGISTERED    — no RSVP for this event; no override (events are
 *                       members-only with no walk-ins)
 *   INVALID_PASS      — forged, tampered, reset, or unreadable
 */
export const CHECK_IN_VERDICT = Object.freeze({
  CHECKED_IN: 'CHECKED_IN',
  ALREADY_CHECKED_IN: 'ALREADY_CHECKED_IN',
  NOT_REGISTERED: 'NOT_REGISTERED',
  INVALID_PASS: 'INVALID_PASS',
});

// Responses carry only what the desk needs — the screen is visible across a busy
// table, so no email, no student id, no full account record.
function attendeeSummary(rsvp, membershipStatus) {
  return { name: rsvp.name, membershipStatus: membershipStatus ?? null };
}

/**
 * POST /api/activities/:id/check-in — ADMIN/OWNER only
 * Body: { pass }
 */
export const checkInByPass = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || Number.isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  const parsed = parseMemberPass(req.body?.pass);
  if (!parsed) {
    // Unreadable/malformed codes are rejected before any database work.
    return res.status(200).json({ verdict: CHECK_IN_VERDICT.INVALID_PASS });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, title: true },
    });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const member = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, email: true, qrVersion: true, membershipStatus: true },
    });

    // A pass for a deleted account, or one issued before a reset, is invalid.
    if (!member || !verifyMemberPass(parsed, member.qrVersion)) {
      return res.status(200).json({ verdict: CHECK_IN_VERDICT.INVALID_PASS });
    }

    let rsvp = await prisma.rsvp.findUnique({
      where: { activityId_userId: { activityId, userId: member.id } },
      select: { id: true, name: true, checkedInAt: true },
    });

    // Heal-on-scan (KAN-180 Decision 3), scoped to pre-KAN-178 rows: legacy
    // bookings made through the old public route can still have a null userId,
    // and rejecting a member who genuinely registered would be wrong when there
    // is no walk-in override. Identity comes from the verified pass, so the
    // email is corroboration rather than authentication. Logged every time so
    // this can be deleted once legacy rows are exhausted, per review.
    if (!rsvp) {
      const legacy = await prisma.rsvp.findFirst({
        where: { activityId, userId: null, email: member.email },
        select: { id: true, name: true, checkedInAt: true },
      });
      if (legacy) {
        await prisma.rsvp.update({
          where: { id: legacy.id },
          data: { userId: member.id },
        });
        logger.info(
          { rsvpId: legacy.id, activityId, userId: member.id },
          'check-in: healed legacy unlinked RSVP by account email',
        );
        rsvp = legacy;
      }
    }

    if (!rsvp) {
      return res.status(200).json({
        verdict: CHECK_IN_VERDICT.NOT_REGISTERED,
        membershipStatus: member.membershipStatus,
      });
    }

    // Atomic claim: a single row-locked statement, so two execs scanning the
    // same member at two desks cannot both record a check-in. Zero rows updated
    // means someone got there first.
    const now = new Date();
    const claimed = await prisma.rsvp.updateMany({
      where: { id: rsvp.id, checkedInAt: null },
      data: { checkedInAt: now, checkedInByUserId: req.user.id },
    });

    if (claimed.count === 0) {
      const existing = await prisma.rsvp.findUnique({
        where: { id: rsvp.id },
        select: { checkedInAt: true },
      });
      return res.status(200).json({
        verdict: CHECK_IN_VERDICT.ALREADY_CHECKED_IN,
        checkedInAt: existing?.checkedInAt ?? null,
        ...attendeeSummary(rsvp, member.membershipStatus),
      });
    }

    logger.info(
      { activityId, userId: member.id, byUserId: req.user.id },
      'Member checked in',
    );
    return res.status(200).json({
      verdict: CHECK_IN_VERDICT.CHECKED_IN,
      checkedInAt: now,
      ...attendeeSummary(rsvp, member.membershipStatus),
    });
  } catch (err) {
    if (isMemberPassError(err)) {
      logger.error({ err }, 'check-in: member passes are not configured');
      return res.status(500).json({ error: 'Member passes are not configured' });
    }
    logger.error({ err, activityId }, 'checkInByPass error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/activities/:id/check-in/attendees — ADMIN/OWNER only
 *
 * Pre-fetched when the exec selects the event so verification works with no
 * signal at the venue (KAN-180 Decision 4). Returns the minimum needed to give
 * a verdict offline. The scanner must clear this on event end or logout and
 * must not persist it beyond the session — it is a list of member names on an
 * exec's personal phone.
 */
export const listCheckInAttendees = async (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  if (!activityId || Number.isNaN(activityId)) {
    return res.status(400).json({ error: 'Valid activity id is required' });
  }

  try {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, title: true },
    });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const rsvps = await prisma.rsvp.findMany({
      where: { activityId },
      select: { userId: true, name: true, checkedInAt: true },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({
      activity: { id: activity.id, title: activity.title },
      fetchedAt: new Date(),
      attendees: rsvps
        .filter((r) => r.userId)
        .map((r) => ({ userId: r.userId, name: r.name, checkedInAt: r.checkedInAt })),
      checkedInCount: rsvps.filter((r) => r.checkedInAt).length,
      totalCount: rsvps.length,
    });
  } catch (err) {
    logger.error({ err, activityId }, 'listCheckInAttendees error:');
    return res.status(500).json({ error: 'Internal server error' });
  }
};
