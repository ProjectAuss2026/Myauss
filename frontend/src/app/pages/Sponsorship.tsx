import React, { useEffect, useState, useRef } from 'react';
import { Handshake, Star, Users, Trophy, ArrowRight, Mail } from 'lucide-react';

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

const tiers = [
  {
    name: 'Bronze',
    color: '#CD7F32',
    benefits: [
      'Logo on AUSS website',
      'Social media shoutout',
      'Logo on competition banners',
    ],
  },
  {
    name: 'Silver',
    color: '#C0C0C0',
    benefits: [
      'All Bronze benefits',
      'Logo on team apparel',
      'Featured in event promotions',
      'Free event passes (2)',
    ],
  },
  {
    name: 'Gold',
    color: '#eb7524',
    featured: true,
    benefits: [
      'All Silver benefits',
      'Naming rights for an event',
      'Dedicated social media feature',
      'Free event passes (5)',
      'Direct access to AUSS network',
    ],
  },
];

const benefits = [
  {
    icon: Users,
    title: 'Reach 200+ Members',
    description: 'Connect directly with a growing community of university students and athletes.',
  },
  {
    icon: Star,
    title: 'Brand Visibility',
    description: 'Get featured across our events, social media, and merchandise.',
  },
  {
    icon: Trophy,
    title: 'Event Integration',
    description: 'Integrate your brand into our competitions and training events.',
  },
  {
    icon: Handshake,
    title: 'Community Impact',
    description: 'Support the growth of strength sports at the University of Auckland.',
  },
];

export function Sponsorship() {
  return (
    <div className="bg-black">
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Partner With Us
            </p>
            <h1
              className="text-white mb-4"
              style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
            >
              Sponsorship
            </h1>
            <p className="text-white/50 max-w-xl mx-auto" style={{ fontSize: '17px', fontFamily: 'Inter, sans-serif' }}>
              Partner with AUSS and connect your brand with Auckland's growing strength community.
            </p>
          </FadeInSection>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-20">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <FadeInSection key={b.title} delay={i * 0.1}>
                  <div className="group bg-[#111] border border-white/5 rounded-2xl p-8 hover:border-[#eb7524]/20 hover:bg-[#141414] transition-all duration-500">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 bg-[#eb7524]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#eb7524]/20 transition-colors">
                        <Icon className="w-6 h-6 text-[#eb7524]" />
                      </div>
                      <div>
                        <h3 className="text-white mb-2" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          {b.title}
                        </h3>
                        <p className="text-white/50" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                          {b.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </FadeInSection>
              );
            })}
          </div>

          {/* Sponsorship Tiers */}
          <FadeInSection className="text-center mb-12">
            <h2 className="text-white" style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
              Sponsorship Tiers
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-20">
            {tiers.map((tier, i) => (
              <FadeInSection key={tier.name} delay={i * 0.1}>
                <div
                  className={`bg-[#111] border rounded-2xl p-8 transition-all duration-500 h-full relative ${
                    tier.featured
                      ? 'border-[#eb7524]/30 hover:border-[#eb7524]/50'
                      : 'border-white/5 hover:border-white/10'
                  }`}
                >
                  {tier.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#eb7524] text-white text-xs px-3 py-1 rounded-full font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                      Most Popular
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                      style={{ backgroundColor: tier.color + '20' }}
                    >
                      <Star className="w-6 h-6" style={{ color: tier.color }} />
                    </div>
                    <h3 className="text-white" style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                      {tier.name}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {tier.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: tier.color }} />
                        <span className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                          {benefit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Contact CTA */}
          <FadeInSection className="text-center">
            <div className="bg-[#111] border border-white/5 rounded-2xl p-10 max-w-2xl mx-auto">
              <h2 className="text-white mb-3" style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                Interested in Sponsoring AUSS?
              </h2>
              <p className="text-white/50 mb-6" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>
                Get in touch with us to discuss partnership opportunities.
              </p>
              <a
                href="mailto:auss@auckland.ac.nz"
                className="inline-flex items-center gap-2 bg-[#eb7524] text-white px-8 py-3.5 rounded-xl hover:bg-[#d4691f] transition-colors active:scale-[0.98]"
                style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
              >
                <Mail className="w-4 h-4" />
                Contact Us
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
