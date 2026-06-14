import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitted(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        const message = data.error || 'Unable to request a reset link.';
        setError(message);
        showToast(message, 'error');
        return;
      }

      setSent(true);
      showToast('Password reset email sent', 'success');
    } catch {
      setError('Network error. Please try again.');
      showToast('Network error. Please try again.', 'error');
    } finally {
      setSubmitted(false);
    }
  };

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#eb7524]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#eb7524]/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-20 relative">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
          style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px' }}
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </Link>

        <div className="flex justify-center">
          <div
            className="w-full max-w-[440px]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {sent ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-7 h-7 text-green-400" />
                  </div>
                  <h1 className="text-white mb-2" style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                    Check your email
                  </h1>
                  <p className="text-white/50 mb-6" style={{ fontSize: '14px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
                    If your email is registered, a password reset link has been sent.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 bg-[#eb7524] text-white px-6 py-3 rounded-xl hover:bg-[#d4691f] transition-all active:scale-[0.98]"
                    style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                  >
                    Return to Login
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <h1 className="text-white mb-1" style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                    Reset Password
                  </h1>
                  <p className="text-white/40 mb-6" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                    Enter your account email
                  </p>

                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-white/60 mb-1.5" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@auckland.ac.nz"
                          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all"
                          style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitted}
                      className="w-full bg-[#eb7524] text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                      style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                    >
                      {submitted ? 'Sending...' : 'Send Reset Link'}
                      {!submitted && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}