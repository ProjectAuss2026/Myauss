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
import { ExternalLink, Camera, Globe, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { findPlatform } from '../pages/ManageLinks';
import type { IconType } from 'react-icons';

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

interface MediaEntry {
  id: number;
  mediaDriveUrl: string;
  resolvedName: string;
  resolvedCover: string | null;
}

export function Social() {
  // Mounted state drives the hero entrance animation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  // ── Fetch communication links + media drive URL from DB ───────────────
  const [mediaEntries, setMediaEntries] = useState<MediaEntry[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  useEffect(() => {
    fetch('/api/media-entries')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setMediaEntries(rows);
      })
      .catch((error) => {
        console.warn('[Social] Failed to fetch media entries:', error);
      })
      .finally(() => setMediaLoading(false));
  }, []);

  // ── Fetch communication links from DB ──────────────────────────────────
  interface DbLink {
    id: number;
    platform: string;
    url: string;
    imgUrl: string;
    description: string | null;
    isActive: boolean;
  }
  const [dbLinks, setDbLinks] = useState<DbLink[]>([]);
  const [dbLinksLoading, setDbLinksLoading] = useState(true);
  // Media drive URL — sourced from DB via /api/config (mediaConfig.mediaDriveUrl).
  const [mediaDriveUrl, setMediaDriveUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.communicationLinks) {
          const filtered = (data.communicationLinks as DbLink[]).filter(
            (l) => l.isActive
          );
          setDbLinks(filtered);
        }
        const url = data?.mediaConfig?.mediaDriveUrl;
        if (typeof url === 'string' && url.trim()) {
          setMediaDriveUrl(url.trim());
        }
      })
      .catch(() => {})
      .finally(() => setDbLinksLoading(false));
  }, []);

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

      {/* ── Gallery Preview Section ───────────────────────────────────────── */}
      <section className="relative px-6 pb-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(235,117,36,0.05)' }} />
        </div>

        <div className="max-w-[1200px] mx-auto relative">
          <FadeIn className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ backgroundColor: 'rgba(235,117,36,0.1)', color: '#eb7524' }}>
              <Camera className="w-4 h-4" />
              <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>Photo Gallery</span>
            </div>
            <h2 className="text-white mb-4" style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Captured Moments
            </h2>
            <p className="text-white/50 max-w-lg mx-auto" style={{ fontSize: '16px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
              Highlights from our events and sessions — powered by DB Visuals
            </p>
          </FadeIn>

          {mediaLoading ? (
            <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: '240px' }}>
              {([
                'col-span-12 md:col-span-7 md:row-span-2',
                'col-span-12 md:col-span-5',
                'col-span-12 md:col-span-5',
                'col-span-6 md:col-span-4',
                'col-span-6 md:col-span-3',
                'col-span-12 md:col-span-5',
              ] as const).map((cls, i) => (
                <div key={i} className={`${cls} h-[220px] md:h-full bg-[#111] rounded-2xl animate-pulse`} />
              ))}
            </div>
          ) : mediaEntries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>
                No galleries available yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: '240px' }}>
              {mediaEntries.slice(0, 6).map((entry, i) => {
                const colClass = [
                  'col-span-12 md:col-span-7 md:row-span-2',
                  'col-span-12 md:col-span-5',
                  'col-span-12 md:col-span-5',
                  'col-span-6 md:col-span-4',
                  'col-span-6 md:col-span-3',
                  'col-span-12 md:col-span-5',
                ][i];
                return (
                  <div key={entry.id} className={`${colClass} h-[220px] md:h-full`}>
                    <a
                      href={entry.mediaDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative overflow-hidden rounded-2xl group cursor-pointer block h-full"
                    >
                      {entry.resolvedCover ? (
                        <img
                          src={entry.resolvedCover}
                          alt={entry.resolvedName}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[#111] flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-white/15" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                        <h3 className="text-white font-semibold" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '17px' }}>
                          {entry.resolvedName}
                        </h3>
                        <p className="text-white/50 flex items-center gap-1.5 mt-1 transition-all duration-300 group-hover:text-[#eb7524]"
                           style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                          View Photos
                          <ExternalLink className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </p>
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          )}

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
              {/* Drive URL is loaded from /api/config (mediaConfig.mediaDriveUrl). */}
              {mediaDriveUrl ? (
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
              ) : (
                <span
                  className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/10 text-white/50 px-8 py-3.5 rounded-xl flex-shrink-0"
                  style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                  aria-disabled="true"
                >
                  {dbLinksLoading ? 'Loading…' : 'Photo drive link unavailable'}
                </span>
              )}
            </div>
          </FadeIn>
          <div className="text-center mt-8">
            <Link to="/media">
              <button
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-white transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(235,117,36,0.2)]"
                style={{ backgroundColor: '#eb7524', fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                View Full Gallery
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Social Platform Cards (DB-driven) ────────────────────────── */}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
            {dbLinksLoading
              ? Array.from({ length: 6 }).map((_, i) => (
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
              : dbLinks.length === 0
              ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>
                    No social links added yet.
                  </p>
                </div>
              )
              : dbLinks.map((link, i) => {
                const platform = findPlatform(link.platform);
                const brandColor = platform?.color ?? '#eb7524';
                const IconComp: IconType | null = platform?.icon ?? null;

                return (
                  <FadeIn key={link.id} delay={i * 0.08}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group h-full"
                    >
                      <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-7 h-full flex flex-col hover:border-white/10 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden">
                        <div
                          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                          style={{ backgroundColor: brandColor + '15' }}
                        />
                        <div className="relative flex flex-col flex-1">
                          <div className="flex items-center gap-4 mb-4">
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 overflow-hidden"
                              style={{ backgroundColor: brandColor + '12' }}
                            >
                              {link.imgUrl === '__builtin__' && IconComp ? (
                                <IconComp className="w-7 h-7" style={{ color: brandColor }} />
                              ) : link.imgUrl && link.imgUrl !== '__builtin__' ? (
                                <img
                                  src={link.imgUrl}
                                  alt={link.platform}
                                  className="w-8 h-8 object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : IconComp ? (
                                <IconComp className="w-7 h-7" style={{ color: brandColor }} />
                              ) : (
                                <Globe className="w-7 h-7 text-white/30" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-white mb-0.5" style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                                {link.platform}
                              </h3>
                              <p className="text-white/30 truncate" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                                {link.url}
                              </p>
                            </div>
                          </div>

                          {/* Description */}
                          {link.description && (
                            <p className="text-white/45 mb-6 flex-1" style={{ fontSize: '14px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
                              {link.description}
                            </p>
                          )}

                          <div className="flex items-center gap-2 group-hover:gap-3 transition-all duration-300 mt-auto">
                            <span style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif', color: brandColor }}>
                              Visit
                            </span>
                            <ExternalLink className="w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5" style={{ color: brandColor }} />
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
