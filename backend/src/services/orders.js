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

export default {
  ORDER_TYPE,
  ORDER_STATUS,
  ORDER_PAYMENT_METHOD,
  buildMembershipOrders,
  buildShirtOrder,
  createOrders,
};
