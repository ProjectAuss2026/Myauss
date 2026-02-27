import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser, verifyUser, resendCode } from '../services/authApi';

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('register'); // 'register' | 'verify'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const data = await registerUser(email, password);
      setMessage(data.message);
      setStep('verify');
      setCooldown(60);
    } catch (err) {
      // If backend says PENDING_VERIFICATION, go to verify step
      if (err.status === 'PENDING_VERIFICATION') {
        setMessage(err.message);
        setStep('verify');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const data = await resendCode(email);
      setMessage(data.message);
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await verifyUser(email, code);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="badge">AUSS</span>
        <h2>{step === 'register' ? 'Create Account' : 'Verify Email'}</h2>

        {error && <div className="auth-error">{error}</div>}
        {message && step === 'verify' && <div className="auth-success">{message}</div>}

        {step === 'register' ? (
          <form onSubmit={handleRegister} className="auth-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@auckland.ac.nz"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
            </label>
            <label>
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
              />
            </label>
            <button type="submit" className="primary auth-btn" disabled={loading}>
              {loading ? 'Sending…' : 'Register'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="auth-form">
            <p className="auth-hint">
              A verification code was sent to <strong>{email}</strong>
            </p>
            <label>
              Verification Code
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
              />
            </label>
            <button type="submit" className="primary auth-btn" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & Create Account'}
            </button>
            <button
              type="button"
              className="secondary auth-btn"
              onClick={handleResend}
              disabled={cooldown > 0}
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
