import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  Plus, Trash2, Edit3, Save, X, ChevronLeft, Star, Users, Trophy, Heart,
  Camera, ExternalLink, ArrowRight, LogOut, Shield, Image as ImageIcon,
  Loader2, Calendar, Clock, AlertCircle, HelpCircle, ChevronDown,
} from 'lucide-react';

function useInViewCustom(options?: { once?: boolean; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (options?.once !== false) obs.disconnect();
        }
      },
      { rootMargin: options?.margin || '0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ── Types ──
interface Sponsor {
  id: number;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  displayOrder: number;
  sponsorshipPageId: number;
}

interface MediaItem {
  id: number;
  activityId: number;
  mediaDriveUrl: string;
  overrideName: string;
  overrideCover: string;
  resolvedName: string;
  resolvedCover: string;
}

interface Activity {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  imageUrl: string;
  externalLink?: string;
  isPublished?: boolean;
  status: 'upcoming' | 'ongoing' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

interface ExecRoleItem { id: number; name: string; }
interface ExecTeamItem { id: number; name: string; }
interface ExecMember {
  id: number;
  name: string;
  role: ExecRoleItem;
  team: ExecTeamItem;
  imageUrl?: string | null;
  bio?: string | null;
  instagramUrl?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
}
interface ExecGroup { team: ExecTeamItem; members: ExecMember[]; }
interface FaqItem { id: number; question: string; answer: string; isActive: boolean; }

// ── Default data ──
const defaultSponsors: Sponsor[] = [];
const defaultMedia: MediaItem[] = [];

const defaultActivities: Activity[] = [];

const statusColors: Record<string, string> = { upcoming: '#3b82f6', ongoing: '#10b981', archived: '#6b7280' };

type Tab = 'sponsors' | 'media' | 'activities' | 'execs' | 'faq';

// ── Exec grouping helper ──
function groupExecs(executives: ExecMember[]): ExecGroup[] {
  const teamMap = new Map<number, ExecGroup>();
  for (const exec of executives) {
    const key = exec.team.id;
    if (!teamMap.has(key)) teamMap.set(key, { team: exec.team, members: [] });
    teamMap.get(key)!.members.push(exec);
  }
  return Array.from(teamMap.values());
}

// ── Shared field styles ──
const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all";
const labelStyle: React.CSSProperties = { fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 };

// ── Custom Select ──
function CustomSelect({ value, onChange, options, required }: {
  value: string | number;
  onChange: (val: string) => void;
  options: { value: string | number; label: string }[];
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all cursor-pointer"
        style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
      >
        <span className={selected ? 'text-white' : 'text-white/30'}>{selected?.label ?? 'Select…'}</span>
        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
          style={{ maxHeight: '220px', overflowY: 'auto' }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(String(opt.value)); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 transition-all ${
                String(opt.value) === String(value)
                  ? 'bg-[#eb7524]/20 text-[#eb7524]'
                  : 'text-white/80 hover:bg-white/[0.06] hover:text-white'
              }`}
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity helpers ──
function deriveActivityStatus(activity: Activity): 'upcoming' | 'ongoing' | 'archived' {
  const now = new Date();
  const startTime = new Date(activity.startTime);
  const endTime = new Date(activity.endTime);
  
  if (!activity.isPublished || now > endTime) return 'archived';
  if (now >= startTime && now < endTime) return 'ongoing';
  return 'upcoming';
}

function mapActivity(activity: any): Activity {
  return {
    ...activity,
    status: deriveActivityStatus(activity),
  };
}

/**
 * Format ISO datetime string for datetime-local input (YYYY-MM-DDTHH:mm)
 */
function formatToDatetimeLocal(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local format to ISO string
 */
function datetimeLocalToISO(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  return `${datetimeLocal}:00`; // Convert YYYY-MM-DDTHH:mm to YYYY-MM-DDTHH:mm:00
}

/**
 * Upload image file to /api/upload
 */
async function uploadActivityImage(file: File): Promise<string> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed');
  }
  
  const data = await response.json();
  return data.path || data.url || data.imgUrl;
}

export function Admin() {
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('sponsors');

  // Sponsor state
  const [sponsors, setSponsors] = useState<Sponsor[]>(defaultSponsors);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [sponsorshipPageId, setSponsorshipPageId] = useState<number | null>(null);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);

  // Media state
  const [media, setMedia] = useState<MediaItem[]>(defaultMedia);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [showMediaForm, setShowMediaForm] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Exec state
  const [execGroups, setExecGroups] = useState<ExecGroup[]>([]);
  const [execRoles, setExecRoles] = useState<ExecRoleItem[]>([]);
  const [execTeams, setExecTeams] = useState<ExecTeamItem[]>([]);
  const [editingExec, setEditingExec] = useState<ExecMember | null>(null);
  const [showExecForm, setShowExecForm] = useState(false);
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  // FAQ state
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqLoading, setFaqLoading] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);

  const { showToast } = useToast();

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, [])

  const getAuthToken = () => localStorage.getItem('token');

  const getApiErrorMessage = async (response: Response) => {
    const fallback = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      return payload?.error?.message || payload?.message || fallback;
    } catch (_error) {
      return fallback;
    }
  };

  // ── Access control ──
  // Wait for auth to resolve before making any redirect decisions.
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Not logged in → send to login page
      navigate('/login', { replace: true });
      return;
    }

    if (!isAdmin) {
      // Logged in but not an admin → send to homepage
      navigate('/', { replace: true });
    }
  }, [isLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin || !user) return;

    const loadSponsorAndMedia = async () => {
      try {
        setSponsorLoading(true);
        setMediaLoading(true);
        setSponsorError(null);
        setMediaError(null);

        const [sponsorshipResponse, mediaResponse] = await Promise.all([
          fetch('/api/sponsorship', { cache: 'no-store' }),
          fetch('/api/media-entries', { cache: 'no-store' }),
        ]);

        if (sponsorshipResponse.ok) {
          const sponsorshipPayload = await sponsorshipResponse.json();
          const sponsorshipData = sponsorshipPayload?.data;
          const pageId = sponsorshipData?.id;
          if (typeof pageId === 'number') {
            setSponsorshipPageId(pageId);
          }

          const sponsorRows = Array.isArray(sponsorshipData?.sponsors) ? sponsorshipData.sponsors : [];
          setSponsors(
            sponsorRows.map((s: any) => ({
              id: s.id,
              name: s.name || '',
              logoUrl: s.logoUrl || '',
              websiteUrl: s.websiteUrl || '',
              displayOrder: typeof s.displayOrder === 'number' ? s.displayOrder : 0,
              sponsorshipPageId: typeof s.sponsorshipPageId === 'number' ? s.sponsorshipPageId : pageId,
            }))
          );
        } else if (sponsorshipResponse.status !== 404) {
          setSponsorError(await getApiErrorMessage(sponsorshipResponse));
        } else {
          setSponsors([]);
          setSponsorshipPageId(null);
        }

        if (mediaResponse.ok) {
          const mediaPayload = await mediaResponse.json();
          const mediaRows = Array.isArray(mediaPayload?.data) ? mediaPayload.data : [];
          setMedia(
            mediaRows.map((m: any) => ({
              id: m.id,
              activityId: m.activityId,
              mediaDriveUrl: m.mediaDriveUrl || '',
              overrideName: m.overrideName || '',
              overrideCover: m.overrideCover || '',
              resolvedName: m.resolvedName || '',
              resolvedCover: m.resolvedCover || '',
            }))
          );
        } else if (mediaResponse.status !== 404) {
          setMediaError(await getApiErrorMessage(mediaResponse));
        } else {
          setMedia([]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load admin data';
        setSponsorError(message);
        setMediaError(message);
      } finally {
        setSponsorLoading(false);
        setMediaLoading(false);
      }
    };

    loadSponsorAndMedia();
  }, [isAdmin, user]);

  // ── Load activities from backend ──
  useEffect(() => {
    if (!isAdmin || !user) return;

    const loadActivities = async () => {
      try {
        setActivityLoading(true);
        setActivityError(null);
        const token = localStorage.getItem('token');
        if (!token) {
          setActivityError('No authentication token found');
          return;
        }
        
        const response = await fetch(`/api/activities/all`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.statusText}`);
        }
        
        const data = await response.json();
        setActivities(data.map(mapActivity));
      } catch (err) {
        setActivityError(err instanceof Error ? err.message : 'Failed to load activities');
        console.error('Error loading activities:', err);
      } finally {
        setActivityLoading(false);
      }
    };

    loadActivities();
  }, [isAdmin, user]);

  // ── Load executives from backend ──
  useEffect(() => {
    if (!isAdmin || !user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const loadExecs = async () => {
      try {
        setExecLoading(true);
        setExecError(null);
        const [groupsRes, rolesRes, teamsRes] = await Promise.all([
          fetch('/api/admin/executives', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/exec-roles', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/admin/exec-teams', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (groupsRes.ok) {
          const payload = await groupsRes.json();
          setExecGroups(groupExecs(Array.isArray(payload?.data) ? payload.data : []));
        } else {
          setExecError(await getApiErrorMessage(groupsRes));
        }
        if (rolesRes.ok) {
          const payload = await rolesRes.json();
          setExecRoles(Array.isArray(payload?.data) ? payload.data : []);
        }
        if (teamsRes.ok) {
          const payload = await teamsRes.json();
          setExecTeams(Array.isArray(payload?.data) ? payload.data : []);
        }
      } catch (err) {
        setExecError(err instanceof Error ? err.message : 'Failed to load executives');
      } finally {
        setExecLoading(false);
      }
    };

    loadExecs();
  }, [isAdmin, user]);

  // ── Load FAQ from backend ──
  useEffect(() => {
    if (!isAdmin || !user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const loadFaq = async () => {
      try {
        setFaqLoading(true);
        setFaqError(null);
        const res = await fetch('/api/admin/faq', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const payload = await res.json();
          setFaqs(Array.isArray(payload?.data) ? payload.data : []);
        } else {
          setFaqError(await getApiErrorMessage(res));
        }
      } catch (err) {
        setFaqError(err instanceof Error ? err.message : 'Failed to load FAQ');
      } finally {
        setFaqLoading(false);
      }
    };

    loadFaq();
  }, [isAdmin, user]);

  const refreshExecs = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const [groupsRes, rolesRes, teamsRes] = await Promise.all([
      fetch('/api/admin/executives', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/exec-roles', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/exec-teams', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (groupsRes.ok) {
      const p = await groupsRes.json();
      setExecGroups(groupExecs(Array.isArray(p?.data) ? p.data : []));
    }
    if (rolesRes.ok) {
      const p = await rolesRes.json();
      setExecRoles(Array.isArray(p?.data) ? p.data : []);
    }
    if (teamsRes.ok) {
      const p = await teamsRes.json();
      setExecTeams(Array.isArray(p?.data) ? p.data : []);
    }
  };

  const saveExec = async (exec: Partial<ExecMember> & { id: number }) => {
    const isEdit = exec.id > 0;
    try {
      setExecError(null);
      const token = getAuthToken();
      if (!token) { setExecError('No authentication token found'); return; }
      const payload = {
        name: exec.name,
        roleId: exec.role?.id,
        teamId: exec.team?.id,
        imageUrl: exec.imageUrl || null,
        bio: exec.bio || null,
        instagramUrl: exec.instagramUrl || null,
        email: exec.email || null,
        isActive: exec.isActive ?? true,
      };
      const res = await fetch(isEdit ? `/api/admin/executives/${exec.id}` : '/api/admin/executives', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      await refreshExecs();
      setEditingExec(null);
      setShowExecForm(false);
      showToast(isEdit ? 'Exec member updated' : 'Exec member added', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save executive';
      setExecError(msg);
      showToast(msg, 'error');
    }
  };

  const deleteExec = async (id: number) => {
    try {
      setExecError(null);
      const token = getAuthToken();
      if (!token) { showToast('No authentication token', 'error'); return; }
      const res = await fetch(`/api/admin/executives/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      await refreshExecs();
      showToast('Exec member deleted', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete executive';
      setExecError(msg);
      showToast(msg, 'error');
    }
  };

  const saveFaq = async (faq: Partial<FaqItem> & { id: number }) => {
    const isEdit = faq.id > 0;
    try {
      setFaqError(null);
      const token = getAuthToken();
      if (!token) { setFaqError('No authentication token found'); return; }
      const payload = { question: faq.question, answer: faq.answer, isActive: faq.isActive ?? true };
      const res = await fetch(isEdit ? `/api/admin/faq/${faq.id}` : '/api/admin/faq', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      const refreshRes = await fetch('/api/admin/faq', { headers: { Authorization: `Bearer ${token}` } });
      if (refreshRes.ok) {
        const p = await refreshRes.json();
        setFaqs(Array.isArray(p?.data) ? p.data : []);
      }
      setEditingFaq(null);
      setShowFaqForm(false);
      showToast(isEdit ? 'FAQ entry updated' : 'FAQ entry added', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save FAQ entry';
      setFaqError(msg);
      showToast(msg, 'error');
    }
  };

  const deleteFaq = async (id: number) => {
    try {
      setFaqError(null);
      const token = getAuthToken();
      if (!token) { showToast('No authentication token', 'error'); return; }
      const res = await fetch(`/api/admin/faq/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      setFaqs((prev) => prev.filter((f) => f.id !== id));
      showToast('FAQ entry deleted', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete FAQ entry';
      setFaqError(msg);
      showToast(msg, 'error');
    }
  };

  // ── Loading state ──
  // Show a spinner while auth is being resolved to prevent flash of content
  // or premature redirects.
  if (isLoading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin" />
      </div>
    );
  }

  // ── Guard: never render admin UI for non-admin users ──
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  // ── Sponsor CRUD ──
  const saveSponsor = async (sponsor: Sponsor) => {
    try {
      setSponsorError(null);
      const token = getAuthToken();
      if (!token) {
        setSponsorError('No authentication token found');
        return;
      }
      if (!sponsorshipPageId) {
        setSponsorError('Sponsorship page is not seeded yet.');
        return;
      }

      const payload = {
        name: sponsor.name,
        logoUrl: sponsor.logoUrl || null,
        websiteUrl: sponsor.websiteUrl || null,
        displayOrder: sponsor.displayOrder,
        sponsorshipPageId,
      };

      if (sponsor.id > 0) {
        const response = await fetch(`/api/sponsors/${sponsor.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }
        const updated = (await response.json()).data;
        setSponsors((prev) => prev.map((s) => (s.id === sponsor.id ? {
          id: updated.id,
          name: updated.name || '',
          logoUrl: updated.logoUrl || '',
          websiteUrl: updated.websiteUrl || '',
          displayOrder: typeof updated.displayOrder === 'number' ? updated.displayOrder : 0,
          sponsorshipPageId: updated.sponsorshipPageId,
        } : s)));
      } else {
        const response = await fetch('/api/sponsors', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }
        const created = (await response.json()).data;
        setSponsors((prev) => [...prev, {
          id: created.id,
          name: created.name || '',
          logoUrl: created.logoUrl || '',
          websiteUrl: created.websiteUrl || '',
          displayOrder: typeof created.displayOrder === 'number' ? created.displayOrder : 0,
          sponsorshipPageId: created.sponsorshipPageId,
        }]);
      }

      setEditingSponsor(null);
      setShowSponsorForm(false);
      showToast(sponsor.id > 0 ? 'Sponsor updated' : 'Sponsor added', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save sponsor';
      setSponsorError(msg);
      showToast(msg, 'error');
    }
  };

  const deleteSponsor = async (id: number) => {
    try {
      setSponsorError(null);
      const token = getAuthToken();
      if (!token) { showToast('No authentication token', 'error'); return; }
      setSponsors((prev) => prev.filter((s) => s.id !== id));
      const response = await fetch(`/api/sponsors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response));
      const refetch = await fetch('/api/sponsorship', { cache: 'no-store' });
      if (refetch.ok) {
        const payload = await refetch.json();
        const rows = Array.isArray(payload?.data?.sponsors) ? payload.data.sponsors : [];
        setSponsors(rows.map((s: any) => ({
          id: s.id, name: s.name || '', logoUrl: s.logoUrl || '',
          websiteUrl: s.websiteUrl || '',
          displayOrder: typeof s.displayOrder === 'number' ? s.displayOrder : 0,
          sponsorshipPageId: typeof s.sponsorshipPageId === 'number' ? s.sponsorshipPageId : null,
        })));
      }
      showToast('Sponsor deleted', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete sponsor';
      setSponsorError(msg);
      showToast(msg, 'error');
    }
  };

  // ── Media CRUD ──
  const saveMedia = async (item: MediaItem) => {
    try {
      setMediaError(null);
      const token = getAuthToken();
      if (!token) {
        setMediaError('No authentication token found');
        return;
      }
      const payload = {
        activityId: item.activityId,
        mediaDriveUrl: item.mediaDriveUrl,
        overrideName: item.overrideName || null,
        overrideCover: item.overrideCover || null,
      };

      const response = await fetch(item.id > 0 ? `/api/media-entries/${item.id}` : '/api/media-entries', {
        method: item.id > 0 ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
      }
      const updated = (await response.json()).data;
      const mapped: MediaItem = {
        id: updated.id,
        activityId: updated.activityId,
        mediaDriveUrl: updated.mediaDriveUrl || '',
        overrideName: updated.overrideName || '',
        overrideCover: updated.overrideCover || '',
        resolvedName: updated.resolvedName || '',
        resolvedCover: updated.resolvedCover || '',
      };
      if (item.id > 0) {
        setMedia((prev) => prev.map((m) => (m.id === item.id ? mapped : m)));
      } else {
        setMedia((prev) => [mapped, ...prev]);
      }
      setEditingMedia(null);
      setShowMediaForm(false);
      showToast(item.id > 0 ? 'Photo Drive link updated' : 'Photo Drive link added', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update media link';
      setMediaError(msg);
      showToast(msg, 'error');
    }
  };

  const deleteMedia = async (id: number) => {
    try {
      setMediaError(null);
      const token = getAuthToken();
      if (!token) { showToast('No authentication token', 'error'); return; }
      const response = await fetch(`/api/media-entries/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response));
      setMedia((prev) => prev.filter((m) => m.id !== id));
      const freshRes = await fetch('/api/media-entries', { cache: 'no-store' });
      if (freshRes.ok) {
        const payload = await freshRes.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setMedia(rows.map((m: any) => ({
          id: m.id, activityId: m.activityId, mediaDriveUrl: m.mediaDriveUrl || '',
          overrideName: m.overrideName || '', overrideCover: m.overrideCover || '',
          resolvedName: m.resolvedName || '', resolvedCover: m.resolvedCover || '',
        })));
      }
      showToast('Photo Drive link deleted', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete media entry';
      setMediaError(msg);
      showToast(msg, 'error');
    }
  };

  // ── Activity CRUD ──
  const saveActivity = async (activity: Activity) => {
    try {
      setActivityError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setActivityError('No authentication token found');
        return;
      }

      // Map status to isPublished (archived = not published)
      const isPublished = activity.status !== 'archived';

      const payload = {
        title: activity.title,
        description: activity.description,
        startTime: datetimeLocalToISO(activity.startTime),
        endTime: datetimeLocalToISO(activity.endTime),
        imageUrl: activity.imageUrl,
        externalLink: activity.externalLink || '',
        isPublished,
      };

      if (activity.id > 0) {
        // Update existing
        const response = await fetch(`/api/activities/${activity.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Failed to update activity: ${response.statusText}`);
        }
        const data = await response.json();
        const updated = mapActivity(data);
        setActivities((prev) =>
          prev.map((a) => (a.id === activity.id ? updated : a))
        );
      } else {
        // Create new
        const response = await fetch(`/api/activities`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Failed to create activity: ${response.statusText}`);
        }
        const data = await response.json();
        const created = mapActivity(data);
        setActivities((prev) => [...prev, created]);
      }

      setEditingActivity(null);
      setShowActivityForm(false);
      showToast(activity.id > 0 ? 'Activity updated' : 'Activity created', 'success');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save activity';
      setActivityError(errMsg);
      showToast(errMsg, 'error');
    }
  };

  const deleteActivity = async (id: number) => {
    try {
      setActivityError(null);
      const token = localStorage.getItem('token');
      if (!token) { showToast('No authentication token', 'error'); return; }
      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Failed to delete activity: ${response.statusText}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
      showToast('Activity deleted', 'success');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to delete activity';
      setActivityError(errMsg);
      showToast(errMsg, 'error');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="bg-black min-h-screen">
      {/* Hero bar */}
      <section
        className="relative py-12 md:py-16 px-6 overflow-hidden"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-[150px]" style={{ backgroundColor: 'rgba(235,117,36,0.06)' }} />
        </div>
        <div className="max-w-[1200px] mx-auto relative">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(235,117,36,0.15)' }}>
                <Shield className="w-5 h-5 text-[#eb7524]" />
              </div>
              <div>
                <h1 className="text-white" style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, fontFamily: 'Outfit, sans-serif', lineHeight: 1.2 }}>
                  Admin Dashboard
                </h1>
                <p className="text-white/40" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                  Logged in as <span className="text-[#eb7524]">{user?.email}</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer"
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'sponsors' as Tab, label: 'Sponsors', icon: Star },
              { key: 'activities' as Tab, label: 'Activities', icon: Calendar },
              { key: 'media' as Tab, label: 'Photo Drive', icon: Camera },
              { key: 'execs' as Tab, label: 'Execs', icon: Users },
              { key: 'faq' as Tab, label: 'FAQ', icon: HelpCircle },
            ]).map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
                    active
                      ? 'bg-[#eb7524] text-white shadow-[0_4px_20px_rgba(235,117,36,0.3)]'
                      : 'bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  style={{ fontSize: '14px', fontWeight: active ? 600 : 400, fontFamily: 'Outfit, sans-serif' }}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          {tab === 'sponsors' && (
            <SponsorManager
              sponsors={sponsors}
              onSave={saveSponsor}
              onDelete={deleteSponsor}
              editing={editingSponsor}
              setEditing={setEditingSponsor}
              showForm={showSponsorForm}
              setShowForm={setShowSponsorForm}
              sponsorLoading={sponsorLoading}
              sponsorError={sponsorError}
            />
          )}
          {tab === 'media' && (
            <MediaManager
              media={media}
              onSave={saveMedia}
              onDelete={deleteMedia}
              editing={editingMedia}
              setEditing={setEditingMedia}
              showForm={showMediaForm}
              setShowForm={setShowMediaForm}
              activities={activities}
              mediaLoading={mediaLoading}
              mediaError={mediaError}
            />
          )}
          {tab === 'activities' && (
            <ActivityManager
              activities={activities}
              onSave={saveActivity}
              onDelete={deleteActivity}
              editing={editingActivity}
              setEditing={setEditingActivity}
              showForm={showActivityForm}
              setShowForm={setShowActivityForm}
              activityLoading={activityLoading}
              activityError={activityError}
            />
          )}
          {tab === 'execs' && (
            <ExecManager
              execGroups={execGroups}
              execRoles={execRoles}
              execTeams={execTeams}
              onSave={saveExec}
              onDelete={deleteExec}
              editing={editingExec}
              setEditing={setEditingExec}
              showForm={showExecForm}
              setShowForm={setShowExecForm}
              execLoading={execLoading}
              execError={execError}
              refreshExecs={refreshExecs}
            />
          )}
          {tab === 'faq' && (
            <FaqManager
              faqs={faqs}
              onSave={saveFaq}
              onDelete={deleteFaq}
              editing={editingFaq}
              setEditing={setEditingFaq}
              showForm={showFaqForm}
              setShowForm={setShowFaqForm}
              faqLoading={faqLoading}
              faqError={faqError}
            />
          )}
        </div>
      </section>

    </div>
  );
}

// ═══════════════════════════════════════════════
// Sponsor Manager
// ═══════════════════════════════════════════════

function SponsorManager({
  sponsors, onSave, onDelete, editing, setEditing, showForm, setShowForm, sponsorLoading, sponsorError,
}: {
  sponsors: Sponsor[];
  onSave: (s: Sponsor) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  editing: Sponsor | null;
  setEditing: (s: Sponsor | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  sponsorLoading?: boolean;
  sponsorError?: string | null;
}) {
  const ordered = [...sponsors].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            Manage Sponsors
          </h2>
          <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''} in rendering order
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          <Plus className="w-4 h-4" />
          Add Sponsor
        </button>
      </div>

      {sponsorError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {sponsorError}
          </p>
        </div>
      )}

      {sponsorLoading && (
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
          <p className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            Loading sponsors...
          </p>
        </div>
      )}

      {/* Form Modal */}
      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <SponsorForm
              initial={editing}
              onSave={onSave}
              onCancel={() => { setEditing(null); setShowForm(false); }}
            />
          </div>
        </div>
      )}

      {!sponsorLoading && ordered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordered.map((sponsor) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              onEdit={() => { setEditing(sponsor); setShowForm(false); }}
              onDelete={() => onDelete(sponsor.id)}
            />
          ))}
        </div>
      )}

      {!sponsorLoading && sponsors.length === 0 && (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>No sponsors added yet</p>
        </div>
      )}
    </div>
  );
}

