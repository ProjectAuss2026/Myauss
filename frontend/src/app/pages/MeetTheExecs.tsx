import React, { useEffect, useState, useRef } from 'react';
import { Instagram, Mail } from 'lucide-react';

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

const presidents = [
  { name: 'Alex Chen', role: 'President', color: '#eb7524' },
  { name: 'Jordan Lee', role: 'Vice President', color: '#d4691f' },
  { name: 'Sam Patel', role: 'Treasurer', color: '#c05e1a' },
  { name: 'Taylor Kim', role: 'Secretary', color: '#b55418' },
];

const admin = [
  { name: 'Riley Wang', role: 'Events Coordinator', color: '#eb7524' },
  { name: 'Casey Nguyen', role: 'Marketing Officer', color: '#d4691f' },
  { name: 'Morgan Smith', role: 'Welfare Officer', color: '#c05e1a' },
  { name: 'Jamie Brown', role: 'Social Media', color: '#b55418' },
];

function ExecCard({ member, index }: { member: { name: string; role: string; color: string }; index: number }) {
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <FadeInSection delay={index * 0.1}>
      <div className="group bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-[#eb7524]/20 hover:bg-[#141414] transition-all duration-500 text-center">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
          style={{ backgroundColor: member.color + '30', fontFamily: 'Outfit, sans-serif' }}
        >
          <span style={{ color: member.color }}>{initials}</span>
        </div>
        <h3
          className="text-white mb-1"
          style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          {member.name}
        </h3>
        <p className="text-[#eb7524] mb-3" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
          {member.role}
        </p>
        <div className="flex justify-center gap-3">
          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-[#eb7524]/10 transition-colors cursor-pointer">
            <Instagram className="w-4 h-4 text-white/40 group-hover:text-[#eb7524] transition-colors" />
          </div>
          <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-[#eb7524]/10 transition-colors cursor-pointer">
            <Mail className="w-4 h-4 text-white/40 group-hover:text-[#eb7524] transition-colors" />
          </div>
        </div>
      </div>
    </FadeInSection>
  );
}

export function MeetTheExecs() {
  return (
    <div className="bg-black">
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Our Team
            </p>
            <h1
              className="text-white mb-4"
              style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
            >
              Meet the Execs
            </h1>
            <p className="text-white/50 max-w-xl mx-auto" style={{ fontSize: '17px', fontFamily: 'Inter, sans-serif' }}>
              The dedicated team behind AUSS. We're passionate about building the best strength community at the University of Auckland.
            </p>
          </FadeInSection>

          {/* Presidents */}
          <FadeInSection className="mb-4">
            <h2
              className="text-white/80 mb-6"
              style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Executive Board
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
            {presidents.map((m, i) => (
              <ExecCard key={m.name} member={m} index={i} />
            ))}
          </div>

          {/* Admin */}
          <FadeInSection className="mb-4">
            <h2
              className="text-white/80 mb-6"
              style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
            >
              Administrative Team
            </h2>
          </FadeInSection>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {admin.map((m, i) => (
              <ExecCard key={m.name} member={m} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
