import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import type { Appearance, StripePaymentElementOptions } from '@stripe/stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { fetchWithAuth } from '../lib/authFetch';
import {
  ChevronLeft,
  Lock,
  ShieldCheck,
  Check,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { stripePromise, isStripeConfigured } from '../lib/stripe';

const MEMBERSHIP_PRICE = '$20.00';
const MEMBERSHIP_CURRENCY = 'NZD';
const MEMBERSHIP_PERIOD = '1 Semester';

const INCLUDED = [
  'Full access to all AUSS sessions & events',
  'Member-only socials and competitions',
  'Discounted merch and partner offers',
  'Verified member status on your AUSS pass',
];

// Match the Stripe Payment Element to the app's dark / orange theme.
const appearance: Appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#eb7524',
    colorBackground: '#1a1a1a',
    colorText: '#ffffff',
    colorDanger: '#f87171',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '12px',
  },
};

const paymentElementOptions: StripePaymentElementOptions = {
  layout: 'tabs',
};

/**
 * Inner form — must live inside <Elements> so the Stripe hooks have context.
 * Renders the Payment Element (cards + Apple Pay / Google Pay) and confirms
 * payment. The raw <input> card fields are gone: Stripe owns those for PCI.
 */
function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { refreshUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  // True while we resolve the outcome of a redirect-based payment on return.
  const [verifying, setVerifying] = useState(() =>
    new URLSearchParams(window.location.search).has('payment_intent_client_secret')
  );

  // When Stripe redirects back here after an authenticated/redirect payment,
  // read the outcome from the URL and show the result.
  useEffect(() => {
    if (!stripe) return;
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );
    if (!clientSecret) return;

    stripe
      .retrievePaymentIntent(clientSecret)
      .then(({ paymentIntent }) => {
        switch (paymentIntent?.status) {
          case 'succeeded':
            setSucceeded(true);
            setMessage('Payment successful — your membership is now active.');
            // Verify the payment server-side and flip the account to VERIFIED,
            // then refresh the cached user so the dashboard unlocks.
            fetchWithAuth('/api/payments/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
            })
              .then(() => refreshUser())
              .catch(() => {
                /* Webhook is the backstop if this fails. */
              });
            break;
          case 'processing':
            setMessage('Your payment is processing. We’ll confirm shortly.');
            break;
          case 'requires_payment_method':
            setMessage('Payment was not completed. Please try again.');
            break;
          default:
            break;
        }
      })
      .finally(() => setVerifying(false));
  }, [stripe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe sends the user here after any redirect-based method.
        return_url: `${window.location.origin}/membership/pay`,
      },
    });

    // We only reach here if there was an immediate error (no redirect).
    if (error) {
      setMessage(error.message ?? 'Something went wrong with your payment.');
      setSubmitting(false);
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10 flex-1">
        <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/25 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7 text-green-400" />
        </div>
        <h3
          className="text-white mb-2"
          style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          Membership active
        </h3>
        <p className="text-white/50" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
          {message}
        </p>
        <Link
          to="/dashboard"
          className="mt-6 px-6 py-3 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all"
          style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', fontWeight: 600 }}
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
        <Loader2 className="w-7 h-7 text-[#eb7524] animate-spin" />
        <span className="text-white/50" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
          Confirming your payment…
        </span>
      </div>
    );
  }

  return (
    <form className="flex flex-col flex-1" onSubmit={handleSubmit}>
      <PaymentElement options={paymentElementOptions} />

      {message && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <span className="text-red-300" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
            {message}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full mt-6 py-4 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] hover:shadow-[0_4px_12px_rgba(235,117,36,0.4)] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ fontFamily: 'Outfit, sans-serif', fontSize: '16px', fontWeight: 600 }}
      >
        {submitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Processing…
          </>
        ) : (
          <>Pay {MEMBERSHIP_PRICE} {MEMBERSHIP_CURRENCY}</>
        )}
      </button>

      {/* Secure footer */}
      <div className="flex items-center justify-center gap-2 mt-auto pt-6 text-white/30">
        <Lock className="w-3.5 h-3.5" />
        <span style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
          Payments are secure and encrypted · Powered by Stripe
        </span>
      </div>
    </form>
  );
}

