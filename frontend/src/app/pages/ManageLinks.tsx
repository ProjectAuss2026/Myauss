import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchWithAuth } from '../lib/authFetch';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Save,
  X,
  ExternalLink,
  Globe,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Settings,
  RefreshCw,
  Upload,
  ImageIcon,
} from 'lucide-react';
import type { IconType } from 'react-icons';
import {
  FaLinkedin,
  FaFacebook,
  FaInstagram,
  FaTiktok,
  FaDiscord,
  FaYoutube,
  FaTwitter,
  FaGithub,
  FaSpotify,
  FaWhatsapp,
  FaTelegram,
  FaReddit,
  FaPinterest,
  FaSnapchat,
  FaTwitch,
  FaSlack,
  FaGlobe,
} from 'react-icons/fa';
import { FaXTwitter, FaThreads } from 'react-icons/fa6';
import { MdEmail } from 'react-icons/md';
import { SiLinktree } from 'react-icons/si';

/* ─── Platform Registry ──────────────────────────────────────────────────── */

export interface PlatformInfo {
  /** Canonical name (stored in DB) */
  name: string;
  /** react-icon component */
  icon: IconType;
  /** Hex brand colour */
  color: string;
  /** Search aliases — user might type any of these */
  aliases: string[];
}

export const KNOWN_PLATFORMS: PlatformInfo[] = [
  { name: 'Instagram', icon: FaInstagram, color: '#E1306C', aliases: ['instagram', 'insta', 'ig'] },
  { name: 'Facebook', icon: FaFacebook, color: '#1877F2', aliases: ['facebook', 'fb'] },
  { name: 'LinkedIn', icon: FaLinkedin, color: '#0A66C2', aliases: ['linkedin', 'linked'] },
  { name: 'TikTok', icon: FaTiktok, color: '#000000', aliases: ['tiktok', 'tik tok', 'tt'] },
  { name: 'Discord', icon: FaDiscord, color: '#5865F2', aliases: ['discord', 'disc'] },
  { name: 'YouTube', icon: FaYoutube, color: '#FF0000', aliases: ['youtube', 'yt'] },
  { name: 'Twitter', icon: FaTwitter, color: '#1DA1F2', aliases: ['twitter'] },
  { name: 'X (Twitter)', icon: FaXTwitter, color: '#000000', aliases: ['x', 'x twitter'] },
  { name: 'Threads', icon: FaThreads, color: '#000000', aliases: ['threads'] },
  { name: 'GitHub', icon: FaGithub, color: '#ffffff', aliases: ['github', 'gh'] },
  { name: 'Spotify', icon: FaSpotify, color: '#1DB954', aliases: ['spotify'] },
  { name: 'WhatsApp', icon: FaWhatsapp, color: '#25D366', aliases: ['whatsapp', 'wa'] },
  { name: 'Telegram', icon: FaTelegram, color: '#26A5E4', aliases: ['telegram', 'tg'] },
  { name: 'Reddit', icon: FaReddit, color: '#FF4500', aliases: ['reddit'] },
  { name: 'Pinterest', icon: FaPinterest, color: '#E60023', aliases: ['pinterest', 'pin'] },
  { name: 'Snapchat', icon: FaSnapchat, color: '#FFFC00', aliases: ['snapchat', 'snap'] },
  { name: 'Twitch', icon: FaTwitch, color: '#9146FF', aliases: ['twitch'] },
  { name: 'Slack', icon: FaSlack, color: '#4A154B', aliases: ['slack'] },
  { name: 'Email', icon: MdEmail, color: '#eb7524', aliases: ['email', 'mail', 'e-mail'] },
  { name: 'Linktree', icon: SiLinktree, color: '#43E660', aliases: ['linktree', 'link tree'] },
  { name: 'Website', icon: FaGlobe, color: '#888888', aliases: ['website', 'web', 'site', 'url'] },
];

export function findPlatform(name: string): PlatformInfo | undefined {
  const lower = name.toLowerCase().trim();
  return KNOWN_PLATFORMS.find(
    (p) => p.name.toLowerCase() === lower || p.aliases.includes(lower)
  );
}

function filterPlatforms(query: string): PlatformInfo[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  return KNOWN_PLATFORMS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.aliases.some((a) => a.includes(q))
  ).slice(0, 6);
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface CommunicationLink {
  id: number;
  platform: string;
  url: string;
  imgUrl: string;
  description: string;
  isActive: boolean;
  updatedAt: string;
}

type EditingLink = Partial<Pick<CommunicationLink, 'platform' | 'url' | 'imgUrl' | 'description' | 'isActive'>>;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetchWithAuth('/api/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Upload failed');
  }
  const data = await res.json();
  return data.imgUrl;
}

