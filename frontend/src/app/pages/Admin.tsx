import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { fetchWithAuth } from "../lib/authFetch";
import {
  type AdminMembersPagination,
  getMemberPaymentProofFile,
  getMemberPaymentProofs,
  formatMemberDate,
  formatMemberDateTime,
  formatMemberRole,
  formatMembershipStatus,
  getAdminMembers,
  type AdminMember,
  type MemberPaymentProofMetadata,
  type MemberStatusFilter,
  updateAdminMemberStatus,
} from "../lib/adminMembers";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Star,
  Users,
  Camera,
  ExternalLink,
  LogOut,
  Shield,
  Image as ImageIcon,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  GripVertical,
  Link as LinkIcon,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { AttendeesModal } from "../components/AttendeesModal";
import {
  getSafeImageSrc,
  getSafeLinkHref,
  isSafeImageSrc,
  isSafeLinkHref,
} from "../../lib/safeUrl";

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
      { rootMargin: options?.margin || "0px" },
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
  capacity?: number | null;
  status: "upcoming" | "ongoing" | "archived";
  createdAt?: string;
  updatedAt?: string;
}

interface ExecRoleItem {
  id: number;
  name: string;
  displayOrder: number;
}
interface ExecTeamItem {
  id: number;
  name: string;
  displayOrder: number;
}
interface ExecMember {
  id: number;
  name: string;
  role: ExecRoleItem | null;
  team: ExecTeamItem | null;
  imageUrl?: string | null;
  bio?: string | null;
  instagramUrl?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
}
interface ExecGroup {
  team: ExecTeamItem;
  members: ExecMember[];
}
interface FaqItem {
  id: number;
  question: string;
  answer: string;
  isActive: boolean;
}
interface AccessUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "OWNER";
  firstName: string | null;
  lastName: string | null;
  isVerified: boolean;
  createdAt: string;
}

interface InviteeSuggestion {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

// ── Default data ──
const defaultSponsors: Sponsor[] = [];
const defaultMedia: MediaItem[] = [];

const defaultActivities: Activity[] = [];

const statusColors: Record<string, string> = {
  upcoming: "#3b82f6",
  ongoing: "#10b981",
  archived: "#6b7280",
};

type Tab =
  | "sponsors"
  | "media"
  | "activities"
  | "execs"
  | "members"
  | "faq"
  | "access";
const VALID_TABS: Tab[] = [
  "sponsors",
  "media",
  "activities",
  "execs",
  "members",
  "faq",
  "access",
];
const DEFAULT_MEMBER_PAGE_SIZE = 20;
const MEMBER_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_MEMBER_PAGINATION: AdminMembersPagination = {
  page: 1,
  pageSize: DEFAULT_MEMBER_PAGE_SIZE,
  total: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
};
const PAYMENT_PROOF_APPROVAL_REASON = "Payment proof approved";

// Synthetic team for members whose role or team was deleted
const UNASSIGNED_TEAM: ExecTeamItem = {
  id: -1,
  name: "⚠ Unassigned — reassign or remove",
  displayOrder: Infinity,
};

// ── Exec grouping helper ──
// ── FLIP animation helpers ──
function captureFlip(containerEl: HTMLElement | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!containerEl) return map;
  (Array.from(containerEl.children) as HTMLElement[]).forEach((el) => {
    if (el.dataset.flipId)
      map.set(el.dataset.flipId, el.getBoundingClientRect().top);
  });
  return map;
}
function applyFlip(
  containerEl: HTMLElement | null,
  snapshot: Map<string, number>,
) {
  if (!containerEl || snapshot.size === 0) return;
  (Array.from(containerEl.children) as HTMLElement[]).forEach((el) => {
    const prevTop = snapshot.get(el.dataset.flipId ?? "");
    if (prevTop === undefined) return;
    const delta = prevTop - el.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) return;
    el.style.transform = `translateY(${delta}px)`;
    el.style.transition = "none";
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transition =
          "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)";
        el.style.transform = "";
      }),
    );
  });
}

function groupExecs(executives: ExecMember[]): ExecGroup[] {
  const teamMap = new Map<number, ExecGroup>();
  for (const exec of executives) {
    const key = exec.team?.id ?? -1;
    if (!teamMap.has(key)) {
      teamMap.set(key, { team: exec.team ?? UNASSIGNED_TEAM, members: [] });
    }
    teamMap.get(key)!.members.push(exec);
  }
  const groups = Array.from(teamMap.values());
  // Sort members within each group by role displayOrder, then role id
  for (const g of groups) {
    g.members.sort(
      (a, b) =>
        (a.role?.displayOrder ?? 9999) - (b.role?.displayOrder ?? 9999) ||
        (a.role?.id ?? 9999) - (b.role?.id ?? 9999),
    );
  }
  // Sort groups: unassigned last, then by team displayOrder
  return groups.sort((a, b) => {
    if (a.team.id === -1) return 1;
    if (b.team.id === -1) return -1;
    return a.team.displayOrder - b.team.displayOrder;
  });
}

// ── Shared field styles ──
const inputCls =
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all";
const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontFamily: "Inter, sans-serif",
  fontWeight: 500,
};

