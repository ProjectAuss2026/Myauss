import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from 'qr-scanner';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  CameraOff,
  WifiOff,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchWithAuth } from '../lib/authFetch';

/**
 * Exec-facing event check-in scanner (KAN-180).
 *
 * Offline behaviour: the attendee list is pre-fetched when an event is selected,
 * so a verdict can be given with no signal at the venue. Only the check-in write
 * needs the network, and it queues with retry. The cached list is a set of member
 * names on an exec's personal phone, so it is held in memory only — never
 * localStorage — and cleared when the event changes or the page unmounts.
 */

type Verdict = 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'NOT_REGISTERED' | 'INVALID_PASS';

interface Attendee {
  userId: string;
  name: string;
  checkedInAt: string | null;
}

interface ActivityOption {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
}

// Events stay listed for a while after they end so the desk still works during
// pack-down and late arrivals, but long-finished events are hidden — an exec
// scrolling a season of past activities at a busy door is how people get checked
// into the wrong event.
const POST_EVENT_GRACE_MS = 6 * 60 * 60 * 1000;

interface ScanResult {
  verdict: Verdict;
  name?: string | null;
  membershipStatus?: string | null;
  checkedInAt?: string | null;
  pending?: boolean;
}

const SCAN_COOLDOWN_MS = 2500;