/* ─── PlatformInput — autocomplete combo input ────────────────────────────── */

function PlatformInput({
  value,
  onChange,
  onSelectPlatform,
  placeholder = 'e.g. Instagram',
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectPlatform?: (p: PlatformInfo) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const suggestions = filterPlatforms(value);
  const matched = findPlatform(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (p: PlatformInfo) => {
    onChange(p.name);
    setOpen(false);
    onSelectPlatform?.(p);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {matched ? (
          <matched.icon
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: matched.color }}
          />
        ) : (
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
        )}
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (value.trim()) setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/40 transition-colors"
          style={{ fontFamily: 'Inter, sans-serif' }}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#1a1a1a] border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden">
          {suggestions.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: p.color }} />
                <span className="text-white text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {p.name}
                </span>
                <span className="text-white/20 text-xs ml-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
                  SVG icon available
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── ImageUploadField — file picker + preview ────────────────────────────── */

function ImageUploadField({
  value,
  onChange,
  platformName,
}: {
  value: string;
  onChange: (url: string) => void;
  platformName?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const matched = platformName ? findPlatform(platformName) : undefined;
  const hasBuiltInIcon = !!matched;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const useBuiltIn = () => {
    onChange('__builtin__');
  };

  return (
    <div>
      <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
        Icon Image
      </label>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {value === '__builtin__' && matched ? (
            <matched.icon className="w-6 h-6" style={{ color: matched.color }} />
          ) : value && value !== '__builtin__' ? (
            <img
              src={value}
              alt="icon preview"
              className="w-8 h-8 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-white/15" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-1">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all cursor-pointer text-xs disabled:opacity-40"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Browse
          </button>
          {hasBuiltInIcon && matched && (() => {
            const MatchedIcon = matched.icon;
            return (
              <button
                type="button"
                onClick={useBuiltIn}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all cursor-pointer ${
                  value === '__builtin__'
                    ? 'border-[#eb7524]/30 bg-[#eb7524]/10 text-[#eb7524]'
                    : 'border-white/10 text-white/60 hover:text-white hover:border-white/20'
                }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                <MatchedIcon className="w-3.5 h-3.5" style={{ color: matched.color }} />
                Use {matched.name} icon
              </button>
            );
          })()}
        </div>
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>{error}</p>
      )}
      {value && value !== '__builtin__' && (
        <p className="text-white/20 text-xs truncate" style={{ fontFamily: 'Inter, sans-serif' }}>{value}</p>
      )}
    </div>
  );
}

/* ─── LinkIcon — render icon for a link (built-in or uploaded image) ────── */

function LinkIcon({ link, size = 'md' }: { link: CommunicationLink; size?: 'sm' | 'md' }) {
  const matched = findPlatform(link.platform);
  const px = size === 'sm' ? 'w-6 h-6' : 'w-8 h-8';

  if (link.imgUrl === '__builtin__' && matched) {
    return <matched.icon className={px} style={{ color: matched.color }} />;
  }

  if (link.imgUrl && link.imgUrl !== '__builtin__') {
    return (
      <img
        src={link.imgUrl}
        alt={link.platform}
        className={`${px} object-contain`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  if (matched) {
    return <matched.icon className={px} style={{ color: matched.color }} />;
  }

  return <Globe className={`${px} text-white/20`} />;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function ManageLinks() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [links, setLinks] = useState<CommunicationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | 'new' | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // Editing state — keyed by link id
  const [editing, setEditing] = useState<Record<number, EditingLink>>({});

  // New link form
  const [showNew, setShowNew] = useState(false);
  const [newLink, setNewLink] = useState({ platform: '', url: '', imgUrl: '', description: '' });

  /* ── Auth guard ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'OWNER'))) {
      navigate('/profile');
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  /* ── Fetch links ────────────────────────────────────────────────────── */
  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/config');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLinks(data.communicationLinks ?? []);
    } catch {
      showToast('Failed to load links', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'OWNER')) fetchLinks();
  }, [isAuthenticated, user, fetchLinks]);

  /* ── Editing helpers ────────────────────────────────────────────────── */
  const startEditing = (link: CommunicationLink) => {
    setEditing((prev) => ({
      ...prev,
      [link.id]: { platform: link.platform, url: link.url, imgUrl: link.imgUrl, description: link.description, isActive: link.isActive },
    }));
  };

  const cancelEditing = (id: number) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateField = (id: number, field: keyof EditingLink, value: string | boolean) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  /* ── PATCH (update) ─────────────────────────────────────────────────── */
  const handleSave = async (id: number) => {
    const data = editing[id];
    if (!data) return;
    setSaving(id);
    try {
      const res = await fetchWithAuth('/api/config', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'communicationLink', id, data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed');
      }
      showToast('Link updated', 'success');
      cancelEditing(id);
      await fetchLinks();
    } catch (e: any) {
      showToast(e.message || 'Failed to update link', 'error');
    } finally {
      setSaving(null);
    }
  };

  /* ── Toggle isActive ────────────────────────────────────────────────── */
  const handleToggleActive = async (link: CommunicationLink) => {
    setSaving(link.id);
    try {
      const res = await fetchWithAuth('/api/config', {
        method: 'PATCH',
        body: JSON.stringify({ type: 'communicationLink', id: link.id, data: { isActive: !link.isActive } }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      showToast(`${link.platform} ${!link.isActive ? 'enabled' : 'disabled'}`, 'success');
      await fetchLinks();
    } catch {
      showToast('Failed to toggle status', 'error');
    } finally {
      setSaving(null);
    }
  };

  /* ── POST (create) ──────────────────────────────────────────────────── */
  const handleCreate = async () => {
    if (!newLink.platform.trim() || !newLink.url.trim()) {
      showToast('Platform and URL are required', 'error');
      return;
    }
    // If no image was chosen, try to use built-in icon
    let imgUrl = newLink.imgUrl;
    if (!imgUrl) {
      const matched = findPlatform(newLink.platform);
      if (matched) {
        imgUrl = '__builtin__';
      } else {
        showToast('Please upload an image or select a known platform', 'error');
        return;
      }
    }
    setSaving('new');
    try {
      const res = await fetchWithAuth('/api/config', {
        method: 'POST',
        body: JSON.stringify({ type: 'communicationLink', data: { ...newLink, imgUrl } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Create failed');
      }
      showToast('Link created', 'success');
      setNewLink({ platform: '', url: '', imgUrl: '', description: '' });
      setShowNew(false);
      await fetchLinks();
    } catch (e: any) {
      showToast(e.message || 'Failed to create link', 'error');
    } finally {
      setSaving(null);
    }
  };

  /* ── DELETE ─────────────────────────────────────────────────────────── */
  const handleDelete = async (link: CommunicationLink) => {
    if (!window.confirm(`Delete "${link.platform}"? This cannot be undone.`)) return;
    setDeleting(link.id);
    try {
      const res = await fetchWithAuth('/api/config', {
        method: 'DELETE',
        body: JSON.stringify({ type: 'communicationLink', id: link.id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      showToast(`${link.platform} deleted`, 'success');
      await fetchLinks();
    } catch {
      showToast('Failed to delete link', 'error');
    } finally {
      setDeleting(null);
    }
  };

  /* ── Guard render ───────────────────────────────────────────────────── */
  if (authLoading || !user || (user.role !== 'ADMIN' && user.role !== 'OWNER')) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#eb7524]/30 border-t-[#eb7524] rounded-full animate-spin" />
      </div>
    );
  }

  /* ── UI ─────────────────────────────────────────────────────────────── */
  return (
    <div className="bg-black min-h-screen relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#eb7524]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#eb7524]/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-12 md:py-20 relative">
        {/* Back link */}
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
          style={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px' }}
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Profile
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#eb7524]/10 border border-[#eb7524]/20 flex items-center justify-center">
              <Settings className="w-6 h-6 text-[#eb7524]" />
            </div>
            <div>
              <h1
                className="text-white"
                style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                Manage Links
              </h1>
              <p className="text-white/40 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
                {links.length} communication link{links.length !== 1 && 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchLinks}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all cursor-pointer disabled:opacity-40"
              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowNew(true)}
              disabled={showNew}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] cursor-pointer disabled:opacity-50 disabled:hover:shadow-none"
              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
            >
              <Plus className="w-4 h-4" />
              Add Link
            </button>
          </div>
        </div>

        {/* New link form */}
        {showNew && (
          <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(235,117,36,0.08)]">
            <div className="flex items-center justify-between mb-5">
              <h2
                className="text-white flex items-center gap-2"
                style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                <Plus className="w-4 h-4 text-[#eb7524]" />
                New Link
              </h2>
              <button
                onClick={() => { setShowNew(false); setNewLink({ platform: '', url: '', imgUrl: '', description: '' }); }}
                className="text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Platform *
                </label>
                <PlatformInput
                  value={newLink.platform}
                  onChange={(v) => setNewLink({ ...newLink, platform: v })}
                  onSelectPlatform={(p) => {
                    setNewLink((prev) => ({
                      ...prev,
                      platform: p.name,
                      imgUrl: prev.imgUrl || '__builtin__',
                    }));
                  }}
                />
              </div>
              <div>
                <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                  URL *
                </label>
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/40 transition-colors"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  />
                </div>
              </div>
            </div>

            <div className="mb-5">
              <ImageUploadField
                value={newLink.imgUrl}
                onChange={(url) => setNewLink({ ...newLink, imgUrl: url })}
                platformName={newLink.platform}
              />
            </div>

            <div className="mb-5">
              <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                Description <span className="text-white/20">(optional, max 150 chars)</span>
              </label>
              <div className="relative">
                <textarea
                  value={newLink.description}
                  onChange={(e) => {
                    if (e.target.value.length <= 150) setNewLink({ ...newLink, description: e.target.value });
                  }}
                  placeholder="Short description shown on the social card..."
                  rows={2}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/40 transition-colors resize-none"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                />
                <span className="absolute bottom-2 right-3 text-white/20 text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {newLink.description.length}/150
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={saving === 'new'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] cursor-pointer disabled:opacity-50"
                style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              >
                {saving === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Create Link
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#eb7524]/30 border-t-[#eb7524] rounded-full animate-spin" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-20">
            <Globe className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>
              No communication links found. Add one to get started.
            </p>
          </div>
        ) : (
          /* ── Link cards ─────────────────────────────────────────────── */
          <div className="space-y-4">
            {links.map((link) => {
              const isEditing = editing[link.id] !== undefined;
              const draft = editing[link.id];
              const isSaving = saving === link.id;
              const isDeleting = deleting === link.id;

              return (
                <div
                  key={link.id}
                  className={`bg-[#111] border rounded-2xl overflow-hidden transition-all ${
                    isEditing
                      ? 'border-[#eb7524]/25 shadow-[0_8px_32px_rgba(235,117,36,0.06)]'
                      : 'border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  {/* Card header — display mode */}
                  <div className="flex items-center gap-4 px-6 py-5">
                    {/* Icon / image preview */}
                    <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <LinkIcon link={link} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-white truncate"
                          style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                        >
                          {link.platform}
                        </h3>
                        <span
                          className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            link.isActive
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-white/5 text-white/30 border border-white/10'
                          }`}
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          {link.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p
                        className="text-white/40 truncate mt-0.5"
                        style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                      >
                        {link.url}
                      </p>
                      {link.description && (
                        <p
                          className="text-white/25 truncate mt-0.5"
                          style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}
                        >
                          {link.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggleActive(link)}
                        disabled={isSaving}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
                        title={link.isActive ? 'Disable' : 'Enable'}
                      >
                        {link.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-white/30" />
                        )}
                      </button>

                      {/* Edit */}
                      {!isEditing ? (
                        <button
                          onClick={() => startEditing(link)}
                          className="px-3 py-1.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all cursor-pointer text-xs"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => cancelEditing(link.id)}
                          className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all cursor-pointer text-xs"
                          style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                          Cancel
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(link)}
                        disabled={isDeleting}
                        className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer disabled:opacity-40"
                        title="Delete"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Editing fields */}
                  {isEditing && draft && (
                    <div className="border-t border-white/[0.06] px-6 py-5 bg-white/[0.01]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                            Platform
                          </label>
                          <PlatformInput
                            value={draft.platform ?? ''}
                            onChange={(v) => updateField(link.id, 'platform', v)}
                            onSelectPlatform={(p) => {
                              updateField(link.id, 'platform', p.name);
                              if (!draft.imgUrl || draft.imgUrl === '__builtin__') {
                                updateField(link.id, 'imgUrl', '__builtin__');
                              }
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                            URL
                          </label>
                          <div className="relative">
                            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                              value={draft.url ?? ''}
                              onChange={(e) => updateField(link.id, 'url', e.target.value)}
                              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#eb7524]/40 transition-colors"
                              style={{ fontFamily: 'Inter, sans-serif' }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mb-5">
                        <ImageUploadField
                          value={draft.imgUrl ?? ''}
                          onChange={(url) => updateField(link.id, 'imgUrl', url)}
                          platformName={draft.platform}
                        />
                      </div>

                      <div className="mb-5">
                        <label className="block text-white/40 text-xs mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Description <span className="text-white/20">(optional, max 150 chars)</span>
                        </label>
                        <div className="relative">
                          <textarea
                            value={draft.description ?? ''}
                            onChange={(e) => {
                              if (e.target.value.length <= 150) updateField(link.id, 'description', e.target.value);
                            }}
                            placeholder="Short description shown on the social card..."
                            rows={2}
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/40 transition-colors resize-none"
                            style={{ fontFamily: 'Inter, sans-serif' }}
                          />
                          <span className="absolute bottom-2 right-3 text-white/20 text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {(draft.description ?? '').length}/150
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-white/20 text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                          Last updated: {new Date(link.updatedAt).toLocaleDateString()}
                        </p>
                        <button
                          onClick={() => handleSave(link.id)}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all hover:shadow-[0_4px_20px_rgba(235,117,36,0.4)] cursor-pointer disabled:opacity-50"
                          style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
