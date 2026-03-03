/**
 * Social.tsx — Social & Media page with config-driven social cards.
 *
 * WHAT CHANGED (latest):
 * - ALL URLs (social links + media drive) now come from the single typed
 *   config object via `usePublicConfig()`. Zero hardcoded links remain.
 * - Photo Drive CTA uses `config.communications.media_drive_url`.
 * - Social cards section renders exactly 6 config-driven cards.
 *
 * HOW BACKEND PLUGS IN:
 * Implement GET /api/public-config returning a body matching PublicConfig.
 * The hook picks it up automatically — no changes needed here.
 *
 * WHY FALLBACK EXISTS:
 * Until the backend route is created, the fetch will 404. The hook falls
 * back to DEFAULT_PUBLIC_CONFIG so the page always shows exactly 6 cards
 * and a valid media drive URL.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Camera, ArrowRight } from 'lucide-react';
import { usePublicConfig } from '../../lib/usePublicConfig';
import { buildSocialCards } from '../../lib/socialCards';

// ─── Intersection-observer scroll hook ──────────────────────────────────────
// `once: true` (default) disconnects after the first intersection.

function useInViewCustom(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (options?.once !== false) obs.disconnect();
        }
      },
      { rootMargin: options?.margin || '0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ─── Scroll-triggered fade-in wrapper ───────────────────────────────────────

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInViewCustom({ once: true, margin: '-50px' });
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.6s ease ' + delay + 's, transform 0.6s ease ' + delay + 's',
      }}
    >
      {children}
    </div>
  );
}

// ─── Photo drive placeholder images (Unsplash) ─────────────────────────────
// These will eventually come from a Google Drive integration or CMS.

const photodriveImages = [
  { src: 'https://images.unsplash.com/photo-1770026136797-18659700b5b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Powerlifting deadlift session', label: 'Powerlifting Competition 2025' },
  { src: 'https://images.unsplash.com/photo-1761034114082-c2d63456a82a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Group training session', label: 'Training Session' },
  { src: 'https://images.unsplash.com/photo-1765109375988-912ce5ba5ffd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Team celebration', label: 'Team Event' },
  { src: 'https://images.unsplash.com/photo-1624513764372-a4eb7b334c62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Squat rack workout', label: 'Gym Session' },
  { src: 'https://images.unsplash.com/photo-1688521010890-0e58abbaf755?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Chalk hands barbell', label: 'Meet Day' },
];

export function Social() {
  // Mounted state drives the hero entrance animation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  // TODO: Once GET /api/public-config is implemented, this hook will
  // automatically use live data instead of the fallback defaults.
  const { config, loading } = usePublicConfig();

  // Derive the 6 social card models from the config's communications block.
  // `config` is NEVER null — see usePublicConfig for fallback strategy.
  const socialCards = buildSocialCards(config.communications);

  // Media drive URL from config — no hardcoded links in the component.
  const mediaDriveUrl = config.communications.media_drive_url;

  return (
    <div className="bg-black min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 px-6 overflow-hidden">
        {/* Radial glow behind the heading */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(235,117,36,0.08)' }} />
        </div>
        <div
          className="max-w-[800px] mx-auto text-center relative"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            Stay Connected
          </p>
          <h1 className="text-white mb-4" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Our <span className="text-[#eb7524]">Socials</span>
          </h1>
          <p className="text-white/50 max-w-lg mx-auto" style={{ fontSize: '17px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
            Follow us across every platform to never miss a training session, event, or PR celebration.
          </p>
        </div>
      </section>

      {/* ── Photo Drive Section ──────────────────────────────────────────── */}
      <section className="relative px-6 pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(235,117,36,0.05)' }} />
        </div>

        <div className="max-w-[1200px] mx-auto relative">
          <FadeIn className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: 'rgba(235,117,36,0.1)', color: '#eb7524' }}>
              <Camera className="w-4 h-4" />
              <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>Photo Drive</span>
            </div>
            <h2 className="text-white mb-4" style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Event Photos &amp; Highlights
            </h2>
            <p className="text-white/50 max-w-lg mx-auto" style={{ fontSize: '16px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
              Browse through photos from our training sessions, competitions, and social events.
              All our event photos are available in one place.
            </p>
          </FadeIn>

          {/* Photo Grid: featured image spans 2×2, remaining 4 fill the right column */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
            <FadeIn delay={0.1} className="col-span-2 row-span-2">
              <div className="relative h-full min-h-[280px] md:min-h-[400px] rounded-2xl overflow-hidden group cursor-pointer">
                <img src={photodriveImages[0].src} alt={photodriveImages[0].alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white/80" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{photodriveImages[0].label}</p>
                </div>
              </div>
            </FadeIn>
            {photodriveImages.slice(1).map((img, i) => (
              <FadeIn key={img.alt} delay={0.2 + i * 0.08}>
                <div className="relative h-[180px] md:h-[192px] rounded-2xl overflow-hidden group cursor-pointer">
                  <img src={img.src} alt={img.alt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-500" />
                  <div className="absolute bottom-3 left-3">
                    <p className="text-white/70" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>{img.label}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Drive CTA — URL comes from config.communications.media_drive_url */}
          <FadeIn delay={0.3}>
            <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(235,117,36,0.1)' }}>
                <Camera className="w-8 h-8 text-[#eb7524]" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-white mb-1" style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                  View Full Photo Drive
                </h3>
                <p className="text-white/40" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>
                  Access all event photos, competition shots, and training highlights in our Google Drive.
                  Feel free to download and share!
                </p>
              </div>
              {/* TODO: Backend will provide media_drive_url — currently uses placeholder */}
              <a
                href={mediaDriveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#eb7524] text-white px-8 py-3.5 rounded-xl hover:bg-[#d4691f] transition-all flex-shrink-0"
                style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                Open Drive
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Social Platform Cards (config-driven, always exactly 6) ────── */}
      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-white mb-4" style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Find Us Everywhere
            </h2>
            <p className="text-white/50 max-w-lg mx-auto" style={{ fontSize: '16px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
              Connect with AUSS across all our social platforms.
            </p>
          </FadeIn>

          {/*
           * Grid sizing strategy (equal cards):
           * - 1 col mobile, 2 cols md, 3 cols lg → 6 cards fill 2 complete rows.
           * - `items-stretch` forces every grid cell to the same row height.
           * - Each card uses `h-full` + `flex flex-col` so the CTA row is pushed
           *   to the bottom via `flex-1` on the description, keeping card content
           *   visually aligned regardless of description length.
           * - Equal `gap-5` (20 px) between all cards in both axes.
           */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {loading
              ? /* Skeleton cards while config loads (always 6) to prevent layout shift */
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-[#111] border border-white/[0.06] rounded-2xl p-7 animate-pulse h-full"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-5 w-28 bg-white/5 rounded" />
                        <div className="h-4 w-20 bg-white/5 rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-full bg-white/5 rounded mb-2" />
                    <div className="h-4 w-3/4 bg-white/5 rounded mb-6" />
                    <div className="h-4 w-24 bg-white/5 rounded" />
                  </div>
                ))
              : socialCards.map((card, i) => {
                  const Icon = card.icon;
                  return (
                    <FadeIn key={card.key} delay={i * 0.08}>
                      {/*
                       * Card link: `h-full` fills the stretched grid cell.
                       * Email uses no target since mailto: opens the mail client.
                       */}
                      <a
                        href={card.href}
                        target={card.key === 'email' ? undefined : '_blank'}
                        rel={card.key === 'email' ? undefined : 'noopener noreferrer'}
                        className="block group h-full"
                      >
                        {/*
                         * Equal-height strategy: outer <a> + inner div both use
                         * `h-full`. `flex flex-col` + `flex-1` on the description
                         * pushes the CTA to the card bottom regardless of text length.
                         */}
                        <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-7 h-full flex flex-col hover:border-white/10 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden">
                          {/* Hover glow — brand-colored blob behind the card */}
                          <div
                            className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                            style={{ backgroundColor: card.brandColor + '15' }}
                          />
                          <div className="relative flex flex-col flex-1">
                            {/* Icon + platform name row */}
                            <div className="flex items-center gap-4 mb-4">
                              <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110"
                                style={{ backgroundColor: card.brandColor + '12' }}
                              >
                                <Icon className="w-7 h-7" style={{ color: card.brandColor }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white mb-0.5" style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                                  {card.label}
                                </h3>
                                <p className="text-white/30 truncate" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                                  {card.handle}
                                </p>
                              </div>
                            </div>

                            {/* Description (flex-1 pushes the CTA to the card bottom) */}
                            <p className="text-white/45 mb-6 flex-1" style={{ fontSize: '14px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
                              {card.description}
                            </p>

                            {/* CTA row — always at the bottom thanks to flex layout */}
                            <div className="flex items-center gap-2 group-hover:gap-3 transition-all duration-300 mt-auto">
                              <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', color: card.brandColor }}>
                                {card.cta}
                              </span>
                              <ExternalLink className="w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5" style={{ color: card.brandColor }} />
                            </div>
                          </div>
                        </div>
                      </a>
                    </FadeIn>
                  );
                })}
          </div>
        </div>
      </section>
    </div>
  );
}
