import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ChevronDown,
  Lock,
  Bell,
  Link2,
  Calendar,
  Clock,
  User,
  Shield,
  ArrowRight,
  ExternalLink,
  Tag,
  Sparkles,
  QrCode,
  LogOut,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { RSVPModal } from '../components/RSVPModal';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className="bg-[#171717] border border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/[0.12]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#eb7524]/10 rounded-xl flex items-center justify-center group-hover:bg-[#eb7524]/20 transition-colors">
            <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#eb7524]" />
          </div>
          <h3
            className="text-white"
            style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            {title}
          </h3>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/40 transition-transform duration-300 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        style={{
          maxHeight: isOpen ? `${contentHeight}px` : '0px',
          opacity: isOpen ? 1 : 0,
          transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
          overflow: 'hidden',
        }}
      >
        <div ref={contentRef} className="px-4 sm:px-6 pb-4 sm:pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

function useInViewCustom(options?: { once?: boolean; margin?: string }) {
  // Callback ref: re-attaches the observer whenever the node mounts. This
  // matters because the page renders a loading spinner first (during auth
  // rehydration), so the observed element only mounts on a later render.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => setNode(el), []);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!node) return;
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
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return { ref, inView };
}

interface Activity {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  imageUrl: string | null;
  externalLink: string | null;
  isPublished: boolean;
  capacity: number | null;
}

function getRoleLabel(role: string) {
  if (role === 'OWNER') return 'Owner';
  if (role === 'ADMIN') return 'Executive';
  return 'Member';
}

function formatEventDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Whole-day countdown from now until the event's start. */
function getEventCountdown(startTime: string): { text: string; isSoon: boolean } {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfEvent = new Date(startTime);
  startOfEvent.setHours(0, 0, 0, 0);

  const daysUntil = Math.round((startOfEvent.getTime() - startOfToday.getTime()) / 86_400_000);

  if (daysUntil <= 0) return { text: 'Today', isSoon: true };
  if (daysUntil === 1) return { text: 'Tomorrow', isSoon: true };
  if (daysUntil === 2) return { text: 'In 2 days', isSoon: true };
  return { text: `In ${daysUntil} days`, isSoon: false };
}

