import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  Users,
} from 'lucide-react';
import { RSVPModal } from '../components/RSVPModal';

interface Activity {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  imageUrl: string;
  externalLink?: string;
  isPublished?: boolean;
}

interface RsvpCount {
  count: number;
  capacity: number | null;
  isSoldOut: boolean;
}

function deriveStatus(activity: Activity): 'upcoming' | 'ongoing' | 'archived' {
  const now = new Date();
  const start = new Date(activity.startTime);
  const end = new Date(activity.endTime);
  if (activity.isPublished === false || now > end) return 'archived';
  if (now >= start && now < end) return 'ongoing';
  return 'upcoming';
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function ActivityDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const activityId = id ? parseInt(id, 10) : NaN;
  const validId = !Number.isNaN(activityId);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const [rsvp, setRsvp] = useState<RsvpCount | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(true);
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  // Fetch activity (filter from public list since there is no GET /:id endpoint)
  useEffect(() => {
    if (!validId) {
      setError('Invalid activity id');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/activities');
        if (!res.ok) throw new Error(`Failed to load activity: ${res.statusText}`);
        const list: Activity[] = await res.json();
        const found = list.find((a) => a.id === activityId);
        if (cancelled) return;
        if (!found) {
          setError('Activity not found');
          setActivity(null);
        } else {
          setActivity(found);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId, validId]);

  const loadRsvpCount = useCallback(async () => {
    if (!validId) return;
    try {
      setRsvpLoading(true);
      setRsvpError(null);
      const res = await fetch(`/api/activities/${activityId}/rsvp/count`);
      if (!res.ok) throw new Error(`Failed to load RSVP info: ${res.statusText}`);
      const data: RsvpCount = await res.json();
      setRsvp(data);
    } catch (err) {
      setRsvpError(err instanceof Error ? err.message : 'Failed to load RSVP info');
    } finally {
      setRsvpLoading(false);
    }
  }, [activityId, validId]);

  useEffect(() => {
    loadRsvpCount();
  }, [loadRsvpCount]);

  if (loading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin mx-auto mb-4" />
          <p className="text-white/60" style={{ fontFamily: 'Inter, sans-serif' }}>
            Loading activity...
          </p>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2
            className="text-white mb-2"
            style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            Unable to Load Activity
          </h2>
          <p className="text-white/60 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
            {error ?? 'Activity not found'}
          </p>
          <button
            onClick={() => navigate('/activities')}
            className="px-6 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer"
            style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            Back to Activities
          </button>
        </div>
      </div>
    );
  }

  const status = deriveStatus(activity);
  const isArchived = status === 'archived';
  const isSoldOut = rsvp?.isSoldOut ?? false;
  const rsvpDisabled = isArchived || isSoldOut || rsvpLoading || !!rsvpError;

  let buttonText = 'Register Now';
  if (isArchived) buttonText = 'Event Ended';
  else if (rsvpLoading) buttonText = 'Loading...';
  else if (isSoldOut) buttonText = 'Sold Out';

  return (
    <div className="bg-black min-h-screen">
      <section className="px-6 pt-10 pb-16">
        <div className="max-w-[900px] mx-auto">
          <button
            onClick={() => navigate('/activities')}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 cursor-pointer"
            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Activities
          </button>

          <div className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden">
            {/* Image */}
            <div className="relative h-[260px] md:h-[360px] overflow-hidden bg-white/[0.02]">
              {imgError || !activity.imageUrl ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-12 h-12 text-white/10" />
                </div>
              ) : (
                <img
                  src={activity.imageUrl}
                  alt={activity.title}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {status === 'ongoing' && (
                <div className="absolute top-4 right-4">
                  <span
                    className="px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.85)',
                      border: '1px solid rgb(16, 185, 129, 0.65)',
                      color: '#10b981',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                    Live Now
                  </span>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-6 md:p-8">
              <h1
                className="text-white mb-4"
                style={{
                  fontSize: 'clamp(24px, 4vw, 34px)',
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                  lineHeight: 1.2,
                }}
              >
                {activity.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
                <div
                  className="flex items-center gap-2 text-white/60"
                  style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                >
                  <Calendar className="w-4 h-4 text-[#eb7524]" />
                  <span>{formatDate(activity.startTime)}</span>
                </div>
                <div
                  className="flex items-center gap-2 text-white/60"
                  style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
                >
                  <Clock className="w-4 h-4 text-[#eb7524]" />
                  <span>
                    {formatTime(activity.startTime)} – {formatTime(activity.endTime)}
                  </span>
                </div>
              </div>

              <p
                className="text-white/70 mb-8 whitespace-pre-line"
                style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif', lineHeight: 1.7 }}
              >
                {activity.description}
              </p>

              {/* RSVP status + actions */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 md:p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-[#eb7524]" />
                  <span
                    className="text-[#eb7524]"
                    style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '0.05em' }}
                  >
                    REGISTRATION
                  </span>
                </div>
                <RSVPStatus loading={rsvpLoading} error={rsvpError} rsvp={rsvp} />

                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                  <button
                    onClick={() => setModalOpen(true)}
                    disabled={rsvpDisabled}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#eb7524]"
                    style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
                  >
                    {buttonText}
                  </button>
                  {activity.externalLink && (
                    <a
                      href={activity.externalLink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white/70 hover:bg-white/[0.08] hover:text-white transition-all cursor-pointer"
                      style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}
                    >
                      More Info
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <RSVPModal
        open={modalOpen}
        activityId={activityId}
        activityTitle={activity.title}
        onClose={() => setModalOpen(false)}
        onSuccess={loadRsvpCount}
      />
    </div>
  );
}

function RSVPStatus({
  loading,
  error,
  rsvp,
}: {
  loading: boolean;
  error: string | null;
  rsvp: RsvpCount | null;
}) {
  if (loading) {
    return (
      <p
        className="flex items-center gap-2 text-white/50"
        style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking availability...
      </p>
    );
  }

  if (error || !rsvp) {
    return (
      <p
        className="text-white/50"
        style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}
      >
        Registration info unavailable right now.
      </p>
    );
  }

  const { count, capacity, isSoldOut } = rsvp;

  if (isSoldOut) {
    return (
      <div>
        <p
          className="text-red-400 mb-1"
          style={{ fontSize: '16px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
        >
          Sold Out
        </p>
        {capacity !== null && (
          <p
            className="text-white/50"
            style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
          >
            {count} / {capacity} spots registered
          </p>
        )}
      </div>
    );
  }

  if (capacity === null) {
    return (
      <div>
        <p
          className="text-white"
          style={{ fontSize: '16px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
        >
          Unlimited spots available
        </p>
        <p
          className="text-white/50"
          style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
        >
          {count} {count === 1 ? 'person has' : 'people have'} registered
        </p>
      </div>
    );
  }

  const remaining = Math.max(capacity - count, 0);
  const pct = capacity > 0 ? Math.min((count / capacity) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
        <p
          className="text-white"
          style={{ fontSize: '16px', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
        >
          {count} / {capacity} spots registered
        </p>
        <p
          className="text-white/50"
          style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
        >
          {remaining} {remaining === 1 ? 'spot' : 'spots'} remaining
        </p>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full bg-[#eb7524] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
