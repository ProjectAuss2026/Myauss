import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Mail, ChevronLeft, RefreshCw, CheckCircle } from 'lucide-react';

function useInViewCustom(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (options?.once) observer.disconnect();
        } else if (!options?.once) {
          setInView(false);
        }
      },
      { rootMargin: options?.margin || '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

export function Verify() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUserFromToken } = useAuth();
  const { showToast } = useToast();

  const email = (location.state as any)?.email || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { ref: containerRef, inView } = useInViewCustom({ once: true });

  // If no email in state, redirect back to login
  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every((d) => d !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;

    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || '';
    }
    setCode(newCode);
    setError(null);

    // Focus the next empty input or the last one
    const nextEmpty = newCode.findIndex((d) => d === '');
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();

    // Auto-submit if all filled
    if (newCode.every((d) => d !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleVerify = async (codeStr?: string) => {
    const fullCode = codeStr || code.join('');
    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed.');
        showToast(data.error || 'Verification failed', 'error');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success — update auth context (triggers nav re-render)
      setUserFromToken(data.token, data.user);
      setSuccess(true);
      showToast('Email verified! Welcome to AUSS', 'success');

      // Brief success animation, then navigate
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setResendLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend code.');
        showToast(data.error || 'Failed to resend code', 'error');
        return;
      }

      setCooldown(60);
      showToast('Verification code resent', 'success');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  if (!email) return null;

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#eb7524]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#eb7524]/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-20 relative" ref={containerRef}>
        {/* Back link */}
        <div
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
            style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px' }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Login
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center">
          {/* Card */}
          <div
            className="w-full max-w-[440px]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {success ? (
                /* ── Success State ── */
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h2
                    className="text-white mb-2"
                    style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                  >
                    Email Verified!
                  </h2>
                  <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                    Welcome to AUSS. Redirecting you now...
                  </p>
                </div>
              ) : (
                /* ── Verify Form ── */
                <>
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-[#eb7524]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-7 h-7 text-[#eb7524]" />
                    </div>
                    <h2
                      className="text-white mb-1"
                      style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                    >
                      Verify Your Email
                    </h2>
                    <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                      We sent a 6-digit code to
                    </p>
                    <p className="text-[#eb7524] mt-1" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                      {email}
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* OTP Input Grid */}
                    <div className="flex justify-center gap-3 mb-6">
                      {code.map((digit, i) => (
                        <input
                          key={i}
                          ref={(el) => { inputRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleChange(i, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(i, e)}
                          onPaste={i === 0 ? handlePaste : undefined}
                          disabled={loading}
                          className={`
                            w-12 h-14 text-center text-xl font-semibold rounded-xl
                            bg-white/[0.04] border transition-all duration-200
                            text-white placeholder:text-white/20
                            focus:outline-none focus:bg-white/[0.06]
                            disabled:opacity-50
                            ${digit
                              ? 'border-[#eb7524]/50 bg-[#eb7524]/[0.06]'
                              : 'border-white/10 focus:border-[#eb7524]/50'
                            }
                          `}
                          style={{ fontFamily: 'Outfit, sans-serif', caretColor: '#eb7524' }}
                        />
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || code.some((d) => d === '')}
                      className="w-full bg-[#eb7524] text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                      style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                    >
                      {loading ? 'Verifying...' : 'Verify Email'}
                    </button>
                  </form>

                  {/* Resend */}
                  <div className="mt-6 pt-6 border-t border-white/[0.06] text-center">
                    <p className="text-white/40 mb-3" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      Didn't receive the code?
                    </p>
                    {cooldown > 0 ? (
                      <p className="text-white/30" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                        Resend available in{' '}
                        <span className="text-[#eb7524]/70 font-medium">{cooldown}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="inline-flex items-center gap-2 text-[#eb7524] hover:text-[#eb7524]/80 transition-colors cursor-pointer disabled:opacity-50"
                        style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                      >
                        <RefreshCw className={`w-4 h-4 ${resendLoading ? 'animate-spin' : ''}`} />
                        {resendLoading ? 'Sending...' : 'Resend Code'}
                      </button>
                    )}
                  </div>

                  {/* Check spam hint */}
                  <p
                    className="text-center text-white/20 mt-4"
                    style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
                  >
                    Check your spam folder if you don't see the email. In dev mode, the code is logged in the backend terminal.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