export function MemberDashboard() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { ref: containerRef, inView } = useInViewCustom({ once: true });
  const [mounted, setMounted] = useState(false);

  // QR reveal state: click-to-reveal with auto-hide (security measure)
  const [qrRevealed, setQrRevealed] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const [revealSecondsLeft, setRevealSecondsLeft] = useState(0);
  const handleToggleReveal = () => {
    if (qrRevealed) {
      setQrRevealed(false);
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
      setRevealSecondsLeft(0);
      return;
    }
    setQrRevealed(true);
    let seconds = 10;
    setRevealSecondsLeft(seconds);
    revealTimerRef.current = window.setInterval(() => {
      seconds -= 1;
      setRevealSecondsLeft(seconds);
      if (seconds <= 0) {
        setQrRevealed(false);
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        setRevealSecondsLeft(0);
      }
    }, 1000);
  };
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, []);

  // Upcoming events (from the Activities API)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [rsvpActivity, setRsvpActivity] = useState<Activity | null>(null);

  // Protected route — redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadActivities = async () => {
      try {
        setEventsLoading(true);
        setEventsError(null);
        const res = await fetch('/api/activities');
        if (!res.ok) throw new Error('Failed to load events');
        const data = await res.json();
        if (!cancelled) setActivities(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setEventsError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    loadActivities();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    showToast('You have signed out', 'info');
    navigate('/');
  };

  // Wait for session rehydration before deciding what to render
  if (isLoading || !user) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#eb7524]/30 border-t-[#eb7524] rounded-full animate-spin" />
      </div>
    );
  }

  const roleLabel = getRoleLabel(user.role);
  const fullName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.email;
  const memberId = user.email.split('@')[0].toUpperCase();

  // Only events that haven't finished yet, soonest first
  const now = Date.now();
  const upcomingEvents = activities
    .filter((a) => new Date(a.endTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(235,117,36,0.08)' }} />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px]" style={{ backgroundColor: 'rgba(235,117,36,0.05)' }} />
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-20 relative" ref={containerRef}>
        {/* Header */}
        <div
          className="mb-8 sm:mb-12"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(-20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p
                className="text-[#eb7524] uppercase tracking-[0.25em] mb-2"
                style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                Member Portal
              </p>
              <h1
                className="text-white mb-2"
                style={{
                  fontSize: 'clamp(28px, 7vw, 48px)',
                  fontWeight: 700,
                  lineHeight: 1.1,
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome back, <br></br><span className="text-[#eb7524]">{fullName}</span>
              </h1>
              <p
                className="text-white/50 flex items-center gap-2 flex-wrap"
                style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="break-all">{user.email}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 sm:px-4 py-2 bg-[#eb7524]/10 border border-[#eb7524]/20 rounded-full flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#eb7524]" />
                <span
                  className="text-[#eb7524]"
                  style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                >
                  {roleLabel}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-2 bg-white/[0.03] border border-white/10 rounded-full flex items-center gap-2 text-white/60 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 transition-all cursor-pointer"
                style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* AUSS PASS QR Code */}
        <div
          className="mb-8"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
          }}
        >
          <div className="bg-gradient-to-br from-[#171717] via-[#1a1a1a] to-[#171717] border-2 border-[#eb7524]/30 rounded-3xl p-5 sm:p-8 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#eb7524] rounded-full blur-[100px]" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#eb7524] rounded-full blur-[100px]" />
            </div>

            <div className="relative flex flex-col items-center gap-8">
              {/* Pass info - Above QR on mobile */}
              <div className="w-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#eb7524] rounded-2xl flex items-center justify-center">
                    <QrCode className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div>
                    <h2
                      className="text-white mb-1"
                      style={{ fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
                    >
                      AUSS PASS
                    </h2>
                    <p
                      className="text-[#eb7524]"
                      style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                    >
                      Member ID: {memberId}
                    </p>
                  </div>
                </div>

                {/* QR Code - Top on mobile, prominent (blur by default, click to reveal) */}
              <div className="flex flex-col items-center justify-center w-full">
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl">
                  <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] relative">
                    <div
                      className="w-full h-full rounded-xl transition-all"
                      style={{
                        filter: qrRevealed ? 'none' : 'blur(8px)',
                        WebkitFilter: qrRevealed ? 'none' : 'blur(8px)',
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      <QRCodeSVG
                        value={`AUSS-MEMBER-${user.email}`}
                        size={240}
                        level="H"
                        includeMargin={false}
                        fgColor="#000000"
                        style={{ width: '100%', height: '100%' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleReveal(); }}
                    className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full"
                    style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}
                  >
                    {qrRevealed ? 'Hide QR' : 'Reveal QR'}
                  </button>
                </div>
              </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between py-2 border-b border-white/10">
                    <span className="text-white/50" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      Member Name
                    </span>
                    <span className="text-white text-right" style={{ fontSize: '13px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                      {fullName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-white/10">
                    <span className="text-white/50" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      Status
                    </span>
                    <span className="text-[#eb7524]" style={{ fontSize: '13px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                      {user.role === 'MEMBER' ? 'Active Member' : roleLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-white/50" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      Valid Until
                    </span>
                    <span className="text-white" style={{ fontSize: '13px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                      Dec 31, 2026
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 sm:p-4">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#eb7524] mb-2" />
                    <p className="text-white" style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                      {eventsLoading ? '—' : upcomingEvents.length}
                    </p>
                    <p className="text-white/40" style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
                      Upcoming Events
                    </p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 sm:p-4">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-[#eb7524] mb-2" />
                    <p className="text-white" style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                      3
                    </p>
                    <p className="text-white/40" style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
                      New Updates
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Sections */}
        <div
          className="space-y-4"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s',
          }}
        >
          {/* Upcoming Events - Moved to top */}
          <CollapsibleSection title="Upcoming Events" icon={Calendar} defaultOpen={true}>
            {eventsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-[#eb7524] animate-spin" />
              </div>
            ) : eventsError ? (
              <div className="flex flex-col items-center text-center py-8 gap-2">
                <AlertCircle className="w-8 h-8 text-red-400/70" />
                <p className="text-white/50" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  {eventsError}
                </p>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8 gap-2">
                <Calendar className="w-8 h-8 text-white/15" />
                <p className="text-white/40" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  No upcoming events right now. Check back soon!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => {
                  const { text: countdownText, isSoon } = getEventCountdown(event.startTime);
                  const borderColor = isSoon ? 'border-green-500/40' : 'border-white/[0.06]';
                  const bgColor = isSoon ? 'bg-green-500/[0.05]' : 'bg-white/[0.03]';
                  const glowClass = isSoon ? 'shadow-[0_0_20px_rgba(34,197,94,0.15)]' : '';

                  return (
                    <div
                      key={event.id}
                      className={`${bgColor} border ${borderColor} rounded-xl p-4 sm:p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all ${glowClass}`}
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4
                              className="text-white"
                              style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                            >
                              {event.title}
                            </h4>
                          </div>

                          {/* Countdown */}
                          <div className="mb-3">
                            <div
                              className={`inline-flex items-center gap-2 px-3 py-1.5 ${
                                isSoon ? 'bg-green-500/20 border-green-500/30' : 'bg-white/[0.05] border-white/10'
                              } border rounded-lg`}
                            >
                              <Calendar className={`w-4 h-4 ${isSoon ? 'text-green-400' : 'text-white/40'}`} />
                              <span
                                className={isSoon ? 'text-green-400' : 'text-white/60'}
                                style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
                              >
                                {countdownText}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p
                              className="text-white/50 flex items-center gap-2"
                              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                            >
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                              {formatEventDate(event.startTime)}
                            </p>
                            <p
                              className="text-white/40 flex items-center gap-2"
                              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                            >
                              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                              {formatEventTime(event.startTime)} – {formatEventTime(event.endTime)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => setRsvpActivity(event)}
                            className={`w-full sm:w-auto px-4 py-2 ${
                              isSoon ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-[#eb7524]/10 border-[#eb7524]/20 text-[#eb7524]'
                            } border rounded-lg hover:bg-opacity-30 transition-all cursor-pointer`}
                            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                          >
                            RSVP
                          </button>
                          <button
                            onClick={() => navigate(`/activities/${event.id}`)}
                            className="w-full sm:w-auto px-4 py-2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>

          {/* Exclusive Content */}
          <CollapsibleSection title="Exclusive Content" icon={Lock}>
            <div className="space-y-3">
              <p
                className="text-white/60 mb-4"
                style={{ fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
              >
                Access member-only training guides, workout programs, and nutrition resources.
              </p>
              {[
                {
                  title: 'Advanced Powerlifting Program',
                  description: '12-week periodized strength training plan',
                  tag: 'New',
                },
                {
                  title: 'Nutrition Guide for Athletes',
                  description: 'Evidence-based meal planning and macros',
                  tag: 'Popular',
                },
                {
                  title: 'Competition Prep Handbook',
                  description: 'Everything you need for your first meet',
                  tag: null,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4
                          className="text-white group-hover:text-[#eb7524] transition-colors"
                          style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                        >
                          {item.title}
                        </h4>
                        {item.tag && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              item.tag === 'New' ? 'bg-[#eb7524]/20 text-[#eb7524]' : 'bg-white/10 text-white/60'
                            }`}
                            style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                          >
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-white/40"
                        style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                      >
                        {item.description}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#eb7524] group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Sponsor Discount Codes */}
          <CollapsibleSection title="Sponsor Discount Codes" icon={Tag}>
            <div className="space-y-3">
              <p
                className="text-white/60 mb-4"
                style={{ fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
              >
                Exclusive discounts from our sponsors — available only to AUSS members.
              </p>
              {[
                {
                  sponsor: 'FitNutrition',
                  code: 'AUSS20',
                  discount: '20% off supplements',
                  tier: 'Platinum',
                },
                {
                  sponsor: 'IronWorks Gym',
                  code: 'AUSSFIT',
                  discount: 'Free week pass',
                  tier: 'Gold',
                },
                {
                  sponsor: 'Athletic Apparel Co',
                  code: 'STRENGTH15',
                  discount: '15% off all gear',
                  tier: 'Silver',
                },
              ].map((item) => (
                <div
                  key={item.sponsor}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h4
                        className="text-white mb-1"
                        style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                      >
                        {item.sponsor}
                      </h4>
                      <p
                        className="text-white/40"
                        style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                      >
                        {item.discount}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] ${
                        item.tier === 'Platinum'
                          ? 'bg-purple-500/20 text-purple-300'
                          : item.tier === 'Gold'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-gray-500/20 text-gray-300'
                      }`}
                      style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                    >
                      {item.tier}
                    </span>
                  </div>
                  <div className="bg-black/40 border border-[#eb7524]/20 rounded-lg px-3 py-2 flex items-center justify-between">
                    <code
                      className="text-[#eb7524]"
                      style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 600 }}
                    >
                      {item.code}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(item.code)}
                      className="text-white/40 hover:text-white/70 transition-colors text-[12px] cursor-pointer"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Announcements */}
          <CollapsibleSection title="Announcements" icon={Bell}>
            <div className="space-y-3">
              {[
                {
                  title: 'New Training Schedule Released',
                  date: 'May 10, 2026',
                  content: 'Check out our updated training times for Semester 2. Now with extra Saturday sessions!',
                  isNew: true,
                },
                {
                  title: 'Competition Registration Open',
                  date: 'May 8, 2026',
                  content: 'Sign up for the Auckland University Strength Championship. Early bird pricing ends May 20th.',
                  isNew: true,
                },
                {
                  title: 'AGM Summary',
                  date: 'May 1, 2026',
                  content: 'Thank you to everyone who attended! View the meeting notes and upcoming initiatives.',
                  isNew: false,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all"
                >
                  <div className="flex items-start gap-3">
                    {item.isNew && (
                      <div className="w-2 h-2 bg-[#eb7524] rounded-full mt-2 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4
                          className="text-white"
                          style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                        >
                          {item.title}
                        </h4>
                      </div>
                      <p
                        className="text-white/30 mb-2"
                        style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
                      >
                        {item.date}
                      </p>
                      <p
                        className="text-white/50"
                        style={{ fontSize: '14px', lineHeight: 1.5, fontFamily: 'Inter, sans-serif' }}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Private Links */}
          <CollapsibleSection title="Private Links" icon={Link2}>
            <div className="space-y-3">
              <p
                className="text-white/60 mb-4"
                style={{ fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
              >
                Quick access to member-only platforms and resources.
              </p>
              {[
                { title: 'Members Discord Server', url: 'discord.gg/auss-members', icon: Sparkles },
                { title: 'Training Drive (Google Drive)', url: 'drive.google.com/auss', icon: Lock },
                { title: 'WhatsApp Community', url: 'chat.whatsapp.com/auss', icon: Bell },
                { title: 'Member Portal (Canvas)', url: 'canvas.auckland.ac.nz', icon: ExternalLink },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-[#eb7524]/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 bg-[#eb7524]/10 rounded-lg flex items-center justify-center group-hover:bg-[#eb7524]/20 transition-colors">
                        <item.icon className="w-4 h-4 text-[#eb7524]" />
                      </div>
                      <div className="flex-1">
                        <h4
                          className="text-white group-hover:text-[#eb7524] transition-colors"
                          style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                        >
                          {item.title}
                        </h4>
                        <p
                          className="text-white/30"
                          style={{ fontSize: '12px', fontFamily: 'monospace' }}
                        >
                          {item.url}
                        </p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-[#eb7524] transition-colors flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

        </div>
      </div>

      {/* RSVP modal for the selected event */}
      <RSVPModal
        open={rsvpActivity !== null}
        activityId={rsvpActivity?.id ?? 0}
        activityTitle={rsvpActivity?.title}
        onClose={() => setRsvpActivity(null)}
      />
    </div>
  );
}
