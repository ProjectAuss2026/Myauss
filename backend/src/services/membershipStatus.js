import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

// Membership account status values. Mirrors the Prisma `MembershipStatus` enum.
// Distinct from `User.isVerified`, which tracks EMAIL verification (OTP) — the two
// are independent axes: a user can be email-verified but membership INACTIVE.
export const MEMBERSHIP_STATUS = Object.freeze({
  INACTIVE: 'INACTIVE',
  NEED_REVIEW: 'NEED_REVIEW',
  VERIFIED: 'VERIFIED',
});

export const MEMBERSHIP_STATUS_VALUES = Object.freeze(Object.values(MEMBERSHIP_STATUS));

// Frozen legal-transition map — the single source of truth for what moves are allowed.
//   INACTIVE    → NEED_REVIEW  (member submits cash/bank-transfer proof)
//   NEED_REVIEW → VERIFIED     (admin approves proof)
//   NEED_REVIEW → INACTIVE     (admin rejects proof)
//   VERIFIED    → INACTIVE     (admin-driven: membership lapsed / refunded)
export const MEMBERSHIP_TRANSITIONS = Object.freeze({
  INACTIVE: Object.freeze(['NEED_REVIEW']),
  NEED_REVIEW: Object.freeze(['VERIFIED', 'INACTIVE']),
  VERIFIED: Object.freeze(['INACTIVE']),
});

export function isValidMembershipStatus(status) {
  return MEMBERSHIP_STATUS_VALUES.includes(status);
}

export function isValidTransition(from, to) {
  return Boolean(MEMBERSHIP_TRANSITIONS[from]?.includes(to));
}

// Thrown when a caller requests a transition the map does not permit.
export class MembershipTransitionError extends Error {
  constructor(from, to) {
    super(`Illegal membership status transition: ${from} → ${to}`);
    this.name = 'MembershipTransitionError';
    this.code = 'ILLEGAL_TRANSITION';
    this.from = from;
    this.to = to;
  }
}

// ── Notification extension point ────────────────────────────────────
// Payment / admin-review stories register listeners here to send emails
// (e.g. "membership approved", "proof rejected") without this foundation
// service depending on them. Listeners run after the DB transaction commits;
// a throwing listener is logged and never fails the transition.
const listeners = new Set();

export function onMembershipStatusChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function emitStatusChange(event) {
  for (const listener of listeners) {
    try {
      await listener(event);
    } catch (err) {
      logger.error({ err, event }, 'Membership status-change listener failed');
    }
  }
}

/**
 * Transition a user's membership status through the guarded state machine and
 * write a timestamped audit row atomically.
 *
 * @param {Object}      args
 * @param {string}      args.targetUserId  User whose status changes.
 * @param {string}      args.toStatus      Desired MembershipStatus.
 * @param {string|null} [args.actorUserId] Who performed it; null for system jobs.
 * @param {string|null} [args.reason]      Optional audit reason (<=200 chars).
 * @param {import('@prisma/client').PrismaClient} [args.client] Injectable for tests.
 * @returns {Promise<import('@prisma/client').User>} The updated user.
 * @throws {MembershipTransitionError} when the transition is not permitted.
 */
export async function changeMembershipStatus({
  targetUserId,
  toStatus,
  actorUserId = null,
  reason = null,
  client = prisma,
}) {
  if (!isValidMembershipStatus(toStatus)) {
    throw new MembershipTransitionError('UNKNOWN', toStatus);
  }

  const updated = await client.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, membershipStatus: true },
    });
    if (!target) {
      const err = new Error('Target user not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    const fromStatus = target.membershipStatus;

    // No-op transitions are rejected so the audit log only records real changes.
    if (fromStatus === toStatus || !isValidTransition(fromStatus, toStatus)) {
      throw new MembershipTransitionError(fromStatus, toStatus);
    }

    const user = await tx.user.update({
      where: { id: targetUserId },
      data: {
        membershipStatus: toStatus,
        membershipStatusUpdatedAt: new Date(),
      },
      include: { info: true },
    });

    await tx.membershipStatusAudit.create({
      data: {
        actorUserId,
        targetUserId,
        fromStatus,
        toStatus,
        reason: reason ? String(reason).slice(0, 200) : null,
      },
    });

    return { user, fromStatus };
  });

  logger.info(
    { targetUserId, actorUserId, from: updated.fromStatus, to: toStatus },
    'Membership status changed',
  );

  await emitStatusChange({
    targetUserId,
    actorUserId,
    fromStatus: updated.fromStatus,
    toStatus,
    reason,
  });

  return updated.user;
}
