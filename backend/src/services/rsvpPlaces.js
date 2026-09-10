import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import { sendMail, escapeHtml } from '../utils/mailer.js';

/**
 * Releasing and reallocating event places (KAN-191 + KAN-189).
 *
 * The seam for member-initiated cancellation, so promotion lives in one place
 * rather than at every call site. It takes an optional transaction client
 * because the vacate and the promotion must be atomic — two simultaneous
 * cancellations must not promote the same person twice or skip anyone.
 *
 * NOT yet used by admin removal (deleteRsvp), which still deletes directly and
 * therefore promotes nobody — an exec removing someone from a full event leaves
 * that place unfilled. Raised in review rather than fixed here; this comment
 * previously claimed otherwise.
 *
 * That guarantee is enforced by the conditional writes in releaseRsvpPlace and
 * promoteNextWaitlisted, NOT by the transaction: Prisma runs at Read Committed,
 * where a transaction alone doesn't stop two callers acting on the same row they
 * both read. See promoteNextWaitlisted for the full reasoning.
 */

// Past this point automatic promotion stops and the remaining queue is handed to
// the exec at the desk, who can see both the waitlist and the room. Promoting
// someone 90 minutes before an event they can no longer reach just moves the
// empty place to a person who can't use it.
const DEFAULT_PROMOTION_CUTOFF_HOURS = 12;
const MS_PER_HOUR = 60 * 60 * 1000;

// How many times we re-read the queue after losing a claim to a concurrent
// cancellation. Each lost race means another transaction promoted the member we
// had picked, so retrying takes the next one. Losing this many in a row needs
// that many simultaneous cancellations on one event; past it we stop rather than
// loop, and the remaining queue passes to the exec at the desk.
const MAX_PROMOTION_CLAIM_ATTEMPTS = 5;

export function getPromotionCutoffHours() {
  const raw = process.env.WAITLIST_PROMOTION_CUTOFF_HOURS;

  // Unset, or set to an empty string, means "use the default". Worth spelling
  // out: Number('') is 0, so an empty value used to read as a valid 0 and
  // silently disable the cutoff entirely.
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_PROMOTION_CUTOFF_HOURS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    // 0 is legitimate (promote right up to the start). Negatives and typos are
    // not, and falling back silently means a mistyped value in Railway looks
    // exactly like a correct one — the deploy that sets it is the only chance
    // anyone has to notice.
    logger.warn(
      { configured: raw, using: DEFAULT_PROMOTION_CUTOFF_HOURS },
      'WAITLIST_PROMOTION_CUTOFF_HOURS must be a non-negative number; using the default',
    );
    return DEFAULT_PROMOTION_CUTOFF_HOURS;
  }
  return parsed;
}

export class RsvpNotFoundError extends Error {
  constructor(message = 'RSVP not found') {
    super(message);
    this.name = 'RsvpNotFoundError';
    this.code = 'RSVP_NOT_FOUND';
  }
}

export function isRsvpNotFoundError(error) {
  return error instanceof RsvpNotFoundError;
}

