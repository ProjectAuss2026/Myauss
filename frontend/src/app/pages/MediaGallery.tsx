import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ExternalLink, Image as ImageIcon, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSafeImageSrc, getSafeLinkHref } from '../../lib/safeUrl';

// ─── Intersection-observer scroll hook ──────────────────────────────────────

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

function FadeIn({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface MediaEntry {
  id: number;
  mediaDriveUrl: string;
  resolvedName: string;
  resolvedCover: string | null;
  activity: {
    startTime: string;
  };
}

// ─── Bento column spans for the first 6 entries ──────────────────────────────

const BENTO_CLASSES = [
  'col-span-12 md:col-span-7 md:row-span-2', // hero — wide + tall
  'col-span-12 md:col-span-5',
  'col-span-12 md:col-span-5',
  'col-span-6 md:col-span-4',
  'col-span-6 md:col-span-3',
  'col-span-12 md:col-span-5',
] as const;

// ─── Gallery card ─────────────────────────────────────────────────────────────

function GalleryCard({ entry }: { entry: MediaEntry }) {
  const safeHref = getSafeLinkHref(entry.mediaDriveUrl);
  const safeCover = getSafeImageSrc(entry.resolvedCover);
  if (!safeHref) return null;

  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="relative overflow-hidden rounded-2xl group cursor-pointer block h-full"
    >
      {safeCover ? (
        <img
          src={safeCover}
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
        <h3
          className="text-white font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif', fontSize: '17px' }}
        >
          {entry.resolvedName}
        </h3>
        <p
          className="text-white/50 flex items-center gap-1.5 mt-1 transition-all duration-300 group-hover:text-[#eb7524]"
          style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
        >
          View Photos
          <ExternalLink className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </p>
      </div>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MediaGallery() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const [entries, setEntries] = useState<MediaEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/media-entries')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setEntries(rows);
      })
      .catch((err) => {
        console.warn('[MediaGallery] Failed to fetch media entries:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const bentoEntries = entries.slice(0, 6);
  const extraEntries = entries.slice(6);

  return (
    <div className="bg-black min-h-screen">
      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-8 max-w-[1200px] mx-auto">
        <Link
          to="/social"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors duration-200"
          style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Social
        </Link>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative py-16 md:py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[150px]"
            style={{ backgroundColor: 'rgba(235,117,36,0.08)' }}
          />
        </div>
        <div
          className="max-w-[800px] mx-auto text-center relative"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{ backgroundColor: 'rgba(235,117,36,0.1)', color: '#eb7524' }}
          >
            <Camera className="w-4 h-4" />
            <span style={{ fontSize: '13px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
              Photo Gallery
            </span>
          </div>
          <h1
            className="text-white mb-4"
            style={{
              fontSize: 'clamp(32px, 5vw, 52px)',
              fontWeight: 700,
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            Event <span className="text-[#eb7524]">Memories</span>
          </h1>
          <p
            className="text-white/50 max-w-lg mx-auto"
            style={{ fontSize: '17px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}
          >
            Browse our collection of event photos and highlights.
          </p>
        </div>
      </section>

      {/* ── Gallery Grid ────────────────────────────────────────────────────── */}
      <section className="px-6 pb-24">
        <FadeIn className="max-w-[1200px] mx-auto">
          {loading ? (
            <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: '240px' }}>
              {BENTO_CLASSES.map((cls, i) => (
                <div
                  key={i}
                  className={`${cls} h-[260px] md:h-full bg-[#111] rounded-2xl animate-pulse`}
                />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-24">
              <p
                className="text-white/30"
                style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}
              >
                No galleries available yet.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-3" style={{ gridAutoRows: '240px' }}>
                {bentoEntries.map((entry, i) => (
                  <div key={entry.id} className={`${BENTO_CLASSES[i]} h-[260px] md:h-full`}>
                    <GalleryCard entry={entry} />
                  </div>
                ))}
              </div>

              {extraEntries.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  {extraEntries.map((entry) => (
                    <div key={entry.id} className="h-[260px]">
                      <GalleryCard entry={entry} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </FadeIn>
      </section>
    </div>
  );
}