function SponsorCard({ sponsor, onEdit, onDelete }: { sponsor: Sponsor; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-6 group hover:border-white/10 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(235,117,36,0.15)' }}>
          {sponsor.logoUrl ? (
            <img src={sponsor.logoUrl} alt={sponsor.name} className="w-7 h-7 object-contain" />
          ) : (
            <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#eb7524' }}>{sponsor.name.charAt(0)}</span>
          )}
        </div>
        <span className="px-2.5 py-0.5 rounded-full border text-xs" style={{ borderColor: '#eb752466', color: '#eb7524', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
          Order {sponsor.displayOrder}
        </span>
      </div>
      <h4 className="text-white mb-1" style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>{sponsor.name}</h4>
      <p className="text-white/35 mb-4 truncate" style={{ fontSize: '13px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}>
        {sponsor.websiteUrl || 'No website URL'}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 hover:text-[#eb7524] hover:border-[#eb7524]/30 transition-all cursor-pointer"
          style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
        >
          <Edit3 className="w-3 h-3" />
          Edit
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
              style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer"
              style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
            style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function SponsorForm({ initial, onSave, onCancel }: { initial: Sponsor | null; onSave: (s: Sponsor) => Promise<void> | void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl || '');
  const [displayOrder, setDisplayOrder] = useState(String(initial?.displayOrder ?? 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      id: initial?.id || 0,
      name,
      logoUrl,
      websiteUrl,
      displayOrder: Number(displayOrder) || 0,
      sponsorshipPageId: initial?.sponsorshipPageId || 0,
    });
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {initial ? 'Edit Sponsor' : 'Add New Sponsor'}
        </h3>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Sponsor Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IronGrip Supplements" className={inputCls} style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }} required />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Display Order</label>
          <input
            type="number"
            min={0}
            step={1}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className={inputCls}
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Logo URL</label>
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" className={inputCls} style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Website URL</label>
          <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className={inputCls} style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <div className="md:col-span-2 flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>
            Cancel
          </button>
          <button type="submit" className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]" style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            <Save className="w-4 h-4" />
            {initial ? 'Update' : 'Add'} Sponsor
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Media Manager
// ═══════════════════════════════════════════════

function MediaManager({
  media, onSave, onDelete, editing, setEditing, showForm, setShowForm, activities, mediaLoading, mediaError,
}: {
  media: MediaItem[];
  onSave: (m: MediaItem) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  editing: MediaItem | null;
  setEditing: (m: MediaItem | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  activities: Activity[];
  mediaLoading?: boolean;
  mediaError?: string | null;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            Manage Activity Media Drives
          </h2>
          <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            Add one drive folder per activity. Drive URL is required.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          <Plus className="w-4 h-4" />
          Add Media Entry
        </button>
      </div>

      {activities.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-yellow-200" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            Add at least one activity first before creating media entries.
          </p>
        </div>
      )}

      {mediaError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {mediaError}
          </p>
        </div>
      )}

      {mediaLoading && (
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
          <p className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            Loading media configuration...
          </p>
        </div>
      )}

      {/* Form Modal */}
      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <MediaForm
              initial={editing}
              onSave={onSave}
              activities={activities}
              onCancel={() => { setEditing(null); setShowForm(false); }}
            />
          </div>
        </div>
      )}

      {!mediaLoading && media.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {media.map((item) => (
            <div key={item.id} className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="h-[170px] bg-black/40">
                {item.resolvedCover ? (
                  <img src={item.resolvedCover} alt={item.resolvedName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/10" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h4 className="text-white mb-2 truncate" style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                  {item.resolvedName}
                </h4>
                <a
                  href={item.mediaDriveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#eb7524] text-sm break-all hover:text-[#ff9f5e]"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {item.mediaDriveUrl}
                </a>
                <MediaCardActions item={item} onEdit={() => { setEditing(item); setShowForm(false); }} onDelete={() => onDelete(item.id)} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <ImageIcon className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>No media entries added yet</p>
        </div>
      )}
    </div>
  );
}

function MediaForm({ initial, onSave, activities, onCancel }: { initial: MediaItem | null; onSave: (m: MediaItem) => Promise<void> | void; activities: Activity[]; onCancel: () => void }) {
  const [activityId, setActivityId] = useState(String(initial?.activityId || (activities[0]?.id || '')));
  const [mediaDriveUrl, setMediaDriveUrl] = useState(initial?.mediaDriveUrl || '');
  const [overrideName, setOverrideName] = useState(initial?.overrideName || '');
  const [overrideCover, setOverrideCover] = useState(initial?.overrideCover || '');
  const [isResolvingCover, setIsResolvingCover] = useState(false);
  const [coverResolveError, setCoverResolveError] = useState<string | null>(null);

  const selectedActivity = activities.find((a) => String(a.id) === activityId);

  const resolvePixiesetUrl = async (url: string) => {
    if (!url.includes('pixieset.com') || !url.includes('pid=')) return;
    setIsResolvingCover(true);
    setCoverResolveError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/resolve-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoverResolveError(data?.error?.message || 'Could not resolve image URL');
      } else {
        setOverrideCover(data.directUrl);
      }
    } catch {
      setCoverResolveError('Network error while resolving URL');
    } finally {
      setIsResolvingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityId) return;
    await onSave({
      id: initial?.id || 0,
      activityId: Number(activityId),
      mediaDriveUrl,
      overrideName,
      overrideCover,
      resolvedName: initial?.resolvedName || '',
      resolvedCover: initial?.resolvedCover || '',
    });
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {initial ? 'Edit Media Entry' : 'Add Media Entry'}
        </h3>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Linked Activity</label>
          <CustomSelect
            value={activityId}
            onChange={(v) => setActivityId(v)}
            options={activities.map((a) => ({ value: a.id, label: a.title }))}
            required
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Media Drive URL</label>
          <input
            value={mediaDriveUrl}
            onChange={(e) => setMediaDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className={inputCls}
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            required
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Override Name (optional)</label>
          <input
            value={overrideName}
            onChange={(e) => setOverrideName(e.target.value)}
            placeholder={selectedActivity?.title || 'Uses linked activity title by default'}
            className={inputCls}
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Override Cover URL (optional)</label>
          <div className="relative">
            <input
              value={overrideCover}
              onChange={(e) => { setOverrideCover(e.target.value); setCoverResolveError(null); }}
              onBlur={(e) => resolvePixiesetUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                setTimeout(() => resolvePixiesetUrl(pasted), 0);
              }}
              placeholder={selectedActivity?.imageUrl || 'Paste a Pixieset photo link or direct image URL'}
              className={inputCls}
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', paddingRight: isResolvingCover ? '2.5rem' : undefined }}
            />
            {isResolvingCover && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#eb7524] animate-spin" />
            )}
          </div>
          {coverResolveError && (
            <p className="mt-1 text-red-400" style={{ fontSize: '12px' }}>{coverResolveError}</p>
          )}
          {!coverResolveError && overrideCover && !isResolvingCover && overrideCover.startsWith('https://images.pixieset.com') && (
            <p className="mt-1 text-green-400/70" style={{ fontSize: '12px' }}>✓ Pixieset URL resolved</p>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>
            Cancel
          </button>
          <button type="submit" className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]" style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            <Save className="w-4 h-4" />
            {initial ? 'Update' : 'Save'} Link
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Activity Manager
// ═══════════════════════════════════════════════

function ActivityManager({
  activities, onSave, onDelete, editing, setEditing, showForm, setShowForm,
  activityLoading, activityError,
}: {
  activities: Activity[];
  onSave: (a: Activity) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
  editing: Activity | null;
  setEditing: (a: Activity | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  activityLoading?: boolean;
  activityError?: string | null;
}) {
  const grouped = {
    upcoming: activities.filter((a) => a.status === 'upcoming'),
    ongoing: activities.filter((a) => a.status === 'ongoing'),
    archived: activities.filter((a) => a.status === 'archived'),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            Manage Activities
          </h2>
          <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'} ({grouped.upcoming.length} upcoming, {grouped.ongoing.length} ongoing, {grouped.archived.length} archived)
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          disabled={activityLoading}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Error alert */}
      {activityError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {activityError}
          </p>
        </div>
      )}

      {/* Loading state */}
      {activityLoading && (
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
          <p className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            Loading activities...
          </p>
        </div>
      )}

      {/* Form Modal */}
      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityForm
              initial={editing}
              onSave={onSave}
              onCancel={() => { setEditing(null); setShowForm(false); }}
            />
          </div>
        </div>
      )}

      {/* Activities by status */}
      {(['ongoing', 'upcoming', 'archived'] as const).map((status) => {
        const items = grouped[status];
        const color = statusColors[status];
        const labels = { upcoming: 'Upcoming', ongoing: 'Ongoing', archived: 'Archived' };

        return (
          <div key={status} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
              <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                {labels[status]} Activities
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: color + '18', color, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                {items.length}
              </span>
            </div>
            {items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onEdit={() => { setEditing(activity); setShowForm(false); }}
                    onDelete={() => onDelete(activity.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 rounded-xl border border-white/[0.06]">
                <p className="text-white/30" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>No {labels[status].toLowerCase()} activities</p>
              </div>
            )}
          </div>
        );
      })}

      {activities.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>No activities added yet</p>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity, onEdit, onDelete }: { activity: Activity; onEdit: () => void; onDelete: () => Promise<void> | void }) {
  const color = statusColors[activity.status];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/10 transition-all duration-300">
      {/* Image */}
      <div className="relative h-[180px] overflow-hidden">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
            <Calendar className="w-8 h-8 text-white/10" />
          </div>
        ) : (
          <img
            src={activity.imageUrl}
            alt={activity.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h4 className="text-white mb-3 truncate" style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {activity.title}
        </h4>


        {/* Date/Time */}
        <div className="bg-white/[0.03] rounded-lg p-2 mb-3 border border-white/[0.05]">
          <div className="flex items-center gap-1.5 text-white/50" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            <Clock className="w-3 h-3" />
            <span>{formatDate(activity.startTime)} · {formatTime(activity.startTime)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 hover:text-[#eb7524] hover:border-[#eb7524]/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
          >
            <Edit3 className="w-3 h-3" />
            Edit
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Deleting
                  </>
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityForm({ initial, onSave, onCancel }: { initial: Activity | null; onSave: (a: Activity) => Promise<void> | void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [startTime, setStartTime] = useState(formatToDatetimeLocal(initial?.startTime));
  const [endTime, setEndTime] = useState(formatToDatetimeLocal(initial?.endTime));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [externalLink, setExternalLink] = useState(initial?.externalLink || '');
  const [isPublished, setIsPublished] = useState(initial?.isPublished !== false);
  const [preview, setPreview] = useState(initial?.imageUrl || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadActivityImage(file);
      setImageUrl(url);
      setPreview(url);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !startTime || !endTime) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Derive status from times and isPublished
      const now = new Date();
      const start = new Date(datetimeLocalToISO(startTime));
      const end = new Date(datetimeLocalToISO(endTime));
      let status: Activity['status'] = 'upcoming';
      if (!isPublished || now > end) {
        status = 'archived';
      } else if (now >= start && now < end) {
        status = 'ongoing';
      }
      
      await onSave({
        id: initial?.id || 0, // 0 means new record
        title,
        description,
        startTime,
        endTime,
        imageUrl: imageUrl,
        externalLink,
        status,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {initial ? 'Edit Activity' : 'Add New Activity'}
        </h3>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>Activity Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Training Session"
              className={inputCls}
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              required
            />
          </div>
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>Published</label>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`w-full py-2.5 rounded-xl border transition-all cursor-pointer ${
                isPublished
                  ? 'bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
              style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              {isPublished ? '✓ Published' : '○ Unpublished'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the activity..."
            rows={3}
            className={inputCls + ' resize-none'}
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>Start Date/Time *</label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputCls}
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              required
            />
          </div>
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>End Date/Time *</label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputCls}
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Activity Image</label>
          <div className="flex gap-3 mb-2">
            <input 
              ref={fileRef}
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  {imageUrl ? 'Change Image' : 'Upload Image'}
                </>
              )}
            </button>
          </div>
          {uploadError && (
            <p className="text-red-400 text-xs mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>{uploadError}</p>
          )}
          {imageUrl && (
            <p className="text-white/40 text-xs truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{imageUrl}</p>
          )}
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>External Link</label>
          <input
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            placeholder="https://example.com"
            className={inputCls}
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-xl overflow-hidden h-[160px] border border-white/[0.06]">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {initial ? 'Update' : 'Add'} Activity
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Exec Manager
// ═══════════════════════════════════════════════

function ExecManager({
  execGroups, execRoles, execTeams, onSave, onDelete, editing, setEditing, showForm, setShowForm, execLoading, execError, refreshExecs,
}: {
  execGroups: ExecGroup[];
  execRoles: ExecRoleItem[];
  execTeams: ExecTeamItem[];
  onSave: (exec: Partial<ExecMember> & { id: number }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  editing: ExecMember | null;
  setEditing: (e: ExecMember | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  execLoading: boolean;
  execError: string | null;
  refreshExecs: () => Promise<void>;
}) {
  const allMembers = execGroups.flatMap((g) => g.members);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-white" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>Exec Members</h2>
          <p className="text-white/40 mt-1" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{allMembers.length} member{allMembers.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {execError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{execError}</span>
        </div>
      )}

      {execLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin" />
        </div>
      ) : allMembers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>No exec members yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {execGroups.map((group) => (
            <div key={group.team.id}>
              <h3 className="text-white/60 mb-3" style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{group.team.name}</h3>
              <div className="grid gap-3">
                {group.members.map((member) => (
                  <ExecMemberCard
                    key={member.id}
                    member={member}
                    onEdit={() => { setEditing(member); setShowForm(true); }}
                    onDelete={() => onDelete(member.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ExecMemberForm
              initial={editing}
              execRoles={execRoles}
              execTeams={execTeams}
              onSave={onSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        </div>
      )}

      <ExecRoleTeamManager execRoles={execRoles} execTeams={execTeams} onRefresh={refreshExecs} />
    </div>
  );
}

function MediaCardActions({ item, onEdit, onDelete }: { item: any; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try { await onDelete(); } finally { setIsDeleting(false); setConfirmDelete(false); }
  };

  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        onClick={onEdit}
        disabled={isDeleting}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 hover:text-[#eb7524] hover:border-[#eb7524]/30 transition-all cursor-pointer disabled:opacity-40"
        style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
      >
        <Edit3 className="w-3 h-3" />
        Edit
      </button>
      {confirmDelete ? (
        <>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
            style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
          >
            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            {isDeleting ? 'Deleting' : 'Confirm'}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50"
            style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
          >Cancel</button>
        </>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
          style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      )}
    </div>
  );
}

function ExecMemberCard({ member, onEdit, onDelete }: { member: ExecMember; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try { await onDelete(); } finally { setIsDeleting(false); }
  };

  return (
    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 hover:bg-white/[0.05] transition-all">
      <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 overflow-hidden flex-shrink-0">
        {member.imageUrl ? (
          <img src={member.imageUrl} alt={member.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users className="w-4 h-4 text-white/20" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-medium truncate" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{member.name}</p>
          {!member.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/30 border border-white/10">Inactive</span>}
        </div>
        <p className="text-white/40 truncate" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>{member.role.name} · {member.team.name}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onEdit} disabled={isDeleting} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer disabled:opacity-40">
          <Edit3 className="w-4 h-4" />
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {isDeleting ? 'Deleting' : 'Confirm'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50"
              style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
            >Cancel</button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ExecMemberForm({ initial, execRoles, execTeams, onSave, onCancel }: {
  initial: ExecMember | null;
  execRoles: ExecRoleItem[];
  execTeams: ExecTeamItem[];
  onSave: (exec: Partial<ExecMember> & { id: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [roleId, setRoleId] = useState<number>(initial?.role?.id ?? (execRoles[0]?.id ?? 0));
  const [teamId, setTeamId] = useState<number>(initial?.team?.id ?? (execTeams[0]?.id ?? 0));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [instagramUrl, setInstagramUrl] = useState(initial?.instagramUrl ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({
        id: initial?.id ?? 0,
        name: name.trim(),
        role: { id: roleId, name: '' },
        team: { id: teamId, name: '' },
        imageUrl: imageUrl.trim() || null,
        bio: bio.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
        email: email.trim() || null,
        isActive,
        createdAt: initial?.createdAt ?? '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>{initial ? 'Edit Member' : 'Add Member'}</h3>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={100} className={inputCls} />
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Role *</label>
          <CustomSelect
            value={roleId}
            onChange={(v) => setRoleId(Number(v))}
            options={execRoles.map((r) => ({ value: r.id, label: r.name }))}
            required
          />
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Team *</label>
          <CustomSelect
            value={teamId}
            onChange={(v) => setTeamId(Number(v))}
            options={execTeams.map((t) => ({ value: t.id, label: t.name }))}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Image URL</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Bio (max 300 chars)</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio..." maxLength={300} rows={3} className={inputCls} />
          <p className="text-white/20 mt-1 text-right" style={{ fontSize: '12px' }}>{bio.length}/300</p>
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Instagram URL</label>
          <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className={inputCls} />
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exec@example.com" className={inputCls} />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <input type="checkbox" id="execIsActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#eb7524]" />
          <label htmlFor="execIsActive" className="text-white/60 cursor-pointer" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>Active (visible on public site)</label>
        </div>
        <div className="md:col-span-2 flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50" style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />{initial ? 'Update' : 'Add'} Member</>}
          </button>
        </div>
      </form>
    </div>
  );
}

function ExecRoleTeamManager({ execRoles, execTeams, onRefresh }: {
  execRoles: ExecRoleItem[];
  execTeams: ExecTeamItem[];
  onRefresh: () => Promise<void>;
}) {
  const [newRoleName, setNewRoleName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    setError(null);
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/exec-roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName.trim() }),
    });
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p?.error?.message || 'Failed to add role'); return; }
    setNewRoleName('');
    await onRefresh();
  };

  const deleteRole = async (id: number) => {
    setError(null);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/exec-roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p?.error?.message || 'Failed to delete role'); return; }
    await onRefresh();
  };

  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    setError(null);
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/exec-teams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p?.error?.message || 'Failed to add team'); return; }
    setNewTeamName('');
    await onRefresh();
  };

  const deleteTeam = async (id: number) => {
    setError(null);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/admin/exec-teams/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { const p = await res.json().catch(() => ({})); setError(p?.error?.message || 'Failed to delete team'); return; }
    await onRefresh();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-2 pt-8 border-t border-white/[0.06]">
      {error && (
        <div className="md:col-span-2 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400" style={{ fontSize: '14px' }}>{error}</span>
        </div>
      )}
      {[
        { label: 'Roles', items: execRoles, newName: newRoleName, setNewName: setNewRoleName, onAdd: addRole, onDelete: deleteRole },
        { label: 'Teams', items: execTeams, newName: newTeamName, setNewName: setNewTeamName, onAdd: addTeam, onDelete: deleteTeam },
      ].map(({ label, items, newName, setNewName, onAdd, onDelete }) => (
        <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <h4 className="text-white/60 mb-4" style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</h4>
          <div className="space-y-2 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-white/70" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{item.name}</span>
                <button onClick={() => onDelete(item.id)} className="p-1 rounded text-red-400/60 hover:text-red-400 transition-all cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd()} placeholder={`New ${label.toLowerCase().slice(0, -1)}…`} maxLength={100} className={inputCls + ' text-sm'} />
            <button onClick={onAdd} disabled={!newName.trim()} className="flex items-center gap-1 px-3 py-2 bg-[#eb7524] text-white rounded-xl disabled:opacity-40 cursor-pointer hover:bg-[#d4691f] transition-all flex-shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// FAQ Manager
// ═══════════════════════════════════════════════

function FaqManager({
  faqs, onSave, onDelete, editing, setEditing, showForm, setShowForm, faqLoading, faqError,
}: {
  faqs: FaqItem[];
  onSave: (faq: Partial<FaqItem> & { id: number }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  editing: FaqItem | null;
  setEditing: (f: FaqItem | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
  faqLoading: boolean;
  faqError: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-white" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>FAQ</h2>
          <p className="text-white/40 mt-1" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{faqs.length} entr{faqs.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {faqError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{faqError}</span>
        </div>
      )}

      {faqLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin" />
        </div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-16">
          <HelpCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>No FAQ entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <FaqEntryRow
              key={faq.id}
              faq={faq}
              onEdit={() => { setEditing(faq); setShowForm(true); }}
              onDelete={() => onDelete(faq.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <FaqEntryForm
              initial={editing}
              onSave={onSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FaqEntryRow({ faq, onEdit, onDelete }: { faq: FaqItem; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try { await onDelete(); } finally { setIsDeleting(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 hover:bg-white/[0.05] transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-medium" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>{faq.question}</p>
            {!faq.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/30 border border-white/10 flex-shrink-0">Inactive</span>}
          </div>
          <p className="text-white/40 line-clamp-2" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{faq.answer}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onEdit} disabled={isDeleting} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer disabled:opacity-40">
            <Edit3 className="w-4 h-4" />
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                {isDeleting ? 'Deleting' : 'Confirm'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50"
                style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
              >Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FaqEntryForm({ initial, onSave, onCancel }: {
  initial: FaqItem | null;
  onSave: (faq: Partial<FaqItem> & { id: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({ id: initial?.id ?? 0, question: question.trim(), answer: answer.trim(), isActive });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>{initial ? 'Edit FAQ Entry' : 'Add FAQ Entry'}</h3>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Question * (max 300 chars)</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What is AUSS?" required maxLength={300} className={inputCls} />
          <p className="text-white/20 mt-1 text-right" style={{ fontSize: '12px' }}>{question.length}/300</p>
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>Answer *</label>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Full answer…" required rows={5} className={inputCls} />
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="faqIsActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-[#eb7524]" />
          <label htmlFor="faqIsActive" className="text-white/60 cursor-pointer" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>Active (visible on About page)</label>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50" style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />{initial ? 'Update' : 'Add'} Entry</>}
          </button>
        </div>
      </form>
    </div>
  );
}
