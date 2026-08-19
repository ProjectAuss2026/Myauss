import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { X, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchWithAuth } from '../lib/authFetch';

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
};

interface RSVPModalProps {
  open: boolean;
  activityId: number;
  activityTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RSVPModal({ open, activityId, activityTitle, onClose, onSuccess }: RSVPModalProps) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Events are members-only (KAN-178): RSVP requires sign-in plus an active
  // membership, and the booking is taken from the account rather than typed in.
  const isSignedIn = Boolean(user);
  // Mirror the server-side rule in requireVerifiedMembership: ADMIN/OWNER are
  // exempt from the membership requirement, since staff run events and must not
  // be blocked by their own membership state. Keep these two in step.
  const canBook = isAdmin || user?.membershipStatus === 'VERIFIED';
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  // Reset state whenever the modal is opened/closed
  useEffect(() => {
    if (open) {
      setApiError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setSubmitting(true);
    try {
      // No body: the server takes the attendee's details from the account.
      const res = await fetchWithAuth(`/api/activities/${activityId}/rsvp`, {
        method: 'POST',
      });

      if (res.ok) {
        setSuccess(true);
        if (onSuccess) onSuccess();
        return;
      }

      let message = 'Something went wrong. Please try again.';
      if (res.status === 401) {
        message = 'Your session has expired. Please sign in again.';
      } else if (res.status === 403) {
        // Machine-readable code rather than string-matching the message.
        const body = await res.json().catch(() => null);
        message =
          body?.code === 'MEMBERSHIP_REQUIRED'
            ? 'An active AUSS membership is required to register for events.'
            : 'You do not have permission to register for this event.';
      } else if (res.status === 404) {
        message = 'This activity is no longer available.';
      } else if (res.status === 409) {
        message = 'This event is sold out, or you are already registered for it.';
      }
      setApiError(message);
    } catch (err) {
      console.error('RSVP submit error:', err);
      setApiError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h3
              className="text-white"
              style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
            >
              {success ? 'You\u2019re registered!' : 'RSVP for this event'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-white/40 hover:text-white/80 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {activityTitle && !success && (
            <p
              className="text-white/50 mb-5"
              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
            >
              {activityTitle}
            </p>
          )}

          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <p
                className="text-white/80 mb-6"
                style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
              >
                Your RSVP has been submitted successfully. We've saved your spot
                {activityTitle ? ` for ${activityTitle}` : ''}.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer"
                style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                Done
              </button>
            </div>
          ) : !isSignedIn ? (
            <div className="py-2">
              <div className="w-14 h-14 rounded-full bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-white/50" />
              </div>
              <p
                className="text-white/70 text-center mb-6"
                style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
              >
                Events are for AUSS members. Sign in to register — we&rsquo;ll use the details on your account.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                  style={{ fontSize: '14px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="flex-1 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer"
                  style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  Sign in
                </button>
              </div>
            </div>
          ) : !canBook ? (
            <div className="py-2">
              <div className="w-14 h-14 rounded-full bg-[#eb7524]/15 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-[#eb7524]" />
              </div>
              <p
                className="text-white/70 text-center mb-6"
                style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
              >
                You need an active AUSS membership to register for events. Activate yours to book a place.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                  style={{ fontSize: '14px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/verify-membership')}
                  className="flex-1 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer"
                  style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  Activate membership
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <p
                className="text-white/50"
                style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
              >
                You&rsquo;re registering with the details on your AUSS account.
              </p>

              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4 space-y-2">
                {displayName && (
                  <div>
                    <span className="block text-white/40" style={labelStyle}>Name</span>
                    <span className="text-white" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                      {displayName}
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-white/40" style={labelStyle}>Email</span>
                  <span className="text-white" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                    {user?.email}
                  </span>
                </div>
              </div>

              {apiError && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p
                    className="text-red-300"
                    style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                  >
                    {apiError}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontSize: '14px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Registering...' : 'Confirm RSVP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
