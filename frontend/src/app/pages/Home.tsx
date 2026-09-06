import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Users, Dumbbell, Calendar, PartyPopper, ArrowRight, ChevronDown } from 'lucide-react';
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
  { label: 'Events', value: 15, suffix: '+' },
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

const heroImages = [
  { src: "/photos/club_photo2.jpg", alt: 'Strength training', gradient: 'from-[#eb7524]/40 to-[#d4691f]/60', h: 'h-56 md:h-64' },
  { src: "/photos/club_photo1.jpg", alt: 'Group photo', gradient: 'from-[#eb7524]/30 to-[#1a1a1a]/80', h: 'h-56 md:h-80' },
  { src: "/photos/club_photo3.jpg", alt: 'Red Bull event', gradient: 'from-[#d4691f]/50 to-[#eb7524]/30', h: 'h-56 md:h-64' },
];

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
      <section className="relative bg-[#eb7524] px-6 overflow-hidden">
        <div className="max-w-[1200px] mx-auto relative" ref={heroRef}>
          <div className="flex flex-col items-center justify-center py-20 md:py-28 text-center">
            <p
              className="text-black/70 uppercase mb-6 tracking-[0.35em]"
              style={{
                fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                opacity: heroInView ? 1 : 0, transform: heroInView ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
              }}
            >
              Auckland University Strength Society
            </p>
            <h1
              className="text-black mb-6"
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
                  className="absolute -bottom-2 left-0 w-full h-1 bg-black/20 rounded-full origin-left"
                  style={{
                    transform: heroInView ? 'scaleX(1)' : 'scaleX(0)',
                    transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.8s',
                  }}
                />
              </span>
            </h1>
            <p
              className="text-black/70 mb-10 max-w-xl"
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
                  className="bg-black text-white px-8 py-3.5 rounded-xl flex items-center gap-2 shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                >
                  {ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
              <Link to="/about">
                <div
                  className="bg-white/20 backdrop-blur-sm text-black/90 px-8 py-3.5 rounded-xl border border-black/10 hover:bg-white/30 transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
                  style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                >
                  Learn More
                </div>
              </Link>
            </div>
          </div>

          {/* Hero Images (gradient placeholders) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-16">
            {heroImages.map((img, i) => (
              <div
                key={img.alt}
                className={`${img.h} overflow-hidden rounded-2xl group relative bg-gradient-to-br ${img.gradient}`}
                style={{
                  opacity: heroInView ? 1 : 0, transform: heroInView ? 'translateY(0)' : 'translateY(40px)',
                  transition: `opacity 0.7s ease ${0.6 + i * 0.15}s, transform 0.7s ease ${0.6 + i * 0.15}s`,
                }}
              >
                {/* Real image */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Dumbbell className="w-12 h-12 text-black/20" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center pb-8">
            <div style={{ transform: `translateY(${bounceY}px)` }}>
              <ChevronDown className="w-6 h-6 text-black/30" />
            </div>
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
