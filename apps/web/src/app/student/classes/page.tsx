'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { SkeletonWithSpinner } from '@/components/ui/loading-skeleton';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetch, apiFetchResponse, getCachedPortalData, setCachedPortalData } from '@/lib/api';
import {
  Video,
  Radio,
  Calendar,
  Clock,
  User,
  Users,
  Search,
  ExternalLink,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Sparkles,
  MapPin,
  RefreshCw,
  Loader2,
} from 'lucide-react';

interface LiveSessionItem {
  id: string;
  title: string;
  description: string | null;
  courseId: string;
  courseTitle: string;
  batchId: string;
  batchName: string;
  teacherName: string;
  teacherPhoto: string | null;
  room: string | null;
  startsAt: string;
  endsAt: string;
  status: 'LIVE_NOW' | 'STARTING_SOON' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
  rawStatus: string;
  platform: 'GOOGLE_MEET' | 'ZOOM' | 'MICROSOFT_TEAMS' | 'OTHER';
  canJoin: boolean;
  joinUrl: string | null;
  hasRecording: boolean;
  recordingUrl: string | null;
  attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | null;
}

interface LiveSessionsResponse {
  sessions: LiveSessionItem[];
  summary: {
    total: number;
    upcoming: number;
    liveNow: number;
    completed: number;
    recorded: number;
    cancelled: number;
  };
  batches: Array<{
    id: string;
    name: string;
    courseTitle: string;
  }>;
}

