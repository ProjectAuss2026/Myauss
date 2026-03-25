import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Clock, MapPin, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface Activity {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  imageUrl: string;
  externalLink?: string;
  status: 'upcoming' | 'ongoing' | 'archived';
}

// ── Activity helper ──
function deriveActivityStatus(activity: any): 'upcoming' | 'ongoing' | 'archived' {
  const now = new Date();
  const startTime = new Date(activity.startTime);
  const endTime = new Date(activity.endTime);
  
  if (!activity.isPublished || now > endTime) return 'archived';
  if (now >= startTime && now < endTime) return 'ongoing';
  return 'upcoming';
}

function mapActivity(activity: any): Activity {
  return {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    startTime: activity.startTime,
    endTime: activity.endTime,
    imageUrl: activity.imageUrl,
    externalLink: activity.externalLink,
    status: deriveActivityStatus(activity),
  };
}

export function Activities() {
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch activities from backend
  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/activities`);
        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.statusText}`);
        }
        const data = await response.json();
        setActivities(data.map(mapActivity));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
        console.error('Error loading activities:', err);
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, []);
  
  // Filter out archived activities
  const visibleActivities = activities.filter(a => a.status !== 'archived');
  
  // Separate upcoming and ongoing activities
  const upcomingActivities = visibleActivities.filter(a => a.status === 'upcoming');
  const ongoingActivities = visibleActivities.filter(a => a.status === 'ongoing');

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getTimeUntil = (dateStr: string) => {
    const now = new Date();
    const eventDate = new Date(dateStr);
    const diff = eventDate.getTime() - now.getTime();
    
    if (diff < 0) return 'Started';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#eb7524] animate-spin mx-auto mb-4" />
          <p className="text-white/60" style={{ fontFamily: 'Inter, sans-serif' }}>Loading activities...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-white mb-2" style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
            Unable to Load Activities
          </h2>
          <p className="text-white/60 mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all cursor-pointer"
            style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black min-h-screen">
      {/* Hero Section */}
      <section
        className="relative py-16 md:py-24 px-6 overflow-hidden"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full blur-[150px]" 
            style={{ backgroundColor: 'rgba(117, 79, 53, 0.06)' }} />
        </div>
        
        <div className="max-w-[1200px] mx-auto relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
              style={{ backgroundColor: 'rgba(235,117,36,0.15)' }}>
              <Calendar className="w-5 h-5 text-[#eb7524]" />
            </div>
            <span className="text-[#eb7524]" style={{ fontSize: '13px', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
              UPCOMING EVENTS
            </span>
          </div>
          
          <h1 className="text-white mb-3" style={{ 
            fontSize: 'clamp(32px, 5vw, 48px)', 
            fontWeight: 700, 
            fontFamily: 'Outfit, sans-serif', 
            lineHeight: 1.2 
          }}>
            Club Activities & Events
          </h1>
          
          <p className="text-white/60 max-w-2xl mb-8" style={{ 
            fontSize: 'clamp(16px, 2vw, 18px)', 
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.6
          }}>
            Stay updated on all AUSS activities, training sessions, competitions, and social events. Join us and be part of the action!
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-4 py-2 rounded-full" style={{ 
              backgroundColor: 'rgba(235,117,36,0.1)',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              color: '#eb7524'
            }}>
              {visibleActivities.length} Total Events
            </span>
            {ongoingActivities.length > 0 && (
              <span className="px-4 py-2 rounded-full flex items-center gap-2" style={{ 
                backgroundColor: 'rgba(16,185,129,0.1)',
                fontSize: '13px',
                fontFamily: 'Inter, sans-serif',
                color: '#10b981'
              }}>
                <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                {ongoingActivities.length} Happening Now
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="px-6 pb-24">
        <div className="max-w-[1200px] mx-auto">
          {/* Ongoing Activities */}
          {ongoingActivities.length > 0 && (
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 rounded-full bg-[#10b981]" />
                <h2 className="text-white" style={{ 
                  fontSize: '24px', 
                  fontWeight: 700, 
                  fontFamily: 'Outfit, sans-serif' 
                }}>
                  Happening Now
                </h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {ongoingActivities.map((activity) => (
                  <ActivityCardLarge key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Activities */}
          {upcomingActivities.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 rounded-full bg-[#3b82f6]" />
                <h2 className="text-white" style={{ 
                  fontSize: '24px', 
                  fontWeight: 700, 
                  fontFamily: 'Outfit, sans-serif' 
                }}>
                  Upcoming Events
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} formatDate={formatDate} formatTime={formatTime} getTimeUntil={getTimeUntil} />
                ))}
              </div>
            </div>
          )}

          {/* No Activities Message */}
          {visibleActivities.length === 0 && (
            <div className="text-center py-24">
              <Calendar className="w-16 h-16 text-white/10 mx-auto mb-6" />
              <h3 className="text-white mb-2" style={{ 
                fontSize: '20px', 
                fontWeight: 600, 
                fontFamily: 'Outfit, sans-serif' 
              }}>
                No Activities Scheduled
              </h3>
              <p className="text-white/40" style={{ 
                fontSize: '16px', 
                fontFamily: 'Inter, sans-serif' 
              }}>
                Check back soon for upcoming events and activities!
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActivityCard({ 
  activity, 
  formatDate, 
  formatTime, 
  getTimeUntil 
}: { 
  activity: Activity;
  formatDate: (dateStr: string) => string;
  formatTime: (dateStr: string) => string;
  getTimeUntil: (dateStr: string) => string;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/10 transition-all duration-300">
      {/* Image */}
      <div className="relative h-[200px] overflow-hidden">
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            fontFamily: 'Inter, sans-serif'
          }}>
            {getTimeUntil(activity.startTime)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-white mb-2 line-clamp-2" style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          fontFamily: 'Outfit, sans-serif' 
        }}>
          {activity.title}
        </h3>
        
        <p className="text-white/40 mb-4 line-clamp-2" style={{ 
          fontSize: '13px', 
          fontFamily: 'Inter, sans-serif',
          lineHeight: 1.5
        }}>
          {activity.description}
        </p>

        {/* Date/Time Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-white/50" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(activity.startTime)}</span>
          </div>
          <div className="flex items-center gap-2 text-white/50" style={{ fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTime(activity.startTime)} - {formatTime(activity.endTime)}</span>
          </div>
        </div>

        {/* Learn More Button */}
        <button 
          onClick={() => activity.externalLink && window.open(activity.externalLink, '_blank')}
          disabled={!activity.externalLink}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
          style={{ 
            fontSize: '13px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 500
          }}
        >
          Learn More
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ActivityCardLarge({ activity }: { activity: Activity }) {
  const [imgError, setImgError] = useState(false);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  return (
    <div className="bg-[#111] border border-white/[0.06] rounded-2xl overflow-hidden group hover:border-white/10 transition-all duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 h-full">
        {/* Image */}
        <div className="relative h-[300px] md:h-auto overflow-hidden">
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
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/50 via-transparent to-transparent" />
          <div className="absolute top-3 right-3">
            <span className="px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2" style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              fontFamily: 'Inter, sans-serif'
            }}>
              <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              Live Now
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-white mb-3" style={{ 
              fontSize: '22px', 
              fontWeight: 700, 
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1.3
            }}>
              {activity.title}
            </h3>
            
            <p className="text-white/50 mb-6" style={{ 
              fontSize: '14px', 
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.6
            }}>
              {activity.description}
            </p>

            {/* Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-white/60" style={{ fontSize: '14px', fontFamily: 'Inter, sans-serif' }}>
                <Clock className="w-5 h-5 text-[#eb7524]" />
                <span>Starting at {formatTime(activity.startTime)}</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button 
            onClick={() => activity.externalLink && window.open(activity.externalLink, '_blank')}
            disabled={!activity.externalLink}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#eb7524] text-white hover:bg-[#d4691f] transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
            style={{ 
              fontSize: '14px',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600
            }}
          >
            Join Event
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}