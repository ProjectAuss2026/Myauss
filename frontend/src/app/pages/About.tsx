import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Sparkles, Shield, HeartHandshake } from 'lucide-react';

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

const whyJoinCards = [
  {
    icon: HeartHandshake,
    title: 'Supportive Community',
    description: 'Train alongside motivated individuals who share your passion for strength. From beginners to national competitors, everyone is welcome.',
  },
  {
    icon: Sparkles,
    title: 'Personal Growth',
    description: 'Develop discipline, resilience, and confidence through strength training. Your journey is about more than just numbers on the bar.',
  },
  {
    icon: Shield,
    title: 'Quality Coaching',
    description: 'Access experienced coaches and knowledge to improve your technique, programming, and competition readiness.',
  },
];

const faqs = [
  {
    q: 'Do I need to be experienced to join?',
    a: 'Absolutely not! AUSS welcomes lifters of all levels. Whether you\'ve never touched a barbell or you\'ve been lifting for years, there\'s a place for you.',
  },
  {
    q: 'What sports does AUSS cover?',
    a: 'AUSS primarily covers powerlifting, Olympic weightlifting, and strongman. We also support general strength training for those who just want to get stronger.',
  },
  {
    q: 'How much does membership cost?',
    a: 'Membership is affordable and gives you access to all our events, training sessions, and competitions throughout the year. Check our login page for the latest pricing.',
  },
  {
    q: 'When and where do you train?',
    a: 'We hold regular training sessions throughout the week at facilities around the University of Auckland. Specific times and locations are shared with members via our social channels.',
  },
  {
    q: 'Can I compete?',
    a: 'Yes! We run internal competitions and also support members who want to compete at inter-university, regional, and national levels.',
  },
];

export function About() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="bg-black">
      {/* Intro Section */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#eb7524]/5 to-transparent" />
        <div className="max-w-[1000px] mx-auto relative">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Our Story
            </p>
            <h1
              className="text-white mb-6"
              style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif', lineHeight: '1.15' }}
            >
              Auckland University
              <br />
              <span className="text-[#eb7524]">Strength Society</span>
            </h1>
            <p className="text-white/50 max-w-2xl mx-auto leading-relaxed" style={{ fontSize: '17px', fontFamily: 'Inter, sans-serif' }}>
              AUSS was founded to bring together strength athletes from across the University of Auckland. Our mission is to create an inclusive, driven environment where people can train, compete, and grow — both as athletes and individuals.
            </p>
          </FadeInSection>

          {/* Group Photo Placeholder */}
          <FadeInSection delay={0.2}>
            <div className="rounded-2xl overflow-hidden h-64 md:h-80 bg-gradient-to-br from-[#eb7524]/20 to-[#1a1a1a] flex items-center justify-center border border-white/5">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#eb7524]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <HeartHandshake className="w-8 h-8 text-[#eb7524]/60" />
                </div>
                <p className="text-white/30 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>AUSS Group Photo</p>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Why Join Section */}
      <section className="py-24 px-6 bg-black">
        <div className="max-w-[1200px] mx-auto">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Why Join Us
            </p>
            <h2
              className="text-white"
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Why Join AUSS?
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {whyJoinCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <FadeInSection key={card.title} delay={i * 0.1}>
                  <div className="group bg-[#111] border border-white/5 rounded-2xl p-8 hover:border-[#eb7524]/20 hover:bg-[#141414] transition-all duration-500 h-full text-center">
                    <div className="w-14 h-14 bg-[#eb7524]/10 rounded-xl flex items-center justify-center mx-auto mb-5 group-hover:bg-[#eb7524]/20 transition-colors duration-500">
                      <Icon className="w-7 h-7 text-[#eb7524]" />
                    </div>
                    <h3
                      className="text-white mb-3"
                      style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                    >
                      {card.title}
                    </h3>
                    <p className="text-white/50 leading-relaxed" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                      {card.description}
                    </p>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 bg-black">
        <div className="max-w-[800px] mx-auto">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              FAQ
            </p>
            <h2
              className="text-white"
              style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Frequently Asked Questions
            </h2>
          </FadeInSection>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <FadeInSection key={i} delay={i * 0.05}>
                  <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors">
                    <button
                      className="w-full flex items-center justify-between p-5 text-left"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                    >
                      <span className="text-white pr-4" style={{ fontSize: '16px', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                        {faq.q}
                      </span>
                      <ChevronDown
                        className="w-5 h-5 text-white/40 flex-shrink-0 transition-transform duration-300"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      />
                    </button>
                    <div
                      className="overflow-hidden transition-all duration-300"
                      style={{ maxHeight: isOpen ? '200px' : '0px', opacity: isOpen ? 1 : 0 }}
                    >
                      <p className="px-5 pb-5 text-white/50 leading-relaxed" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </FadeInSection>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
