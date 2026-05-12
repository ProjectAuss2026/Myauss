import React, { useEffect, useState, useRef } from 'react';
import { Instagram, Mail, Loader2 } from 'lucide-react';

interface ExecRole { id: number; name: string; }
interface ExecTeam { id: number; name: string; }
interface ExecMember {
  id: number;
  name: string;
  role: ExecRole;
  imageUrl?: string | null;
  bio?: string | null;
  instagramUrl?: string | null;
  email?: string | null;
}
interface TeamGroup { team: ExecTeam; members: ExecMember[]; }

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

function ExecCard({ member, index }: { member: ExecMember; index: number }) {
  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <FadeInSection delay={index * 0.1}>
      <div className="group bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-[#eb7524]/20 hover:bg-[#141414] transition-all duration-500 text-center">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-4 overflow-hidden flex items-center justify-center text-white text-2xl font-bold"
          style={{ backgroundColor: '#eb752430', fontFamily: 'Outfit, sans-serif' }}
        >
          {member.imageUrl ? (
            <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" />
          ) : (
            <span style={{ color: '#eb7524' }}>{initials}</span>
          )}
        </div>
        <h3
          className="text-white mb-1"
          style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          {member.name}
        </h3>
        <p className="text-[#eb7524] mb-2" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
          {member.role.name}
        </p>
        {member.bio && (
          <p className="text-white/40 mb-3 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
            {member.bio}
          </p>
        )}
        <div className="flex justify-center gap-3">
          {member.instagramUrl ? (
            <a
              href={member.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-[#eb7524]/10 transition-colors"
            >
              <Instagram className="w-4 h-4 text-white/40 group-hover:text-[#eb7524] transition-colors" />
            </a>
          ) : (
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center opacity-30 cursor-default">
              <Instagram className="w-4 h-4 text-white/40" />
            </div>
          )}
          {member.email ? (
            <a
              href={`mailto:${member.email}`}
              className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-[#eb7524]/10 transition-colors"
            >
              <Mail className="w-4 h-4 text-white/40 group-hover:text-[#eb7524] transition-colors" />
            </a>
          ) : (
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center opacity-30 cursor-default">
              <Mail className="w-4 h-4 text-white/40" />
            </div>
          )}
        </div>
      </div>
    </FadeInSection>
  );
}

export function MeetTheExecs() {
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/executives')
      .then((r) => r.json())
      .then((payload) => {
        if (Array.isArray(payload?.data)) setGroups(payload.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

          {loading && (
            <div className="flex justify-center py-24">
              <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin" />
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="text-center py-24">
              <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>No exec members to display yet.</p>
            </div>
          )}

          {!loading && groups.map((group, gi) => (
            <div key={group.team.id} className={gi < groups.length - 1 ? 'mb-16' : ''}>
              <FadeInSection className="mb-4">
                <h2
                  className="text-white/80 mb-6"
                  style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  {group.team.name}
                </h2>
              </FadeInSection>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {group.members.map((m, i) => (
                  <ExecCard key={m.id} member={m} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
