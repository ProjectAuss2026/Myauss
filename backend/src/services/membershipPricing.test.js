import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePricing,
  resolveCharge,
  promoIsLive,
  isValidShirtSize,
  PRICING_DEFAULTS,
} from './membershipPricing.js';

const NOW = Date.UTC(2026, 8, 7); // 2026-09-07, fixed clock for determinism

const promoRow = {
  membershipCents: 1000,
  shirtAddonCents: 1000,
  promoActive: true,
  promoPercentOff: 50,
  promoEndsAt: null,
};
const noPromoRow = { ...promoRow, promoActive: false, promoPercentOff: 0 };

// ── The four price combinations ──────────────────────────────────────────────
test('normal prices (promo off): membership $10, with-shirt $20', () => {
  const p = computePricing(noPromoRow, NOW);
  assert.equal(p.tiers.MEMBERSHIP.amountCents, 1000);
  assert.equal(p.tiers.MEMBERSHIP_WITH_SHIRT.amountCents, 2000);
  assert.equal(p.promo.active, false);
});

test('promo prices (50% off membership): membership $5, with-shirt $15', () => {
  const p = computePricing(promoRow, NOW);
  assert.equal(p.tiers.MEMBERSHIP.amountCents, 500);
  assert.equal(p.tiers.MEMBERSHIP_WITH_SHIRT.amountCents, 1500);
  assert.equal(p.promo.active, true);
  assert.equal(p.promo.percentOff, 50);
});

test('the t-shirt add-on is never discounted', () => {
  const p = computePricing(promoRow, NOW);
  assert.equal(p.shirt.addonCents, 1000);
  assert.equal(
    p.tiers.MEMBERSHIP_WITH_SHIRT.amountCents - p.tiers.MEMBERSHIP.amountCents,
    1000,
  );
});

// ── Promo expiry ─────────────────────────────────────────────────────────────
test('promo auto-expires once promoEndsAt has passed (reverts to full price)', () => {
  const expired = { ...promoRow, promoEndsAt: new Date(NOW - 1000).toISOString() };
  const p = computePricing(expired, NOW);
  assert.equal(p.promo.active, false);
  assert.equal(p.tiers.MEMBERSHIP.amountCents, 1000);
  assert.equal(p.tiers.MEMBERSHIP_WITH_SHIRT.amountCents, 2000);
});

test('promo is still live before promoEndsAt', () => {
  const future = { ...promoRow, promoEndsAt: new Date(NOW + 86_400_000).toISOString() };
  const p = computePricing(future, NOW);
  assert.equal(p.promo.active, true);
  assert.equal(p.tiers.MEMBERSHIP.amountCents, 500);
});

test('promoIsLive: false when inactive, zero-percent, or past end; true otherwise', () => {
  assert.equal(promoIsLive({ promoActive: false, promoPercentOff: 50, promoEndsAt: null }, NOW), false);
  assert.equal(promoIsLive({ promoActive: true, promoPercentOff: 0, promoEndsAt: null }, NOW), false);
  assert.equal(promoIsLive({ promoActive: true, promoPercentOff: 50, promoEndsAt: new Date(NOW - 1).toISOString() }, NOW), false);
  assert.equal(promoIsLive({ promoActive: true, promoPercentOff: 50, promoEndsAt: null }, NOW), true);
});

// ── Missing pricing row → safe fallback ──────────────────────────────────────
test('missing pricing row falls back to full price with no promo', () => {
  const p = computePricing(PRICING_DEFAULTS, NOW);
  assert.equal(p.promo.active, false);
  assert.equal(p.tiers.MEMBERSHIP.amountCents, 1000);
  assert.equal(p.tiers.MEMBERSHIP_WITH_SHIRT.amountCents, 2000);
});

// ── Tier + shirt-size validation ─────────────────────────────────────────────
const promoPricing = computePricing(promoRow, NOW);

test('membership tier: $5, no shirt, ignores a stray shirtSize', () => {
  const c = resolveCharge(promoPricing, { tier: 'MEMBERSHIP', shirtSize: 'M' });
  assert.equal(c.amountCents, 500);
  assert.equal(c.includesShirt, false);
  assert.equal(c.shirtSize, null);
});

test('with-shirt tier: $15, stores the size uppercased/trimmed', () => {
  const c = resolveCharge(promoPricing, { tier: 'MEMBERSHIP_WITH_SHIRT', shirtSize: ' m ' });
  assert.equal(c.amountCents, 1500);
  assert.equal(c.includesShirt, true);
  assert.equal(c.shirtSize, 'M');
});

test('with-shirt rejects a missing shirt size (400)', () => {
  assert.throws(
    () => resolveCharge(promoPricing, { tier: 'MEMBERSHIP_WITH_SHIRT' }),
    (e) => e.status === 400,
  );
});

test('with-shirt rejects an invalid shirt size (400)', () => {
  assert.throws(
    () => resolveCharge(promoPricing, { tier: 'MEMBERSHIP_WITH_SHIRT', shirtSize: 'XXXL' }),
    (e) => e.status === 400,
  );
});

test('an unknown tier value defaults to membership-only (never over-charges)', () => {
  const c = resolveCharge(promoPricing, { tier: 'HACKED_TIER' });
  assert.equal(c.tier, 'MEMBERSHIP');
  assert.equal(c.amountCents, 500);
  assert.equal(c.includesShirt, false);
});

test('isValidShirtSize accepts XS–XXL (case/space-insensitive), rejects others', () => {
  assert.equal(isValidShirtSize('xl'), true);
  assert.equal(isValidShirtSize(' M '), true);
  assert.equal(isValidShirtSize('XXXL'), false);
  assert.equal(isValidShirtSize(''), false);
  assert.equal(isValidShirtSize(null), false);
});
