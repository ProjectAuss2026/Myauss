import prisma from '../prismaClient.js';

/**
 * Releasing an event place (KAN-191).
 *
 * Deliberately a single seam. Both member-initiated cancellation and (later)
 * admin removal vacate a place through here, so KAN-189 adds waitlist promotion
 * in ONE place rather than at every call site. It takes an optional transaction
 * client for the same reason: promotion must happen atomically with the vacate,
 * so two simultaneous cancellations can't promote the same person twice or skip
 * anyone.
 */

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

/**
 * Release the place held by `userId` for `activityId`.
 *
 * Hard-deletes the row (KAN-191 Decision 3): it frees the (activityId, userId)
 * unique constraint so "cancel then re-register" works without extra logic, and
 * matches the existing admin removal behaviour. If cancellation reporting is
 * ever wanted, a CANCELLED status belongs alongside KAN-189's
 * CONFIRMED/WAITLISTED rather than being invented here.
 *
 * @param {Object} args
 * @param {number} args.activityId
 * @param {string} args.userId
 * @param {import('@prisma/client').Prisma.TransactionClient} [args.tx]
 * @returns {Promise<{ releasedRsvpId: number }>}
 * @throws {RsvpNotFoundError} when the member holds no place for this activity.
 */
export async function releaseRsvpPlace({ activityId, userId, tx }) {
  const client = tx ?? prisma;

  const rsvp = await client.rsvp.findUnique({
    where: { activityId_userId: { activityId, userId } },
    select: { id: true },
  });

  if (!rsvp) {
    throw new RsvpNotFoundError();
  }

  await client.rsvp.delete({ where: { id: rsvp.id } });

  // KAN-189 hooks promotion in here — inside the same transaction as the
  // delete, so the freed place is handed to the earliest waitlisted member
  // atomically. Nothing else needs to change at the call sites.

  return { releasedRsvpId: rsvp.id };
}
