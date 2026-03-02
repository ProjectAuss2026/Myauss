import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, Users, ChevronLeft, Dumbbell } from 'lucide-react';

type View = 'login' | 'role-select' | 'register';
type Role = 'member' | 'exec' | null;

export function Login() {
  const [view, setView] = useState<View>('login');
  const [role, setRole] = useState<Role>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // No backend calls — UI demo only
    alert('Login submitted (demo only)');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Registration submitted (demo only)');
  };

  const roles = [
    {
      id: 'member' as Role,
      icon: Users,
      title: 'Member',
      description: 'Join as a regular member to access training sessions, events, and the AUSS community.',
    },
    {
      id: 'exec' as Role,
      icon: ShieldCheck,
      title: 'Committee',
      description: 'Apply to join the executive committee and help run AUSS operations.',
    },
  ];

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-20">
      <div
        className="w-full max-w-md"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#eb7524]/10 rounded-2xl mb-4">
            <Dumbbell className="w-7 h-7 text-[#eb7524]" />
          </div>
          <h1
            className="text-white mb-2"
            style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
          >
            {view === 'login' && 'Welcome Back'}
            {view === 'role-select' && 'Choose Your Role'}
            {view === 'register' && 'Create Account'}
          </h1>
          <p className="text-white/50" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
            {view === 'login' && 'Sign in to your AUSS account'}
            {view === 'role-select' && 'Select how you want to join AUSS'}
            {view === 'register' && `Registering as ${role === 'exec' ? 'Committee' : 'Member'}`}
          </p>
        </div>

        {/* Login View */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="bg-[#111] border border-white/5 rounded-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Mail className="w-5 h-5 text-white/30" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="bg-transparent text-white w-full outline-none placeholder:text-white/30"
                  style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Lock className="w-5 h-5 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="bg-transparent text-white w-full outline-none placeholder:text-white/30"
                  style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-white/50">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#eb7524] text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-colors active:scale-[0.98]"
              style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>

            <p className="text-center text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setView('role-select')}
                className="text-[#eb7524] hover:text-[#d4691f] transition-colors font-medium"
              >
                Register
              </button>
            </p>
          </form>
        )}

        {/* Role Select View */}
        {view === 'role-select' && (
          <div className="space-y-4">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = role === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`w-full bg-[#111] border rounded-xl p-5 text-left transition-all duration-300 ${
                    isSelected ? 'border-[#eb7524]/50 bg-[#eb7524]/5' : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-[#eb7524]/20' : 'bg-white/5'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-[#eb7524]' : 'text-white/40'}`} />
                    </div>
                    <div>
                      <h3
                        className="text-white mb-1"
                        style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                      >
                        {r.title}
                      </h3>
                      <p className="text-white/40 leading-relaxed" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                        {r.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => role && setView('register')}
              disabled={!role}
              className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                role
                  ? 'bg-[#eb7524] text-white hover:bg-[#d4691f] active:scale-[0.98]'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
              style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setView('login')}
              className="w-full text-center text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-1"
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Sign In
            </button>
          </div>
        )}

        {/* Register View */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="bg-[#111] border border-white/5 rounded-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <User className="w-5 h-5 text-white/30" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="bg-transparent text-white w-full outline-none placeholder:text-white/30"
                  style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Mail className="w-5 h-5 text-white/30" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="bg-transparent text-white w-full outline-none placeholder:text-white/30"
                  style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Lock className="w-5 h-5 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="bg-transparent text-white w-full outline-none placeholder:text-white/30"
                  style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-white/50">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Lock className="w-5 h-5 text-white/30" />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  className="bg-transparent text-white w-full outline-none placeholder:text-white/30"
                  style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#eb7524] text-white py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#d4691f] transition-colors active:scale-[0.98]"
              style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              Create Account
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setView('role-select')}
              className="w-full text-center text-white/40 hover:text-white/60 transition-colors flex items-center justify-center gap-1"
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Role Selection
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
