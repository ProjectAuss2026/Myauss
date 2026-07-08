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
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
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
