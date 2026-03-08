import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Mail, Shield, Users, Calendar, ChevronLeft, LogOut, Hash, User, Settings } from 'lucide-react';

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

export function Profile() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const { ref: containerRef, inView } = useInViewCustom({ once: true });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleLogout = () => {
    logout();
    showToast('You have signed out', 'info');
    navigate('/');
  };

  if (isLoading || !user) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#eb7524]/30 border-t-[#eb7524] rounded-full animate-spin" />
      </div>
    );
  }

  const isExec = user.role === 'ADMIN';
  const roleLabel = isExec ? 'Executive' : 'Member';
  const fullName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.email;

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
            to="/"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
            style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px' }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </Link>
        </div>

        <div className="flex flex-col items-center">
          {/* Profile Card */}
          <div
            className="w-full max-w-[520px]"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Header banner */}
              <div className="h-24 bg-gradient-to-r from-[#eb7524]/20 via-[#eb7524]/10 to-transparent relative">
                <div className="absolute -bottom-8 left-8">
                  <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border-2 border-[#eb7524]/30 flex items-center justify-center shadow-lg">
                    {isExec ? (
                      <Shield className="w-7 h-7 text-[#eb7524]" />
                    ) : (
                      <Users className="w-7 h-7 text-[#eb7524]" />
                    )}
                  </div>
                </div>
              </div>

              {/* User info */}
              <div className="pt-12 px-8 pb-8">
                <div className="flex items-center gap-3 mb-1">
                  <h1
                    className="text-white"
                    style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                  >
                    {fullName}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isExec
                        ? 'bg-[#eb7524]/15 text-[#eb7524] border border-[#eb7524]/25'
                        : 'bg-white/5 text-white/50 border border-white/10'
                    }`}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {isExec ? 'EXEC' : 'MEMBER'}
                  </span>
                </div>
                <p className="text-white/40 mb-8" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                  Auckland University Strength Society
                </p>

                {/* Info cards */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-[#eb7524]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white/40 text-xs mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Name</p>
                      <p className="text-white truncate" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                        {fullName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-[#eb7524]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white/40 text-xs mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Email</p>
                      <p className="text-white truncate" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {user.studentId && (
                    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
                      <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center flex-shrink-0">
                        <Hash className="w-5 h-5 text-[#eb7524]" />
                      </div>
                      <div>
                        <p className="text-white/40 text-xs mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Student ID</p>
                        <p className="text-white" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                          {user.studentId}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center flex-shrink-0">
                      {isExec ? (
                        <Shield className="w-5 h-5 text-[#eb7524]" />
                      ) : (
                        <Users className="w-5 h-5 text-[#eb7524]" />
                      )}
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Role</p>
                      <p className="text-white" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                        {roleLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4">
                    <div className="w-10 h-10 rounded-xl bg-[#eb7524]/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-[#eb7524]" />
                    </div>
                    <div>
                      <p className="text-white/40 text-xs mb-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>Status</p>
                      <p className="text-green-400" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                        Verified ✓
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sign out */}
                {isExec && (
                  <Link
                    to="/manage"
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#eb7524]/10 border border-[#eb7524]/20 text-[#eb7524] hover:bg-[#eb7524]/15 hover:border-[#eb7524]/30 transition-all"
                    style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}
                  >
                    <Settings className="w-4 h-4" />
                    Manage Links
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className={`w-full ${isExec ? 'mt-3' : 'mt-6'} flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/60 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all cursor-pointer`}
                  style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
