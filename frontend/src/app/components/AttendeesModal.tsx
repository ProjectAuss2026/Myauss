import React, { useEffect, useState, useCallback } from 'react';
import {
  X, Loader2, AlertCircle, Users, Download, Trash2, Mail, Calendar, RefreshCw,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { fetchWithAuth } from '../lib/authFetch';

interface RsvpRow {
  id: number;
  name: string;
  email: string;
  studentId: string;
  createdAt: string;
}

interface RawRsvp {
  id: number;
  name: string;
  email: string;
  studentID?: string;
  studentId?: string;
  createdAt: string;
}

interface AttendeesModalProps {
  activityId: number;
  activityTitle: string;
  onClose: () => void;
}

function formatRegDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-NZ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normaliseRsvp(r: RawRsvp): RsvpRow {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    studentId: r.studentId ?? r.studentID ?? '',
    createdAt: r.createdAt,
  };
}

export function AttendeesModal({ activityId, activityTitle, onClose }: AttendeesModalProps) {
  const { showToast } = useToast();
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRsvps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithAuth(`/api/activities/${activityId}/rsvps`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('You do not have permission to view attendees.');
        }
        if (res.status === 404) {
          throw new Error('Activity not found.');
        }
        throw new Error(`Failed to load attendees (${res.status})`);
      }
      const data: RawRsvp[] = await res.json();
      setRsvps(data.map(normaliseRsvp));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendees');
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => { loadRsvps(); }, [loadRsvps]);

  // Lock body scroll + Escape close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingDeleteId === null && deletingId === null) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, pendingDeleteId, deletingId]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await fetchWithAuth(`/api/activities/${activityId}/rsvps/export`);
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsvps-${activityId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Attendee list exported.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to export attendee list', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteId === null) return;
    const rsvpId = pendingDeleteId;
    try {
      setDeletingId(rsvpId);
      const res = await fetchWithAuth(`/api/activities/${activityId}/rsvps/${rsvpId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        if (res.status === 404) throw new Error('Attendee no longer exists.');
        if (res.status === 401 || res.status === 403) {
          throw new Error('You do not have permission to remove this attendee.');
        }
        throw new Error(`Failed to remove attendee (${res.status})`);
      }
      setRsvps((prev) => prev.filter((r) => r.id !== rsvpId));
      showToast('Attendee removed.', 'success');
      setPendingDeleteId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove attendee', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const pendingAttendee = pendingDeleteId !== null
    ? rsvps.find((r) => r.id === pendingDeleteId) ?? null
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (pendingDeleteId === null && deletingId === null) onClose(); }}
    >
      <div
        className="bg-[#1a1a1a] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendees-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/10">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(235,117,36,0.15)' }}
            >
              <Users className="w-5 h-5 text-[#eb7524]" />
            </div>
            <div className="min-w-0">
              <h3
                id="attendees-modal-title"
                className="text-white truncate"
                style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                Attendees
              </h3>
              <p
                className="text-white/50 truncate"
                style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                title={activityTitle}
              >
                {activityTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadRsvps}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading || rsvps.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#eb7524]/15 border border-[#eb7524]/30 text-[#eb7524] hover:bg-[#eb7524]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <Loader2 className="w-5 h-5 text-[#eb7524] animate-spin" />
              <p className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                Loading attendees...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3" role="alert">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-200" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                  {error}
                </p>
                <button
                  type="button"
                  onClick={loadRsvps}
                  className="mt-2 text-red-300 underline hover:text-red-200 cursor-pointer"
                  style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : rsvps.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <p className="text-white/40" style={{ fontSize: '15px', fontFamily: 'Inter, sans-serif' }}>
                No attendees have RSVP&rsquo;d yet.
              </p>
            </div>
          ) : (
            <>
              <p className="text-white/40 mb-3" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                {rsvps.length} attendee{rsvps.length === 1 ? '' : 's'}
              </p>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left" style={{ fontFamily: 'Inter, sans-serif' }}>
                  <thead className="bg-white/5 text-white/50" style={{ fontSize: '12px' }}>
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Student ID</th>
                      <th className="px-4 py-3 font-medium">Registration Date</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/80" style={{ fontSize: '13.5px' }}>
                    {rsvps.map((r) => {
                      const isDeleting = deletingId === r.id;
                      return (
                        <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 align-top">{r.name}</td>
                          <td className="px-4 py-3 align-top">
                            <a
                              href={`mailto:${r.email}`}
                              className="inline-flex items-center gap-1.5 text-white/70 hover:text-[#eb7524] break-all"
                            >
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              {r.email}
                            </a>
                          </td>
                          <td className="px-4 py-3 align-top text-white/70">{r.studentId || '—'}</td>
                          <td className="px-4 py-3 align-top text-white/60 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              {formatRegDate(r.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(r.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-red-400 hover:border-red-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ fontSize: '12px' }}
                              aria-label={`Remove ${r.name}`}
                            >
                              {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {pendingAttendee && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => { if (deletingId === null) setPendingDeleteId(null); }}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-white mb-1" style={{ fontSize: '17px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                  Remove this attendee?
                </h4>
                <p className="text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif', lineHeight: 1.55 }}>
                  <span className="text-white/85">{pendingAttendee.name}</span> ({pendingAttendee.email}) will be removed
                  from this activity. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPendingDeleteId(null)}
                disabled={deletingId !== null}
                className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: '14px', fontFamily: 'Outfit, sans-serif', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                className="flex items-center gap-2 bg-red-500 text-white px-6 py-2.5 rounded-xl hover:bg-red-600 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
              >
                {deletingId !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
