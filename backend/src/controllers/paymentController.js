import Stripe from 'stripe';
import logger from '../utils/logger.js';

// Membership pricing (overridable via env). Amount is in the smallest currency
// unit (cents). Defaults to NZ$20.00.
const MEMBERSHIP_PRICE_CENTS = Number.parseInt(process.env.MEMBERSHIP_PRICE_CENTS || '2000', 10);
const MEMBERSHIP_CURRENCY = (process.env.MEMBERSHIP_CURRENCY || 'nzd').toLowerCase();

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
 * POST /api/payments/intent
 * Creates a PaymentIntent for the membership fee and returns its client secret
 * so the frontend Payment Element can collect and confirm payment.
 */
export async function createMembershipPaymentIntent(_req, res) {
  const stripe = getStripe();

  if (!stripe) {
    logger.error('STRIPE_SECRET_KEY is not configured');
    return res.status(503).json({ error: 'Payments are not configured' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: MEMBERSHIP_PRICE_CENTS,
      currency: MEMBERSHIP_CURRENCY,
      // Lets Stripe enable cards + Apple Pay / Google Pay wallets automatically.
      automatic_payment_methods: { enabled: true },
      metadata: { purpose: 'auss_membership' },
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

export default { createMembershipPaymentIntent };
