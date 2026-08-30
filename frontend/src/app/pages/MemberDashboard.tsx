import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  Settings,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWithAuth } from '../lib/authFetch';
import { RSVPModal } from '../components/RSVPModal';
import { MembershipPromptModal } from '../components/MembershipPromptModal';
import { fetchWithAuth } from '../lib/authFetch';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** When true, the section content is blurred behind a "members only" overlay. */
  locked?: boolean;
  /**
   * When true, the locked overlay shows an "awaiting approval" state instead of
   * a payment prompt — for members whose bank-transfer proof is under review.
   */
  pendingReview?: boolean;
  /** Called when a locked user clicks "Get your membership". */
  onUnlock?: () => void;
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, locked = false, pendingReview = false, onUnlock }: CollapsibleSectionProps) {
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
            className="text-white flex items-center gap-2"
            style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            {title}
            {locked && <Lock className="w-3.5 h-3.5 text-white/30" />}
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
          {locked ? (
            <div className="relative">
              {/* Blurred preview so members can see what they're unlocking */}
              <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden="true">
                {children}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 px-6">
                <div className="w-11 h-11 rounded-2xl bg-[#eb7524]/10 border border-[#eb7524]/25 flex items-center justify-center">
                  {pendingReview ? <Clock className="w-5 h-5 text-[#eb7524]" /> : <Lock className="w-5 h-5 text-[#eb7524]" />}
                </div>
                <p
                  className="text-white"
                  style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  Members only
                </p>
                <p
                  className="text-white/45 max-w-xs"
                  style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                >
                  {pendingReview
                    ? 'Your payment is under review — an executive will approve it soon.'
                    : 'Activate your membership to unlock this section.'}
                </p>
                {pendingReview ? (
                  <div
                    className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#eb7524]/10 border border-[#eb7524]/30 text-[#ffcfad]"
                    style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Awaiting approval
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onUnlock}
                    className="mt-1 px-4 py-2 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer"
                    style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                  >
                    Get your membership
                  </button>
                )}
              </div>
            </div>
          ) : (
            children
          )}
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

// Gated member perks (KAN-167). These are fetched from the authenticated,
// VERIFIED-membership endpoint GET /api/member/content — they are NOT bundled
// with the app, so the real sponsor codes never ship to non-members.
interface DiscountCode {
  id: number;
  sponsor: string;
  code: string;
  discount: string;
  tier: string | null;
}
interface ExclusiveItem {
  id: number;
  title: string;
  description: string;
  tag: string | null;
  url: string | null;
}
interface PrivateLink {
  id: number;
  title: string;
  description: string | null;
  url: string;
}
interface MemberContent {
  discountCodes: DiscountCode[];
  exclusiveContent: ExclusiveItem[];
  privateLinks: PrivateLink[];
}

// Public club announcements — fetched from GET /api/announcements. These are NOT
// gated (every dashboard visitor sees them); they were previously hardcoded here.
interface Announcement {
  id: number;
  title: string;
  content: string;
  publishedAt: string;
  isNew: boolean;
}

// Non-sensitive placeholders shown (blurred) to non-members so the locked
// sections still convey what's behind them. Deliberately fake: no real sponsor
// code appears here, so grepping the built bundle for a live code finds nothing.
const PLACEHOLDER_DISCOUNTS: DiscountCode[] = [
  { id: -1, sponsor: 'Sponsor Partner', code: '••••••', discount: 'Members-only discount', tier: 'Platinum' },
  { id: -2, sponsor: 'Sponsor Partner', code: '••••••', discount: 'Members-only offer', tier: 'Gold' },
  { id: -3, sponsor: 'Sponsor Partner', code: '••••••', discount: 'Members-only perk', tier: 'Silver' },
];
const PLACEHOLDER_EXCLUSIVE: ExclusiveItem[] = [
  { id: -1, title: 'Members-only guide', description: 'Unlock to view', tag: 'New', url: null },
  { id: -2, title: 'Members-only program', description: 'Unlock to view', tag: 'Popular', url: null },
  { id: -3, title: 'Members-only handbook', description: 'Unlock to view', tag: null, url: null },
];
const PLACEHOLDER_LINKS: PrivateLink[] = [
  { id: -1, title: 'Members-only community', description: null, url: '••••••••••' },
  { id: -2, title: 'Members-only drive', description: null, url: '••••••••••' },
  { id: -3, title: 'Members-only chat', description: null, url: '••••••••••' },
];

