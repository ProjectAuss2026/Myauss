import React, { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const inputCls =
  'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all';

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  fontWeight: 500,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RSVPModalProps {
  open: boolean;
  activityId: number;
  activityTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FieldErrors {
  name?: string;
  email?: string;
  studentId?: string;
}

export function RSVPModal({ open, activityId, activityTitle, onClose, onSuccess }: RSVPModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state whenever the modal is opened/closed
  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setStudentId('');
      setFieldErrors({});
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

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) errs.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email.trim())) errs.email = 'Please enter a valid email address';
    if (!studentId.trim()) errs.studentId = 'Student ID is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          studentId: studentId.trim(),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        if (onSuccess) onSuccess();
        return;
      }

      let message = 'Something went wrong. Please try again.';
      if (res.status === 400) message = 'Please check the entered details.';
      else if (res.status === 404) message = 'This activity is no longer available.';
      else if (res.status === 409) message = 'This event is sold out or this email has already registered.';
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-white/60 mb-1.5" style={labelStyle}>
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className={inputCls}
                  style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                  disabled={submitting}
                  autoFocus
                />
                {fieldErrors.name && (
                  <p className="mt-1.5 text-red-400" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-white/60 mb-1.5" style={labelStyle}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                  style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                  disabled={submitting}
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-red-400" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-white/60 mb-1.5" style={labelStyle}>
                  Student ID
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. z1234567"
                  className={inputCls}
                  style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                  disabled={submitting}
                />
                <p className="mt-2 text-white/35" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                  Used to confirm Auckland Uni eligibility and manage event attendance. It is protected, not shown publicly, and may be visible to authorised organisers; contact auss@auckland.ac.nz for correction or removal. Final privacy wording should be confirmed by AUSS.
                </p>
                {fieldErrors.studentId && (
                  <p className="mt-1.5 text-red-400" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                    {fieldErrors.studentId}
                  </p>
                )}
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
                  {submitting ? 'Submitting...' : 'Submit RSVP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
