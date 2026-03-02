import React, { useEffect, useState, useRef } from 'react';
import { Instagram, Mail, ExternalLink, Camera, Calendar, Users } from 'lucide-react';

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

const socialLinks = [
  {
    platform: 'Instagram',
    icon: Instagram,
    handle: '@auss.uoa',
    description: 'Follow us for training content, event updates, and community highlights.',
    url: 'https://instagram.com/auss.uoa',
    color: '#E1306C',
  },
  {
    platform: 'Email',
    icon: Mail,
    handle: 'auss@auckland.ac.nz',
    description: 'Reach out for any questions, sponsorship enquiries, or general information.',
    url: 'mailto:auss@auckland.ac.nz',
    color: '#eb7524',
  },
];

const upcomingEvents = [
  { title: 'Training Session', date: 'Every Wednesday', time: '5:00 PM - 7:00 PM', location: 'Uni Rec Centre' },
  { title: 'Internal Competition', date: 'TBA', time: 'All Day', location: 'TBA' },
  { title: 'Social Mixer', date: 'TBA', time: 'Evening', location: 'TBA' },
];

const galleryPlaceholders = [
  { gradient: 'from-[#eb7524]/30 to-[#1a1a1a]', label: 'Competition Day' },
  { gradient: 'from-[#d4691f]/40 to-[#111]', label: 'Training Session' },
  { gradient: 'from-[#eb7524]/20 to-[#1a1a1a]', label: 'Team Social' },
  { gradient: 'from-[#c05e1a]/30 to-[#111]', label: 'Workshop' },
  { gradient: 'from-[#eb7524]/25 to-[#1a1a1a]', label: 'Awards Night' },
  { gradient: 'from-[#d4691f]/35 to-[#111]', label: 'Group Training' },
];

export function Social() {
  return (
    <div className="bg-black">
      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <FadeInSection className="text-center mb-16">
            <p className="text-[#eb7524] uppercase tracking-[0.25em] mb-4 text-sm" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
              Stay Connected
            </p>
            <h1
              className="text-white mb-4"
              style={{ fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
            >
              Social & Media
            </h1>
            <p className="text-white/50 max-w-xl mx-auto" style={{ fontSize: '17px', fontFamily: 'Inter, sans-serif' }}>
              Follow our journey, stay up to date with events, and connect with the AUSS community.
            </p>
          </FadeInSection>

          {/* Social Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-20">
            {socialLinks.map((link, i) => {
              const Icon = link.icon;
              return (
                <FadeInSection key={link.platform} delay={i * 0.1}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block bg-[#111] border border-white/5 rounded-2xl p-8 hover:border-[#eb7524]/20 hover:bg-[#141414] transition-all duration-500"
                  >
                    <div className="flex items-start gap-5">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors" style={{ backgroundColor: link.color + '15' }}>
                        <Icon className="w-7 h-7" style={{ color: link.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                            {link.platform}
                          </h3>
                          <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-[#eb7524] transition-colors" />
                        </div>
                        <p className="text-[#eb7524] mb-2" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                          {link.handle}
                        </p>
                        <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                          {link.description}
                        </p>
                      </div>
                    </div>
                  </a>
                </FadeInSection>
              );
            })}
          </div>

          {/* Upcoming Events */}
          <FadeInSection className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <Calendar className="w-5 h-5 text-[#eb7524]" />
              <h2 className="text-white" style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                Upcoming Events
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {upcomingEvents.map((event, i) => (
                <FadeInSection key={event.title} delay={i * 0.1}>
                  <div className="bg-[#111] border border-white/5 rounded-xl p-6 hover:border-[#eb7524]/20 transition-colors">
                    <h3 className="text-white mb-2" style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                      {event.title}
                    </h3>
                    <p className="text-[#eb7524] text-sm mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>{event.date}</p>
                    <p className="text-white/40 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{event.time} · {event.location}</p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </FadeInSection>

          {/* Gallery */}
          <FadeInSection>
            <div className="flex items-center gap-3 mb-8">
              <Camera className="w-5 h-5 text-[#eb7524]" />
              <h2 className="text-white" style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                Gallery
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryPlaceholders.map((item, i) => (
                <FadeInSection key={item.label} delay={i * 0.08}>
                  <div className={`aspect-square rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center border border-white/5 hover:border-[#eb7524]/20 transition-colors group cursor-pointer`}>
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-white/20 mx-auto mb-2 group-hover:text-[#eb7524]/40 transition-colors" />
                      <p className="text-white/30 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{item.label}</p>
                    </div>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