function SectionLoadingRow() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="w-6 h-6 text-[#eb7524] animate-spin" />
    </div>
  );
}

function SectionErrorRow({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-2">
      <AlertCircle className="w-8 h-8 text-red-400/70" />
      <p className="text-white/50" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
        {message}
      </p>
    </div>
  );
}

function SectionEmptyRow({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-2">
      <Icon className="w-8 h-8 text-white/15" />
      <p className="text-white/40" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </p>
    </div>
  );
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
  const { user, isAuthenticated, isLoading, logout, setUserFromToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { ref: containerRef, inView } = useInViewCustom({ once: true });
  const [mounted, setMounted] = useState(false);

  // Member event pass (KAN-180). The QR is a server-signed value fetched on
  // demand, not derived from anything the client knows. The old click-to-reveal
  // blur and right-click blocking were removed with it: they implied a
  // protection that never existed, since the value sat in the DOM regardless.
  // Security comes from the pass being unguessable, and from the member being
  // able to reset it if it leaks.
  const [pass, setPass] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [resettingPass, setResettingPass] = useState(false);

  const loadPass = useCallback(async () => {
    setPassError(null);
    try {
      const res = await fetchWithAuth('/api/auth/me/pass');
      if (!res.ok) throw new Error(`pass request failed: ${res.status}`);
      const data = await res.json();
      setPass(data.pass ?? null);
    } catch (err) {
      console.error('Failed to load member pass:', err);
      setPassError('Could not load your pass. Pull to refresh or try again.');
    }
  }, []);

  useEffect(() => {
    loadPass();
  }, [loadPass]);

  const handleResetPass = useCallback(async () => {
    setResettingPass(true);
    setPassError(null);
    try {
      const res = await fetchWithAuth('/api/auth/me/pass/reset', { method: 'POST' });
      if (!res.ok) throw new Error(`pass reset failed: ${res.status}`);
      const data = await res.json();
      setPass(data.pass ?? null);
    } catch (err) {
      console.error('Failed to reset member pass:', err);
      setPassError('Could not reset your pass. Please try again.');
    } finally {
      setResettingPass(false);
    }
  }, []);

  // Upcoming events (from the Activities API)
  const [activities, setActivities] = useState<Activity[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [rsvpActivity, setRsvpActivity] = useState<Activity | null>(null);

  // Gated member perks — fetched from the server (KAN-167), never bundled.
  const [memberContent, setMemberContent] = useState<MemberContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Public announcements — served ungated from GET /api/announcements.
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  // Executive invitation state
  const [inviteToken, setInviteToken] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  // Membership prompt — auto-shown once for INACTIVE members, then dismissible.
  const [showMembershipPrompt, setShowMembershipPrompt] = useState(false);
  useEffect(() => {
    if (user?.membershipStatus === 'INACTIVE') {
      setShowMembershipPrompt(true);
    } else {
      setShowMembershipPrompt(false);
    }
  }, [user?.membershipStatus]);

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

  // Announcements are public and ungated, so (like activities) they load for
  // every visitor regardless of membership status — no auth header needed.
  useEffect(() => {
    let cancelled = false;
    const loadAnnouncements = async () => {
      try {
        setAnnouncementsLoading(true);
        setAnnouncementsError(null);
        const res = await fetch('/api/announcements');
        if (!res.ok) throw new Error('Failed to load announcements');
        const data = await res.json();
        if (!cancelled) setAnnouncements(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setAnnouncementsError(err instanceof Error ? err.message : 'Failed to load announcements');
      } finally {
        if (!cancelled) setAnnouncementsLoading(false);
      }
    };
    loadAnnouncements();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch gated perks from the members-only endpoint. Only VERIFIED members (and
  // staff) are entitled to them, so non-members never even make the request —
  // they see the blurred placeholders instead. The endpoint enforces this
  // server-side regardless (401/403), so this guard is purely to avoid a request
  // that would be rejected.
  useEffect(() => {
    const hasStaffAccess = user?.role === 'ADMIN' || user?.role === 'OWNER';
    const canAccess = hasStaffAccess || user?.membershipStatus === 'VERIFIED';
    if (!canAccess) return;

    let cancelled = false;
    const loadContent = async () => {
      try {
        setContentLoading(true);
        setContentError(null);
        const res = await fetchWithAuth('/api/member/content');
        if (!res.ok) throw new Error('Failed to load member content');
        const data = await res.json();
        if (!cancelled) setMemberContent(data);
      } catch (err) {
        if (!cancelled) setContentError(err instanceof Error ? err.message : 'Failed to load member content');
      } finally {
        if (!cancelled) setContentLoading(false);
      }
    };
    loadContent();
    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.membershipStatus]);

  const handleLogout = async () => {
    await logout();
    showToast('You have signed out', 'info');
    navigate('/');
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken.trim()) {
      showToast('Please enter an invitation token', 'error');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Please sign in again and retry', 'error');
      return;
    }

    setAcceptingInvite(true);
    try {
      const res = await fetch('/api/auth/admin/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ token: inviteToken.trim() }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to accept invitation');
      }

      setUserFromToken(payload.token, payload.user);
      setInviteToken('');
      showToast('Executive access granted', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invitation';
      showToast(message, 'error');
    } finally {
      setAcceptingInvite(false);
    }
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
  const hasAdminAccess = user.role === 'ADMIN' || user.role === 'OWNER';
  // Member perks (events, exclusive content, sponsor codes, private links) are
  // gated behind a paid/confirmed membership. Admins & owners always have access.
  const isVerifiedMember = hasAdminAccess || user.membershipStatus === 'VERIFIED';
  const membershipLocked = !isVerifiedMember;
  // A member who submitted a bank-transfer proof is awaiting an executive's
  // approval — they've already paid, so we must not push them back to the
  // payment page. Their gated content stays locked until VERIFIED.
  const isPendingReview = membershipLocked && user.membershipStatus === 'IN_REVIEW';
  const goToMembership = () => navigate('/verify-membership');
  const membershipStatusDisplay = isVerifiedMember
    ? { label: 'Verified', className: 'text-green-400' }
    : user.membershipStatus === 'IN_REVIEW'
    ? { label: 'Need Review', className: 'text-[#ffcfad]' }
    : { label: 'Inactive', className: 'text-white/70' };
  const fullName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.email;
  const memberId = user.email.split('@')[0].toUpperCase();

  // Only events that haven't finished yet, soonest first
  const now = Date.now();
  const upcomingEvents = activities
    .filter((a) => new Date(a.endTime).getTime() > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // "New Updates" stat — derived from announcements flagged new (was hardcoded 3).
  const newUpdatesCount = announcements.filter((a) => a.isNew).length;

  // Render the body of a gated section. For non-members we show blurred, fake
  // placeholders (the CollapsibleSection blur overlay hides them). For members
  // we show the server-fetched content, with loading / error / empty states.
  function gatedSection<T extends { id: number }>(
    liveItems: T[],
    placeholders: T[],
    renderList: (items: T[]) => React.ReactNode,
    emptyIcon: React.ElementType,
    emptyLabel: string,
  ): React.ReactNode {
    if (membershipLocked) return renderList(placeholders);
    if (contentError) return <SectionErrorRow message={contentError} />;
    // memberContent is null until the fetch resolves (covers both the pre-effect
    // first paint and the in-flight request), so members never flash an empty state.
    if (contentLoading || !memberContent) return <SectionLoadingRow />;
    if (liveItems.length === 0) return <SectionEmptyRow icon={emptyIcon} label={emptyLabel} />;
    return renderList(liveItems);
  }

  const renderDiscountCodes = (items: DiscountCode[]) => (
    <div className="space-y-3">
      <p
        className="text-white/60 mb-4"
        style={{ fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
      >
        Exclusive discounts from our sponsors — available only to AUSS members.
      </p>
      {items.map((item) => (
        <div
          key={item.id}
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
              <p className="text-white/40" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                {item.discount}
              </p>
            </div>
            {item.tier && (
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
            )}
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
  );

  const renderExclusiveContent = (items: ExclusiveItem[]) => (
    <div className="space-y-3">
      <p
        className="text-white/60 mb-4"
        style={{ fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
      >
        Access member-only training guides, workout programs, and nutrition resources.
      </p>
      {items.map((item) => (
        <div
          key={item.id}
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
              <p className="text-white/40" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                {item.description}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#eb7524] group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderPrivateLinks = (items: PrivateLink[]) => (
    <div className="space-y-3">
      <p
        className="text-white/60 mb-4"
        style={{ fontSize: '14px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}
      >
        Quick access to member-only platforms and resources.
      </p>
      {items.map((item) => (
        <a
          key={item.id}
          href={membershipLocked ? undefined : item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-[#eb7524]/20 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 bg-[#eb7524]/10 rounded-lg flex items-center justify-center group-hover:bg-[#eb7524]/20 transition-colors">
                <Link2 className="w-4 h-4 text-[#eb7524]" />
              </div>
              <div className="flex-1">
                <h4
                  className="text-white group-hover:text-[#eb7524] transition-colors"
                  style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                >
                  {item.title}
                </h4>
                <p className="text-white/30" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  {item.url}
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-[#eb7524] transition-colors flex-shrink-0" />
          </div>
        </a>
      ))}
    </div>
  );

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
              {hasAdminAccess && (
                <Link
                  to="/manage"
                  className="px-3 sm:px-4 py-2 bg-[#eb7524]/10 border border-[#eb7524]/20 rounded-full flex items-center gap-2 text-[#eb7524] hover:bg-[#eb7524]/15 hover:border-[#eb7524]/30 transition-all"
                  style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage Links</span>
                </Link>
              )}
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

        {/* Membership CTA — persistent prompt for members who aren't verified yet */}
        {membershipLocked && (
          <div
            className="mb-8"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.6s ease 0.05s, transform 0.6s ease 0.05s',
            }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-[#eb7524]/30 bg-gradient-to-br from-[#eb7524]/[0.12] via-[#171717] to-[#171717] p-5 sm:p-7">
              {/* Glow accents */}
              <div className="absolute -top-16 -right-10 w-56 h-56 bg-[#eb7524]/20 rounded-full blur-[90px] pointer-events-none" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#eb7524]/15 border border-[#eb7524]/30 flex items-center justify-center shrink-0">
                  {isPendingReview ? (
                    <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-[#eb7524]" />
                  ) : (
                    <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-[#eb7524]" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className="text-[#eb7524] uppercase tracking-[0.2em] mb-1.5"
                    style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
                  >
                    {isPendingReview ? 'Payment under review' : 'Membership inactive'}
                  </p>
                  <h3
                    className="text-white mb-1.5"
                    style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
                  >
                    {isPendingReview ? 'Your payment is under review' : 'Activate your AUSS membership'}
                  </h3>
                  <p
                    className="text-white/55"
                    style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.6 }}
                  >
                    {isPendingReview
                      ? 'Thanks for submitting your payment. Please wait while an executive member reviews and approves it — your membership will activate automatically once confirmed.'
                      : 'Unlock event RSVPs, exclusive content, sponsor perks and private member links.'}
                  </p>
                </div>
                {isPendingReview ? (
                  <div
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#eb7524]/10 border border-[#eb7524]/30 text-[#ffcfad]"
                    style={{ fontSize: '15px', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}
                  >
                    <Clock className="w-4 h-4" />
                    Awaiting approval
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={goToMembership}
                    className="group w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#eb7524] to-[#f59042] text-white shadow-[0_4px_16px_rgba(235,117,36,0.4)] hover:shadow-[0_6px_22px_rgba(235,117,36,0.6)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                    style={{ fontSize: '15px', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}
                  >
                    Get your membership
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

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

                {/* Member event pass — scanned by an exec at the event desk (KAN-180) */}
              <div className="flex flex-col items-center justify-center w-full">
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl">
                  <div className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] flex items-center justify-center">
                    {pass ? (
                      <QRCodeSVG
                        value={pass}
                        size={240}
                        level="H"
                        includeMargin={false}
                        fgColor="#000000"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <span
                        className="text-black/40 text-center px-4"
                        style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                      >
                        {passError ?? 'Loading your pass…'}
                      </span>
                    )}
                  </div>
                </div>

                <p
                  className="mt-4 text-white/40 text-center max-w-[260px]"
                  style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}
                >
                  Show this at the event desk. A screenshot works if you have no signal.
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleResetPass(); }}
                    disabled={resettingPass}
                    className="px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-full disabled:opacity-50"
                    style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif' }}
                    title="Invalidates your current QR and issues a new one. Use this if you've shared or lost it."
                  >
                    {resettingPass ? 'Resetting…' : 'Reset my pass'}
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
                    <span className={membershipStatusDisplay.className} style={{ fontSize: '13px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                      {membershipStatusDisplay.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-white/50" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                      Valid Until
                    </span>
                    <span className="text-white" style={{ fontSize: '13px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                      {isVerifiedMember ? 'Dec 31, 2026' : '—'}
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
                     {announcementsLoading ? '—' : newUpdatesCount}
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
                          {isPendingReview ? (
                            <div
                              className="w-full sm:w-auto px-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white/40 flex items-center justify-center gap-1.5"
                              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                              title="Your payment is under review — an executive will approve it soon"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              RSVP
                            </div>
                          ) : membershipLocked ? (
                            <button
                              onClick={goToMembership}
                              className="w-full sm:w-auto px-4 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-white/40 hover:text-white/70 hover:border-[#eb7524]/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                              title="Activate your membership to RSVP"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              RSVP
                            </button>
                          ) : (
                            <button
                              onClick={() => setRsvpActivity(event)}
                              className={`w-full sm:w-auto px-4 py-2 ${
                                isSoon ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-[#eb7524]/10 border-[#eb7524]/20 text-[#eb7524]'
                              } border rounded-lg hover:bg-opacity-30 transition-all cursor-pointer`}
                              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                            >
                              RSVP
                            </button>
                          )}
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

          {/* Announcements (public, server-driven) */}
          <CollapsibleSection title="Announcements" icon={Bell} defaultOpen={true}>
            {announcementsLoading ? (
              <SectionLoadingRow />
            ) : announcementsError ? (
              <SectionErrorRow message={announcementsError} />
            ) : announcements.length === 0 ? (
              <SectionEmptyRow icon={Bell} label="No announcements right now. Check back soon!" />
            ) : (
              <div className="space-y-3">
                {announcements.map((item) => (
                  <div
                    key={item.id}
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
                          {formatEventDate(item.publishedAt)}
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
            )}
          </CollapsibleSection>

          {/* Exclusive Content (server-gated — KAN-167) */}
          <CollapsibleSection title="Exclusive Content" icon={Lock} locked={membershipLocked} pendingReview={isPendingReview} onUnlock={goToMembership}>
            {gatedSection(
              memberContent?.exclusiveContent ?? [],
              PLACEHOLDER_EXCLUSIVE,
              renderExclusiveContent,
              Lock,
              'No exclusive content published yet.',
            )}
          </CollapsibleSection>

          {/* Sponsor Discount Codes (server-gated — KAN-167) */}
          <CollapsibleSection title="Sponsor Discount Codes" icon={Tag} locked={membershipLocked} pendingReview={isPendingReview} onUnlock={goToMembership}>
            {gatedSection(
              memberContent?.discountCodes ?? [],
              PLACEHOLDER_DISCOUNTS,
              renderDiscountCodes,
              Tag,
              'No sponsor codes available yet.',
            )}
          </CollapsibleSection>

          {/* Private Links (server-gated — KAN-167) */}
          <CollapsibleSection title="Private Links" icon={Link2} locked={membershipLocked} pendingReview={isPendingReview} onUnlock={goToMembership}>
            {gatedSection(
              memberContent?.privateLinks ?? [],
              PLACEHOLDER_LINKS,
              renderPrivateLinks,
              Link2,
              'No private links available yet.',
            )}
          </CollapsibleSection>

          {!hasAdminAccess && (
           <div className="mt-6 p-4 rounded-xl bg-[#eb7524]/8 border border-[#eb7524]/20">
             <p className="text-white mb-2" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}>
               Executive invitation
             </p>
             <p className="text-white/50 mb-3" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
               If an owner invited you to become executive, paste your invitation token below.
             </p>
             <div className="flex gap-2">
               <input
                 value={inviteToken}
                 onChange={(e) => setInviteToken(e.target.value)}
                 placeholder="Paste invitation token"
                 className="flex-1 bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/25 focus:outline-none focus:border-[#eb7524]/40"
                 style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
               />
               <button
                 type="button"
                 onClick={handleAcceptInvite}
                 disabled={acceptingInvite}
                 className="px-4 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer disabled:opacity-60"
                 style={{ fontSize: '13px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
               >
                 {acceptingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept'}
               </button>
             </div>
           </div>
          )}

        </div>
      </div>

      {/* RSVP modal for the selected event */}
      <RSVPModal
        open={rsvpActivity !== null}
        activityId={rsvpActivity?.id ?? 0}
        activityTitle={rsvpActivity?.title}
        onClose={() => setRsvpActivity(null)}
      />

      {/* Membership nudge for inactive members */}
      <MembershipPromptModal
        open={showMembershipPrompt && user?.membershipStatus === 'INACTIVE'}
        onClose={() => setShowMembershipPrompt(false)}
      />
    </div>
  );
}
