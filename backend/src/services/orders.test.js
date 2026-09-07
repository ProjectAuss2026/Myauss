import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMembershipOrders, buildShirtOrder, ORDER_STATUS, ORDER_TYPE } from './orders.js';

test('paid membership only -> one MEMBERSHIP row, PAID', () => {
  const rows = buildMembershipOrders({
    membershipCents: 500, currency: 'nzd', paymentMethod: 'CARD',
    reference: 'pi_1', paid: true, paidAt: new Date(),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, ORDER_TYPE.MEMBERSHIP);
  assert.equal(rows[0].status, ORDER_STATUS.PAID);
  assert.equal(rows[0].amountCents, 500);
  assert.equal(rows[0].shirtSize, null);
});

test('paid membership + shirt -> two independent rows; shirt READY_FOR_PICKUP', () => {
  const rows = buildMembershipOrders({
    membershipCents: 500, includesShirt: true, shirtCents: 1000, shirtSize: 'M',
    currency: 'nzd', paymentMethod: 'CARD', reference: 'pi_2', paid: true, paidAt: new Date(),
  });
  assert.equal(rows.length, 2);
  const membership = rows.find((r) => r.type === 'MEMBERSHIP');
  const shirt = rows.find((r) => r.type === 'SHIRT');
  assert.equal(membership.status, ORDER_STATUS.PAID);
  assert.equal(membership.amountCents, 500);
  assert.equal(membership.shirtSize, null);
  assert.equal(shirt.status, ORDER_STATUS.READY_FOR_PICKUP);
  assert.equal(shirt.amountCents, 1000);
  assert.equal(shirt.shirtSize, 'M');
  assert.equal(shirt.reference, 'pi_2'); // both share the checkout reference
});

test('bank-transfer (not yet paid) -> both rows PENDING_REVIEW, no paidAt', () => {
  const rows = buildMembershipOrders({
    membershipCents: 500, includesShirt: true, shirtCents: 1000, shirtSize: 'L',
    currency: 'nzd', paymentMethod: 'BANK_TRANSFER', reference: 'proof_1', paid: false,
  });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.status === ORDER_STATUS.PENDING_REVIEW));
  assert.ok(rows.every((r) => r.paidAt === null));
  assert.ok(rows.every((r) => r.paymentMethod === 'BANK_TRANSFER'));
});

test('standalone shirt order for an active member', () => {
  const rows = buildShirtOrder({
    shirtCents: 1000, shirtSize: 'XL', currency: 'nzd', paymentMethod: 'CARD',
    reference: 'pi_3', paid: true, paidAt: new Date(),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, ORDER_TYPE.SHIRT);
  assert.equal(rows[0].status, ORDER_STATUS.READY_FOR_PICKUP);
  assert.equal(rows[0].shirtSize, 'XL');
});
