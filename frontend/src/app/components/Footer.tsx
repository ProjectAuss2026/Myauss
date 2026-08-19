/**
 * Footer.tsx — Site-wide footer with config-driven social icons.
 *
 * WHAT CHANGED:
 * - Replaced hardcoded socialIcons array with config-driven SocialCardModels.
 * - Social icon data now comes from `usePublicConfig()` hook which fetches
 *   GET /api/public-config and falls back to DEFAULT_PUBLIC_CONFIG.
 * - Skeleton placeholders render while the config is loading.
 *
 * HOW BACKEND PLUGS IN:
 * Implement GET /api/public-config returning a body that matches PublicConfig.
 * The hook will pick it up automatically — no changes needed here.
 *
 * WHY FALLBACK EXISTS:
 * Until the backend route is created, the fetch will 404. The hook falls
 * back to DEFAULT_PUBLIC_CONFIG so the footer always shows 6 social icons.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { usePublicConfig } from '../../lib/usePublicConfig';
import { buildSocialCards } from '../../lib/socialCards';
import { getSafeLinkHref } from '../../lib/safeUrl';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/sponsorship', label: 'Sponsorship' },
  { to: '/social', label: 'Social' },
  { to: '/meet-the-execs', label: 'Team' },
];

export function Footer() {
  // Fetch config (falls back to defaults if backend not available yet).
  const { config, loading } = usePublicConfig();

  // Derive the 6 social card models from the config's communications block.
  const socialCards = buildSocialCards(config.communications);

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
          <span className="text-white/25 hover:text-white/50 transition-colors cursor-pointer" style={{ fontFamily: 'Inter, sans-serif' }}>Membership</span>
          <span className="text-white/20">-</span>
          <span className="text-white/25 hover:text-white/50 transition-colors cursor-pointer" style={{ fontFamily: 'Inter, sans-serif' }}>Media/Photos</span>
          <span className="text-white/20">-</span>
          <span className="text-white/25 hover:text-white/50 transition-colors cursor-pointer" style={{ fontFamily: 'Inter, sans-serif' }}>Sponsorship</span>
        </div>

        {/* Divider */}
        <div className="w-[400px] max-w-full mx-auto h-px bg-white/5 mb-8" />

        {/* Social Icons — rendered from config-driven card models */}
        <div className="flex justify-center gap-5 mb-8">
          {loading
            ? /* Skeleton placeholders while config is loading */
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[40px] h-[40px] rounded-xl bg-white/[0.03] animate-pulse"
                />
              ))
            : socialCards.map((card) => {
                const safeHref = getSafeLinkHref(card.href);
                if (!safeHref) return null;
                const Icon = card.icon;
                return (
                  <a
                    key={card.key}
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-[40px] h-[40px] flex items-center justify-center rounded-xl bg-white/[0.03] hover:bg-[#eb7524]/10 transition-all hover:scale-110 hover:-translate-y-0.5 active:scale-95"
                    aria-label={card.label}
                  >
                    <Icon className="w-6 h-6 object-contain opacity-50 hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
        </div>

        <div className="mb-4 text-center">
          <Link
            to="/privacy"
            className="text-xs text-white/30 transition-colors hover:text-white/60"
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