export default function StudentClassesPage() {
  const { logout } = useStudentAuth({ requireAuth: true, redirectTo: '/login' });
  const cachedInitial =
    getCachedPortalData<LiveSessionsResponse>('student_live_sessions') ||
    getCachedPortalData<LiveSessionsResponse>('student_classes');
  const [data, setData] = useState<LiveSessionsResponse | null>(() => cachedInitial);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedInitial);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleJoinClass = async (session: LiveSessionItem) => {
    // Open meeting synchronously inside user click event so browser popup blockers never block it
    if (session.joinUrl) {
      window.open(session.joinUrl, '_blank', 'noopener,noreferrer');
    }

    setJoiningId(session.id);
    setActionNotice(null);
    const joinStartMs = Date.now();
    try {
      const res = await apiFetch<{ joinUrl?: string; attendanceStatus?: string }>(
        `/students/live-sessions/${session.id}/join`,
        { method: 'POST' },
      );
      if (!session.joinUrl && res.joinUrl) {
        window.open(res.joinUrl, '_blank', 'noopener,noreferrer');
      }
      const recordedStatus = (res.attendanceStatus as LiveSessionItem['attendanceStatus']) || 'PRESENT';
      setData((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.map((item) =>
                item.id === session.id ? { ...item, attendanceStatus: recordedStatus } : item,
              ),
            }
          : prev,
      );

      // Start verified participation telemetry (JOINED + 60s HEARTBEAT + LEFT on return/unload)
      apiFetch(`/students/live-sessions/${session.id}/telemetry`, {
        method: 'POST',
        body: JSON.stringify({ event: 'JOINED', durationSec: 1 }),
      }).catch(() => {});

      const heartbeatInterval = setInterval(() => {
        const elapsedSec = Math.max(1, Math.round((Date.now() - joinStartMs) / 1000));
        apiFetch(`/students/live-sessions/${session.id}/telemetry`, {
          method: 'POST',
          body: JSON.stringify({ event: 'HEARTBEAT', durationSec: elapsedSec }),
        }).catch(() => {});
      }, 60000);

      const handleLeave = () => {
        clearInterval(heartbeatInterval);
        const elapsedSec = Math.max(1, Math.round((Date.now() - joinStartMs) / 1000));
        apiFetch(`/students/live-sessions/${session.id}/telemetry`, {
          method: 'POST',
          body: JSON.stringify({ event: 'LEFT', durationSec: elapsedSec }),
        }).catch(() => {});
        window.removeEventListener('beforeunload', handleLeave);
      };
      window.addEventListener('beforeunload', handleLeave);
    } catch (err: any) {
      setActionNotice(err?.message || 'Unable to join live class right now.');
    } finally {
      setJoiningId(null);
    }
  };

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'LIVE_NOW' | 'UPCOMING' | 'RECORDED' | 'COMPLETED'>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tabLoading, setTabLoading] = useState<string | null>(null);

  const handleTabChange = (tab: 'ALL' | 'LIVE_NOW' | 'UPCOMING' | 'RECORDED' | 'COMPLETED') => {
    setTabLoading(tab);
    setActiveTab(tab);
    setTimeout(() => setTabLoading(null), 120);
  };

  useEffect(() => {
    async function fetchSessions() {
      try {
        if (!data) {
          setIsLoading(true);
        }
        setError(null);

        const res = await apiFetchResponse('/students/live-sessions');
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load live sessions (${res.status})`);
        }
        const json = await res.json();
        setData(json);
        setCachedPortalData('student_live_sessions', json, 15 * 60 * 1000);
        setCachedPortalData('student_classes', json, 15 * 60 * 1000);
      } catch (err: any) {
        setError(err?.message || 'Unable to load live sessions');
        if (!data) {
          setData(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchSessions();
  }, [logout]);

  const rawSessions = data?.sessions || [];
  const summary = data?.summary || { total: 0, upcoming: 0, liveNow: 0, completed: 0, recorded: 0, cancelled: 0 };
  const batches = data?.batches || [];

  // Instant 0ms Client-Side Filtering
  const filteredSessions = useMemo(() => {
    let list = [...rawSessions];

    if (activeTab === 'LIVE_NOW') {
      list = list.filter((s) => s.status === 'LIVE_NOW');
    } else if (activeTab === 'UPCOMING') {
      list = list.filter((s) => s.status === 'UPCOMING' || s.status === 'STARTING_SOON');
    } else if (activeTab === 'RECORDED') {
      list = list.filter((s) => s.hasRecording);
    } else if (activeTab === 'COMPLETED') {
      list = list.filter((s) => s.status === 'COMPLETED');
    }

    if (selectedBatch !== 'ALL') {
      list = list.filter((s) => s.batchId === selectedBatch);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(q) ||
          (s.courseTitle || '').toLowerCase().includes(q) ||
          (s.teacherName || '').toLowerCase().includes(q) ||
          (s.batchName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [rawSessions, activeTab, selectedBatch, searchQuery]);

  return (
    <StudentShell pageTitle="Live Classes">
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                <Radio size={14} className="text-red-300 animate-pulse" />
                Live Online Classrooms
              </span>
              <span className="text-xs text-blue-100">Synchronous & Recorded Lectures</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Interactive Live Classes</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Join real-time theology lectures, biblical seminar sessions, and pastoral mentorship meetings scheduled for your enrolled batches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.liveNow}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Live Now</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.upcoming}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Upcoming</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.recorded}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Recordings</div>
            </div>
          </div>
        </div>

        {actionNotice && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900 flex items-center justify-between gap-3">
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="font-semibold text-blue-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button
              onClick={() => handleTabChange('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tabLoading === 'ALL' && <Loader2 size={13} className="animate-spin text-white" />}
              <span>All Sessions ({summary.total})</span>
            </button>
            <button
              onClick={() => handleTabChange('LIVE_NOW')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'LIVE_NOW'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tabLoading === 'LIVE_NOW' ? (
                <Loader2 size={13} className="animate-spin text-white" />
              ) : (
                <span className={`w-2 h-2 rounded-full ${activeTab === 'LIVE_NOW' ? 'bg-white' : 'bg-red-500 animate-pulse'}`} />
              )}
              <span>Live Now ({summary.liveNow})</span>
            </button>
            <button
              onClick={() => handleTabChange('UPCOMING')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'UPCOMING'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tabLoading === 'UPCOMING' && <Loader2 size={13} className="animate-spin text-white" />}
              <span>Upcoming ({summary.upcoming})</span>
            </button>
            <button
              onClick={() => handleTabChange('RECORDED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'RECORDED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tabLoading === 'RECORDED' && <Loader2 size={13} className="animate-spin text-white" />}
              <span>Recordings ({summary.recorded})</span>
            </button>
            <button
              onClick={() => handleTabChange('COMPLETED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'COMPLETED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {tabLoading === 'COMPLETED' && <Loader2 size={13} className="animate-spin text-white" />}
              <span>Past ({summary.completed})</span>
            </button>
          </div>

          {/* Search & Batch Dropdown */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search classes or faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {batches.length > 0 && (
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">All Enrolled Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Sessions Grid */}
        {isLoading && rawSessions.length === 0 ? (
          <SkeletonWithSpinner spinnerText="Loading live seminars & cohort sessions...">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-6 bg-slate-200 rounded w-3/4" />
                  <div className="h-16 bg-slate-100 rounded" />
                  <div className="h-10 bg-slate-200 rounded-xl" />
                </div>
              ))}
            </div>
          </SkeletonWithSpinner>
        ) : filteredSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Video size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Live Classes Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are currently no scheduled classes matching your selected filters. Check back closer to your lecture time.
            </p>
            <button
              onClick={() => {
                setActiveTab('ALL');
                setSelectedBatch('ALL');
                setSearchQuery('');
              }}
              className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSessions.map((s) => {
              const starts = new Date(s.startsAt);
              const ends = new Date(s.endsAt);
              const dateFormatted = starts.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
              const timeFormatted = `${starts.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })} - ${ends.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}`;

              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                    s.status === 'LIVE_NOW'
                      ? 'border-red-300 ring-2 ring-red-500/20'
                      : s.status === 'STARTING_SOON'
                      ? 'border-amber-300'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="p-6">
                    {/* Status & Platform Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {s.status === 'LIVE_NOW' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold uppercase tracking-wider">
                          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                          Live Now
                        </span>
                      ) : s.status === 'STARTING_SOON' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider">
                          <Clock size={12} />
                          Starts Soon
                        </span>
                      ) : s.status === 'UPCOMING' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                          <Calendar size={12} />
                          Upcoming
                        </span>
                      ) : s.status === 'CANCELLED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold">
                          <XCircle size={12} />
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                          <CheckCircle2 size={12} />
                          Completed
                        </span>
                      )}

                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                        {s.platform === 'GOOGLE_MEET'
                          ? 'Google Meet'
                          : s.platform === 'ZOOM'
                          ? 'Zoom'
                          : s.platform === 'MICROSOFT_TEAMS'
                          ? 'MS Teams'
                          : 'Online'}
                      </span>
                    </div>

                    {/* Course & Title */}
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1">
                      {s.courseTitle}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug mb-2 line-clamp-2">
                      {s.title}
                    </h3>
                    {s.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4">{s.description}</p>
                    )}

                    {/* Class Details Meta */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800">{dateFormatted}</span>
                        <span className="text-slate-300">•</span>
                        <Clock size={14} className="text-slate-400 shrink-0" />
                        <span>{timeFormatted}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{s.batchName}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate font-medium text-slate-800">{s.teacherName}</span>
                      </div>

                      {s.room && (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-400 shrink-0" />
                          <span className="text-slate-500">{s.room}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                    {s.attendanceStatus ? (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          s.attendanceStatus === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.attendanceStatus === 'LATE'
                            ? 'bg-amber-100 text-amber-800'
                            : s.attendanceStatus === 'EXCUSED'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {s.attendanceStatus}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Attendance: Pending</span>
                    )}

                    {s.canJoin && s.joinUrl ? (
                      <button
                        type="button"
                        disabled={joiningId === s.id}
                        onClick={() => handleJoinClass(s)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        <Video size={14} />
                        {joiningId === s.id ? 'Joining...' : 'Join Class'}
                        <ExternalLink size={12} />
                      </button>
                    ) : s.hasRecording && s.recordingUrl ? (
                      <a
                        href={s.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        <PlayCircle size={14} />
                        Watch Recording
                        <ExternalLink size={12} />
                      </a>
                    ) : s.status === 'CANCELLED' ? (
                      <button disabled className="px-3 py-1.5 text-xs text-slate-400 bg-slate-100 rounded-lg cursor-not-allowed">
                        Cancelled
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setActionNotice(
                            `${s.title} starts on ${dateFormatted} at ${starts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. The join link activates 15 minutes before class.`,
                          )
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium transition-all"
                      >
                        <Clock size={12} />
                        Session Info
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
