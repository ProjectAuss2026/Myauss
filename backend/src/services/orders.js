import prisma from '../prismaClient.js';

export const ORDER_TYPE = { MEMBERSHIP: 'MEMBERSHIP', SHIRT: 'SHIRT' };
export const ORDER_STATUS = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  PAID: 'PAID',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  PICKED_UP: 'PICKED_UP',
  DECLINED: 'DECLINED',
};
export const ORDER_PAYMENT_METHOD = { CARD: 'CARD', BANK_TRANSFER: 'BANK_TRANSFER' };

/**
 * PURE: build the Order rows for a membership purchase. Membership and an
 * optional t-shirt become TWO independent rows. `paid` selects the initial
 * status:
 *  - paid=true  (card confirmed):        MEMBERSHIP -> PAID, SHIRT -> READY_FOR_PICKUP
 *  - paid=false (bank-transfer, in review): both -> PENDING_REVIEW
 * Exposed pure for unit testing (no DB).
 */
export function buildMembershipOrders({
  membershipCents,
  includesShirt = false,
  shirtCents = 0,
  shirtSize = null,
  currency,
  paymentMethod,
  reference = null,
  paid,
  paidAt = null,
}) {
  const rows = [
    {
      type: ORDER_TYPE.MEMBERSHIP,
      status: paid ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING_REVIEW,
      amountCents: membershipCents,
      currency,
      paymentMethod,
      reference,
      shirtSize: null,
      paidAt: paid ? paidAt : null,
    },
  ];
  if (includesShirt) {
    rows.push({
      type: ORDER_TYPE.SHIRT,
      status: paid ? ORDER_STATUS.READY_FOR_PICKUP : ORDER_STATUS.PENDING_REVIEW,
      amountCents: shirtCents,
      currency,
      paymentMethod,
      reference,
      shirtSize,
      paidAt: paid ? paidAt : null,
    });
  }
  return rows;
}

/**
 * Build a single standalone SHIRT order (for an already-active member buying a
 * shirt on its own).
 */
export function buildShirtOrder({ shirtCents, shirtSize, currency, paymentMethod, reference = null, paid, paidAt = null }) {
  return [
    {
      type: ORDER_TYPE.SHIRT,
      status: paid ? ORDER_STATUS.READY_FOR_PICKUP : ORDER_STATUS.PENDING_REVIEW,
      amountCents: shirtCents,
      currency,
      paymentMethod,
      reference,
      shirtSize,
      paidAt: paid ? paidAt : null,
    },
  ];
}

/**
 * Idempotent create keyed on `reference` (the card /confirm handler and the
 * Stripe webhook both call this for the same intent). If any order already
 * exists for the reference, this is a no-op.
 */
export async function createOrders({ userId, reference, rows }) {
  if (!rows || rows.length === 0) return { created: 0 };
  if (reference) {
    const existing = await prisma.order.count({ where: { reference } });
    if (existing > 0) return { created: 0, skipped: true };
  }
  await prisma.order.createMany({ data: rows.map((r) => ({ ...r, userId })) });
  return { created: rows.length };
}

/**
 * PURE: what a PENDING_REVIEW order becomes when an admin approves/declines.
 * Approve: SHIRT (physical) -> READY_FOR_PICKUP, everything else -> PAID.
 * Decline: -> DECLINED. Exposed pure for unit testing.
 */
export function nextReviewedStatus(orderType, approve) {
  if (!approve) return ORDER_STATUS.DECLINED;
  return orderType === ORDER_TYPE.SHIRT ? ORDER_STATUS.READY_FOR_PICKUP : ORDER_STATUS.PAID;
}

/**
 * Settle a member's PENDING_REVIEW orders alongside an admin membership
 * decision, keeping order status in sync with member status. Additive: callers
 * invoke this best-effort after changeMembershipStatus so a failure here never
 * blocks the membership decision.
 */
export async function settleReviewedOrders({ userId, approve, reason = null, actorUserId = null }) {
  const now = new Date();
  const pending = await prisma.order.findMany({
    where: { userId, status: ORDER_STATUS.PENDING_REVIEW },
    select: { id: true, type: true },
  });
  await Promise.all(
    pending.map((o) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          status: nextReviewedStatus(o.type, approve),
          paidAt: approve ? now : null,
          statusReason: reason,
          statusUpdatedById: actorUserId,
        },
      }),
    ),
  );
  return pending.length;
}

export default {
  ORDER_TYPE,
  ORDER_STATUS,
  ORDER_PAYMENT_METHOD,
  buildMembershipOrders,
  buildShirtOrder,
  createOrders,
  nextReviewedStatus,
  settleReviewedOrders,
};