export function MembershipPayment() {
  const { user, isAdmin, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Already-active members can't pay again — send them back to the dashboard.
  // (The success screen still renders because it lands here via the Stripe
  // redirect before the user is refreshed to VERIFIED.)
  const hasReturnParams = new URLSearchParams(window.location.search).has(
    'payment_intent_client_secret'
  );
  const isActiveMember = isAdmin || user?.membershipStatus === 'VERIFIED';
  useEffect(() => {
    if (isLoading || hasReturnParams) return;
    if (!isAuthenticated) {
      navigate('/login');
    } else if (isActiveMember) {
      navigate('/dashboard');
    }
  }, [isLoading, isAuthenticated, isActiveMember, hasReturnParams, navigate]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Ask the backend to create a PaymentIntent and hand back its client secret.
  useEffect(() => {
    if (!isStripeConfigured) {
      setLoadError('Payments are not configured yet. Add your Stripe keys to enable checkout.');
      return;
    }

    // Returning from a Stripe redirect: reuse the completed intent's client
    // secret from the URL so <Elements>/CheckoutForm mount and can read the
    // outcome + activate the membership. Don't create a fresh intent.
    const returnedSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );
    if (returnedSecret) {
      setClientSecret(returnedSecret);
      return;
    }

    // Already-active members shouldn't be starting a new payment.
    if (isActiveMember) return;

    let cancelled = false;
    fetchWithAuth('/api/payments/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Failed to start payment');
        if (!cancelled) setClientSecret(data.clientSecret);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to start payment');
      });

    return () => {
      cancelled = true;
    };
  }, [hasReturnParams, isActiveMember]);

  const fade = (delay = 0) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
  });

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-200 h-100 bg-[#eb7524]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-100 h-100 bg-[#eb7524]/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-300 mx-auto px-6 py-12 md:py-20 relative">
        {/* Back link */}
        <div style={fade(0)}>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
            style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px' }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
        </div>

        {/* Heading */}
        <div style={fade(0.05)} className="mb-10">
          <h1
            className="text-white mb-2"
            style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            Complete your membership
          </h1>
          <p className="text-white/40" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
            Pay securely to activate your AUSS membership instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 items-stretch">
          {/* ---------- LEFT: Order summary ---------- */}
          <div style={fade(0.1)} className="flex">
            <div className="w-full bg-[#111] border border-white/6 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col">
              {/* Banner */}
              <div className="h-20 bg-linear-to-r from-[#eb7524]/20 via-[#eb7524]/10 to-transparent relative">
                <div className="absolute -bottom-6 left-7">
                  <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border-2 border-[#eb7524]/30 flex items-center justify-center shadow-lg">
                    <ShieldCheck className="w-6 h-6 text-[#eb7524]" />
                  </div>
                </div>
              </div>

              <div className="pt-10 px-7 pb-7 flex flex-col flex-1">
                <h2
                  className="text-white mb-1"
                  style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  AUSS Membership
                </h2>
                <p className="text-white/40 mb-6" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  Auckland University Strength Society
                </p>

                {/* What's included */}
                <ul className="space-y-3 mb-7">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="w-5 h-5 mt-0.5 rounded-full bg-[#eb7524]/15 border border-[#eb7524]/25 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-[#eb7524]" />
                      </span>
                      <span
                        className="text-white/70"
                        style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Price breakdown */}
                <div className="mt-auto border-t border-white/8 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white/50" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                      Membership
                    </span>
                    <span className="text-white/70" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                      {MEMBERSHIP_PRICE}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/50 flex items-center gap-1.5" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                      <Calendar className="w-3.5 h-3.5" /> Period
                    </span>
                    <span className="text-white/70" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                      {MEMBERSHIP_PERIOD}
                    </span>
                  </div>
                  <div className="border-t border-white/8 pt-4 flex items-center justify-between">
                    <span className="text-white" style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                      Total
                    </span>
                    <span className="text-white" style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                      {MEMBERSHIP_PRICE}{' '}
                      <span className="text-white/40" style={{ fontSize: '13px', fontWeight: 400 }}>
                        {MEMBERSHIP_CURRENCY}
                      </span>
                    </span>
                  </div>
                  <p
                    className="text-white/35 pt-1"
                    style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                  >
                    A card processing surcharge applies and will be included in your final
                    payment total.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- RIGHT: Payment panel ---------- */}
          <div style={fade(0.15)} className="flex">
            <div className="w-full bg-[#111] border border-white/6 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-7 md:p-8 flex flex-col">
              {loadError ? (
                <div className="flex flex-col items-center justify-center text-center flex-1 py-10">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-4">
                    <AlertCircle className="w-7 h-7 text-red-400" />
                  </div>
                  <p className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                    {loadError}
                  </p>
                </div>
              ) : !clientSecret ? (
                <div className="flex flex-col items-center justify-center flex-1 py-16 gap-3">
                  <Loader2 className="w-7 h-7 text-[#eb7524] animate-spin" />
                  <span className="text-white/40" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                    Loading secure checkout…
                  </span>
                </div>
              ) : (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                  <CheckoutForm />
                </Elements>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
