import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Sparkles, Shield, HeartHandshake } from 'lucide-react';
import imgGroupPhoto from "/photos/club_photo1.jpg";

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

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
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

interface FaqEntry {
  id: number;
  question: string;
  answer: string;
}

const whyJoinPoints = [
  {
    icon: HeartHandshake,
    title: 'Supportive Community',
    text: "Joining AUSS means becoming part of a welcoming and driven community of students who share a passion for strength, fitness, and self-improvement. Whether you're stepping into the gym for the first time or already experienced, you'll find a supportive environment where everyone encourages each other to grow.",
  },
  {
    icon: Sparkles,
    title: 'Learn & Improve',
    text: 'AUSS provides opportunities to improve your knowledge of strength training through shared experience, guidance from fellow members, and community-based learning. Connect with training partners, attend events, and take part in activities that keep you motivated and consistent throughout the semester.',
  },
  {
    icon: Shield,
    title: 'More Than Lifting',
    text: "Beyond physical progress, AUSS is about building confidence, friendships, and a sense of belonging at university. It's not just about lifting weights - it's about lifting each other up and creating a strong, positive community both inside and outside the gym.",
  },
];

function FaqItem({ faq, index }: { faq: FaqEntry; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <FadeIn delay={index * 0.08}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-5 flex items-start justify-between gap-4 group cursor-pointer"
      >
        <span
          className="text-white group-hover:text-[#eb7524] transition-colors"
          style={{ fontSize: '17px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
        >
          {faq.question}
        </span>
        <div className="flex-shrink-0 mt-1">
          <ChevronDown
            className="w-5 h-5 text-white/40 group-hover:text-[#eb7524] transition-all duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
          />
        </div>
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: open ? '200px' : '0',
          opacity: open ? 1 : 0,
        }}
      >
        <p
          className="text-white/50 leading-relaxed pb-4"
          style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
        >
          {faq.answer}
        </p>
      </div>
      <div className="h-px bg-white/5" />
    </FadeIn>
  );
}

export function About() {
  const [mounted, setMounted] = useState(false);
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  useEffect(() => {
    fetch('/api/faq')
      .then((r) => r.json())
      .then((payload) => {
        if (Array.isArray(payload?.data)) setFaqs(payload.data);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-[900px] mx-auto px-6 py-16 md:py-24">
        {/* About Us Section */}
        <div
          style={{
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            Our Story
          </p>
          <h1
            className="text-white mb-8"
            style={{ fontSize: 'clamp(36px, 5vw, 55px)', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
          >
            About Us.
          </h1>
        </div>
        <p
          className="text-white/60 mb-10 leading-relaxed"
          style={{
            fontSize: '17px', lineHeight: '1.8', fontFamily: 'Inter, sans-serif',
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s',
          }}
        >
          The Auckland University Strength Society, originally established as the Auckland University Strength & Powerlifting Association (AUSPA), was founded in 2015. It began as a student-led initiative to create a community for University of Auckland students interested in strength training, and has since grown into a much broader strength and fitness society that supports members of all experience levels, from all walks of life.
        </p>

        {/* Action Buttons */}
        <div
          className="flex gap-3 mb-12 flex-wrap"
          style={{
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease 0.35s, transform 0.5s ease 0.35s',
          }}
        >
          <Link to="/meet-the-execs">
            <div
              className="bg-[#eb7524] text-white px-7 py-3 rounded-full hover:bg-[#d4691f] transition-all shadow-[0_4px_20px_rgba(235,117,36,0.25)] hover:shadow-[0_8px_30px_rgba(235,117,36,0.35)] hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
              style={{ fontSize: '16px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
            >
              Meet the Execs
            </div>
          </Link>
          <a href="#faq">
            <div
              className="bg-transparent text-white px-7 py-3 rounded-full border border-[#eb7524]/40 hover:border-[#eb7524] hover:bg-[#eb7524]/5 transition-all hover:scale-[1.03] hover:-translate-y-0.5 active:scale-[0.97]"
              style={{ fontSize: '16px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
            >
              FAQ
            </div>
          </a>
        </div>

        {/* Group Photo */}
        <div
          className="mb-24 overflow-hidden rounded-3xl relative group"
          style={{
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.98)',
            transition: 'opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s',
          }}
        >
          <img
            src={imgGroupPhoto}
            alt="AUSS group photo"
            className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>

        {/* Why Join AUSS? */}
        <FadeIn className="mb-6">
          <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            Benefits
          </p>
          <h2
            className="text-white"
            style={{ fontSize: '28px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
          >
            Why join AUSS?
          </h2>
        </FadeIn>

        <div className="space-y-6 mb-24">
          {whyJoinPoints.map((point, i) => {
            const Icon = point.icon;
            return (
              <FadeIn key={point.title} delay={i * 0.12}>
                <div className="bg-[#111] border border-white/5 rounded-2xl p-7 hover:border-[#eb7524]/20 transition-all duration-500 group">
                  <div className="flex items-start gap-5">
                    <div className="w-11 h-11 bg-[#eb7524]/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#eb7524]/20 transition-colors duration-500">
                      <Icon className="w-5 h-5 text-[#eb7524]" />
                    </div>
                    <div>
                      <h3
                        className="text-white mb-2"
                        style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                      >
                        {point.title}
                      </h3>
                      <p
                        className="text-white/50 leading-relaxed"
                        style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}
                      >
                        {point.text}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div id="faq" className="scroll-mt-24">
          <FadeIn className="mb-8">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Common Questions
            </p>
            <h2
              className="text-white"
              style={{ fontSize: '28px', fontWeight: 500, fontFamily: 'Outfit, sans-serif' }}
            >
              Frequently Asked Questions
            </h2>
          </FadeIn>

          <div className="bg-[#111] border border-white/5 rounded-2xl px-7">
            {faqs.length > 0 ? (
              faqs.map((faq, i) => (
                <FaqItem key={faq.id} faq={faq} index={i} />
              ))
            ) : (
              <p className="py-8 text-white/30 text-center" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                No FAQ entries yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
