import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const imgLogo = "/logo/AUSS_logo.png";

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/sponsorship', label: 'Sponsorship' },
  { to: '/social', label: 'Social' },
];

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0A0A0A]/90 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.3)] border-b border-white/5'
          : 'bg-[#0A0A0A] border-b border-white/10'
      }`}
      style={{
        transform: mounted ? 'translateY(0)' : 'translateY(-80px)',
        transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.5s, border-color 0.5s',
      }}
    >
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <img
              src={imgLogo}
              alt="AUSS Logo"
              className="w-14 h-14 object-cover rounded-full ring-2 ring-white/10 group-hover:ring-[#eb7524]/50 transition-all duration-300 hover:scale-105 active:scale-95"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="relative px-5 py-2 text-[15px] group"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                <span className={`relative z-10 transition-colors duration-300 ${
                  isActive(link.to) ? 'text-[#eb7524]' : 'text-white/80 group-hover:text-white'
                }`}>
                  {link.label}
                </span>
                {isActive(link.to) && (
                  <div className="absolute inset-0 bg-white/5 rounded-lg transition-all duration-300" />
                )}
              </Link>
            ))}

            {isAuthenticated ? (
              <div className="relative ml-4">
                <button
                  onClick={() => setProfileDropdown(!profileDropdown)}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-full bg-[#eb7524]/15 border border-[#eb7524]/30 flex items-center justify-center group-hover:bg-[#eb7524]/25 transition-all">
                    <User className="w-4 h-4 text-[#eb7524]" />
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${profileDropdown ? 'rotate-180' : ''}`} />
                </button>

                {profileDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#161616] border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/[0.06]">
                        <p className="text-white text-sm truncate" style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}>
                          {user?.email}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                          {user?.role === 'ADMIN' ? 'Executive' : 'Member'}
                        </p>
                      </div>
                      <div className="py-1">
                        <button
                          onClick={() => { setProfileDropdown(false); navigate('/profile'); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                        >
                          <User className="w-4 h-4" />
                          My Profile
                        </button>
                        <button
                          onClick={() => { setProfileDropdown(false); logout(); showToast('You have signed out', 'info'); navigate('/'); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-colors cursor-pointer"
                          style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/login" className="ml-4">
                <div
                  className="bg-[#eb7524] text-white px-5 py-2 rounded-full text-[15px] hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] hover:scale-[1.03] active:scale-[0.97]"
                  style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}
                >
                  Join AUSS
                </div>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white p-2 rounded-lg hover:bg-white/5 transition-colors active:scale-90 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className="md:hidden overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: mobileMenuOpen ? '400px' : '0',
            opacity: mobileMenuOpen ? 1 : 0,
          }}
        >
          <div className="py-4 border-t border-white/10 space-y-1">
            {navLinks.map((link) => (
              <div key={link.to}>
                <Link
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-3 px-3 rounded-lg transition-all ${
                    isActive(link.to) ? 'text-[#eb7524] bg-[#eb7524]/5' : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {link.label}
                </Link>
              </div>
            ))}
            <div className="pt-3 mt-2 border-t border-white/10 px-3">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 w-full py-3 text-white/80 hover:text-white transition-colors"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    <User className="w-4 h-4" />
                    My Profile
                  </Link>
                  <button
                    onClick={() => { setMobileMenuOpen(false); logout(); showToast('You have signed out', 'info'); navigate('/'); }}
                    className="flex items-center gap-3 w-full py-3 text-red-400/80 hover:text-red-400 transition-colors cursor-pointer"
                    style={{ fontFamily: 'Outfit, sans-serif' }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full text-center bg-[#eb7524] text-white py-3 rounded-xl hover:bg-[#d4691f] transition-all"
                  style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}
                >
                  Join AUSS
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
