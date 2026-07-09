import Stripe from 'stripe';
import prisma from '../prismaClient.js';
import logger from '../utils/logger.js';
import {
  MEMBERSHIP_STATUS,
  MembershipTransitionError,
  changeMembershipStatus,
} from '../services/membershipStatus.js';

// Membership pricing (overridable via env). Amount is in the smallest currency
// unit (cents). Defaults to NZ$20.00.
const MEMBERSHIP_PRICE_CENTS = Number.parseInt(process.env.MEMBERSHIP_PRICE_CENTS || '2000', 10);
const MEMBERSHIP_CURRENCY = (process.env.MEMBERSHIP_CURRENCY || 'nzd').toLowerCase();
const PAYMENT_PURPOSE = 'auss_membership';

let stripeClient = null;

function getStripe() {
  // Test seam: lets the controller tests inject a fake Stripe client the same
  // way auth.controller.js consults __AUSS_AUTH_TEST_HOOKS__.
  if (process.env.NODE_ENV === 'test' && globalThis.__AUSS_PAYMENT_TEST_HOOKS__?.stripe) {
    return globalThis.__AUSS_PAYMENT_TEST_HOOKS__.stripe;
  }

  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

/**
 * Pull the human-auditable details (method type, card brand/last4, charge
 * timestamp) out of a succeeded PaymentIntent. The webhook payload carries
 * `latest_charge` as an id string rather than an expanded object, so this
 * fetches the charge from Stripe when needed. Detail extraction is
 * best-effort: a lookup failure still yields a recordable payment.
 */
async function extractPaymentDetails(stripe, paymentIntent) {
  let charge = paymentIntent.latest_charge;

  if (typeof charge === 'string' && charge) {
    try {
      charge = await stripe.charges.retrieve(charge);
    } catch (error) {
      logger.warn(
        { err: error, paymentIntentId: paymentIntent.id },
        'Failed to retrieve charge for payment ledger details',
      );
      charge = null;
    }
  }

  const methodDetails = charge?.payment_method_details || null;
  return {
    method: methodDetails?.type || 'card',
    cardBrand: methodDetails?.card?.brand || null,
    cardLast4: methodDetails?.card?.last4 || null,
    paidAt: charge?.created ? new Date(charge.created * 1000) : new Date(),
  };
}

/**
 * Write the succeeded PaymentIntent into the Payment ledger (KAN-138 AC7).
 * Idempotent: both /confirm and the webhook call this, so the row is upserted
 * on the unique stripePaymentIntentId and the second writer is a no-op.
 */
async function recordMembershipPayment({ stripe, paymentIntent, userId }) {
  const [details, user] = await Promise.all([
    extractPaymentDetails(stripe, paymentIntent),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  await prisma.payment.upsert({
    where: { stripePaymentIntentId: paymentIntent.id },
    update: {},
    create: {
      userId,
      payerEmail: user?.email || paymentIntent.receipt_email || 'unknown',
      stripePaymentIntentId: paymentIntent.id,
      amountCents: paymentIntent.amount_received ?? paymentIntent.amount,
      currency: paymentIntent.currency,
      method: details.method,
      cardBrand: details.cardBrand,
      cardLast4: details.cardLast4,
      paidAt: details.paidAt,
    },
  });
}

/**
 * Flip a user to VERIFIED after a confirmed payment. Idempotent: if the member
 * is already VERIFIED (e.g. the webhook and the client confirm both fire) it
 * resolves without error instead of throwing on the illegal VERIFIED→VERIFIED
 * transition.
 *
 * @returns {Promise<boolean>} true if the status actually changed.
 */
async function activateMembership({ userId, actorUserId = null, reason }) {
  try {
    await changeMembershipStatus({
      targetUserId: userId,
      toStatus: MEMBERSHIP_STATUS.VERIFIED,
      actorUserId,
      reason,
    });
    return true;
  } catch (err) {
    if (
      err instanceof MembershipTransitionError &&
      err.from === MEMBERSHIP_STATUS.VERIFIED
    ) {
      // Already active — treat as a no-op success.
      return false;
    }
    throw err;
  }
}

/**
 * POST /api/payments/intent  (authenticated)
 * Creates a PaymentIntent for the membership fee and returns its client secret
 * so the frontend Payment Element can collect and confirm payment. The intent
 * is tagged with the paying user's id so the webhook / confirm step can flip
 * the right account to VERIFIED. Rejects members who are already active.
 */
export async function createMembershipPaymentIntent(req, res) {
  const stripe = getStripe();

  if (!stripe) {
    logger.error('STRIPE_SECRET_KEY is not configured');
    return res.status(503).json({ error: 'Payments are not configured' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { membershipStatus: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.membershipStatus === MEMBERSHIP_STATUS.VERIFIED) {
      return res.status(409).json({ error: 'Your membership is already active.' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: MEMBERSHIP_PRICE_CENTS,
      currency: MEMBERSHIP_CURRENCY,
      // Lets Stripe enable cards + Apple Pay / Google Pay wallets automatically.
      automatic_payment_methods: { enabled: true },
      metadata: { purpose: PAYMENT_PURPOSE, userId: req.user.id },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      amount: MEMBERSHIP_PRICE_CENTS,
      currency: MEMBERSHIP_CURRENCY,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create membership PaymentIntent');
    return res.status(502).json({ error: 'Failed to start payment' });
  }
}

/**
 * POST /api/payments/confirm  (authenticated)
 * Called by the frontend once Stripe reports the payment succeeded. Re-checks
 * the PaymentIntent server-side (never trusting the client) and, if it truly
 * succeeded and belongs to this user, activates their membership. Gives instant
 * feedback; the webhook is the durable backstop for abandoned tabs.
 */
export async function confirmMembershipPayment(req, res) {
  const stripe = getStripe();

  if (!stripe) {
    return res.status(503).json({ error: 'Payments are not configured' });
  }

  const { paymentIntentId } = req.body || {};
  if (!paymentIntentId || typeof paymentIntentId !== 'string') {
    return res.status(400).json({ error: 'A paymentIntentId is required' });
  }

  let paymentIntent;
  try {
    // latest_charge is expanded so the ledger recording below can read the
    // card brand / last4 without a second Stripe roundtrip.
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });
  } catch (error) {
    logger.warn({ err: error, paymentIntentId }, 'Failed to retrieve PaymentIntent');
    return res.status(404).json({ error: 'Payment not found' });
  }

  // The intent must belong to this user and be a membership payment.
  if (
    paymentIntent.metadata?.purpose !== PAYMENT_PURPOSE ||
    paymentIntent.metadata?.userId !== req.user.id
  ) {
    return res.status(403).json({ error: 'This payment does not belong to your account' });
  }

  if (paymentIntent.status !== 'succeeded') {
    return res
      .status(402)
      .json({ error: 'Payment has not completed', status: paymentIntent.status });
  }

  try {
    await activateMembership({
      userId: req.user.id,
      actorUserId: req.user.id,
      reason: `Card payment (${paymentIntent.id})`,
    });
  } catch (error) {
    logger.error({ err: error, userId: req.user.id }, 'Failed to activate membership after payment');
    return res.status(500).json({ error: 'Payment succeeded but activation failed' });
  }

  try {
    await recordMembershipPayment({ stripe, paymentIntent, userId: req.user.id });
  } catch (error) {
    // Non-fatal: the member is already active, and the webhook delivery will
    // upsert the ledger row when it fires (Stripe retries on failure there).
    logger.error(
      { err: error, userId: req.user.id, paymentIntentId: paymentIntent.id },
      'Failed to record payment in ledger after confirm',
    );
  }

  return res.json({ membershipStatus: MEMBERSHIP_STATUS.VERIFIED });
}

/**
 * POST /api/payments/webhook  (no auth — verified via Stripe signature)
 * Durable source of truth: activates membership when Stripe confirms the
 * payment, even if the user closed the tab before /confirm ran. Requires the
 * raw request body (mounted with express.raw in app.js) and STRIPE_WEBHOOK_SECRET.
 */
export async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    logger.error('Stripe webhook is not configured (missing secret key or webhook secret)');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      webhookSecret,
    );
  } catch (error) {
    logger.warn({ err: error }, 'Stripe webhook signature verification failed');
    // Don't reflect the exception text in the response body (CodeQL: exception
    // text reinterpreted as HTML). The detail is logged above; Stripe only needs
    // the 400 status to know delivery failed.
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const userId = paymentIntent.metadata?.userId;

    if (paymentIntent.metadata?.purpose === PAYMENT_PURPOSE && userId) {
      try {
        await activateMembership({
          userId,
          actorUserId: null, // system-initiated
          reason: `Stripe webhook (${paymentIntent.id})`,
        });
        // The webhook is the durable writer for the payment ledger (AC7):
        // activation is idempotent, so failing here makes Stripe redeliver
        // until both the status flip and the ledger row have landed.
        await recordMembershipPayment({ stripe, paymentIntent, userId });
      } catch (error) {
        logger.error({ err: error, userId }, 'Failed to activate membership from webhook');
        // 500 so Stripe retries the delivery.
        return res.status(500).json({ received: false });
      }
    }
  }

  return res.json({ received: true });
}

export default {
  createMembershipPaymentIntent,
  confirmMembershipPayment,
  handleStripeWebhook,
};
