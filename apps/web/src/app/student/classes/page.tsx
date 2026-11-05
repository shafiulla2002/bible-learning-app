'use client';

import React, { useState, useEffect } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
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

const fallbackSessions: LiveSessionItem[] = [
  {
    id: 'demo-s1',
    title: 'Biblical Interpretation Q&A Seminar',
    description: 'Weekly interactive questions and hermeneutics case studies with faculty mentors.',
    courseId: 'c-theology-1',
    courseTitle: 'Building Biblical Theology',
    batchId: 'b-2026-a',
    batchName: 'Batch 2026-A Diploma',
    teacherName: 'Dr. Mary Thomas',
    teacherPhoto: null,
    room: 'Virtual Room Alpha',
    startsAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    status: 'LIVE_NOW',
    rawStatus: 'LIVE',
    platform: 'GOOGLE_MEET',
    canJoin: true,
    joinUrl: 'https://meet.google.com/demo-biblical-qa',
    hasRecording: false,
    recordingUrl: null,
    attendanceStatus: null,
  },
  {
    id: 'demo-s2',
    title: 'Covenant Theology & Reformation History',
    description: 'In-depth historical overview of the Scottish & Continental Reformers.',
    courseId: 'c-theology-1',
    courseTitle: 'Building Biblical Theology',
    batchId: 'b-2026-a',
    batchName: 'Batch 2026-A Diploma',
    teacherName: 'Rev. Jason David',
    teacherPhoto: null,
    room: 'Main Chapel Stream',
    startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(),
    status: 'UPCOMING',
    rawStatus: 'SCHEDULED',
    platform: 'ZOOM',
    canJoin: false,
    joinUrl: 'https://zoom.us/j/demo-reformation',
    hasRecording: false,
    recordingUrl: null,
    attendanceStatus: null,
  },
  {
    id: 'demo-s3',
    title: 'Old Testament Canon & Manuscript Traditions',
    description: 'Archived lecture on the Masoretic Text and Dead Sea Scrolls evidence.',
    courseId: 'c-theology-1',
    courseTitle: 'Building Biblical Theology',
    batchId: 'b-2026-a',
    batchName: 'Batch 2026-A Diploma',
    teacherName: 'Dr. Samuel Mathew',
    teacherPhoto: null,
    room: 'Studio Hall 1',
    startsAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    endsAt: new Date(Date.now() - 46.5 * 60 * 60 * 1000).toISOString(),
    status: 'COMPLETED',
    rawStatus: 'COMPLETED',
    platform: 'GOOGLE_MEET',
    canJoin: false,
    joinUrl: null,
    hasRecording: true,
    recordingUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    attendanceStatus: 'PRESENT',
  },
];

export default function StudentClassesPage() {
  const { student, profile, institute } = useStudentAuth();
  const [data, setData] = useState<LiveSessionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'LIVE_NOW' | 'UPCOMING' | 'RECORDED' | 'COMPLETED'>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function fetchSessions() {
      try {
        setIsLoading(true);
        setError(null);

        const headers: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          const token =
            localStorage.getItem('token') ||
            localStorage.getItem('access_token') ||
            localStorage.getItem('auth_token');
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }

        if (profile?.studentProfileId) {
          headers['x-dev-user-id'] = student?.id || '';
          headers['x-dev-role'] = 'STUDENT';
          headers['x-dev-institute-id'] = institute?.id || '';
        }

        const params = new URLSearchParams();
        if (selectedBatch !== 'ALL') params.append('batchId', selectedBatch);
        if (searchQuery.trim()) params.append('q', searchQuery.trim());
        if (activeTab !== 'ALL') params.append('status', activeTab);

        const res = await fetch(`/api/students/live-sessions?${params.toString()}`, { headers });
        if (!res.ok) {
          throw new Error(`Failed to load live sessions (${res.status})`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.warn('Falling back to local session data:', err.message);
        setData({
          sessions: fallbackSessions,
          summary: {
            total: fallbackSessions.length,
            upcoming: 1,
            liveNow: 1,
            completed: 1,
            recorded: 1,
            cancelled: 0,
          },
          batches: [
            { id: 'b-2026-a', name: 'Batch 2026-A Diploma', courseTitle: 'Building Biblical Theology' },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSessions();
  }, [selectedBatch, searchQuery, activeTab, profile?.studentProfileId, student?.id, institute?.id]);

  const sessions = data?.sessions || [];
  const summary = data?.summary || { total: 0, upcoming: 0, liveNow: 0, completed: 0, recorded: 0, cancelled: 0 };
  const batches = data?.batches || [];

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

        {/* Filter Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              All Sessions ({summary.total})
            </button>
            <button
              onClick={() => setActiveTab('LIVE_NOW')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === 'LIVE_NOW'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeTab === 'LIVE_NOW' ? 'bg-white' : 'bg-red-500 animate-pulse'}`} />
              Live Now ({summary.liveNow})
            </button>
            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'UPCOMING'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Upcoming ({summary.upcoming})
            </button>
            <button
              onClick={() => setActiveTab('RECORDED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'RECORDED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Recordings ({summary.recorded})
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'COMPLETED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Past ({summary.completed})
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
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm animate-pulse space-y-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-16 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
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
            {sessions.map((s) => {
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
                      <a
                        href={s.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        <Video size={14} />
                        Join Class
                        <ExternalLink size={12} />
                      </a>
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
                        onClick={() => alert(`This session starts on ${dateFormatted} at ${starts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. The join link will activate 15 minutes before class.`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium transition-all"
                      >
                        <Clock size={12} />
                        Set Reminder
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
