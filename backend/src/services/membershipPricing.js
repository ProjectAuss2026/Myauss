import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';

// Allowed unisex t-shirt sizes (KAN-198 tiers). Stored uppercased.
export const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const MEMBERSHIP_TIERS = {
  MEMBERSHIP: 'MEMBERSHIP',
  MEMBERSHIP_WITH_SHIRT: 'MEMBERSHIP_WITH_SHIRT',
};

// Safe fallback if the single MembershipPricing row is ever missing: base
// prices with NO promo (never charge a surprise discount we can't explain).
export const PRICING_DEFAULTS = {
  membershipCents: 1000,
  shirtAddonCents: 1000,
  promoActive: false,
  promoPercentOff: 0,
  promoEndsAt: null,
};

const MEMBERSHIP_CURRENCY = (process.env.MEMBERSHIP_CURRENCY || 'nzd').toLowerCase();

export function isValidShirtSize(size) {
  return typeof size === 'string' && SHIRT_SIZES.includes(size.trim().toUpperCase());
}

// Is the promo live right now? Off if inactive, zero-percent, or past its end.
export function promoIsLive(row, nowMs = Date.now()) {
  if (!row.promoActive) return false;
  if (!(row.promoPercentOff > 0)) return false;
  if (row.promoEndsAt && new Date(row.promoEndsAt).getTime() <= nowMs) return false;
  return true;
}

/**
 * PURE: compute the authoritative price breakdown from a pricing row. The promo
 * discounts ONLY the membership portion; the t-shirt add-on is never discounted.
 * Amounts are in cents. Exposed for exhaustive unit testing (no DB).
 */
export function computePricing(row, nowMs = Date.now()) {
  const live = promoIsLive(row, nowMs);
  const membershipFull = row.membershipCents;
  const membershipNow = live
    ? Math.round((membershipFull * (100 - row.promoPercentOff)) / 100)
    : membershipFull;
  const shirtAddon = row.shirtAddonCents;

  return {
    currency: MEMBERSHIP_CURRENCY,
    promo: {
      active: live,
      percentOff: live ? row.promoPercentOff : 0,
      endsAt: row.promoEndsAt ? new Date(row.promoEndsAt).toISOString() : null,
    },
    membership: { fullCents: membershipFull, nowCents: membershipNow },
    shirt: { addonCents: shirtAddon },
    tiers: {
      MEMBERSHIP: { amountCents: membershipNow, includesShirt: false },
      MEMBERSHIP_WITH_SHIRT: { amountCents: membershipNow + shirtAddon, includesShirt: true },
    },
    shirtSizes: SHIRT_SIZES,
  };
}

/**
 * PURE: resolve a client-supplied { tier, shirtSize } against a computed pricing
 * object into the authoritative charge. The client NEVER supplies the amount.
 * Throws an Error with `.status = 400` on invalid input. Exposed for testing.
 */
export function resolveCharge(pricing, { tier, shirtSize } = {}) {
  const chosen = tier === MEMBERSHIP_TIERS.MEMBERSHIP_WITH_SHIRT
    ? MEMBERSHIP_TIERS.MEMBERSHIP_WITH_SHIRT
    : MEMBERSHIP_TIERS.MEMBERSHIP;
  const includesShirt = chosen === MEMBERSHIP_TIERS.MEMBERSHIP_WITH_SHIRT;

  let size = null;
  if (includesShirt) {
    if (!isValidShirtSize(shirtSize)) {
      const err = new Error('A valid shirt size (XS, S, M, L, XL or XXL) is required for the membership + t-shirt option.');
      err.status = 400;
      throw err;
    }
    size = shirtSize.trim().toUpperCase();
  }

  return {
    tier: chosen,
    amountCents: pricing.tiers[chosen].amountCents,
    currency: pricing.currency,
    includesShirt,
    shirtSize: size,
    pricing,
  };
}

async function loadPricingRow() {
  try {
    const row = await prisma.membershipPricing.findUnique({ where: { id: 1 } });
    return row || PRICING_DEFAULTS;
  } catch (error) {
    logger.warn({ err: error }, 'MembershipPricing lookup failed; using default prices (no promo)');
    return PRICING_DEFAULTS;
  }
}

// Async wrappers used by the controllers: load the DB row, then compute.
export async function getMembershipPricing() {
  return computePricing(await loadPricingRow());
}

export async function resolveTierCharge(input) {
  return resolveCharge(await getMembershipPricing(), input);
}

export default {
  getMembershipPricing,
  resolveTierCharge,
  computePricing,
  resolveCharge,
  promoIsLive,
  isValidShirtSize,
  SHIRT_SIZES,
  MEMBERSHIP_TIERS,
  PRICING_DEFAULTS,
};
