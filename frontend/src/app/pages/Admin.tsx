import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus, Trash2, Edit3, Save, X, ChevronLeft, Star, Users, Trophy, Heart,
  Camera, ExternalLink, ArrowRight, LogOut, Shield, Image as ImageIcon,
  Loader2, Calendar, Clock, AlertCircle,
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
  id: string;
  name: string;
  tier: 'Gold' | 'Silver' | 'Bronze';
  description: string;
  website: string;
}

interface MediaItem {
  id: string;
  src: string;
  alt: string;
  label: string;
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

// ── Default data ──
const defaultSponsors: Sponsor[] = [
  { id: '1', name: 'IronGrip Supplements', tier: 'Gold', description: 'Premium sports nutrition partner providing supplements and recovery products for all AUSS members.', website: 'https://example.com' },
  { id: '2', name: 'LiftWear NZ', tier: 'Gold', description: 'Official apparel sponsor outfitting our competition team with high-performance lifting gear.', website: 'https://example.com' },
  { id: '3', name: 'BarBend Athletics', tier: 'Silver', description: 'Equipment sponsor providing competition-grade barbells and plates for our training sessions.', website: 'https://example.com' },
  { id: '4', name: 'FuelBox Meals', tier: 'Silver', description: 'Meal prep partner keeping our athletes fuelled with macro-balanced meals throughout the semester.', website: 'https://example.com' },
  { id: '5', name: 'UoA Recreation Centre', tier: 'Bronze', description: 'Our home gym and venue partner for all AUSS training sessions and internal competitions.', website: 'https://example.com' },
  { id: '6', name: 'PhysioFirst NZ', tier: 'Bronze', description: 'Sports physiotherapy partner offering discounted recovery and injury prevention sessions for members.', website: 'https://example.com' },
];

const defaultMedia: MediaItem[] = [
  { id: '1', src: 'https://images.unsplash.com/photo-1770026136797-18659700b5b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Powerlifting deadlift session', label: 'Powerlifting Competition 2025' },
  { id: '2', src: 'https://images.unsplash.com/photo-1761034114082-c2d63456a82a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Group training session', label: 'Training Session' },
  { id: '3', src: 'https://images.unsplash.com/photo-1765109375988-912ce5ba5ffd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Team celebration', label: 'Team Event' },
  { id: '4', src: 'https://images.unsplash.com/photo-1624513764372-a4eb7b334c62?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Squat rack workout', label: 'Gym Session' },
  { id: '5', src: 'https://images.unsplash.com/photo-1688521010890-0e58abbaf755?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixlib=rb-4.1.0&q=80&w=1080', alt: 'Chalk hands barbell', label: 'Meet Day' },
];

const defaultActivities: Activity[] = [];

const tierColors: Record<string, string> = { Gold: '#eb7524', Silver: '#94a3b8', Bronze: '#b87333' };

const statusColors: Record<string, string> = { upcoming: '#3b82f6', ongoing: '#10b981', archived: '#6b7280' };

type Tab = 'sponsors' | 'media' | 'activities';

// ── Shared field styles ──
const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all";
const labelStyle: React.CSSProperties = { fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 };

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

  // Media state
  const [media, setMedia] = useState<MediaItem[]>(defaultMedia);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [showMediaForm, setShowMediaForm] = useState(false);

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

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
  // TODO (backend): Replace local state mutations with API calls.
  //   - POST /api/admin/sponsors        → create sponsor
  //   - PUT  /api/admin/sponsors/:id    → update sponsor
  //   - DELETE /api/admin/sponsors/:id  → delete sponsor
  // All admin API routes must verify the JWT and enforce role === 'ADMIN'
  // server-side, regardless of frontend guards.
  const saveSponsor = (sponsor: Sponsor) => {
    if (sponsors.find((s) => s.id === sponsor.id)) {
      setSponsors((prev) => prev.map((s) => (s.id === sponsor.id ? sponsor : s)));
    } else {
      setSponsors((prev) => [...prev, { ...sponsor, id: Date.now().toString() }]);
    }
    setEditingSponsor(null);
    setShowSponsorForm(false);
  };

