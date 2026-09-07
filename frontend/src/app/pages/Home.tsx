import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Dumbbell, Calendar, PartyPopper, ArrowRight, ChevronDown, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

function AnimatedCounter({ end, duration = 2, suffix = '' }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInViewCustom({ once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, end, duration]);

  return <div ref={ref}><span>{count}{suffix}</span></div>;
}

const stats = [
  { label: 'Active Members', value: 300, suffix: '+' },
  { label: 'Training Sessions', value: 50, suffix: '+' },
  { label: 'Years Running', value: 10, suffix: '' },
  { label: 'Events', value: 100, suffix: '+' },
];

const features = [
  {
    icon: Users,
    title: 'Inclusive Community',
    description: 'A welcoming space for lifters of all levels - from first-timers to experienced athletes.',
  },
  {
    icon: Dumbbell,
    title: 'Expert Guidance',
    description: 'Learn technique and programming from experienced members and qualified coaches.',
  },
  {
    icon: Calendar,
    title: 'Regular Events',
    description: 'Weekly training sessions, social events, and club-wide collaborations year-round.',
  },
  {
    icon: PartyPopper,
    title: 'Always Something On',
    description: 'From beginner-friendly sessions to social nights and fitness collaborations, and there is always an event to join.',
  },
];

function FadeInSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInViewCustom({ once: true, margin: '-50px' });
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// Hero background: two club clips (A -> B) crossfading on a loop. Muted by
// default so autoplay is allowed; a corner button unmutes whichever clip is
// currently on screen (audio follows the active clip). Lives inside Home, so it
// only ever plays on the landing page and stops when you navigate away.
const HERO_CLIPS = [
  // Lead with the crisp gym / event footage, then the vlog clip. Shown at their
  // natural 16:9 in a 16:9 hero — no blur, no zoom, so they stay as sharp as the
  // source allows.
  { src: '/videos/hero-b.mp4', poster: '/videos/poster-b.jpg', cls: 'scale-[1.02]' },
  { src: '/videos/hero-a.mp4', poster: '/videos/poster-a.jpg', cls: 'scale-[1.02]' },
];

