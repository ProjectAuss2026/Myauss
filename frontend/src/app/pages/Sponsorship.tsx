import React, { useEffect, useState, useRef } from 'react';
import { Mail, ArrowRight, Star, Users, Trophy, ExternalLink, Heart } from 'lucide-react';
import { getSafeImageSrc, getSafeLinkHref } from '../../lib/safeUrl';

interface ApiSponsor {
  id: number;
  name: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  websiteUrl: string | null;
}

interface ApiSponsorshipPayload {
  id: number;
  pageContent: string;
  sponsors: ApiSponsor[];
}

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

// ─── Sponsor card: homepage screenshot background, logo revealed on hover ────
function SponsorCard({ sponsor }: { sponsor: ApiSponsor }) {
  const safeWebsiteUrl = getSafeLinkHref(sponsor.websiteUrl);
  const safeHeroImageUrl = getSafeImageSrc(sponsor.heroImageUrl);
  const safeLogoUrl = getSafeImageSrc(sponsor.logoUrl);
  const className = `group block relative h-[260px] rounded-2xl overflow-hidden ${safeWebsiteUrl ? 'cursor-pointer' : ''}`;

  const content = (
    <>
      {/* Background: homepage screenshot */}
      {safeHeroImageUrl ? (
        <img
          src={safeHeroImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1c] to-[#0a0a0a]" />
      )}

      {/* Persistent gradient at bottom for name legibility */}
      <div
        className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)' }}
      />

      {/* Hover: full dark overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-500" />

      {/* Hover: glass pill slides up from below — never opacity:0 so backdrop-blur is always composited */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {safeLogoUrl ? (
          <div
            className="bg-white/15 backdrop-blur-md rounded-2xl px-7 py-5 max-w-[220px] flex items-center justify-center shadow-[0_0_24px_rgba(235,117,36,0.45)] translate-y-[300px] group-hover:translate-y-0 transition-transform duration-500 ease-out"
          >
            <img
              src={safeLogoUrl}
              alt={sponsor.name}
              className="h-[52px] max-w-[180px] w-auto object-contain drop-shadow-2xl"
            />
          </div>
        ) : (
          <span
            className="text-white drop-shadow-2xl translate-y-[300px] group-hover:translate-y-0 transition-transform duration-500 ease-out"
            style={{ fontSize: '52px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
          >
            {sponsor.name.charAt(0)}
          </span>
        )}
      </div>

      {/* Default bottom: name + link icon — slides out on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between transition-all duration-400 group-hover:translate-y-full group-hover:opacity-0 pointer-events-none">
        <p
          className="text-white leading-tight"
          style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          {sponsor.name}
        </p>
        <ExternalLink className="w-4 h-4 text-white/50 flex-shrink-0" />
      </div>
    </>
  );

  return safeWebsiteUrl ? (
    <a
      href={safeWebsiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={`Visit ${sponsor.name}`}
    >
      {content}
    </a>
  ) : (
    <div className={className} aria-label={sponsor.name}>
      {content}
    </div>
  );
}

const benefits = [
  { icon: Users, title: '200+ Members', text: 'Reach an active, engaged student community' },
  { icon: Trophy, title: '15+ Events/Year', text: 'Brand visibility at competitions and socials' },
  { icon: Star, title: '10k+ Social Reach', text: 'Exposure across Instagram, TikTok, and more' },
  { icon: Heart, title: 'Community Impact', text: 'Support student health, fitness, and wellbeing' },
];

export function Sponsorship() {
  const [mounted, setMounted] = useState(false);
  const [sponsorship, setSponsorship] = useState<ApiSponsorshipPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  useEffect(() => {
    fetch('/api/sponsorship')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (payload?.data) {
          setSponsorship(payload.data as ApiSponsorshipPayload);
        }
      })
      .catch((error) => {
        console.warn('[Sponsorship] Failed to fetch sponsorship data:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const pageContent = sponsorship?.pageContent || 'AUSS is proudly supported by our partners and sponsors.';
  const sponsors = sponsorship?.sponsors || [];

  return (
    <div className="bg-black min-h-screen">
      <section className="relative py-20 md:py-28 px-6 overflow-hidden">
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
            Our Partners
          </p>
          <h1 className="text-white mb-6" style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Sponsors <span className="text-[#eb7524]">&amp;</span> Partners
          </h1>
          <p className="text-white/50 max-w-lg mx-auto" style={{ fontSize: '17px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
            {pageContent}
          </p>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-white mb-3" style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Proudly Supported By
            </h2>
            <p className="text-white/40 max-w-md mx-auto" style={{ fontSize: '15px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
              Brands that believe in what we do — powering our events, training, and community.
            </p>
          </FadeIn>

          {/* Flex-wrap grid: centers any number of sponsors — single card stands alone, multiple wrap naturally */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[260px] bg-[#111] border border-white/[0.06] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : sponsors.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/30" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                No sponsors have been published yet.
              </p>
            </div>
          ) : (
            <div
              className={`grid gap-4 md:gap-5 ${
                sponsors.length === 1
                  ? 'grid-cols-1 max-w-[420px] mx-auto'
                  : sponsors.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-[860px] mx-auto'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {sponsors.map((sponsor, i) => (
                <FadeIn key={sponsor.id} delay={i * 0.05}>
                  <SponsorCard sponsor={sponsor} />
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Why Sponsor AUSS?
            </p>
            <h2 className="text-white mb-3" style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Benefits of Partnering With Us
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b, i) => {
              const BIcon = b.icon;
              return (
                <FadeIn key={b.title} delay={i * 0.08}>
                  <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-6 text-center h-full hover:border-white/10 transition-all duration-500">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(235,117,36,0.1)' }}>
                      <BIcon className="w-6 h-6 text-[#eb7524]" />
                    </div>
                    <h3 className="text-white mb-1" style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>{b.title}</h3>
                    <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}>{b.text}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px]" style={{ backgroundColor: 'rgba(235,117,36,0.05)' }} />
        </div>
        <FadeIn className="max-w-[700px] mx-auto relative">
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-10 md:p-12 text-center">
            <Mail className="w-10 h-10 text-[#eb7524] mx-auto mb-4" />
            <h2 className="text-white mb-3" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Become a Sponsor
            </h2>
            <p className="text-white/50 mb-8 max-w-md mx-auto" style={{ fontSize: '16px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>
              Interested in supporting Auckland&apos;s strongest student community? We offer flexible sponsorship packages.
            </p>
            <a
              href="mailto:auss@auckland.ac.nz?subject=Sponsorship%20Inquiry"
              className="inline-flex items-center gap-2 bg-[#eb7524] text-white px-8 py-3.5 rounded-xl hover:bg-[#d4691f] transition-all"
              style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              Get in Touch
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </FadeIn>
      </section>
    </div>
  );
}