// ── Custom Select ──
function CustomSelect({
  value,
  onChange,
  options,
  required,
}: {
  value: string | number;
  onChange: (val: string) => void;
  options: { value: string | number; label: string }[];
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#eb7524]/50 focus:bg-white/[0.06] transition-all cursor-pointer"
        style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
      >
        <span className={selected ? "text-white" : "text-white/30"}>
          {selected?.label ?? "Select…"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-white/40 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 bg-[#111] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
          style={{ maxHeight: "220px", overflowY: "auto" }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(String(opt.value));
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 transition-all ${
                String(opt.value) === String(value)
                  ? "bg-[#eb7524]/20 text-[#eb7524]"
                  : "text-white/80 hover:bg-white/[0.06] hover:text-white"
              }`}
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared validation helpers ──
function isHttpUrl(value: string): boolean {
  return isSafeLinkHref(value);
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const fieldErrorCls = "mt-1.5 text-red-400";
const fieldErrorStyle: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: "Inter, sans-serif",
};

// ── Reusable confirmation dialog ──
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Save Changes",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(235,117,36,0.12)" }}
          >
            <AlertCircle className="w-5 h-5 text-[#eb7524]" />
          </div>
          <div className="flex-1">
            <h3
              className="text-white mb-1"
              style={{
                fontSize: "17px",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {title}
            </h3>
            <div
              className="text-white/60"
              style={{
                fontSize: "14px",
                fontFamily: "Inter, sans-serif",
                lineHeight: 1.55,
              }}
            >
              {message}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontSize: "14px",
              fontFamily: "Outfit, sans-serif",
              fontWeight: 500,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity helpers ──
function deriveActivityStatus(
  activity: Activity,
): "upcoming" | "ongoing" | "archived" {
  const now = new Date();
  const startTime = new Date(activity.startTime);
  const endTime = new Date(activity.endTime);

  if (!activity.isPublished || now > endTime) return "archived";
  if (now >= startTime && now < endTime) return "ongoing";
  return "upcoming";
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
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local format to ISO string
 */
function datetimeLocalToISO(datetimeLocal: string): string {
  if (!datetimeLocal) return "";
  return `${datetimeLocal}:00`; // Convert YYYY-MM-DDTHH:mm to YYYY-MM-DDTHH:mm:00
}

function getCapacityError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "Capacity must be a positive whole number";
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    return "Capacity must be a positive whole number";
  return null;
}

function parseCapacity(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

/**
 * Upload image file to /api/upload
 */
async function uploadActivityImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetchWithAuth("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Upload failed");
  }

  const data = await response.json();
  return data.path || data.url || data.imgUrl;
}

export function Admin() {
  const { user, isAuthenticated, isAdmin, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(() => {
    const saved = localStorage.getItem("admin_tab");
    return VALID_TABS.includes(saved as Tab) ? (saved as Tab) : "sponsors";
  });

  const handleTabChange = (newTab: Tab) => {
    localStorage.setItem("admin_tab", newTab);
    setTab(newTab);
  };

  // Sponsor state
  const [sponsors, setSponsors] = useState<Sponsor[]>(defaultSponsors);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [sponsorshipPageId, setSponsorshipPageId] = useState<number | null>(
    null,
  );
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

  // Access management (OWNER only)
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteReason, setInviteReason] = useState("");
  const [issuingInvite, setIssuingInvite] = useState(false);
  const [searchingInvitees, setSearchingInvitees] = useState(false);
  const [inviteSuggestions, setInviteSuggestions] = useState<
    InviteeSuggestion[]
  >([]);
  const [selectedInvitee, setSelectedInvitee] =
    useState<InviteeSuggestion | null>(null);
  const [inviteSearchMessage, setInviteSearchMessage] = useState<string | null>(
    null,
  );
  const [demotingUserId, setDemotingUserId] = useState<string | null>(null);

  const [members, setMembers] = useState<AdminMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [debouncedMemberSearch, setDebouncedMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] =
    useState<MemberStatusFilter>("ALL");
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(
    DEFAULT_MEMBER_PAGE_SIZE,
  );
  const [memberPagination, setMemberPagination] =
    useState<AdminMembersPagination>(DEFAULT_MEMBER_PAGINATION);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const { showToast } = useToast();
  const isOwner = user?.role === "OWNER";

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const getApiErrorMessage = async (response: Response) => {
    const fallback = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      return (
        (typeof payload?.error === "string"
          ? payload.error
          : payload?.error?.message) ||
        payload?.message ||
        fallback
      );
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
      navigate("/login", { replace: true });
      return;
    }

    if (!isAdmin) {
      // Logged in but not an admin → send to homepage
      navigate("/", { replace: true });
    }
  }, [isLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    if (!isOwner && tab === "access") {
      handleTabChange("sponsors");
    }
  }, [isOwner, tab]);

  useEffect(() => {
    if (!isAdmin || !user) return;

    const loadSponsorAndMedia = async () => {
      try {
        setSponsorLoading(true);
        setMediaLoading(true);
        setSponsorError(null);
        setMediaError(null);

        const [sponsorshipResponse, mediaResponse] = await Promise.all([
          fetch("/api/sponsorship", { cache: "no-store" }),
          fetch("/api/media-entries", { cache: "no-store" }),
        ]);

        if (sponsorshipResponse.ok) {
          const sponsorshipPayload = await sponsorshipResponse.json();
          const sponsorshipData = sponsorshipPayload?.data;
          const pageId = sponsorshipData?.id;
          if (typeof pageId === "number") {
            setSponsorshipPageId(pageId);
          }

          const sponsorRows = Array.isArray(sponsorshipData?.sponsors)
            ? sponsorshipData.sponsors
            : [];
          setSponsors(
            sponsorRows.map((s: any) => ({
              id: s.id,
              name: s.name || "",
              logoUrl: s.logoUrl || "",
              websiteUrl: s.websiteUrl || "",
              displayOrder:
                typeof s.displayOrder === "number" ? s.displayOrder : 0,
              sponsorshipPageId:
                typeof s.sponsorshipPageId === "number"
                  ? s.sponsorshipPageId
                  : pageId,
            })),
          );
        } else if (sponsorshipResponse.status !== 404) {
          setSponsorError(await getApiErrorMessage(sponsorshipResponse));
        } else {
          setSponsors([]);
          setSponsorshipPageId(null);
        }

        if (mediaResponse.ok) {
          const mediaPayload = await mediaResponse.json();
          const mediaRows = Array.isArray(mediaPayload?.data)
            ? mediaPayload.data
            : [];
          setMedia(
            mediaRows.map((m: any) => ({
              id: m.id,
              activityId: m.activityId,
              mediaDriveUrl: m.mediaDriveUrl || "",
              overrideName: m.overrideName || "",
              overrideCover: m.overrideCover || "",
              resolvedName: m.resolvedName || "",
              resolvedCover: m.resolvedCover || "",
            })),
          );
        } else if (mediaResponse.status !== 404) {
          setMediaError(await getApiErrorMessage(mediaResponse));
        } else {
          setMedia([]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load admin data";
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
        const response = await fetchWithAuth(`/api/activities/all`, {
          headers: { "Content-Type": "application/json" },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.statusText}`);
        }

        const data = await response.json();
        setActivities(data.map(mapActivity));
      } catch (err) {
        setActivityError(
          err instanceof Error ? err.message : "Failed to load activities",
        );
        console.error("Error loading activities:", err);
      } finally {
        setActivityLoading(false);
      }
    };

    loadActivities();
  }, [isAdmin, user]);

  // ── Load executives from backend ──
  useEffect(() => {
    if (!isAdmin || !user) return;

    const loadExecs = async () => {
      try {
        setExecLoading(true);
        setExecError(null);
        const [groupsRes, rolesRes, teamsRes] = await Promise.all([
          fetchWithAuth("/api/admin/executives"),
          fetchWithAuth("/api/admin/exec-roles"),
          fetchWithAuth("/api/admin/exec-teams"),
        ]);
        if (groupsRes.ok) {
          const payload = await groupsRes.json();
          setExecGroups(
            groupExecs(Array.isArray(payload?.data) ? payload.data : []),
          );
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
        setExecError(
          err instanceof Error ? err.message : "Failed to load executives",
        );
      } finally {
        setExecLoading(false);
      }
    };

    loadExecs();
  }, [isAdmin, user]);

  // ── Load FAQ from backend ──
  useEffect(() => {
    if (!isAdmin || !user) return;

    const loadFaq = async () => {
      try {
        setFaqLoading(true);
        setFaqError(null);
        const res = await fetchWithAuth("/api/admin/faq");
        if (res.ok) {
          const payload = await res.json();
          setFaqs(Array.isArray(payload?.data) ? payload.data : []);
        } else {
          setFaqError(await getApiErrorMessage(res));
        }
      } catch (err) {
        setFaqError(err instanceof Error ? err.message : "Failed to load FAQ");
      } finally {
        setFaqLoading(false);
      }
    };

    loadFaq();
  }, [isAdmin, user]);

  const refreshExecs = async () => {
    const [groupsRes, rolesRes, teamsRes] = await Promise.all([
      fetchWithAuth("/api/admin/executives"),
      fetchWithAuth("/api/admin/exec-roles"),
      fetchWithAuth("/api/admin/exec-teams"),
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

  const loadAccessUsers = async () => {
    if (!isOwner) return;

    try {
      setAccessLoading(true);
      setAccessError(null);
      const res = await fetchWithAuth("/api/auth/admin/users");
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      const payload = await res.json();
      setAccessUsers(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setAccessError(
        err instanceof Error ? err.message : "Failed to load users",
      );
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    if (!isOwner || !user) return;
    loadAccessUsers();
  }, [isOwner, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmedSearch = memberSearch.trim();
      setDebouncedMemberSearch((previousSearch) => {
        if (previousSearch !== trimmedSearch) {
          setMemberPage(1);
        }
        return trimmedSearch;
      });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [memberSearch]);

  const loadMembers = async () => {
    if (!isAdmin || !user) return;

    try {
      setMembersLoading(true);
      setMembersError(null);
      const result = await getAdminMembers({
        status: memberStatusFilter,
        search: memberSearch.trim(),
        page: memberPage,
        pageSize: memberPageSize,
      });
      setMembers(result.members);
      setMemberPagination(result.pagination);
    } catch (err) {
      setMembers([]);
      setMembersError(
        err instanceof Error ? err.message : "Failed to load members",
      );
    } finally {
      setMembersLoading(false);
    }
  };

  const refreshMembers = async () => {
    const trimmedSearch = memberSearch.trim();
    if (trimmedSearch !== debouncedMemberSearch) {
      setMemberPage(1);
      setDebouncedMemberSearch(trimmedSearch);
      return;
    }

    await loadMembers();
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!isAdmin || !user) return;

      try {
        setMembersLoading(true);
        setMembersError(null);
        const result = await getAdminMembers({
          status: memberStatusFilter,
          search: debouncedMemberSearch,
          page: memberPage,
          pageSize: memberPageSize,
        });
        if (cancelled) return;
        setMembers(result.members);
        setMemberPagination(result.pagination);
      } catch (err) {
        if (cancelled) return;
        setMembers([]);
        setMembersError(
          err instanceof Error ? err.message : "Failed to load members",
        );
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    user,
    memberStatusFilter,
    debouncedMemberSearch,
    memberPage,
    memberPageSize,
  ]);

  const handleMemberStatusFilterChange = (nextStatus: MemberStatusFilter) => {
    if (nextStatus === memberStatusFilter) return;
    setMemberStatusFilter(nextStatus);
    setMemberPage(1);
  };

  const handleMemberPageSizeChange = (nextPageSize: number) => {
    if (nextPageSize === memberPageSize) return;
    setMemberPageSize(nextPageSize);
    setMemberPage(1);
  };

  useEffect(() => {
    if (!isOwner) return;

    const query = inviteEmail.trim().toLowerCase();
    if (!query) {
      setSearchingInvitees(false);
      setInviteSuggestions([]);
      setSelectedInvitee(null);
      setInviteSearchMessage(null);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setSearchingInvitees(true);
      try {
        const res = await fetchWithAuth(
          `/api/auth/admin/users/search?query=${encodeURIComponent(query)}`,
        );
        if (!res.ok) {
          if (res.status === 404) {
            if (cancelled) return;
            setInviteSuggestions([]);
            setSelectedInvitee(null);
            setInviteSearchMessage(
              "Invite search API is unavailable. Restart backend to load the latest auth routes.",
            );
            return;
          }
          const message = await getApiErrorMessage(res);
          if (cancelled) return;
          setInviteSuggestions([]);
          setSelectedInvitee(null);
          setInviteSearchMessage(message);
          return;
        }

        const payload = await res.json();
        const matches: InviteeSuggestion[] = Array.isArray(payload?.data)
          ? payload.data
          : [];
        if (cancelled) return;
        setInviteSuggestions(matches);
        setInviteSearchMessage(
          matches.length === 0 ? "No eligible user found for this email" : null,
        );
        const exactMatch =
          matches.find((candidate) => candidate.email === query) || null;
        setSelectedInvitee((prev) => {
          if (exactMatch) return exactMatch;
          if (prev && matches.some((candidate) => candidate.id === prev.id))
            return prev;
          return null;
        });
      } catch {
        if (cancelled) return;
        setInviteSuggestions([]);
        setSelectedInvitee(null);
        setInviteSearchMessage("Failed to search users");
      } finally {
        if (!cancelled) setSearchingInvitees(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inviteEmail, isOwner]);

  const promoteUserToAdmin = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast("Member email is required", "error");
      return;
    }

    const selectedUser =
      selectedInvitee?.email === email
        ? selectedInvitee
        : inviteSuggestions.find((candidate) => candidate.email === email) ||
          null;
    if (!selectedUser) {
      showToast("Select an eligible member from the dropdown", "error");
      return;
    }

    setIssuingInvite(true);
    try {
      const res = await fetchWithAuth(
        `/api/auth/admin/users/${selectedUser.id}/promote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: inviteReason.trim() || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      setInviteEmail("");
      setInviteReason("");
      setInviteSuggestions([]);
      setSelectedInvitee(null);
      setInviteSearchMessage(null);
      await loadAccessUsers();
      showToast(`${selectedUser.email} promoted to admin`, "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to promote member";
      showToast(message, "error");
    } finally {
      setIssuingInvite(false);
    }
  };

  const demoteAdminUser = async (targetUser: AccessUser) => {
    if (!window.confirm(`Demote ${targetUser.email} to member?`)) return;

    setDemotingUserId(targetUser.id);
    try {
      const res = await fetchWithAuth(
        `/api/auth/admin/users/${targetUser.id}/demote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Offboarded from executive/admin team",
          }),
        },
      );
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      showToast(`${targetUser.email} demoted to member`, "success");
      await loadAccessUsers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to demote user";
      showToast(message, "error");
    } finally {
      setDemotingUserId(null);
    }
  };

  // Re-sort exec member cards client-side when role display order changes (no fetch needed)
  const resortExecGroupsByRoles = (newRoles: ExecRoleItem[]) => {
    const orderMap = new Map(newRoles.map((r) => [r.id, r.displayOrder]));
    setExecGroups((prev) =>
      prev.map((g) => ({
        ...g,
        members: [...g.members].sort(
          (a, b) =>
            (orderMap.get(a.role?.id ?? -1) ?? 9999) -
            (orderMap.get(b.role?.id ?? -1) ?? 9999),
        ),
      })),
    );
  };

  const saveExec = async (exec: Partial<ExecMember> & { id: number }) => {
    const isEdit = exec.id > 0;
    try {
      setExecError(null);
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
      const res = await fetchWithAuth(
        isEdit ? `/api/admin/executives/${exec.id}` : "/api/admin/executives",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      await refreshExecs();
      setEditingExec(null);
      setShowExecForm(false);
      showToast(
        isEdit ? "Exec member updated" : "Exec member added",
        "success",
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save executive";
      setExecError(msg);
      showToast(msg, "error");
    }
  };

  const deleteExec = async (id: number) => {
    try {
      setExecError(null);
      const res = await fetchWithAuth(`/api/admin/executives/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      await refreshExecs();
      showToast("Exec member deleted", "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete executive";
      setExecError(msg);
      showToast(msg, "error");
    }
  };

  const saveFaq = async (faq: Partial<FaqItem> & { id: number }) => {
    const isEdit = faq.id > 0;
    try {
      setFaqError(null);
      const payload = {
        question: faq.question,
        answer: faq.answer,
        isActive: faq.isActive ?? true,
      };
      const res = await fetchWithAuth(
        isEdit ? `/api/admin/faq/${faq.id}` : "/api/admin/faq",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      const refreshRes = await fetchWithAuth("/api/admin/faq");
      if (refreshRes.ok) {
        const p = await refreshRes.json();
        setFaqs(Array.isArray(p?.data) ? p.data : []);
      }
      setEditingFaq(null);
      setShowFaqForm(false);
      showToast(isEdit ? "FAQ entry updated" : "FAQ entry added", "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to save FAQ entry";
      setFaqError(msg);
      showToast(msg, "error");
    }
  };

  const deleteFaq = async (id: number) => {
    try {
      setFaqError(null);
      const res = await fetchWithAuth(`/api/admin/faq/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await getApiErrorMessage(res));
      setFaqs((prev) => prev.filter((f) => f.id !== id));
      showToast("FAQ entry deleted", "success");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete FAQ entry";
      setFaqError(msg);
      showToast(msg, "error");
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
      if (!sponsorshipPageId) {
        setSponsorError("Sponsorship page is not seeded yet.");
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
        const response = await fetchWithAuth(`/api/sponsors/${sponsor.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }
        const updated = (await response.json()).data;
        setSponsors((prev) =>
          prev.map((s) =>
            s.id === sponsor.id
              ? {
                  id: updated.id,
                  name: updated.name || "",
                  logoUrl: updated.logoUrl || "",
                  websiteUrl: updated.websiteUrl || "",
                  displayOrder:
                    typeof updated.displayOrder === "number"
                      ? updated.displayOrder
                      : 0,
                  sponsorshipPageId: updated.sponsorshipPageId,
                }
              : s,
          ),
        );
      } else {
        const response = await fetchWithAuth("/api/sponsors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response));
        }
        const created = (await response.json()).data;
        setSponsors((prev) => [
          ...prev,
          {
            id: created.id,
            name: created.name || "",
            logoUrl: created.logoUrl || "",
            websiteUrl: created.websiteUrl || "",
            displayOrder:
              typeof created.displayOrder === "number"
                ? created.displayOrder
                : 0,
            sponsorshipPageId: created.sponsorshipPageId,
          },
        ]);
      }

      setEditingSponsor(null);
      setShowSponsorForm(false);
      showToast(
        sponsor.id > 0 ? "Sponsor updated" : "Sponsor added",
        "success",
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to save sponsor";
      setSponsorError(msg);
      showToast(msg, "error");
    }
  };

  const deleteSponsor = async (id: number) => {
    try {
      setSponsorError(null);
      setSponsors((prev) => prev.filter((s) => s.id !== id));
      const response = await fetchWithAuth(`/api/sponsors/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response));
      const refetch = await fetch("/api/sponsorship", { cache: "no-store" });
      if (refetch.ok) {
        const payload = await refetch.json();
        const rows = Array.isArray(payload?.data?.sponsors)
          ? payload.data.sponsors
          : [];
        setSponsors(
          rows.map((s: any) => ({
            id: s.id,
            name: s.name || "",
            logoUrl: s.logoUrl || "",
            websiteUrl: s.websiteUrl || "",
            displayOrder:
              typeof s.displayOrder === "number" ? s.displayOrder : 0,
            sponsorshipPageId:
              typeof s.sponsorshipPageId === "number"
                ? s.sponsorshipPageId
                : null,
          })),
        );
      }
      showToast("Sponsor deleted", "success");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to delete sponsor";
      setSponsorError(msg);
      showToast(msg, "error");
    }
  };

  // ── Media CRUD ──
  const saveMedia = async (item: MediaItem) => {
    try {
      setMediaError(null);
      const payload = {
        activityId: item.activityId,
        mediaDriveUrl: item.mediaDriveUrl,
        overrideName: item.overrideName || null,
        overrideCover: item.overrideCover || null,
      };

      const response = await fetchWithAuth(
        item.id > 0 ? `/api/media-entries/${item.id}` : "/api/media-entries",
        {
          method: item.id > 0 ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response));
      }
      const updated = (await response.json()).data;
      const mapped: MediaItem = {
        id: updated.id,
        activityId: updated.activityId,
        mediaDriveUrl: updated.mediaDriveUrl || "",
        overrideName: updated.overrideName || "",
        overrideCover: updated.overrideCover || "",
        resolvedName: updated.resolvedName || "",
        resolvedCover: updated.resolvedCover || "",
      };
      if (item.id > 0) {
        setMedia((prev) => prev.map((m) => (m.id === item.id ? mapped : m)));
      } else {
        setMedia((prev) => [mapped, ...prev]);
      }
      setEditingMedia(null);
      setShowMediaForm(false);
      showToast(
        item.id > 0 ? "Photo Drive link updated" : "Photo Drive link added",
        "success",
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to update media link";
      setMediaError(msg);
      showToast(msg, "error");
    }
  };

  const deleteMedia = async (id: number) => {
    try {
      setMediaError(null);
      const response = await fetchWithAuth(`/api/media-entries/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await getApiErrorMessage(response));
      setMedia((prev) => prev.filter((m) => m.id !== id));
      const freshRes = await fetch("/api/media-entries", { cache: "no-store" });
      if (freshRes.ok) {
        const payload = await freshRes.json();
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        setMedia(
          rows.map((m: any) => ({
            id: m.id,
            activityId: m.activityId,
            mediaDriveUrl: m.mediaDriveUrl || "",
            overrideName: m.overrideName || "",
            overrideCover: m.overrideCover || "",
            resolvedName: m.resolvedName || "",
            resolvedCover: m.resolvedCover || "",
          })),
        );
      }
      showToast("Photo Drive link deleted", "success");
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to delete media entry";
      setMediaError(msg);
      showToast(msg, "error");
    }
  };

  // ── Activity CRUD ──
  const saveActivity = async (activity: Activity) => {
    try {
      setActivityError(null);

      const isPublished =
        activity.isPublished ?? activity.status !== "archived";

      const payload = {
        title: activity.title,
        description: activity.description,
        startTime: datetimeLocalToISO(activity.startTime),
        endTime: datetimeLocalToISO(activity.endTime),
        imageUrl: activity.imageUrl,
        externalLink: activity.externalLink || "",
        isPublished,
        capacity: activity.capacity ?? null,
      };

      if (activity.id > 0) {
        // Update existing
        const response = await fetchWithAuth(`/api/activities/${activity.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`Failed to update activity: ${response.statusText}`);
        }
        const data = await response.json();
        const updated = mapActivity(data);
        setActivities((prev) =>
          prev.map((a) => (a.id === activity.id ? updated : a)),
        );
      } else {
        // Create new
        const response = await fetchWithAuth(`/api/activities`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
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
      showToast(
        activity.id > 0 ? "Activity updated" : "Activity created",
        "success",
      );
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to save activity";
      setActivityError(errMsg);
      showToast(errMsg, "error");
    }
  };

  const deleteActivity = async (id: number) => {
    try {
      setActivityError(null);
      const response = await fetchWithAuth(`/api/activities/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok)
        throw new Error(`Failed to delete activity: ${response.statusText}`);
      setActivities((prev) => prev.filter((a) => a.id !== id));
      showToast("Activity deleted", "success");
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to delete activity";
      setActivityError(errMsg);
      showToast(errMsg, "error");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="bg-black min-h-screen">
      {/* Hero bar */}
      <section
        className="relative py-12 md:py-16 px-6 overflow-hidden"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-[150px]"
            style={{ backgroundColor: "rgba(235,117,36,0.06)" }}
          />
        </div>
        <div className="max-w-[1200px] mx-auto relative">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(235,117,36,0.15)" }}
              >
                <Shield className="w-5 h-5 text-[#eb7524]" />
              </div>
              <div>
                <h1
                  className="text-white"
                  style={{
                    fontSize: "clamp(24px, 4vw, 36px)",
                    fontWeight: 700,
                    fontFamily: "Outfit, sans-serif",
                    lineHeight: 1.2,
                  }}
                >
                  Admin Dashboard
                </h1>
                <p
                  className="text-white/40"
                  style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                >
                  Logged in as{" "}
                  <span className="text-[#eb7524]">{user?.email}</span>
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all cursor-pointer"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: "sponsors" as Tab, label: "Sponsors", icon: Star },
              { key: "activities" as Tab, label: "Activities", icon: Calendar },
              { key: "media" as Tab, label: "Photo Drive", icon: Camera },
              { key: "execs" as Tab, label: "Execs", icon: Users },
              { key: "members" as Tab, label: "Members", icon: CheckCircle2 },
              { key: "faq" as Tab, label: "FAQ", icon: HelpCircle },
              ...(isOwner
                ? [{ key: "access" as Tab, label: "Access", icon: Shield }]
                : []),
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all cursor-pointer ${
                    active
                      ? "bg-[#eb7524] text-white shadow-[0_4px_20px_rgba(235,117,36,0.3)]"
                      : "bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08]"
                  }`}
                  style={{
                    fontSize: "14px",
                    fontWeight: active ? 600 : 400,
                    fontFamily: "Outfit, sans-serif",
                  }}
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
          {tab === "sponsors" && (
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
          {tab === "media" && (
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
          {tab === "activities" && (
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
          {tab === "execs" && (
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
              onRolesReorder={resortExecGroupsByRoles}
            />
          )}
          {tab === "members" && (
            <MembersManager
              members={members}
              pagination={memberPagination}
              loading={membersLoading}
              error={membersError}
              search={memberSearch}
              setSearch={setMemberSearch}
              page={memberPage}
              pageSize={memberPageSize}
              setPage={setMemberPage}
              setPageSize={handleMemberPageSizeChange}
              statusFilter={memberStatusFilter}
              setStatusFilter={handleMemberStatusFilterChange}
              onRefreshMembers={refreshMembers}
            />
          )}
          {tab === "faq" && (
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
          {tab === "access" && isOwner && (
            <AccessManager
              users={accessUsers}
              loading={accessLoading}
              error={accessError}
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              inviteReason={inviteReason}
              setInviteReason={setInviteReason}
              issuingInvite={issuingInvite}
              searchingInvitees={searchingInvitees}
              inviteSuggestions={inviteSuggestions}
              selectedInviteeId={selectedInvitee?.id ?? null}
              selectedInviteeEmail={selectedInvitee?.email ?? null}
              inviteSearchMessage={inviteSearchMessage}
              onSelectInvitee={(candidate) => {
                setSelectedInvitee(candidate);
                setInviteEmail(candidate.email);
                setInviteSuggestions([]);
                setInviteSearchMessage(null);
              }}
              onPromoteUser={promoteUserToAdmin}
              onRefreshUsers={loadAccessUsers}
              onDemoteUser={demoteAdminUser}
              demotingUserId={demotingUserId}
              currentUserId={user?.id ?? null}
            />
          )}
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Members Manager
// ═══════════════════════════════════════════════

const MEMBER_FILTER_OPTIONS: { value: MemberStatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "NEED_REVIEW", label: "Need Review" },
  { value: "VERIFIED", label: "Verified" },
];

function getMembershipBadgeClasses(status: string): string {
  switch ((status || "").toUpperCase()) {
    case "VERIFIED":
      return "bg-green-500/15 text-green-200 border border-green-500/30";
    case "NEED_REVIEW":
      return "bg-[#eb7524]/15 text-[#ffcfad] border border-[#eb7524]/35";
    case "INACTIVE":
    default:
      return "bg-white/[0.06] text-white/60 border border-white/10";
  }
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function isImageMimeType(value: string | null | undefined): boolean {
  return String(value || "")
    .trim()
    .toLowerCase()
    .startsWith("image/");
}

function formatPaymentProofStatus(status: string | null | undefined): string {
  switch ((status || "").toUpperCase()) {
    case "PENDING":
      return "Pending";
    case "LINKED":
      return "Linked";
    default:
      return formatMembershipStatus(status);
  }
}

function PaymentProofReviewModal({
  member,
  onClose,
  onReviewed,
}: {
  member: AdminMember;
  onClose: () => void;
  onReviewed: () => Promise<void> | void;
}) {
  const { showToast } = useToast();
  const [proofs, setProofs] = useState<MemberPaymentProofMetadata[]>([]);
  const [proofsLoading, setProofsLoading] = useState(true);
  const [proofsError, setProofsError] = useState<string | null>(null);
  const [selectedProofId, setSelectedProofId] = useState<string | null>(null);
  const [proofObjectUrl, setProofObjectUrl] = useState<string | null>(null);
  const [proofFileLoading, setProofFileLoading] = useState(false);
  const [proofFileError, setProofFileError] = useState<string | null>(null);
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const [proofFileMimeType, setProofFileMimeType] = useState<string | null>(
    null,
  );
  const [submittingAction, setSubmittingAction] = useState<
    "approve" | "decline" | null
  >(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [declineReasonVisible, setDeclineReasonVisible] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineReasonError, setDeclineReasonError] = useState<string | null>(
    null,
  );

  const selectedProof =
    proofs.find((proof) => proof.id === selectedProofId) || proofs[0] || null;

  useEffect(() => {
    let cancelled = false;

    const loadProofs = async () => {
      try {
        setProofsLoading(true);
        setProofsError(null);
        setReviewError(null);
        setDeclineReasonError(null);
        const nextProofs = await getMemberPaymentProofs(member.id);
        if (cancelled) return;
        setProofs(nextProofs);
        setSelectedProofId(nextProofs[0]?.id || null);
      } catch (error) {
        if (cancelled) return;
        setProofs([]);
        setSelectedProofId(null);
        setProofsError(
          error instanceof Error
            ? error.message
            : "Failed to load payment proof metadata",
        );
      } finally {
        if (!cancelled) {
          setProofsLoading(false);
        }
      }
    };

    loadProofs();

    return () => {
      cancelled = true;
    };
  }, [member.id]);

  useEffect(() => {
    if (!selectedProofId) {
      setProofObjectUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return null;
      });
      setProofFileName(null);
      setProofFileMimeType(null);
      setProofFileError(null);
      setProofFileLoading(false);
      return;
    }

    let cancelled = false;

    const loadProofFile = async () => {
      try {
        setProofFileLoading(true);
        setProofFileError(null);
        const file = await getMemberPaymentProofFile(selectedProofId);
        if (cancelled) return;

        const nextObjectUrl = URL.createObjectURL(file.blob);
        setProofObjectUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return nextObjectUrl;
        });
        setProofFileName(
          file.filename || selectedProof?.originalFilename || null,
        );
        setProofFileMimeType(
          file.contentType || selectedProof?.mimeType || null,
        );
      } catch (error) {
        if (cancelled) return;
        setProofObjectUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return null;
        });
        setProofFileName(selectedProof?.originalFilename || null);
        setProofFileMimeType(selectedProof?.mimeType || null);
        setProofFileError(
          error instanceof Error
            ? error.message
            : "Failed to load payment proof file",
        );
      } finally {
        if (!cancelled) {
          setProofFileLoading(false);
        }
      }
    };

    loadProofFile();

    return () => {
      cancelled = true;
    };
  }, [
    selectedProofId,
    selectedProof?.mimeType,
    selectedProof?.originalFilename,
  ]);

  useEffect(() => {
    return () => {
      if (proofObjectUrl) {
        URL.revokeObjectURL(proofObjectUrl);
      }
    };
  }, [proofObjectUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingAction) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submittingAction, onClose]);

  const retryMetadataLoad = async () => {
    setProofsLoading(true);
    setProofsError(null);
    try {
      const nextProofs = await getMemberPaymentProofs(member.id);
      setProofs(nextProofs);
      setSelectedProofId(nextProofs[0]?.id || null);
    } catch (error) {
      setProofs([]);
      setSelectedProofId(null);
      setProofsError(
        error instanceof Error
          ? error.message
          : "Failed to load payment proof metadata",
      );
    } finally {
      setProofsLoading(false);
    }
  };

  const retryProofFileLoad = async () => {
    if (!selectedProofId) return;

    setProofFileLoading(true);
    setProofFileError(null);
    try {
      const file = await getMemberPaymentProofFile(selectedProofId);
      const nextObjectUrl = URL.createObjectURL(file.blob);
      setProofObjectUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return nextObjectUrl;
      });
      setProofFileName(
        file.filename || selectedProof?.originalFilename || null,
      );
      setProofFileMimeType(file.contentType || selectedProof?.mimeType || null);
    } catch (error) {
      setProofObjectUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return null;
      });
      setProofFileError(
        error instanceof Error
          ? error.message
          : "Failed to load payment proof file",
      );
    } finally {
      setProofFileLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setSubmittingAction("approve");
      setReviewError(null);
      setDeclineReasonError(null);
      await updateAdminMemberStatus(member.id, {
        status: "VERIFIED",
        reason: PAYMENT_PROOF_APPROVAL_REASON,
      });
      await onReviewed();
      showToast(
        `${member.name || member.email || "Member"} approved and marked as verified.`,
        "success",
      );
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to approve payment proof";
      setReviewError(message);
      showToast(message, "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleDecline = async () => {
    const cleanReason = declineReason.trim();
    if (!cleanReason) {
      setDeclineReasonError("Enter a decline reason before submitting.");
      return;
    }
    if (cleanReason.length > 200) {
      setDeclineReasonError("Decline reason must be 200 characters or fewer.");
      return;
    }

    try {
      setSubmittingAction("decline");
      setReviewError(null);
      setDeclineReasonError(null);
      await updateAdminMemberStatus(member.id, {
        status: "INACTIVE",
        reason: cleanReason,
      });
      await onReviewed();
      showToast(
        `${member.name || member.email || "Member"} payment proof declined and membership marked inactive.`,
        "success",
      );
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to decline payment proof";
      setReviewError(message);
      showToast(message, "error");
    } finally {
      setSubmittingAction(null);
    }
  };

  const previewLabel = `Payment proof preview for ${member.name || member.email || member.id}`;
  const canApprove =
    member.membershipStatus === "NEED_REVIEW" &&
    !proofsLoading &&
    !proofsError &&
    proofs.length > 0;
  const isSubmitting = submittingAction !== null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-5xl rounded-3xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-proof-review-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <h3
              id="payment-proof-review-title"
              className="text-white"
              style={{
                fontSize: "22px",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              Review payment proof
            </h3>
            <p
              className="mt-1 text-white/45"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              Inspect the uploaded proof securely before approving the member.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/65 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close payment proof review"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p
                    className="text-white/40"
                    style={{
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Member name
                  </p>
                  <p
                    className="mt-1 text-white"
                    style={{
                      fontSize: "15px",
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {member.name || "—"}
                  </p>
                </div>
                <div>
                  <p
                    className="text-white/40"
                    style={{
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Email
                  </p>
                  <p
                    className="mt-1 text-white/75 break-all"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {member.email || "—"}
                  </p>
                </div>
                <div>
                  <p
                    className="text-white/40"
                    style={{
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    User ID
                  </p>
                  <p
                    className="mt-1 text-white/75 break-all"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {member.id}
                  </p>
                </div>
                <div>
                  <p
                    className="text-white/40"
                    style={{
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Current status
                  </p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] ${getMembershipBadgeClasses(member.membershipStatus)}`}
                    >
                      {formatMembershipStatus(member.membershipStatus)}
                    </span>
                  </div>
                </div>
                <div>
                  <p
                    className="text-white/40"
                    style={{
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                    }}
                  >
                    Join date
                  </p>
                  <p
                    className="mt-1 text-white/75"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {formatMemberDate(member.joinedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h4
                    className="text-white"
                    style={{
                      fontSize: "17px",
                      fontWeight: 600,
                      fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    Uploaded proofs
                  </h4>
                  <p
                    className="mt-1 text-white/45"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Only authenticated admins can load these proof files.
                  </p>
                </div>
                {!proofsLoading && !proofsError && proofs.length > 0 && (
                  <span
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/55"
                    style={{
                      fontSize: "12px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {proofs.length} proof{proofs.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {proofsLoading ? (
                <div
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4"
                  role="status"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-[#eb7524]" />
                  <span
                    className="text-white/70"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Loading payment proof details...
                  </span>
                </div>
              ) : proofsError ? (
                <div
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                    <div>
                      <p
                        className="text-red-100"
                        style={{
                          fontSize: "14px",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        Failed to load payment proof metadata
                      </p>
                      <p
                        className="mt-1 text-red-100/80"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {proofsError}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={retryMetadataLoad}
                    className="mt-4 rounded-lg border border-red-200/30 bg-red-200/10 px-3 py-2 text-red-100 transition-all hover:bg-red-200/20"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Retry proof details
                  </button>
                </div>
              ) : proofs.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-5 text-center">
                  <ImageIcon className="mx-auto mb-3 h-9 w-9 text-white/15" />
                  <p
                    className="text-white"
                    style={{
                      fontSize: "15px",
                      fontFamily: "Outfit, sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    No payment proof uploaded
                  </p>
                  <p
                    className="mt-2 text-white/45"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    This member is in Need Review, but no proof metadata is
                    available to inspect.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {proofs.map((proof) => {
                    const active = proof.id === selectedProof?.id;
                    return (
                      <button
                        key={proof.id}
                        type="button"
                        onClick={() => setSelectedProofId(proof.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-[#eb7524]/50 bg-[#eb7524]/10 text-white"
                            : "border-white/10 bg-white/[0.02] text-white/75 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              style={{
                                fontSize: "14px",
                                fontFamily: "Inter, sans-serif",
                                fontWeight: 600,
                              }}
                            >
                              {proof.originalFilename}
                            </p>
                            <p
                              className="mt-1 text-white/45"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {proof.mimeType} •{" "}
                              {formatFileSize(proof.sizeBytes)}
                            </p>
                          </div>
                          <span
                            className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/55"
                            style={{
                              fontSize: "11px",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            {proof.status
                              ? formatPaymentProofStatus(proof.status)
                              : "Uploaded"}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div>
                            <p
                              className="text-white/35"
                              style={{
                                fontSize: "11px",
                                fontFamily: "Inter, sans-serif",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Uploaded
                            </p>
                            <p
                              className="mt-1 text-white/65"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {formatMemberDate(proof.createdAt || null)}
                            </p>
                          </div>
                          <div>
                            <p
                              className="text-white/35"
                              style={{
                                fontSize: "11px",
                                fontFamily: "Inter, sans-serif",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Linked
                            </p>
                            <p
                              className="mt-1 text-white/65"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {formatMemberDate(proof.linkedAt || null)}
                            </p>
                          </div>
                          <div>
                            <p
                              className="text-white/35"
                              style={{
                                fontSize: "11px",
                                fontFamily: "Inter, sans-serif",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                              }}
                            >
                              Expires
                            </p>
                            <p
                              className="mt-1 text-white/65"
                              style={{
                                fontSize: "12px",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              {formatMemberDate(proof.expiresAt || null)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h4
                    className="text-white"
                    style={{
                      fontSize: "17px",
                      fontWeight: 600,
                      fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    Proof preview
                  </h4>
                  <p
                    className="mt-1 text-white/45"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Files are fetched with authenticated admin requests and
                    turned into temporary object URLs in the browser.
                  </p>
                </div>
              </div>

              {!selectedProof ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-10 text-center">
                  <ImageIcon className="mx-auto mb-3 h-10 w-10 text-white/15" />
                  <p
                    className="text-white/55"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Select a proof to preview it.
                  </p>
                </div>
              ) : proofFileLoading ? (
                <div
                  className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-10 text-center"
                  role="status"
                >
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-[#eb7524]" />
                  <p
                    className="text-white/65"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Loading proof preview...
                  </p>
                </div>
              ) : proofFileError ? (
                <div
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-5"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                    <div>
                      <p
                        className="text-red-100"
                        style={{
                          fontSize: "14px",
                          fontFamily: "Inter, sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        Could not load payment proof preview.
                      </p>
                      <p
                        className="mt-1 text-red-100/80"
                        style={{
                          fontSize: "13px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {proofFileError}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={retryProofFileLoad}
                    className="mt-4 rounded-lg border border-red-200/30 bg-red-200/10 px-3 py-2 text-red-100 transition-all hover:bg-red-200/20"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    Retry file load
                  </button>
                </div>
              ) : proofObjectUrl &&
                isImageMimeType(proofFileMimeType || selectedProof.mimeType) ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                    <img
                      src={proofObjectUrl}
                      alt={previewLabel}
                      className="max-h-[520px] w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <a
                      href={proofObjectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white/80 transition-all hover:bg-white/[0.08] hover:text-white"
                      style={{
                        fontSize: "13px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open proof
                    </a>
                    <a
                      href={proofObjectUrl}
                      download={proofFileName || selectedProof.originalFilename}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white/80 transition-all hover:bg-white/[0.08] hover:text-white"
                      style={{
                        fontSize: "13px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Download proof
                    </a>
                  </div>
                </div>
              ) : proofObjectUrl ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6">
                  <p
                    className="text-white"
                    style={{
                      fontSize: "15px",
                      fontFamily: "Outfit, sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    Preview unavailable
                  </p>
                  <p
                    className="mt-2 text-white/45"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    This file type cannot be previewed inline, but you can still
                    open or download it securely.
                  </p>
                  <div className="mt-4 flex gap-3 flex-wrap">
                    <a
                      href={proofObjectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white/80 transition-all hover:bg-white/[0.08] hover:text-white"
                      style={{
                        fontSize: "13px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open proof
                    </a>
                    <a
                      href={proofObjectUrl}
                      download={proofFileName || selectedProof.originalFilename}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white/80 transition-all hover:bg-white/[0.08] hover:text-white"
                      style={{
                        fontSize: "13px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      <ImageIcon className="h-4 w-4" />
                      Download proof
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {declineReasonVisible && (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-5">
                <label
                  htmlFor="decline-reason"
                  className="block text-red-100"
                  style={{
                    fontSize: "14px",
                    fontFamily: "Outfit, sans-serif",
                    fontWeight: 600,
                  }}
                >
                  Decline reason
                </label>
                <p
                  className="mt-1 text-red-100/65"
                  style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
                >
                  This reason will be saved to the audit trail and sent to the
                  member by email.
                </p>
                <textarea
                  id="decline-reason"
                  value={declineReason}
                  onChange={(event) => {
                    setDeclineReason(event.target.value);
                    if (declineReasonError) {
                      setDeclineReasonError(null);
                    }
                  }}
                  maxLength={200}
                  rows={4}
                  disabled={isSubmitting}
                  className="mt-3 w-full resize-none rounded-xl border border-red-200/20 bg-black/25 px-3 py-2.5 text-white outline-none transition-all placeholder:text-white/25 focus:border-red-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    fontSize: "13px",
                    fontFamily: "Inter, sans-serif",
                  }}
                  placeholder="Explain why this proof could not be accepted."
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  {declineReasonError ? (
                    <p
                      className="text-red-100"
                      role="alert"
                      style={{
                        fontSize: "12px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      {declineReasonError}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span
                    className="text-white/35"
                    style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
                  >
                    {declineReason.length}/200
                  </span>
                </div>
              </div>
            )}

            {reviewError && (
              <div
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
                role="alert"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <p
                    className="text-red-100"
                    style={{
                      fontSize: "13px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {reviewError}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 flex-wrap">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-white/75 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  fontSize: "14px",
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: 500,
                }}
              >
                Close
              </button>
              {declineReasonVisible ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDeclineReasonVisible(false);
                      setDeclineReason("");
                      setDeclineReasonError(null);
                    }}
                    disabled={isSubmitting}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-white/70 transition-all hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Outfit, sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    Cancel decline
                  </button>
                  <button
                    type="button"
                    onClick={handleDecline}
                    disabled={isSubmitting || !canApprove}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/15 px-5 py-2.5 text-red-100 transition-all hover:border-red-300/55 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      fontSize: "14px",
                      fontFamily: "Outfit, sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {submittingAction === "decline" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Declining...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Confirm decline
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDeclineReasonVisible(true);
                    setReviewError(null);
                  }}
                  disabled={isSubmitting || !canApprove}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-5 py-2.5 text-red-100 transition-all hover:border-red-300/55 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    fontSize: "14px",
                    fontFamily: "Outfit, sans-serif",
                    fontWeight: 600,
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </button>
              )}
              <button
                type="button"
                onClick={handleApprove}
                disabled={isSubmitting || !canApprove}
                className="inline-flex items-center gap-2 rounded-xl bg-[#eb7524] px-5 py-2.5 text-white shadow-[0_4px_20px_rgba(235,117,36,0.28)] transition-all hover:bg-[#d4691f] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  fontSize: "14px",
                  fontFamily: "Outfit, sans-serif",
                  fontWeight: 600,
                }}
              >
                {submittingAction === "approve" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Approve membership
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersManager({
  members,
  pagination,
  loading,
  error,
  search,
  setSearch,
  page,
  pageSize,
  setPage,
  setPageSize,
  statusFilter,
  setStatusFilter,
  onRefreshMembers,
}: {
  members: AdminMember[];
  pagination: AdminMembersPagination;
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  pageSize: number;
  setPage: (value: number) => void;
  setPageSize: (value: number) => void;
  statusFilter: MemberStatusFilter;
  setStatusFilter: (value: MemberStatusFilter) => void;
  onRefreshMembers: () => Promise<void> | void;
}) {
  const [reviewMember, setReviewMember] = useState<AdminMember | null>(null);
  const hasSearch = search.trim().length > 0;
  const hasStatusFilter = statusFilter !== "ALL";
  const rangeStart = pagination.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd =
    pagination.total === 0 ? 0 : rangeStart + Math.max(members.length - 1, 0);
  const showEmptyState =
    !loading &&
    !error &&
    pagination.total === 0 &&
    !hasSearch &&
    !hasStatusFilter;
  const showNoResultsState =
    !loading &&
    !error &&
    pagination.total === 0 &&
    (hasSearch || hasStatusFilter);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
        <h2
          className="text-white mb-1"
          style={{
            fontSize: "22px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          Membership Roster
        </h2>
        <p
          className="text-white/40"
          style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
        >
          Review registered members, track membership status, and find students
          quickly.
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div>
            <h3
              className="text-white"
              style={{
                fontSize: "18px",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              Registered Members
            </h3>
            <p
              className="text-white/40 mt-1"
              style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
            >
              {loading
                ? "Updating member roster..."
                : `Showing ${rangeStart === 0 ? "0" : `${rangeStart}–${rangeEnd}`} of ${pagination.total}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshMembers}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] mb-5">
          <div>
            <label
              className="block text-white/60 mb-1.5"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Search
            </label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or student ID"
              className={inputCls}
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            />
          </div>

          <div>
            <label
              className="block text-white/60 mb-1.5"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {MEMBER_FILTER_OPTIONS.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    aria-pressed={active}
                    className={`px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? "bg-[#eb7524] border-[#eb7524] text-white shadow-[0_4px_18px_rgba(235,117,36,0.24)]"
                        : "bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]"
                    }`}
                    style={{
                      fontSize: "13px",
                      fontFamily: "Outfit, sans-serif",
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex-wrap"
            role="alert"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p
                className="text-red-200"
                style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
              >
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshMembers}
              className="text-red-100 underline hover:text-white cursor-pointer"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-[#eb7524] mx-auto mb-3" />
            <p
              className="text-white/50"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              Loading member roster...
            </p>
          </div>
        ) : showEmptyState ? (
          <div className="text-center py-14">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p
              className="text-white"
              style={{
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              No registered members yet
            </p>
            <p
              className="text-white/40 mt-2"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              Member accounts will appear here once registrations are created.
            </p>
          </div>
        ) : showNoResultsState ? (
          <div className="text-center py-14">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p
              className="text-white"
              style={{
                fontSize: "16px",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              No members match your current search and filter
            </p>
            <p
              className="text-white/40 mt-2"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              Try another search term or switch to a different membership
              status.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table
                className="w-full text-left"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                <thead
                  className="bg-white/5 text-white/50"
                  style={{ fontSize: "12px" }}
                >
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Student ID</th>
                    <th className="px-4 py-3 font-medium">Join Date</th>
                    <th className="px-4 py-3 font-medium">Membership Status</th>
                    <th className="px-4 py-3 font-medium">Status updated</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="text-white/80" style={{ fontSize: "13.5px" }}>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="border-t border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 align-top">
                        <div>
                          <p
                            className="text-white"
                            style={{ fontSize: "13.5px", fontWeight: 600 }}
                          >
                            {member.name || "—"}
                          </p>
                          <p
                            className="text-white/35 mt-1"
                            style={{ fontSize: "11.5px" }}
                          >
                            User ID: {member.id}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-white/70 break-all">
                        {member.email || "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-white/70">
                        {member.studentId || "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-white/60 whitespace-nowrap">
                        {formatMemberDate(member.joinedAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] ${getMembershipBadgeClasses(member.membershipStatus)}`}
                        >
                          {formatMembershipStatus(member.membershipStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-white/60 whitespace-nowrap">
                        {formatMemberDateTime(member.membershipStatusUpdatedAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-white/70">
                        {formatMemberRole(member.role)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        {member.membershipStatus === "NEED_REVIEW" ? (
                          <button
                            type="button"
                            onClick={() => setReviewMember(member)}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#eb7524]/35 bg-[#eb7524]/10 px-3 py-1.5 text-[#ffcfad] transition-all hover:border-[#eb7524]/55 hover:bg-[#eb7524]/18 hover:text-white"
                            style={{
                              fontSize: "12px",
                              fontFamily: "Outfit, sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Review payment
                          </button>
                        ) : (
                          <span
                            className="text-white/20"
                            style={{
                              fontSize: "12px",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-white/40"
                  style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
                >
                  Rows per page
                </span>
                {MEMBER_PAGE_SIZE_OPTIONS.map((option) => {
                  const active = option === pageSize;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPageSize(option)}
                      disabled={loading}
                      className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        active
                          ? "bg-[#eb7524] border-[#eb7524] text-white"
                          : "bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]"
                      }`}
                      style={{
                        fontSize: "12px",
                        fontFamily: "Outfit, sans-serif",
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPage(page - 1)}
                  disabled={loading || !pagination.hasPreviousPage}
                  className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                >
                  Previous
                </button>
                <span
                  className="text-white/50"
                  style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                >
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(page + 1)}
                  disabled={loading || !pagination.hasNextPage}
                  className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {reviewMember && (
          <PaymentProofReviewModal
            member={reviewMember}
            onClose={() => setReviewMember(null)}
            onReviewed={onRefreshMembers}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Access Manager
// ═══════════════════════════════════════════════

function AccessManager({
  users,
  loading,
  error,
  inviteEmail,
  setInviteEmail,
  inviteReason,
  setInviteReason,
  issuingInvite,
  searchingInvitees,
  inviteSuggestions,
  selectedInviteeId,
  selectedInviteeEmail,
  inviteSearchMessage,
  onSelectInvitee,
  onPromoteUser,
  onRefreshUsers,
  onDemoteUser,
  demotingUserId,
  currentUserId,
}: {
  users: AccessUser[];
  loading: boolean;
  error: string | null;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteReason: string;
  setInviteReason: (value: string) => void;
  issuingInvite: boolean;
  searchingInvitees: boolean;
  inviteSuggestions: InviteeSuggestion[];
  selectedInviteeId: string | null;
  selectedInviteeEmail: string | null;
  inviteSearchMessage: string | null;
  onSelectInvitee: (candidate: InviteeSuggestion) => void;
  onPromoteUser: () => Promise<void> | void;
  onRefreshUsers: () => Promise<void> | void;
  onDemoteUser: (user: AccessUser) => Promise<void> | void;
  demotingUserId: string | null;
  currentUserId: string | null;
}) {
  const normalizedInviteEmail = inviteEmail.trim().toLowerCase();
  const hasCommittedSelection = Boolean(
    selectedInviteeEmail &&
    selectedInviteeEmail.toLowerCase() === normalizedInviteEmail,
  );
  const showInviteDropdown =
    !hasCommittedSelection &&
    (searchingInvitees ||
      inviteSuggestions.length > 0 ||
      Boolean(inviteSearchMessage));

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
        <h2
          className="text-white mb-1"
          style={{
            fontSize: "22px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          Access Management
        </h2>
        <p
          className="text-white/40"
          style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
        >
          Promote members to admin and manage privileged users.
        </p>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
        <h3
          className="text-white mb-4"
          style={{
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          Promote Member to Admin
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label
              className="block text-white/60 mb-1.5"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Member email
            </label>
            <div className="relative">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="invitee@aucklanduni.ac.nz"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#eb7524]"
                style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
              />

              {showInviteDropdown && (
                <div className="absolute z-30 left-0 right-0 mt-2 rounded-xl border border-white/10 bg-[#0f0f0f] shadow-[0_12px_30px_rgba(0,0,0,0.35)] max-h-56 overflow-y-auto">
                  {searchingInvitees && (
                    <p
                      className="px-3 py-2.5 text-white/50"
                      style={{
                        fontSize: "12px",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Searching eligible users...
                    </p>
                  )}

                  {!searchingInvitees &&
                    inviteSuggestions.map((candidate) => {
                      const fullName =
                        `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim() ||
                        "No name set";
                      const selected = selectedInviteeId === candidate.id;
                      return (
                        <button
                          key={candidate.id}
                          onClick={() => onSelectInvitee(candidate)}
                          className={`w-full text-left px-3 py-2.5 border-b border-white/5 transition-all cursor-pointer ${
                            selected
                              ? "bg-[#eb7524]/15 text-white"
                              : "text-white/80 hover:bg-white/[0.05]"
                          }`}
                          style={{
                            fontSize: "12px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          <p style={{ fontSize: "12px", fontWeight: 600 }}>
                            {candidate.email}
                          </p>
                          <p
                            className="text-white/50"
                            style={{ fontSize: "11px" }}
                          >
                            {fullName}
                          </p>
                        </button>
                      );
                    })}

                  {!searchingInvitees &&
                    inviteSuggestions.length === 0 &&
                    inviteSearchMessage && (
                      <p
                        className="px-3 py-2.5 text-red-200"
                        style={{
                          fontSize: "12px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {inviteSearchMessage}
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              className="block text-white/60 mb-1.5"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Reason (optional)
            </label>
            <input
              value={inviteReason}
              onChange={(e) => setInviteReason(e.target.value)}
              placeholder="Why this promotion is needed"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#eb7524]"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={onPromoteUser}
            disabled={issuingInvite}
            className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {issuingInvite ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {issuingInvite ? "Promoting..." : "Promote to Admin"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h3
            className="text-white"
            style={{
              fontSize: "18px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Privileged Users
          </h3>
          <button
            onClick={onRefreshUsers}
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
            <p
              className="text-red-200"
              style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
            >
              {error}
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#eb7524]" />
          </div>
        ) : (
          <div className="space-y-3">
            {users
              .filter((u) => u.role !== "USER")
              .map((u) => {
                const fullName =
                  `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                  "No name set";
                const canDemote = u.role === "ADMIN" && u.id !== currentUserId;
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div>
                      <p
                        className="text-white"
                        style={{
                          fontSize: "14px",
                          fontWeight: 600,
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {fullName}
                      </p>
                      <p
                        className="text-white/50"
                        style={{
                          fontSize: "12px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {u.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="px-2.5 py-1 rounded-lg bg-[#eb7524]/20 text-[#ffb887] border border-[#eb7524]/30"
                        style={{
                          fontSize: "11px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        {u.role}
                      </span>
                      {canDemote ? (
                        <button
                          onClick={() => onDemoteUser(u)}
                          disabled={demotingUserId === u.id}
                          className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{
                            fontSize: "12px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {demotingUserId === u.id ? "Demoting..." : "Demote"}
                        </button>
                      ) : (
                        <span
                          className="text-white/30"
                          style={{
                            fontSize: "12px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {u.role === "OWNER"
                            ? "Owner protected"
                            : "Current user"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            {users.filter((u) => u.role !== "USER").length === 0 && (
              <p
                className="text-white/30 text-center py-6"
                style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
              >
                No privileged users found.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Sponsor Manager
// ═══════════════════════════════════════════════

function SponsorManager({
  sponsors,
  onSave,
  onDelete,
  editing,
  setEditing,
  showForm,
  setShowForm,
  sponsorLoading,
  sponsorError,
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
  const ordered = [...sponsors].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.id - b.id,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2
            className="text-white mb-1"
            style={{
              fontSize: "22px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Manage Sponsors
          </h2>
          <p
            className="text-white/40"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {sponsors.length} sponsor{sponsors.length !== 1 ? "s" : ""} in
            rendering order
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          <Plus className="w-4 h-4" />
          Add Sponsor
        </button>
      </div>

      {sponsorError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p
            className="text-red-200"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {sponsorError}
          </p>
        </div>
      )}

      {sponsorLoading && (
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
          <p
            className="text-white/60"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
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
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
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
              onEdit={() => {
                setEditing(sponsor);
                setShowForm(false);
              }}
              onDelete={() => onDelete(sponsor.id)}
            />
          ))}
        </div>
      )}

      {!sponsorLoading && sponsors.length === 0 && (
        <div className="text-center py-16">
          <Star className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p
            className="text-white/30"
            style={{ fontSize: "16px", fontFamily: "Inter, sans-serif" }}
          >
            No sponsors added yet
          </p>
        </div>
      )}
    </div>
  );
}

function SponsorCard({
  sponsor,
  onEdit,
  onDelete,
}: {
  sponsor: Sponsor;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const safeLogoUrl = getSafeImageSrc(sponsor.logoUrl);

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-6 group hover:border-white/10 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(235,117,36,0.15)" }}
        >
          {safeLogoUrl ? (
            <img
              src={safeLogoUrl}
              alt={sponsor.name}
              className="w-7 h-7 object-contain"
            />
          ) : (
            <span
              style={{
                fontSize: "18px",
                fontWeight: 700,
                fontFamily: "Outfit, sans-serif",
                color: "#eb7524",
              }}
            >
              {sponsor.name.charAt(0)}
            </span>
          )}
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full border text-xs"
          style={{
            borderColor: "#eb752466",
            color: "#eb7524",
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
          }}
        >
          Order {sponsor.displayOrder}
        </span>
      </div>
      <h4
        className="text-white mb-1"
        style={{
          fontSize: "17px",
          fontWeight: 600,
          fontFamily: "Outfit, sans-serif",
        }}
      >
        {sponsor.name}
      </h4>
      <p
        className="text-white/35 mb-4 truncate"
        style={{
          fontSize: "13px",
          lineHeight: 1.6,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {sponsor.websiteUrl || "No website URL"}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 hover:text-[#eb7524] hover:border-[#eb7524]/30 transition-all cursor-pointer"
          style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
        >
          <Edit3 className="w-3 h-3" />
          Edit
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function SponsorForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Sponsor | null;
  onSave: (s: Sponsor) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl || "");
  const [displayOrder, setDisplayOrder] = useState(
    String(initial?.displayOrder ?? 0),
  );

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
        <h3
          className="text-white"
          style={{
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {initial ? "Edit Sponsor" : "Add New Sponsor"}
        </h3>
        <button
          onClick={onCancel}
          className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-5"
        noValidate
      >
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Sponsor Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. IronGrip Supplements"
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Display Order
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Logo URL
          </label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Website URL
          </label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
        </div>

        <div className="md:col-span-2 flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            <Save className="w-4 h-4" />
            {initial ? "Update" : "Add"} Sponsor
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Photo Drive Link Panel — edit & save the singleton MediaConfig.mediaDriveUrl
// ═══════════════════════════════════════════════

function PhotoDriveLinkPanel() {
  const [configId, setConfigId] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await fetch("/api/config");
        if (!res.ok)
          throw new Error(`Failed to load config: ${res.statusText}`);
        const data = await res.json();
        if (cancelled) return;
        const mc = data?.mediaConfig;
        if (mc && typeof mc.id === "number") {
          setConfigId(mc.id);
          setUrl(mc.mediaDriveUrl ?? "");
          setSavedUrl(mc.mediaDriveUrl ?? "");
        } else {
          setConfigId(null);
          setUrl("");
          setSavedUrl("");
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to load Photo Drive link",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = url !== savedUrl;
  const safeSavedUrl = getSafeLinkHref(savedUrl);

  // Step 1: validate, then open the confirmation dialog.
  const handleSaveClick = () => {
    setValidationError(null);
    setSaveError(null);
    setSavedFlash(false);

    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError("Photo Drive link cannot be empty");
      return;
    }
    if (!isHttpUrl(trimmed)) {
      setValidationError("Please enter a valid http or https URL");
      return;
    }
    setConfirmOpen(true);
  };

  // Step 2: actually persist the change after the admin confirms.
  const handleConfirmSave = async () => {
    const trimmed = url.trim();

    try {
      setSaving(true);
      const res = await fetchWithAuth("/api/config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "mediaConfig",
          ...(configId != null ? { id: configId } : {}),
          data: { mediaDriveUrl: trimmed },
        }),
      });

      if (!res.ok) {
        let message = `Save failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
          else if (body?.error) message = body.error;
        } catch {
          /* ignore body parse errors */
        }
        throw new Error(message);
      }

      const body = await res.json();
      const returned = body?.updated;
      const newUrl =
        returned && typeof returned.mediaDriveUrl === "string"
          ? returned.mediaDriveUrl
          : trimmed;
      if (returned && typeof returned.id === "number") {
        setConfigId(returned.id);
      }
      setUrl(newUrl);
      setSavedUrl(newUrl);
      setConfirmOpen(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save Photo Drive link",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-8 bg-[#111] border border-white/[0.06] rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "rgba(235,117,36,0.12)" }}
        >
          <LinkIcon className="w-5 h-5 text-[#eb7524]" />
        </div>
        <div className="flex-1">
          <h3
            className="text-white"
            style={{
              fontSize: "17px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Photo Drive Link
          </h3>
          <p
            className="text-white/45"
            style={{
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.5,
            }}
          >
            The external URL the visitor-facing &ldquo;Open Drive&rdquo; button
            links to.
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center gap-2 text-white/50"
          style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading current link...
        </div>
      ) : (
        <>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setValidationError(null);
                setSaveError(null);
              }}
              placeholder="https://danbainvisuals.pixieset.com/auss/landing/"
              className={inputCls + " flex-1"}
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
              disabled={saving}
            />
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving || !dirty}
              className="flex items-center justify-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#eb7524]"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                fontFamily: "Outfit, sans-serif",
              }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save Link"}
            </button>
          </div>

          {safeSavedUrl && (
            <div
              className="mt-3 flex items-center gap-2 text-white/40"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <a
                href={safeSavedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#eb7524] transition-colors break-all"
              >
                {savedUrl}
              </a>
            </div>
          )}

          {validationError && (
            <div
              className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p
                className="text-red-300"
                style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
              >
                {validationError}
              </p>
            </div>
          )}
          {saveError && (
            <div
              className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p
                className="text-red-300"
                style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
              >
                {saveError}
              </p>
            </div>
          )}
          {loadError && !saveError && (
            <div
              className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p
                className="text-red-300"
                style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
              >
                {loadError}
              </p>
            </div>
          )}
          {savedFlash && (
            <div
              className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/25"
              role="status"
            >
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p
                className="text-green-300"
                style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
              >
                Photo Drive link saved successfully.
              </p>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Update Photo Drive link?"
        message={
          <>
            The visitor-facing &ldquo;Open Drive&rdquo; button will point to:
            <br />
            <span className="text-white/85 break-all">{url.trim()}</span>
          </>
        }
        confirmLabel="Save Link"
        busy={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════
// Media Manager
// ═══════════════════════════════════════════════

function MediaManager({
  media,
  onSave,
  onDelete,
  editing,
  setEditing,
  showForm,
  setShowForm,
  activities,
  mediaLoading,
  mediaError,
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
      {/* Photo Drive external link editor */}
      <PhotoDriveLinkPanel />

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2
            className="text-white mb-1"
            style={{
              fontSize: "22px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Manage Activity Media Drives
          </h2>
          <p
            className="text-white/40"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            Add one drive folder per activity. Drive URL is required.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          <Plus className="w-4 h-4" />
          Add Media Entry
        </button>
      </div>

      {activities.length === 0 && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p
            className="text-yellow-200"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            Add at least one activity first before creating media entries.
          </p>
        </div>
      )}

      {mediaError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p
            className="text-red-200"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {mediaError}
          </p>
        </div>
      )}

      {mediaLoading && (
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
          <p
            className="text-white/60"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
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
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
            />
          </div>
        </div>
      )}

      {!mediaLoading && media.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {media.map((item) => {
            const safeCover = getSafeImageSrc(item.resolvedCover);
            const safeMediaHref = getSafeLinkHref(item.mediaDriveUrl);
            return (
              <div
                key={item.id}
                className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden"
              >
                <div className="h-[170px] bg-black/40">
                  {safeCover ? (
                    <img
                      src={safeCover}
                      alt={item.resolvedName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-white/10" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h4
                    className="text-white mb-2 truncate"
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      fontFamily: "Outfit, sans-serif",
                    }}
                  >
                    {item.resolvedName}
                  </h4>
                  {safeMediaHref && (
                    <a
                      href={safeMediaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#eb7524] text-sm break-all hover:text-[#ff9f5e]"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      {item.mediaDriveUrl}
                    </a>
                  )}
                  <MediaCardActions
                    item={item}
                    onEdit={() => {
                      setEditing(item);
                      setShowForm(false);
                    }}
                    onDelete={() => onDelete(item.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <ImageIcon className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p
            className="text-white/30"
            style={{ fontSize: "16px", fontFamily: "Inter, sans-serif" }}
          >
            No media entries added yet
          </p>
        </div>
      )}
    </div>
  );
}

function MediaForm({
  initial,
  onSave,
  activities,
  onCancel,
}: {
  initial: MediaItem | null;
  onSave: (m: MediaItem) => Promise<void> | void;
  activities: Activity[];
  onCancel: () => void;
}) {
  const [activityId, setActivityId] = useState(
    String(initial?.activityId || activities[0]?.id || ""),
  );
  const [mediaDriveUrl, setMediaDriveUrl] = useState(
    initial?.mediaDriveUrl || "",
  );
  const [overrideName, setOverrideName] = useState(initial?.overrideName || "");
  const [overrideCover, setOverrideCover] = useState(
    initial?.overrideCover || "",
  );
  const [isResolvingCover, setIsResolvingCover] = useState(false);
  const [coverResolveError, setCoverResolveError] = useState<string | null>(
    null,
  );

  const selectedActivity = activities.find((a) => String(a.id) === activityId);

  const resolvePixiesetUrl = async (url: string) => {
    if (!url.includes("pixieset.com") || !url.includes("pid=")) return;
    setIsResolvingCover(true);
    setCoverResolveError(null);
    try {
      const res = await fetchWithAuth("/api/resolve-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoverResolveError(
          data?.error?.message || "Could not resolve image URL",
        );
      } else {
        setOverrideCover(data.directUrl);
      }
    } catch {
      setCoverResolveError("Network error while resolving URL");
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
      resolvedName: initial?.resolvedName || "",
      resolvedCover: initial?.resolvedCover || "",
    });
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3
          className="text-white"
          style={{
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {initial ? "Edit Media Entry" : "Add Media Entry"}
        </h3>
        <button
          onClick={onCancel}
          className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Linked Activity
          </label>
          <CustomSelect
            value={activityId}
            onChange={(v) => setActivityId(v)}
            options={activities.map((a) => ({ value: a.id, label: a.title }))}
            required
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Media Drive URL
          </label>
          <input
            value={mediaDriveUrl}
            onChange={(e) => setMediaDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            required
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Override Name (optional)
          </label>
          <input
            value={overrideName}
            onChange={(e) => setOverrideName(e.target.value)}
            placeholder={
              selectedActivity?.title || "Uses linked activity title by default"
            }
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
        </div>
        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Override Cover URL (optional)
          </label>
          <div className="relative">
            <input
              value={overrideCover}
              onChange={(e) => {
                setOverrideCover(e.target.value);
                setCoverResolveError(null);
              }}
              onBlur={(e) => resolvePixiesetUrl(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                setTimeout(() => resolvePixiesetUrl(pasted), 0);
              }}
              placeholder={
                selectedActivity?.imageUrl ||
                "Paste a Pixieset photo link or direct image URL"
              }
              className={inputCls}
              style={{
                fontSize: "14px",
                fontFamily: "Inter, sans-serif",
                paddingRight: isResolvingCover ? "2.5rem" : undefined,
              }}
            />
            {isResolvingCover && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#eb7524] animate-spin" />
            )}
          </div>
          {coverResolveError && (
            <p className="mt-1 text-red-400" style={{ fontSize: "12px" }}>
              {coverResolveError}
            </p>
          )}
          {!coverResolveError &&
            overrideCover &&
            !isResolvingCover &&
            overrideCover.startsWith("https://images.pixieset.com") && (
              <p
                className="mt-1 text-green-400/70"
                style={{ fontSize: "12px" }}
              >
                ✓ Pixieset URL resolved
              </p>
            )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            <Save className="w-4 h-4" />
            {initial ? "Update" : "Save"} Link
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
  activities,
  onSave,
  onDelete,
  editing,
  setEditing,
  showForm,
  setShowForm,
  activityLoading,
  activityError,
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
    upcoming: activities.filter((a) => a.status === "upcoming"),
    ongoing: activities.filter((a) => a.status === "ongoing"),
    archived: activities.filter((a) => a.status === "archived"),
  };

  const [viewingAttendees, setViewingAttendees] = useState<Activity | null>(
    null,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2
            className="text-white mb-1"
            style={{
              fontSize: "22px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Manage Activities
          </h2>
          <p
            className="text-white/40"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {activities.length} activit{activities.length !== 1 ? "ies" : "y"} (
            {grouped.upcoming.length} upcoming, {grouped.ongoing.length}{" "}
            ongoing, {grouped.archived.length} archived)
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          disabled={activityLoading}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Error alert */}
      {activityError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p
            className="text-red-200"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {activityError}
          </p>
        </div>
      )}

      {/* Loading state */}
      {activityLoading && (
        <div className="mb-6 p-6 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
          <p
            className="text-white/60"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
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
              onCancel={() => {
                setEditing(null);
                setShowForm(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Activities by status */}
      {(["ongoing", "upcoming", "archived"] as const).map((status) => {
        const items = grouped[status];
        const color = statusColors[status];
        const labels = {
          upcoming: "Upcoming",
          ongoing: "Ongoing",
          archived: "Archived",
        };

        return (
          <div key={status} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <h3
                className="text-white"
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  fontFamily: "Outfit, sans-serif",
                }}
              >
                {labels[status]} Activities
              </h3>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: color + "18",
                  color,
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {items.length}
              </span>
            </div>
            {items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onEdit={() => {
                      setEditing(activity);
                      setShowForm(false);
                    }}
                    onDelete={() => onDelete(activity.id)}
                    onViewAttendees={() => setViewingAttendees(activity)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 rounded-xl border border-white/[0.06]">
                <p
                  className="text-white/30"
                  style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
                >
                  No {labels[status].toLowerCase()} activities
                </p>
              </div>
            )}
          </div>
        );
      })}

      {activities.length === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p
            className="text-white/30"
            style={{ fontSize: "16px", fontFamily: "Inter, sans-serif" }}
          >
            No activities added yet
          </p>
        </div>
      )}

      {viewingAttendees && (
        <AttendeesModal
          activityId={viewingAttendees.id}
          activityTitle={viewingAttendees.title}
          onClose={() => setViewingAttendees(null)}
        />
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  onEdit,
  onDelete,
  onViewAttendees,
}: {
  activity: Activity;
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
  onViewAttendees: () => void;
}) {
  const color = statusColors[activity.status];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const safeImageSrc = getSafeImageSrc(activity.imageUrl);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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
        {imgError || !safeImageSrc ? (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
            <Calendar className="w-8 h-8 text-white/10" />
          </div>
        ) : (
          <img
            src={safeImageSrc}
            alt={activity.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h4
          className="text-white mb-3 truncate"
          style={{
            fontSize: "16px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {activity.title}
        </h4>

        {/* Date/Time */}
        <div className="bg-white/[0.03] rounded-lg p-2 mb-3 border border-white/[0.05]">
          <div
            className="flex items-center gap-1.5 text-white/50"
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
          >
            <Clock className="w-3 h-3" />
            <span>
              {formatDate(activity.startTime)} ·{" "}
              {formatTime(activity.startTime)}
            </span>
          </div>
        </div>

        {/* View Attendees */}
        <button
          onClick={onViewAttendees}
          disabled={isDeleting}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eb7524]/10 border border-[#eb7524]/25 text-[#eb7524] hover:bg-[#eb7524]/20 transition-all cursor-pointer mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <Users className="w-3 h-3" />
          View Attendees
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 hover:text-[#eb7524] hover:border-[#eb7524]/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
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
                style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Deleting
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
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

function ActivityForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Activity | null;
  onSave: (a: Activity) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [startTime, setStartTime] = useState(
    formatToDatetimeLocal(initial?.startTime),
  );
  const [endTime, setEndTime] = useState(
    formatToDatetimeLocal(initial?.endTime),
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [externalLink, setExternalLink] = useState(initial?.externalLink || "");
  const [isPublished, setIsPublished] = useState(
    initial?.isPublished !== false,
  );
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  const [preview, setPreview] = useState(initial?.imageUrl || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inline validation + confirmation state
  type Errors = Partial<
    Record<
      | "title"
      | "description"
      | "startTime"
      | "endTime"
      | "imageUrl"
      | "externalLink"
      | "capacity",
      string
    >
  >;
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const safePreview = getSafeImageSrc(preview);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = "Title is required";
    if (!description.trim()) e.description = "Description is required";
    else if (wordCount(description) < 5)
      e.description = "Description must be at least 5 words";
    if (!startTime) e.startTime = "Start date/time is required";
    if (!endTime) e.endTime = "End date/time is required";
    if (startTime && endTime) {
      const start = new Date(datetimeLocalToISO(startTime));
      const end = new Date(datetimeLocalToISO(endTime));
      if (Number.isNaN(start.getTime()))
        e.startTime = "Start date/time is invalid";
      if (Number.isNaN(end.getTime())) e.endTime = "End date/time is invalid";
      if (!e.startTime && !e.endTime && end <= start) {
        e.endTime = "End must be after start";
      }
    }
    if (imageUrl.trim() && !isSafeImageSrc(imageUrl.trim())) {
      e.imageUrl =
        "Image URL must be a valid http, https, or uploaded image path";
    }
    if (externalLink.trim() && !isHttpUrl(externalLink.trim())) {
      e.externalLink = "External link must be a valid http or https URL";
    }
    const capacityError = getCapacityError(capacity);
    if (capacityError) e.capacity = capacityError;
    return e;
  };

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
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    const e2 = validate();
    setErrors(e2);
    if (Object.keys(e2).length > 0) return;
    setConfirmOpen(true);
  };

  const handleConfirmedSave = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Derive status from times and isPublished
      const now = new Date();
      const start = new Date(datetimeLocalToISO(startTime));
      const end = new Date(datetimeLocalToISO(endTime));
      let status: Activity["status"] = "upcoming";
      if (!isPublished || now > end) {
        status = "archived";
      } else if (now >= start && now < end) {
        status = "ongoing";
      }

      await onSave({
        id: initial?.id || 0, // 0 means new record
        title: title.trim(),
        description: description.trim(),
        startTime,
        endTime,
        imageUrl: imageUrl.trim(),
        externalLink: externalLink.trim(),
        isPublished,
        capacity: parseCapacity(capacity),
        status,
      });
      setErrors({});
      setSubmitSuccess(
        initial
          ? "Activity updated successfully."
          : "Activity created successfully.",
      );
      setConfirmOpen(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to save activity. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3
          className="text-white"
          style={{
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {initial ? "Edit Activity" : "Add New Activity"}
        </h3>
        <button
          onClick={onCancel}
          className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>
              Activity Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Training Session"
              className={inputCls}
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            />
            {errors.title && (
              <p className={fieldErrorCls} style={fieldErrorStyle}>
                {errors.title}
              </p>
            )}
          </div>
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>
              Published
            </label>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`w-full py-2.5 rounded-xl border transition-all cursor-pointer ${
                isPublished
                  ? "bg-[#10b981]/20 border-[#10b981]/40 text-[#10b981]"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {isPublished ? "✓ Published" : "○ Unpublished"}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Description *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the activity (at least 5 words)..."
            rows={3}
            className={inputCls + " resize-none"}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
          {errors.description && (
            <p className={fieldErrorCls} style={fieldErrorStyle}>
              {errors.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>
              Start Date/Time *
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputCls}
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            />
            {errors.startTime && (
              <p className={fieldErrorCls} style={fieldErrorStyle}>
                {errors.startTime}
              </p>
            )}
          </div>
          <div>
            <label className="block text-white/60 mb-1.5" style={labelStyle}>
              End Date/Time *
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputCls}
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            />
            {errors.endTime && (
              <p className={fieldErrorCls} style={fieldErrorStyle}>
                {errors.endTime}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            RSVP Capacity
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="e.g. 30"
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            aria-describedby="activity-capacity-help"
          />
          <p
            id="activity-capacity-help"
            className="mt-1.5 text-white/35"
            style={fieldErrorStyle}
          >
            Leave blank for unlimited capacity.
          </p>
          {errors.capacity && (
            <p className={fieldErrorCls} style={fieldErrorStyle}>
              {errors.capacity}
            </p>
          )}
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            Activity Image
          </label>
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
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  {imageUrl ? "Change Image" : "Upload Image"}
                </>
              )}
            </button>
          </div>
          {uploadError && (
            <p
              className="text-red-400 text-xs mb-2"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {uploadError}
            </p>
          )}
          {imageUrl && (
            <p
              className="text-white/40 text-xs truncate"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              {imageUrl}
            </p>
          )}
        </div>

        <div>
          <label className="block text-white/60 mb-1.5" style={labelStyle}>
            External Link
          </label>
          <input
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            placeholder="https://example.com"
            className={inputCls}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
          {errors.externalLink && (
            <p className={fieldErrorCls} style={fieldErrorStyle}>
              {errors.externalLink}
            </p>
          )}
        </div>

        {/* Preview */}
        {safePreview && (
          <div className="rounded-xl overflow-hidden h-[160px] border border-white/[0.06]">
            <img
              src={safePreview}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {submitError && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p
              className="text-red-300"
              style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
            >
              {submitError}
            </p>
          </div>
        )}
        {submitSuccess && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/25"
            role="status"
          >
            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <p
              className="text-green-300"
              style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
            >
              {submitSuccess}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {initial ? "Update" : "Add"} Activity
              </>
            )}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title={initial ? "Update this activity?" : "Publish this activity?"}
        message={
          <>
            You&rsquo;re about to {initial ? "update" : "publish"}{" "}
            <span className="text-white/85">&ldquo;{title.trim()}&rdquo;</span>.
            {!isPublished && (
              <>
                {" "}
                It will be saved as{" "}
                <span className="text-white/85">unpublished</span>.
              </>
            )}
            <br />
            Continue?
          </>
        }
        confirmLabel={initial ? "Save Changes" : "Publish"}
        busy={isSubmitting}
        onConfirm={handleConfirmedSave}
        onCancel={() => {
          if (!isSubmitting) setConfirmOpen(false);
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════
// Exec Manager
// ═══════════════════════════════════════════════

function ExecManager({
  execGroups,
  execRoles,
  execTeams,
  onSave,
  onDelete,
  editing,
  setEditing,
  showForm,
  setShowForm,
  execLoading,
  execError,
  refreshExecs,
  onRolesReorder,
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
  onRolesReorder: (roles: ExecRoleItem[]) => void;
}) {
  const allMembers = execGroups.flatMap((g) => g.members);

  // FLIP animation for member card reordering
  const memberPositions = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    document
      .querySelectorAll<HTMLElement>("[data-flip-member]")
      .forEach((el) => {
        const prevTop = memberPositions.current.get(el.dataset.flipMember!);
        if (prevTop === undefined) return;
        const delta = prevTop - el.getBoundingClientRect().top;
        if (Math.abs(delta) < 1) return;
        el.style.transform = `translateY(${delta}px)`;
        el.style.transition = "none";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            el.style.transition =
              "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)";
            el.style.transform = "";
          }),
        );
      });
  }, [execGroups]);
  useEffect(() => {
    memberPositions.current.clear();
    document
      .querySelectorAll<HTMLElement>("[data-flip-member]")
      .forEach((el) => {
        memberPositions.current.set(
          el.dataset.flipMember!,
          el.getBoundingClientRect().top,
        );
      });
  }, [execGroups]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2
            className="text-white"
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            Exec Members
          </h2>
          <p
            className="text-white/40 mt-1"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {allMembers.length} member{allMembers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {execError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span
            className="text-red-400"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {execError}
          </span>
        </div>
      )}

      {execLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin" />
        </div>
      ) : allMembers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p
            className="text-white/30"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            No exec members yet
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {execGroups.map((group) => (
            <div key={group.team.id}>
              <h3
                className="text-white/60 mb-3"
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "Inter, sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {group.team.name}
              </h3>
              <div className="grid gap-3">
                {group.members.map((member) => (
                  <div key={member.id} data-flip-member={String(member.id)}>
                    <ExecMemberCard
                      member={member}
                      onEdit={() => {
                        setEditing(member);
                        setShowForm(true);
                      }}
                      onDelete={() => onDelete(member.id)}
                    />
                  </div>
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
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}

      <ExecRoleTeamManager
        execRoles={execRoles}
        execTeams={execTeams}
        onRefresh={refreshExecs}
        onRolesReorder={onRolesReorder}
      />
    </div>
  );
}

function MediaCardActions({
  item,
  onEdit,
  onDelete,
}: {
  item: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        onClick={onEdit}
        disabled={isDeleting}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 hover:text-[#eb7524] hover:border-[#eb7524]/30 transition-all cursor-pointer disabled:opacity-40"
        style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
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
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
          >
            {isDeleting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            {isDeleting ? "Deleting" : "Confirm"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            disabled={isDeleting}
            className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50"
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer"
          style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      )}
    </div>
  );
}

function ExecMemberCard({
  member,
  onEdit,
  onDelete,
}: {
  member: ExecMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isUnassigned = !member.role || !member.team;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 hover:bg-white/[0.05] transition-all">
      <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 overflow-hidden flex-shrink-0">
        {member.imageUrl ? (
          <img
            src={member.imageUrl}
            alt={member.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users className="w-4 h-4 text-white/20" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className="text-white font-medium truncate"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {member.name}
          </p>
          {!member.isActive && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/30 border border-white/10">
              Inactive
            </span>
          )}
          {isUnassigned && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              Unassigned
            </span>
          )}
        </div>
        <p
          className="text-white/40 truncate"
          style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
        >
          {member.role?.name ?? "No role"} · {member.team?.name ?? "No team"}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onEdit}
          disabled={isDeleting}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer disabled:opacity-40"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {isDeleting ? "Deleting" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50"
              style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
            >
              Cancel
            </button>
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

// ── Circle image cropper (URL input / file browse + pan/zoom crop preview) ──
function CircleImageCropper({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const C = 260; // container px
  const R = 110; // circle crop radius px
  const OUT = 256; // output canvas px

  type Stage = "pick" | "crop" | "done";
  const [stage, setStage] = useState<Stage>(value ? "done" : "pick");
  const [inputUrl, setInputUrl] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [loadErr, setLoadErr] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  // Non-passive wheel listener (React onWheel is passive in React 17+)
  useEffect(() => {
    const el = cropContainerRef.current;
    if (!el || stage !== "crop") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) =>
        Math.max(0.1, Math.min(15, s * (e.deltaY > 0 ? 0.92 : 1.08))),
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [stage]);

  const loadSrc = (src: string) => {
    setCropSrc(src);
    setOffset({ x: 0, y: 0 });
    setScale(1);
    setImgNatural({ w: 0, h: 0 });
    setLoadErr(false);
    setStage("crop");
  };

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    const minDim = Math.min(img.naturalWidth, img.naturalHeight);
    setScale(Math.max(0.2, (R * 2.2) / minDim));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const { mx, my, ox, oy } = dragStartRef.current;
    setOffset({ x: ox + e.clientX - mx, y: oy + e.clientY - my });
  };

  const stopDrag = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const confirmCrop = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || imgNatural.w === 0 || loadErr) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = OUT;
    canvas.height = OUT;
    // Map circle crop region to image pixel coords
    const sx = (-R - offset.x) / scale + imgNatural.w / 2;
    const sy = (-R - offset.y) / scale + imgNatural.h / 2;
    const sw = (R * 2) / scale;
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    try {
      ctx.drawImage(img, sx, sy, sw, sw, 0, 0, OUT, OUT);
      onChange(canvas.toDataURL("image/jpeg", 0.92));
    } catch {
      onChange(cropSrc!); // CORS-tainted: fall back to raw URL
    }
    setStage("done");
  };

  if (stage === "done")
    return (
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-white/[0.05] border-2 border-[#eb7524]/30">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setInputUrl("");
            setStage("pick");
          }}
          className="px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
          style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
        >
          Change Image
        </button>
      </div>
    );

  if (stage === "pick")
    return (
      <div className="space-y-3">
        {value && (
          <button
            type="button"
            onClick={() => setStage("done")}
            className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
          >
            ← Keep current image
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (inputUrl.trim()) loadSrc(inputUrl.trim());
              }
            }}
            placeholder="Paste image URL..."
            className={inputCls + " flex-1"}
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          />
          <button
            type="button"
            onClick={() => inputUrl.trim() && loadSrc(inputUrl.trim())}
            disabled={!inputUrl.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer disabled:opacity-40 flex-shrink-0 font-semibold"
            style={{ fontSize: "13px", fontFamily: "Outfit, sans-serif" }}
          >
            Load
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span
            className="text-white/25"
            style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
          >
            or
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => loadSrc(ev.target?.result as string);
            reader.readAsDataURL(file);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
          style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
        >
          <Camera className="w-4 h-4" />
          Browse from computer
        </button>
      </div>
    );

  // stage === 'crop'
  return (
    <div className="space-y-3">
      <p
        className="text-center text-white/35"
        style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
      >
        Drag to pan · Scroll to zoom · Position photo inside the circle
      </p>
      <div className="flex justify-center">
        <div
          ref={cropContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          style={{
            width: C,
            height: C,
            position: "relative",
            overflow: "hidden",
            borderRadius: 12,
            background: "#0d0d0d",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
        >
          {cropSrc && (
            <img
              ref={imgRef}
              src={cropSrc}
              alt=""
              draggable={false}
              onLoad={handleImgLoad}
              onError={() => setLoadErr(true)}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                maxWidth: "none",
                maxHeight: "none",
                pointerEvents: "none",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                transformOrigin: "50% 50%",
              }}
            />
          )}
          {/* Dark vignette with circle cutout */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(circle ${R}px at center, transparent ${R}px, rgba(0,0,0,0.75) ${R}px)`,
            }}
          />
          {/* Orange circle guide border */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: R * 2,
              height: R * 2,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              border: "1.5px solid rgba(235,117,36,0.55)",
              pointerEvents: "none",
            }}
          />
          {loadErr && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p
                className="text-red-400 text-center px-6"
                style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
              >
                Couldn't load image.
                <br />
                Check the URL and try again.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(0.1, s * 0.85))}
          className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.10] transition-all cursor-pointer flex items-center justify-center font-medium leading-none"
          style={{ fontSize: "20px" }}
        >
          −
        </button>
        <span
          className="text-white/30 w-12 text-center"
          style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
        >
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(15, s * 1.15))}
          className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.10] transition-all cursor-pointer flex items-center justify-center font-medium leading-none"
          style={{ fontSize: "20px" }}
        >
          +
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStage("pick")}
          className="flex-1 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={confirmCrop}
          disabled={imgNatural.w === 0 || loadErr}
          className="flex-1 py-2 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          style={{ fontSize: "13px", fontFamily: "Outfit, sans-serif" }}
        >
          Use this crop
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

function ExecMemberForm({
  initial,
  execRoles,
  execTeams,
  onSave,
  onCancel,
}: {
  initial: ExecMember | null;
  execRoles: ExecRoleItem[];
  execTeams: ExecTeamItem[];
  onSave: (exec: Partial<ExecMember> & { id: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [roleId, setRoleId] = useState<number>(
    initial?.role?.id ?? execRoles[0]?.id ?? 0,
  );
  const [teamId, setTeamId] = useState<number>(
    initial?.team?.id ?? execTeams[0]?.id ?? 0,
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initial?.instagramUrl ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If editing an unassigned member, default selects to first available option
  useEffect(() => {
    if (initial?.role == null && execRoles.length > 0)
      setRoleId(execRoles[0].id);
    if (initial?.team == null && execTeams.length > 0)
      setTeamId(execTeams[0].id);
  }, [execRoles, execTeams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({
        id: initial?.id ?? 0,
        name: name.trim(),
        role: { id: roleId, name: "", displayOrder: 0 },
        team: { id: teamId, name: "", displayOrder: 0 },
        imageUrl: imageUrl.trim() || null,
        bio: bio.trim() || null,
        instagramUrl: instagramUrl.trim() || null,
        email: email.trim() || null,
        isActive,
        createdAt: initial?.createdAt ?? "",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3
          className="text-white"
          style={{
            fontSize: "18px",
            fontWeight: 700,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {initial ? "Edit Member" : "Add Member"}
        </h3>
        <button
          onClick={onCancel}
          className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="md:col-span-2">
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            maxLength={100}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Role *
          </label>
          <CustomSelect
            value={roleId}
            onChange={(v) => setRoleId(Number(v))}
            options={execRoles.map((r) => ({ value: r.id, label: r.name }))}
            required
          />
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Team *
          </label>
          <CustomSelect
            value={teamId}
            onChange={(v) => setTeamId(Number(v))}
            options={execTeams.map((t) => ({ value: t.id, label: t.name }))}
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Profile Image
          </label>
          <CircleImageCropper value={imageUrl} onChange={setImageUrl} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Bio (max 300 chars)
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio..."
            maxLength={300}
            rows={3}
            className={inputCls}
          />
          <p
            className="text-white/20 mt-1 text-right"
            style={{ fontSize: "12px" }}
          >
            {bio.length}/300
          </p>
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Instagram URL
          </label>
          <input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/..."
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exec@example.com"
            className={inputCls}
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-3">
          <input
            type="checkbox"
            id="execIsActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-[#eb7524]"
          />
          <label
            htmlFor="execIsActive"
            className="text-white/60 cursor-pointer"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            Active (visible on public site)
          </label>
        </div>
        <div className="md:col-span-2 flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
            style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {initial ? "Update" : "Add"} Member
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function ExecRoleTeamManager({
  execRoles,
  execTeams,
  onRefresh,
  onRolesReorder,
}: {
  execRoles: ExecRoleItem[];
  execTeams: ExecTeamItem[];
  onRefresh: () => Promise<void>;
  onRolesReorder: (roles: ExecRoleItem[]) => void;
}) {
  const [newRoleName, setNewRoleName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [localRoles, setLocalRoles] = useState<ExecRoleItem[]>(execRoles);
  const [localTeams, setLocalTeams] = useState<ExecTeamItem[]>(execTeams);
  // editingKey: e.g. "roles-3" or "teams-7" — which item is being renamed
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  // Shared refs for drag-and-drop
  const dragSourceIndex = useRef<number | null>(null);
  const dragSourceList = useRef<"roles" | "teams" | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // FLIP animation refs
  const rolesListRef = useRef<HTMLDivElement>(null);
  const teamsListRef = useRef<HTMLDivElement>(null);
  const flipSnapshot = useRef<Map<string, number>>(new Map());
  const pendingFlip = useRef<"roles" | "teams" | null>(null);

  useLayoutEffect(() => {
    const which = pendingFlip.current;
    if (!which) return;
    pendingFlip.current = null;
    applyFlip(
      which === "roles" ? rolesListRef.current : teamsListRef.current,
      flipSnapshot.current,
    );
    flipSnapshot.current.clear();
  });

  const byDisplayOrder = <T extends { id: number; displayOrder: number }>(
    arr: T[],
  ) => [...arr].sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);

  // Sync from props: full reset on add/delete, preserve local displayOrder on rename/reorder.
  // Always sort by displayOrder so the rendered list order matches stored priority.
  useEffect(() => {
    setLocalRoles((prev) => {
      const newIds = execRoles
        .map((r) => r.id)
        .sort()
        .join(",");
      const prevIds = prev
        .map((r) => r.id)
        .sort()
        .join(",");
      if (newIds !== prevIds) return byDisplayOrder(execRoles);
      const newMap = new Map(execRoles.map((r) => [r.id, r]));
      return byDisplayOrder(
        prev.map((r) => {
          const u = newMap.get(r.id);
          return u ? { ...u, displayOrder: r.displayOrder } : r;
        }),
      );
    });
  }, [execRoles]);
  useEffect(() => {
    setLocalTeams((prev) => {
      const newIds = execTeams
        .map((t) => t.id)
        .sort()
        .join(",");
      const prevIds = prev
        .map((t) => t.id)
        .sort()
        .join(",");
      if (newIds !== prevIds) return byDisplayOrder(execTeams);
      const newMap = new Map(execTeams.map((t) => [t.id, t]));
      return byDisplayOrder(
        prev.map((t) => {
          const u = newMap.get(t.id);
          return u ? { ...u, displayOrder: t.displayOrder } : t;
        }),
      );
    });
  }, [execTeams]);

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    setError(null);
    const res = await fetchWithAuth("/api/admin/exec-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName.trim() }),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setError(p?.error?.message || "Failed to add role");
      return;
    }
    setNewRoleName("");
    await onRefresh();
  };

  const deleteRole = async (id: number) => {
    setError(null);
    const res = await fetchWithAuth(`/api/admin/exec-roles/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setError(p?.error?.message || "Failed to delete role");
      return;
    }
    await onRefresh();
  };

  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    setError(null);
    const res = await fetchWithAuth("/api/admin/exec-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName.trim() }),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setError(p?.error?.message || "Failed to add team");
      return;
    }
    setNewTeamName("");
    await onRefresh();
  };

  const deleteTeam = async (id: number) => {
    setError(null);
    const res = await fetchWithAuth(`/api/admin/exec-teams/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setError(p?.error?.message || "Failed to delete team");
      return;
    }
    await onRefresh();
  };

  const startEdit = (key: string, currentName: string) => {
    setEditingKey(key);
    setEditingName(currentName);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditingName("");
  };

  const saveEdit = async (id: number, list: "roles" | "teams") => {
    if (!editingName.trim()) return;
    setError(null);
    const url =
      list === "roles"
        ? `/api/admin/exec-roles/${id}`
        : `/api/admin/exec-teams/${id}`;
    const res = await fetchWithAuth(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName.trim() }),
    });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setError(
        p?.error?.message ||
          `Failed to rename ${list === "roles" ? "role" : "team"}`,
      );
      return;
    }
    setEditingKey(null);
    setEditingName("");
    await onRefresh();
  };

  const handleDrop = async (
    fromIndex: number,
    toIndex: number,
    list: "roles" | "teams",
  ) => {
    setDragOverKey(null);
    if (fromIndex === toIndex) return;

    const reorder = <T extends ExecRoleItem | ExecTeamItem>(
      items: T[],
    ): T[] => {
      const next = [...items];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((item, i) => ({ ...item, displayOrder: i }));
    };

    if (list === "roles") {
      const prevRoles = localRoles;
      const reordered = reorder(localRoles);
      flipSnapshot.current = captureFlip(rolesListRef.current);
      pendingFlip.current = "roles";
      setLocalRoles(reordered); // optimistic update — this IS the source of truth
      onRolesReorder(reordered); // live-resort exec member cards without a fetch
      const res = await fetchWithAuth("/api/admin/exec-roles/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: reordered.map(({ id, displayOrder }) => ({
            id,
            displayOrder,
          })),
        }),
      });
      if (!res.ok) {
        setLocalRoles(prevRoles);
        setError("Failed to reorder roles");
      }
    } else {
      const prevTeams = localTeams;
      const reordered = reorder(localTeams);
      flipSnapshot.current = captureFlip(teamsListRef.current);
      pendingFlip.current = "teams";
      setLocalTeams(reordered); // optimistic update
      const res = await fetchWithAuth("/api/admin/exec-teams/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: reordered.map(({ id, displayOrder }) => ({
            id,
            displayOrder,
          })),
        }),
      });
      if (!res.ok) {
        setLocalTeams(prevTeams);
        setError("Failed to reorder teams");
      } else await onRefresh(); // refresh exec groups since team order affects member grouping
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-2 pt-8 border-t border-white/[0.06]">
      {error && (
        <div className="md:col-span-2 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400" style={{ fontSize: "14px" }}>
            {error}
          </span>
        </div>
      )}
      {[
        {
          label: "Roles",
          items: localRoles,
          newName: newRoleName,
          setNewName: setNewRoleName,
          onAdd: addRole,
          onDelete: deleteRole,
          list: "roles" as const,
          listRef: rolesListRef,
        },
        {
          label: "Teams",
          items: localTeams,
          newName: newTeamName,
          setNewName: setNewTeamName,
          onAdd: addTeam,
          onDelete: deleteTeam,
          list: "teams" as const,
          listRef: teamsListRef,
        },
      ].map(
        ({
          label,
          items,
          newName,
          setNewName,
          onAdd,
          onDelete,
          list,
          listRef,
        }) => (
          <div
            key={label}
            className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
          >
            <h4
              className="text-white/60 mb-1"
              style={{
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "Inter, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {label}
            </h4>
            <p
              className="text-white/20 mb-4"
              style={{ fontSize: "11px", fontFamily: "Inter, sans-serif" }}
            >
              Drag to reorder priority
            </p>
            <div ref={listRef} className="space-y-2 mb-4">
              {items.map((item, index) => {
                const overKey = `${list}-${index}`;
                const itemKey = `${list}-${item.id}`;
                const isOver = dragOverKey === overKey;
                const isEditing = editingKey === itemKey;
                return (
                  <div
                    key={item.id}
                    data-flip-id={String(item.id)}
                    draggable={!isEditing}
                    onDragStart={() => {
                      if (isEditing) return;
                      dragSourceIndex.current = index;
                      dragSourceList.current = list;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverKey(overKey);
                    }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (
                        dragSourceIndex.current !== null &&
                        dragSourceList.current === list
                      ) {
                        handleDrop(dragSourceIndex.current, index, list);
                      }
                      dragSourceIndex.current = null;
                      dragSourceList.current = null;
                      setDragOverKey(null);
                    }}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                      isEditing
                        ? "bg-white/[0.06] border border-[#eb7524]/40"
                        : isOver
                          ? "bg-[#eb7524]/15 border border-[#eb7524]/40 cursor-grab active:cursor-grabbing"
                          : "bg-white/[0.03] border border-transparent cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    {!isEditing && (
                      <GripVertical className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                    )}
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item.id, list);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          maxLength={100}
                          className="flex-1 bg-transparent text-white outline-none"
                          style={{
                            fontSize: "14px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        />
                        <button
                          onClick={() => saveEdit(item.id, list)}
                          className="p-1 rounded text-[#eb7524] hover:text-[#eb7524]/80 transition-all cursor-pointer flex-shrink-0"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 rounded text-white/30 hover:text-white/60 transition-all cursor-pointer flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-white/70 truncate flex-1"
                          style={{
                            fontSize: "14px",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {item.name}
                        </span>
                        <button
                          onClick={() => startEdit(itemKey, item.name)}
                          className="p-1 rounded text-white/30 hover:text-white/70 transition-all cursor-pointer flex-shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1 rounded text-red-400/60 hover:text-red-400 transition-all cursor-pointer flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAdd()}
                placeholder={`New ${label.toLowerCase().slice(0, -1)}…`}
                maxLength={100}
                className={inputCls + " text-sm"}
              />
              <button
                onClick={onAdd}
                disabled={!newName.trim()}
                className="flex items-center gap-1 px-3 py-2 bg-[#eb7524] text-white rounded-xl disabled:opacity-40 cursor-pointer hover:bg-[#d4691f] transition-all flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// FAQ Manager
// ═══════════════════════════════════════════════

function FaqManager({
  faqs,
  onSave,
  onDelete,
  editing,
  setEditing,
  showForm,
  setShowForm,
  faqLoading,
  faqError,
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
          <h2
            className="text-white"
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            FAQ
          </h2>
          <p
            className="text-white/40 mt-1"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {faqs.length} entr{faqs.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-[#eb7524] text-white px-5 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)]"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {faqError && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span
            className="text-red-400"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            {faqError}
          </span>
        </div>
      )}

      {faqLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin" />
        </div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-16">
          <HelpCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p
            className="text-white/30"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            No FAQ entries yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq) => (
            <FaqEntryRow
              key={faq.id}
              faq={faq}
              onEdit={() => {
                setEditing(faq);
                setShowForm(true);
              }}
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
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FaqEntryRow({
  faq,
  onEdit,
  onDelete,
}: {
  faq: FaqItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 hover:bg-white/[0.05] transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p
              className="text-white font-medium"
              style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
            >
              {faq.question}
            </p>
            {!faq.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/30 border border-white/10 flex-shrink-0">
                Inactive
              </span>
            )}
          </div>
          <p
            className="text-white/40 line-clamp-2"
            style={{ fontSize: "13px", fontFamily: "Inter, sans-serif" }}
          >
            {faq.answer}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            disabled={isDeleting}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer disabled:opacity-40"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {confirmDelete ? (
            <>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
              >
                {isDeleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                {isDeleting ? "Deleting" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-50"
                style={{ fontSize: "12px", fontFamily: "Inter, sans-serif" }}
              >
                Cancel
              </button>
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
    </div>
  );
}

function FaqEntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FaqItem | null;
  onSave: (faq: Partial<FaqItem> & { id: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave({
        id: initial?.id ?? 0,
        question: question.trim(),
        answer: answer.trim(),
        isActive,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111] border border-[#eb7524]/20 rounded-2xl p-7">
      <div className="flex items-center justify-between mb-6">
        <h3
          className="text-white"
          style={{
            fontSize: "18px",
            fontWeight: 700,
            fontFamily: "Outfit, sans-serif",
          }}
        >
          {initial ? "Edit FAQ Entry" : "Add FAQ Entry"}
        </h3>
        <button
          onClick={onCancel}
          className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Question * (max 300 chars)
          </label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What is AUSS?"
            required
            maxLength={300}
            className={inputCls}
          />
          <p
            className="text-white/20 mt-1 text-right"
            style={{ fontSize: "12px" }}
          >
            {question.length}/300
          </p>
        </div>
        <div>
          <label className="block text-white/50 mb-1.5" style={labelStyle}>
            Answer *
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Full answer…"
            required
            rows={5}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="faqIsActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 accent-[#eb7524]"
          />
          <label
            htmlFor="faqIsActive"
            className="text-white/60 cursor-pointer"
            style={{ fontSize: "14px", fontFamily: "Inter, sans-serif" }}
          >
            Active (visible on About page)
          </label>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
            style={{ fontSize: "14px", fontFamily: "Outfit, sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-[#eb7524] text-white px-6 py-2.5 rounded-xl hover:bg-[#d4691f] transition-all cursor-pointer shadow-[0_4px_20px_rgba(235,117,36,0.25)] disabled:opacity-50"
            style={{
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {initial ? "Update" : "Add"} Entry
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