function formatTime(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CheckIn() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  const [activities, setActivities] = useState<ActivityOption[]>([]);
  const [activityId, setActivityId] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<Map<string, Attendee>>(new Map());
  const [listError, setListError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [queued, setQueued] = useState<string[]>([]);
  const [online, setOnline] = useState(() => navigator.onLine);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  // Server-side is the real gate; this only avoids showing execs' UI to members.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !isAdmin) navigate('/');
  }, [isLoading, isAuthenticated, isAdmin, navigate]);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/activities');
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const all: ActivityOption[] = Array.isArray(data) ? data : (data.activities ?? []);
        const cutoff = Date.now() - POST_EVENT_GRACE_MS;
        setActivities(
          all
            .filter((a) => !a.endTime || new Date(a.endTime).getTime() >= cutoff)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
        );
      } catch {
        setListError('Could not load events.');
      }
    })();
  }, []);

  const loadAttendees = useCallback(async (id: number) => {
    setListError(null);
    try {
      const res = await fetchWithAuth(`/api/activities/${id}/check-in/attendees`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setAttendees(new Map((data.attendees as Attendee[]).map((a) => [a.userId, a])));
    } catch {
      setListError('Could not pre-load the attendee list. Verification needs a connection.');
    }
  }, []);

  useEffect(() => {
    if (activityId != null) loadAttendees(activityId);
    // Don't retain member names for an event we're no longer running.
    return () => setAttendees(new Map());
  }, [activityId, loadAttendees]);

  const submitScan = useCallback(
    async (pass: string, id: number) => {
      const res = await fetchWithAuth(`/api/activities/${id}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as ScanResult;
    },
    [],
  );

  // Retry queued writes when connectivity returns.
  useEffect(() => {
    if (!online || queued.length === 0 || activityId == null) return;
    (async () => {
      const remaining: string[] = [];
      for (const pass of queued) {
        try {
          await submitScan(pass, activityId);
        } catch {
          remaining.push(pass);
        }
      }
      setQueued(remaining);
      if (activityId != null) loadAttendees(activityId);
    })();
  }, [online, queued, activityId, submitScan, loadAttendees]);

  const handleScan = useCallback(
    async (raw: string) => {
      if (activityId == null) return;
      const now = Date.now();
      const last = lastScanRef.current;
      // One QR held to the camera fires continuously — ignore repeats.
      if (last && last.value === raw && now - last.at < SCAN_COOLDOWN_MS) return;
      lastScanRef.current = { value: raw, at: now };

      const parts = raw.split(':');
      if (parts.length !== 3) {
        setResult({ verdict: 'INVALID_PASS' });
        return;
      }

      // Verify locally first so a verdict appears instantly, even with no signal.
      const localMatch = attendees.get(parts[0]);
      if (!localMatch) {
        setResult({ verdict: 'NOT_REGISTERED' });
        return;
      }
      if (localMatch.checkedInAt) {
        setResult({
          verdict: 'ALREADY_CHECKED_IN',
          name: localMatch.name,
          checkedInAt: localMatch.checkedInAt,
        });
        return;
      }

      // Optimistically mark locally so a rescan in the queue reads correctly.
      setAttendees((prev) => {
        const next = new Map(prev);
        next.set(localMatch.userId, { ...localMatch, checkedInAt: new Date().toISOString() });
        return next;
      });

      try {
        const server = await submitScan(raw, activityId);
        setResult(server);
      } catch {
        // Network failed — record it and reconcile when we're back.
        setQueued((q) => [...q, raw]);
        setResult({ verdict: 'CHECKED_IN', name: localMatch.name, pending: true });
      }
    },
    [activityId, attendees, submitScan],
  );

  // Keep the camera effect stable: handleScan changes whenever the attendee map
  // does (including on every optimistic check-in), and depending on it directly
  // would tear down and restart the camera mid-queue.
  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  // Camera lifecycle
  useEffect(() => {
    if (activityId == null || !videoRef.current) return;
    let cancelled = false;
    const video = videoRef.current;

    (async () => {
      if (!window.isSecureContext) {
        setCameraError(
          'The camera needs a secure (HTTPS) connection. Use localhost during development, or the deployed site.',
        );
        return;
      }

      // Pick a real device rather than a facingMode. qr-scanner defaults
      // preferredCamera to 'environment', which fails outright on a laptop with
      // only a front-facing camera — and it signals that by throwing the bare
      // string "Camera not found.", not an Error. Enumerating avoids guessing.
      // Ask for camera access before enumerating. Until getUserMedia has
      // succeeded once, Chrome returns placeholder devices with empty ids and
      // labels — passing one of those as a deviceId constraint can never match.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true });
        probe.getTracks().forEach((t) => t.stop());
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name;
        console.error('Camera permission probe failed:', err);
        setCameraError(
          name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access for this site, then reload.'
            : name === 'NotReadableError'
              ? 'The camera is in use by another app (Zoom, Photo Booth). Close it and reload.'
              : `Could not access the camera${name ? `: ${name}` : '.'}`,
        );
        return;
      }

      // Never leave preferredCamera unset: qr-scanner defaults it to
      // 'environment', which fails outright on a laptop with only a front camera.
      let preferredCamera: string = 'user';
      try {
        const cameras = await QrScanner.listCameras(true);
        console.info(
          'QR scanner cameras:',
          cameras.map((c) => `${c.label || '(no label)'} [${c.id || 'no-id'}]`),
        );
        // Rear camera where one exists (a phone at the door), else whatever
        // there is. Ignore entries with no id — they're unusable as constraints.
        const usable = cameras.filter((c) => c.id);
        const rear = usable.find((c) => /back|rear|environment/i.test(c.label));
        if (rear ?? usable[0]) preferredCamera = (rear ?? usable[0]).id;
      } catch (err) {
        console.error('Could not enumerate cameras, falling back to "user":', err);
      }

      const scanner = new QrScanner(
        video,
        (r) => handleScanRef.current(typeof r === 'string' ? r : r.data),
        { preferredCamera, highlightScanRegion: true, maxScansPerSecond: 4 },
      );
      scannerRef.current = scanner;

      try {
        await scanner.start();
        if (cancelled) return;
        setCameraError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('QR scanner failed to start:', err);
        // qr-scanner throws plain strings in places, so handle both shapes.
        const name = (err as { name?: string })?.name;
        const detail =
          typeof err === 'string' ? err : ((err as { message?: string })?.message ?? '');
        setCameraError(
          name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access for this site, then reload.'
            : name === 'NotReadableError'
              ? 'The camera is in use by another app (Zoom, Photo Booth). Close it and reload.'
              : `Could not start the camera${detail ? `: ${detail}` : '.'}`,
        );
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [activityId]);

  const stats = useMemo(() => {
    const list = [...attendees.values()];
    return { checkedIn: list.filter((a) => a.checkedInAt).length, total: list.length };
  }, [attendees]);

  const verdictView = (r: ScanResult) => {
    const map = {
      CHECKED_IN: {
        icon: <CheckCircle2 className="w-16 h-16" />,
        cls: 'bg-green-500/15 border-green-500/40 text-green-300',
        title: 'Checked in',
      },
      ALREADY_CHECKED_IN: {
        icon: <AlertTriangle className="w-16 h-16" />,
        cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
        title: 'Already checked in',
      },
      NOT_REGISTERED: {
        icon: <XCircle className="w-16 h-16" />,
        cls: 'bg-red-500/15 border-red-500/40 text-red-300',
        title: 'Not registered',
      },
      INVALID_PASS: {
        icon: <XCircle className="w-16 h-16" />,
        cls: 'bg-red-500/15 border-red-500/40 text-red-300',
        title: 'Invalid pass',
      },
    }[r.verdict];

    return (
      <div className={`rounded-2xl border p-6 flex flex-col items-center text-center ${map.cls}`}>
        {map.icon}
        {/* Large and high-contrast: read at arm's length across a busy desk. */}
        <p className="mt-3" style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
          {map.title}
        </p>
        {r.name && (
          <p className="mt-1 text-white" style={{ fontSize: '20px', fontFamily: 'Inter, sans-serif' }}>
            {r.name}
          </p>
        )}
        {r.verdict === 'ALREADY_CHECKED_IN' && r.checkedInAt && (
          <p className="mt-1 text-white/70" style={{ fontSize: '15px' }}>
            First scanned at {formatTime(r.checkedInAt)}
          </p>
        )}
        {r.membershipStatus && r.membershipStatus !== 'VERIFIED' && (
          <p className="mt-2 text-white/70" style={{ fontSize: '14px' }}>
            Membership: {r.membershipStatus}
          </p>
        )}
        {r.verdict === 'NOT_REGISTERED' && (
          <p className="mt-2 text-white/70" style={{ fontSize: '14px', lineHeight: 1.5 }}>
            No booking for this event. They can&rsquo;t be checked in here.
          </p>
        )}
        {r.pending && (
          <p className="mt-2 text-white/60" style={{ fontSize: '13px' }}>
            Saved locally. Will sync when back online.
          </p>
        )}
      </div>
    );
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-6">
      <div className="max-w-md mx-auto">
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="mb-4 inline-flex items-center gap-1.5 text-white/50 hover:text-white transition-colors"
          style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to admin
        </button>

        <h1 className="text-white mb-1" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
          Event check-in
        </h1>
        <p className="text-white/50 mb-5" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
          Scan a member&rsquo;s AUSS pass at the desk.
        </p>

        <label className="block text-white/60 mb-1.5" style={{ fontSize: '13px' }}>
          Event
        </label>
        <select
          value={activityId ?? ''}
          onChange={(e) => {
            setActivityId(e.target.value ? Number(e.target.value) : null);
            setResult(null);
            setCameraError(null);
          }}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white mb-4"
          style={{ fontSize: '14px' }}
        >
          <option value="">Select an event…</option>
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>

        {!online && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/25 px-3 py-2 text-amber-300" style={{ fontSize: '13px' }}>
            <WifiOff className="w-4 h-4 shrink-0" />
            Offline. Verifying from the pre-loaded list.
          </div>
        )}
        {queued.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-white/70" style={{ fontSize: '13px' }}>
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
            {queued.length} check-in{queued.length === 1 ? '' : 's'} waiting to sync
          </div>
        )}
        {listError && (
          <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/25 px-3 py-2 text-red-300" style={{ fontSize: '13px' }}>
            {listError}
          </div>
        )}

        {activityId != null && (
          <>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 px-6 text-center">
                  <CameraOff className="w-8 h-8 text-white/50" />
                  <p className="text-white/70" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                    {cameraError}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4 text-white/60" style={{ fontSize: '13px' }}>
              <span>
                {stats.checkedIn} / {stats.total} checked in
              </span>
              <button
                type="button"
                onClick={() => activityId != null && loadAttendees(activityId)}
                className="inline-flex items-center gap-1.5 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refresh list
              </button>
            </div>

            {result && verdictView(result)}
          </>
        )}
      </div>
    </div>
  );
}