function HeroVideo() {
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const switching = useRef(false);

  const advance = (from: number) => {
    if (from !== active || switching.current) return;
    switching.current = true;
    const next = from === 0 ? 1 : 0;
    const nv = videos.current[next];
    if (nv) {
      try { nv.currentTime = 0; } catch { /* not seekable yet */ }
      nv.play().catch(() => {});
    }
    setActive(next);
  };

  // Start the crossfade a beat before the active clip ends (onEnded is a backstop).
  const onTime = (i: number) => {
    const v = videos.current[i];
    if (!v || i !== active || !v.duration || Number.isNaN(v.duration)) return;
    if (v.currentTime >= v.duration - 0.7) advance(i);
  };

  // Play the active clip, route audio to it (if unmuted), release the lock.
  useEffect(() => {
    videos.current.forEach((v, i) => {
      if (!v) return;
      v.muted = !(soundOn && i === active);
      if (i === active) v.play().catch(() => {});
    });
    const t = window.setTimeout(() => { switching.current = false; }, 900);
    return () => window.clearTimeout(t);
  }, [active, soundOn]);

  // Pause on a hidden tab; resume the active clip when the page is visible again.
  useEffect(() => {
    const onVis = () => {
      const v = videos.current[active];
      if (!v) return;
      if (document.hidden) v.pause(); else v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [active]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {HERO_CLIPS.map((clip, i) => (
        <video
          key={clip.src}
          ref={(el) => { videos.current[i] = el; }}
          src={clip.src}
          poster={clip.poster}
          muted
          playsInline
          preload={i === 0 ? 'auto' : 'metadata'}
          autoPlay={i === 0}
          onTimeUpdate={() => onTime(i)}
          onEnded={() => advance(i)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[900ms] ease-in-out ${clip.cls}`}
          style={{ opacity: i === active ? 1 : 0 }}
        />
      ))}
      {/* Brand grade + legibility scrim */}
      <div className="absolute inset-0 bg-[#eb7524]/30 mix-blend-soft-light" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/75" />
      <div className="absolute inset-0 bg-black/25" />
      {/* Sound toggle — default off (silent); unmutes the active clip */}
      <button
        type="button"
        onClick={() => setSoundOn((s) => !s)}
        aria-label={soundOn ? 'Mute background video' : 'Play background sound'}
        className="absolute bottom-6 left-6 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/90 hover:bg-black/60 transition-all cursor-pointer"
        style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
      >
        {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        <span className="hidden sm:inline">{soundOn ? 'Sound on' : 'Sound off'}</span>
      </button>
    </div>
  );
}

export function Home() {
  const { ref: heroRef, inView: heroInView } = useInViewCustom({ once: true });
  const [bounceY, setBounceY] = useState(0);

  // Reflect auth state in the primary CTAs: a signed-in member should never be
  // told to "Join AUSS" — send them to their dashboard instead.
  const { isAuthenticated, user } = useAuth();
  const ctaTo = isAuthenticated ? '/dashboard' : '/login';
  const ctaLabel = isAuthenticated ? 'Go to Dashboard' : 'Join AUSS';
  const firstName = user?.firstName?.trim();

  useEffect(() => {
    let frame: number;
    const animate = () => {
      setBounceY(Math.sin(Date.now() / 1000) * 8);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="bg-black">
      {/* Hero Section */}
      <section className="relative w-full aspect-[16/9] min-h-[560px] max-h-[860px] flex items-center px-6 overflow-hidden bg-black">
        <HeroVideo />
        <div className="max-w-[1200px] mx-auto relative z-10 w-full" ref={heroRef}>
          <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center">
            <p
              className="text-white/70 uppercase mb-6 tracking-[0.35em]"
              style={{
                fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                opacity: heroInView ? 1 : 0, transform: heroInView ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
              }}
            >
              Auckland University Strength Society
            </p>
            <h1
              className="text-white mb-6"
              style={{
                fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 700, lineHeight: '1.15', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif',
                opacity: heroInView ? 1 : 0, transform: heroInView ? 'translateY(0)' : 'translateY(30px)',
                transition: 'opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s',
              }}
            >
              A Community of
              <br />
              <span className="relative">
                Strength Athletes
                <div
                  className="absolute -bottom-2 left-0 w-full h-1 bg-[#eb7524] rounded-full origin-left"
                  style={{
                    transform: heroInView ? 'scaleX(1)' : 'scaleX(0)',
                    transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.8s',
                  }}
                />
              </span>
            </h1>
            <p
              className="text-white/80 mb-10 max-w-xl"
              style={{
                fontSize: '17px', lineHeight: '1.7', fontFamily: 'Inter, sans-serif',
                opacity: heroInView ? 1 : 0, transform: heroInView ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s',
              }}
            >
              We bring together lifters, beginners, and athletes to train, connect, and grow together. Build strength in a supportive and driven community.
            </p>
            <div
              className="flex gap-4 flex-wrap justify-center"
              style={{
                opacity: heroInView ? 1 : 0, transform: heroInView ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease 0.55s, transform 0.6s ease 0.55s',
              }}
            >
              <Link to={ctaTo}>
                <div
                  className="bg-[#eb7524] text-white px-8 py-3.5 rounded-xl flex items-center gap-2 shadow-[0_8px_30px_rgba(235,117,36,0.35)] hover:shadow-[0_12px_40px_rgba(235,117,36,0.5)] transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                >
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
              <Link to="/about">
                <div
                  className="bg-white/10 backdrop-blur-md text-white px-8 py-3.5 rounded-xl border border-white/20 hover:bg-white/20 transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                >
                  Learn More
                </div>
              </Link>
            </div>
          </div>

        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div style={{ transform: `translateY(${bounceY}px)` }}>
            <ChevronDown className="w-6 h-6 text-white/40" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#eb7524]/5 to-transparent" />
        <div className="max-w-[1200px] mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <FadeInSection key={stat.label} delay={i * 0.1} className="text-center">
                <div
                  className="text-[#eb7524] mb-2"
                  style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, fontFamily: 'Inter, sans-serif', lineHeight: '1.1' }}
                >
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-white/50 text-sm uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {stat.label}
                </p>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-black">
        <div className="max-w-[1200px] mx-auto">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              What we offer
            </p>
            <h2
              className="text-white mb-4"
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Everything You Need to Build Strength
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <FadeInSection key={feature.title} delay={i * 0.1}>
                  <div className="group bg-[#111] border border-white/5 rounded-2xl p-8 hover:border-[#eb7524]/20 hover:bg-[#141414] transition-all duration-500 h-full">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 bg-[#eb7524]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#eb7524]/20 transition-colors duration-500">
                        <Icon className="w-6 h-6 text-[#eb7524]" />
                      </div>
                      <div>
                        <h3
                          className="text-white mb-2"
                          style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                        >
                          {feature.title}
                        </h3>
                        <p className="text-white/50 leading-relaxed" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#eb7524]/10 via-transparent to-[#eb7524]/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#eb7524]/5 blur-[120px]" />
        </div>
        <div className="max-w-[800px] mx-auto text-center relative">
          <FadeInSection>
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Get Started
            </p>
            <h2
              className="text-white mb-6"
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              {isAuthenticated
                ? `Welcome back${firstName ? `, ${firstName}` : ''}!`
                : "Ready to Join Auckland's Strongest Community?"}
            </h2>
            <p className="text-white/50 mb-10 max-w-lg mx-auto" style={{ fontSize: '17px', lineHeight: '1.7', fontFamily: 'Inter, sans-serif' }}>
              {isAuthenticated
                ? 'Head to your dashboard to manage your membership, RSVP to events, and stay connected with the community.'
                : "Whether you're a complete beginner or an experienced lifter, there's a place for you at AUSS. Come train with us."}
            </p>
            <Link to={ctaTo}>
              <div
                className="inline-flex items-center gap-2 bg-[#eb7524] text-white px-10 py-4 rounded-xl shadow-[0_8px_30px_rgba(235,117,36,0.3)] hover:shadow-[0_12px_50px_rgba(235,117,36,0.4)] transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
                style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Join AUSS Today'}
                <ArrowRight className="w-5 h-5" />
              </div>
            </Link>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