export function buildPromotionEmail({ name, activityTitle, activityUrl, startTime }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const subject = `AUSS - You're in: ${activityTitle}`;
  const when = startTime
    ? new Date(startTime).toLocaleString('en-NZ', {
        weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      })
    : null;

  const text = `${greeting}

A place has opened up at ${activityTitle} and you were next on the waitlist, so the place is now yours.
${when ? `\nWhen: ${when}\n` : ''}
If you can no longer make it, please open the event page and cancel so someone else can take it:
${activityUrl}`;

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#0f172a;margin-top:0;">Auckland Uni Strength Society</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>A place has opened up at <strong>${escapeHtml(activityTitle)}</strong> and you were next on the waitlist, so the place is now yours.</p>
      ${when ? `<p style="color:#334155;">When: <strong>${escapeHtml(when)}</strong></p>` : ''}
      <p><a href="${escapeHtml(activityUrl)}" style="display:inline-block;background:#eb7524;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">View the event</a></p>
      <p style="color:#64748b;font-size:14px;">If you can no longer make it, please open the event page and cancel your place so someone else can take it.</p>
    </div>
  `;
  return { subject, text, html };
}

function buildActivityUrl(activityId) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5174').replace(/\/+$/, '');
  return `${appUrl}/activities/${activityId}`;
}

/**
 * Promote the earliest waitlisted member into a freed place.
 *
 * Runs inside the caller's transaction so it is atomic with the vacate. Returns
 * the promoted row (or null) rather than emailing directly — the notification is
 * sent by the caller AFTER the transaction commits, so a failing mailer can
 * never roll back a completed promotion.
 *
 * Concurrency (review, #84). Prisma's $transaction does not raise the isolation
 * level, so this runs at Postgres' default Read Committed: two simultaneous
 * cancellations each take their own snapshot, both see a place free and both see
 * the same member at the head of the queue. Picking the member with a read and
 * then writing them unconditionally is therefore not safe — the loser's UPDATE
 * blocks on the row lock, and once the winner commits it applies anyway, so one
 * member is promoted twice (two emails) and one freed place is never filled.
 *
 * The claim is an atomic conditional write instead: `status: 'WAITLISTED'` in
 * the WHERE is re-evaluated against the committed row, so exactly one caller can
 * take a given member. Zero rows means we lost, and we re-read the queue — that
 * re-read is now correct rather than racy, because blocking on the lock means
 * the winner has already committed. Same shape as the checkedInAt claim in #65.
 */
async function promoteNextWaitlisted({ activityId, tx, now = new Date() }) {
  const activity = await tx.activity.findUnique({
    where: { id: activityId },
    select: { id: true, title: true, capacity: true, startTime: true },
  });
  if (!activity) return null;

  // Uncapped events never have a waitlist to promote from.
  if (activity.capacity === null || activity.capacity === undefined) return null;

  // Past the cutoff, automation hands over to the exec at the desk.
  const cutoffMs = getPromotionCutoffHours() * MS_PER_HOUR;
  if (activity.startTime && activity.startTime.getTime() - now.getTime() < cutoffMs) {
    return null;
  }

  for (let attempt = 1; attempt <= MAX_PROMOTION_CLAIM_ATTEMPTS; attempt += 1) {
    // Re-counted every attempt, not once before the loop: losing a claim means a
    // concurrent promotion committed, which may have just filled the last place.
    const confirmed = await tx.rsvp.count({
      where: { activityId, status: 'CONFIRMED', countsTowardCapacity: true },
    });
    if (confirmed >= activity.capacity) return null;

    // Earliest first — ordering comes from createdAt, so nothing needs
    // renumbering when a row is removed from the middle of the queue.
    const next = await tx.rsvp.findFirst({
      where: { activityId, status: 'WAITLISTED' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, userId: true },
    });
    if (!next) return null;

    const claimed = await tx.rsvp.updateMany({
      where: { id: next.id, status: 'WAITLISTED' },
      data: { status: 'CONFIRMED' },
    });

    if (claimed.count > 0) {
      return { ...next, activityTitle: activity.title, startTime: activity.startTime };
    }

    logger.info(
      { activityId, contendedRsvpId: next.id, attempt },
      'Waitlist promotion lost a claim to a concurrent cancellation; re-reading the queue',
    );
  }

  // Returning null (rather than the member we failed to claim) is the point: the
  // caller emails whoever comes back, so reporting an unclaimed promotion would
  // tell someone they have a place that another transaction gave away.
  logger.warn(
    { activityId, attempts: MAX_PROMOTION_CLAIM_ATTEMPTS },
    'Gave up promoting from the waitlist after repeated claim contention; place left for the exec at the desk',
  );
  return null;
}

/**
 * Release the place held by `userId` for `activityId`, then promote the next
 * waitlisted member if there is one.
 *
 * Hard-deletes the row (KAN-191 Decision 3): it frees the (activityId, userId)
 * unique constraint so "cancel then re-register" works without extra logic.
 *
 * @returns {Promise<{ releasedRsvpId: number, promoted: object|null }>}
 *   `promoted` is the member who took the freed place, for the caller to notify
 *   after committing. Null when nothing was promoted.
 * @throws {RsvpNotFoundError} when the member holds no place for this activity.
 */
export async function releaseRsvpPlace({ activityId, userId, tx }) {
  const run = async (client) => {
    const rsvp = await client.rsvp.findUnique({
      where: { activityId_userId: { activityId, userId } },
      select: { id: true, status: true },
    });

    if (!rsvp) {
      throw new RsvpNotFoundError();
    }

    // Conditional delete for the same reason the promotion claim is conditional:
    // two cancellations of the SAME place (a double-click, a retried request)
    // both read the row, and the loser's delete would otherwise throw P2025 and
    // surface as a 500 on what is really "already cancelled". Zero rows means
    // someone else released it, so we stop here — crucially before promoting,
    // since only one of the two callers actually freed a place.
    const released = await client.rsvp.deleteMany({ where: { id: rsvp.id } });
    if (released.count === 0) {
      throw new RsvpNotFoundError();
    }

    // Leaving the waitlist doesn't free a place, so there is nothing to promote.
    const promoted =
      rsvp.status === 'CONFIRMED'
        ? await promoteNextWaitlisted({ activityId, tx: client })
        : null;

    return { releasedRsvpId: rsvp.id, promoted };
  };

  // DB work only. The notification is deliberately NOT sent here: when a caller
  // passes their own `tx`, everything in this function runs inside their
  // transaction, and an SMTP round-trip there blows Prisma's 5s interactive
  // transaction timeout (P2028) — rolling back both the cancellation and the
  // promotion. Callers send it via notifyPromotion() once their transaction has
  // committed.
  return tx ? run(tx) : prisma.$transaction(run);
}

/**
 * Notify a promoted member. MUST be called after the transaction that promoted
 * them has committed — never inside it (see releaseRsvpPlace).
 *
 * Never throws: a promotion the member isn't told about is bad, but a mailer
 * failure must not look like a failed cancellation to the person who cancelled.
 */
export async function notifyPromotion({ activityId, promoted }) {
  if (!promoted) return;

  logger.info(
    { activityId, promotedUserId: promoted.userId },
    'Promoted next waitlisted member into a freed place',
  );

  try {
    const content = buildPromotionEmail({
      name: promoted.name,
      activityTitle: promoted.activityTitle,
      activityUrl: buildActivityUrl(activityId),
      startTime: promoted.startTime,
    });
    await sendMail({ to: promoted.email, ...content }, 'WAITLIST PROMOTION');
  } catch (err) {
    logger.error(
      { err, activityId, promotedUserId: promoted.userId },
      'Promoted member but failed to send the notification email',
    );
  }
}
