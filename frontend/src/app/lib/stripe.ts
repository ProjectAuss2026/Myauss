import { loadStripe, type Stripe } from '@stripe/stripe-js';

// The publishable key is safe to expose in the frontend. Set it in your env as
// VITE_STRIPE_PUBLISHABLE_KEY (e.g. pk_test_... for test mode).
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

// loadStripe is called once at module load and the promise is reused, as Stripe
// recommends, so the script is only injected a single time.
export const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

export const isStripeConfigured = Boolean(publishableKey);
