import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/sponsorship', label: 'Sponsorship' },
  { to: '/social', label: 'Social' },
  { to: '/meet-the-execs', label: 'Team' },
];

export function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#0A0A0A] text-white relative">
      {/* Top divider with gradient */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-[1200px] mx-auto px-6 py-12">
        {/* Top row: Nav + Scroll to top */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
          <div className="flex items-center gap-8 flex-wrap justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-white/40 hover:text-white text-sm transition-colors"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <button
            onClick={scrollToTop}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#eb7524]/10 border border-white/10 hover:border-[#eb7524]/30 flex items-center justify-center transition-all cursor-pointer hover:scale-105 hover:-translate-y-0.5 active:scale-95"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Secondary Links */}
        <div className="flex justify-center gap-6 mb-8 flex-wrap text-sm">
          <Link
            to="/verify-membership"
            className="text-white/25 hover:text-white/50 transition-colors"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Membership
          </Link>
          <span className="text-white/20">-</span>
          <Link
            to="/media"
            className="text-white/25 hover:text-white/50 transition-colors"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Media/Photos
          </Link>
          <span className="text-white/20">-</span>
          <Link
            to="/sponsorship"
            className="text-white/25 hover:text-white/50 transition-colors"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Sponsorship
          </Link>
          <span className="text-white/20">-</span>
          <Link
            to="/privacy"
            className="text-white/25 hover:text-white/50 transition-colors"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Privacy Policy
          </Link>
        </div>

        {/* Copyright */}
        <div className="text-center text-white/20 text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
          &copy; {new Date().getFullYear()} Auckland University Strength Society. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
