import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/sponsorship', label: 'Sponsorship' },
  { to: '/social', label: 'Social' },
  { to: '/meet-the-execs', label: 'Meet the Execs' },
];

export function Navigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-black/80 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.3)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link
          to="/"
          className="text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
          style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '20px' }}
        >
          <div className="w-8 h-8 bg-[#eb7524] rounded-lg flex items-center justify-center text-white text-sm font-bold">
            A
          </div>
          AUSS
        </Link>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'text-[#eb7524] bg-[#eb7524]/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Join AUSS Button (Desktop) */}
        <div className="hidden md:block">
          <Link to="/login">
            <div
              className="bg-[#eb7524] text-white px-5 py-2 rounded-xl flex items-center gap-1.5 text-sm hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.3)] active:scale-[0.97]"
              style={{ fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Join AUSS
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white/70 hover:text-white transition-colors p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`block px-4 py-3 rounded-xl text-sm transition-all ${
                  isActive
                    ? 'text-[#eb7524] bg-[#eb7524]/10'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            to="/login"
            className="block mt-3"
          >
            <div
              className="bg-[#eb7524] text-white text-center px-5 py-3 rounded-xl text-sm hover:bg-[#d4691f] transition-all"
              style={{ fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Join AUSS
            </div>
          </Link>
        </div>
      )}
    </nav>
  );
}