  const deleteSponsor = (id: string) => {
    setSponsors((prev) => prev.filter((s) => s.id !== id));
  };

  // ── Media CRUD ──
  // TODO (backend): Replace local state mutations with API calls.
  //   - POST /api/admin/media        → create media item
  //   - PUT  /api/admin/media/:id    → update media item
  //   - DELETE /api/admin/media/:id  → delete media item
  // All admin API routes must verify the JWT and enforce role === 'ADMIN'.
  const saveMedia = (item: MediaItem) => {
    if (media.find((m) => m.id === item.id)) {
      setMedia((prev) => prev.map((m) => (m.id === item.id ? item : m)));
    } else {
      setMedia((prev) => [...prev, { ...item, id: Date.now().toString() }]);
    }
    setEditingMedia(null);
    setShowMediaForm(false);
  };

  const deleteMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
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
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to save activity';
      setActivityError(errMsg);
      console.error('Error saving activity:', err);
    }
  };

  const deleteActivity = async (id: number) => {
    try {
      setActivityError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setActivityError('No authentication token found');
        return;
      }

      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to delete activity: ${response.statusText}`);
      }
      
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to delete activity';
      setActivityError(errMsg);
      console.error('Error deleting activity:', err);
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
          <div className="flex gap-2">
            {([
              { key: 'sponsors' as Tab, label: 'Sponsors', icon: Star },
              { key: 'activities' as Tab, label: 'Activities', icon: Calendar },
              { key: 'media' as Tab, label: 'Photo Drive', icon: Camera },
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
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Sponsor Manager
// ═══════════════════════════════════════════════

function SponsorManager({
  sponsors, onSave, onDelete, editing, setEditing, showForm, setShowForm,
}: {
  sponsors: Sponsor[];
  onSave: (s: Sponsor) => void;
  onDelete: (id: string) => void;
  editing: Sponsor | null;
  setEditing: (s: Sponsor | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
}) {
  const grouped = {
    Gold: sponsors.filter((s) => s.tier === 'Gold'),
    Silver: sponsors.filter((s) => s.tier === 'Silver'),
    Bronze: sponsors.filter((s) => s.tier === 'Bronze'),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            Manage Sponsors
          </h2>
          <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {sponsors.length} sponsor{sponsors.length !== 1 ? 's' : ''} across {Object.values(grouped).filter((g) => g.length > 0).length} tiers
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

      {/* Sponsor list by tier */}
      {(['Gold', 'Silver', 'Bronze'] as const).map((tier) => {
        const items = grouped[tier];
        if (items.length === 0) return null;
        const color = tierColors[tier];
        return (
          <div key={tier} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
              <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                {tier} Sponsors
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs" style={{ backgroundColor: color + '18', color, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                {items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  onEdit={() => { setEditing(sponsor); setShowForm(false); }}
                  onDelete={() => onDelete(sponsor.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {sponsors.length === 0 && (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>No sponsors added yet</p>
        </div>
      )}
    </div>
  );
}

function SponsorCard({ sponsor, onEdit, onDelete }: { sponsor: Sponsor; onEdit: () => void; onDelete: () => void }) {
  const color = tierColors[sponsor.tier];
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-6 group hover:border-white/10 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color }}>{sponsor.name.charAt(0)}</span>
        </div>
        <span className="px-2.5 py-0.5 rounded-full border text-xs" style={{ borderColor: color + '40', color, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
          {sponsor.tier}
        </span>
      </div>
      <h4 className="text-white mb-1" style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>{sponsor.name}</h4>
      <p className="text-white/35 mb-4" style={{ fontSize: '13px', lineHeight: 1.6, fontFamily: 'Inter, sans-serif' }}>
        {sponsor.description.length > 100 ? sponsor.description.slice(0, 100) + '...' : sponsor.description}
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

function SponsorForm({ initial, onSave, onCancel }: { initial: Sponsor | null; onSave: (s: Sponsor) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [tier, setTier] = useState<Sponsor['tier']>(initial?.tier || 'Gold');
  const [description, setDescription] = useState(initial?.description || '');
  const [website, setWebsite] = useState(initial?.website || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: initial?.id || '', name, tier, description, website });
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
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Tier</label>
          <div className="flex gap-2">
            {(['Gold', 'Silver', 'Bronze'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`flex-1 py-2.5 rounded-xl border transition-all cursor-pointer ${
                  tier === t ? 'border-transparent' : 'border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
                }`}
                style={{
                  fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                  ...(tier === t ? { backgroundColor: tierColors[t] + '20', color: tierColors[t], borderColor: tierColors[t] + '40' } : {}),
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the sponsor's involvement..."
            rows={3}
            className={inputCls + ' resize-none'}
            style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 mb-1.5" style={labelStyle}>Website URL</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className={inputCls} style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }} />
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
  media, onSave, onDelete, editing, setEditing, showForm, setShowForm,
}: {
  media: MediaItem[];
  onSave: (m: MediaItem) => void;
  onDelete: (id: string) => void;
  editing: MediaItem | null;
  setEditing: (m: MediaItem | null) => void;
  showForm: boolean;
  setShowForm: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-white mb-1" style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            Manage Photo Drive
          </h2>
          <p className="text-white/40" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
            {media.length} photo{media.length !== 1 ? 's' : ''} in the drive
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
          Add Photo
        </button>
      </div>

      {/* Form Modal */}
      {(showForm || editing) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <MediaForm
              initial={editing}
              onSave={onSave}
              onCancel={() => { setEditing(null); setShowForm(false); }}
            />
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {media.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onEdit={() => { setEditing(item); setShowForm(false); }}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>

      {media.length === 0 && (
        <div className="text-center py-16">
          <ImageIcon className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/30" style={{ fontSize: '16px', fontFamily: 'Inter, sans-serif' }}>No photos added yet</p>
        </div>
      )}
    </div>
  );
}

function MediaCard({ item, onEdit, onDelete }: { item: MediaItem; onEdit: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/10 transition-all duration-300">
      <div className="relative h-[180px] overflow-hidden">
        {imgError ? (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
            <ImageIcon className="w-8 h-8 text-white/10" />
          </div>
        ) : (
          <img
            src={item.src}
            alt={item.alt}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white/80 truncate" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>{item.label}</p>
        </div>
      </div>
      <div className="p-4 flex items-center gap-2">
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

function MediaForm({ initial, onSave, onCancel }: { initial: MediaItem | null; onSave: (m: MediaItem) => void; onCancel: () => void }) {
  const [src, setSrc] = useState(initial?.src || '');
  const [alt, setAlt] = useState(initial?.alt || '');
  const [label, setLabel] = useState(initial?.label || '');
  const [preview, setPreview] = useState(initial?.src || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: initial?.id || '', src, alt, label });
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white" style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
          {initial ? 'Edit Photo' : 'Add New Photo'}
        </h3>
        <button onClick={onCancel} className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-white/60 mb-1.5" style={labelStyle}>Image URL</label>
            <input
              value={src}
              onChange={(e) => { setSrc(e.target.value); setPreview(e.target.value); }}
              placeholder="https://images.unsplash.com/..."
              className={inputCls}
              style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
              required
            />
          </div>
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Powerlifting Competition 2025" className={inputCls} style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }} required />
          </div>
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>Alt Text</label>
            <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Descriptive alt text for accessibility" className={inputCls} style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }} required />
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-xl overflow-hidden h-[160px] border border-white/[0.06]">
            <img src={preview} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer" style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif' }}>
            Cancel
          </button>
          <button type="submit" className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]" style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            <Save className="w-4 h-4" />
            {initial ? 'Update' : 'Add'} Photo
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
