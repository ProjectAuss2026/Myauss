import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { logout } = useAuth();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or expired password reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    setSubmitted(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json();

      if (!response.ok) {
        const message = data.error || 'Password reset failed.';
        setError(message);
        showToast(message, 'error');
        return;
      }

      showToast('Password reset successful', 'success');
  await logout();
      navigate('/login');
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
              <h1 className="text-white mb-1" style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                Create New Password
              </h1>
              <p className="text-white/40 mb-6" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                Choose a new password for your account
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </div>
              )}

              {!token && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  Invalid or expired password reset token.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/60 mb-1.5" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Create a password"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all"
                      style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                      minLength={12}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-white/60 mb-1.5" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Confirm your password"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all"
                      style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitted || !token}
                  className="w-full bg-[#eb7524] text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  {submitted ? 'Resetting...' : 'Reset Password'}
                  {!submitted && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}