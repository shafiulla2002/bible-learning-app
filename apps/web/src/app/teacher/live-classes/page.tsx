'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Radio,
  Calendar,
  Clock,
  Users,
  Search,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Video,
  ChevronRight,
  ChevronLeft,
  Filter,
  Copy,
  Check,
  LayoutGrid,
  Table as TableIcon,
  X,
  Sparkles,
  PlayCircle,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherLiveClasses, TeacherLiveClassItem } from '@/lib/use-teacher-live-classes';
import { MediaPlayerModal } from '@/components/shared/MediaPlayerModal';

export default function TeacherLiveClassesPage() {
  const {
    sessions,
    metrics,
    courses,
    batches,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    courseId,
    batchId,
    status,
    isLoading,
    error,
    setPage,
    setSearch,
    setCourseId,
    setBatchId,
    setStatus,
    scheduleClass,
    cancelClass,
    refresh,
  } = useTeacherLiveClasses(12);

  const [viewType, setViewType] = useState<'cards' | 'table'>('cards');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [cancelModalSession, setCancelModalSession] = useState<TeacherLiveClassItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeRecordingSession, setActiveRecordingSession] = useState<TeacherLiveClassItem | null>(null);

  // New Class Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCourseId, setNewCourseId] = useState('');
  const [newBatchId, setNewBatchId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [newEndTime, setNewEndTime] = useState('11:30');
  const [newPlatform, setNewPlatform] = useState('GOOGLE_MEET');
  const [newJoinUrl, setNewJoinUrl] = useState('');
  const [newRoom, setNewRoom] = useState('Virtual Room Alpha');

  // Filter batches by selected course in modal
  const filteredModalBatches = newCourseId
    ? batches.filter((b) => b.courseId === newCourseId)
    : batches;

  const handleOpenScheduleModal = () => {
    setNewTitle('');
    setNewDescription('');
    setNewCourseId(courses[0]?.id || '');
    const firstCourseBatches = courses[0]?.id
      ? batches.filter((b) => b.courseId === courses[0].id)
      : batches;
    setNewBatchId(firstCourseBatches[0]?.id || batches[0]?.id || '');
    
    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNewDate(tomorrow.toISOString().split('T')[0]);
    setNewStartTime('10:00');
    setNewEndTime('11:30');
    setNewPlatform('GOOGLE_MEET');
    setNewJoinUrl('https://meet.google.com/');
    setNewRoom('Virtual Room Alpha');
    setSubmitError(null);
    setScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!newTitle.trim()) {
      setSubmitError('Please enter a class title');
      return;
    }
    if (!newBatchId) {
      setSubmitError('Please select a batch');
      return;
    }
    if (!newDate || !newStartTime || !newEndTime) {
      setSubmitError('Please select valid class date and start/end times');
      return;
    }

    const startsAt = new Date(`${newDate}T${newStartTime}:00`);
    const endsAt = new Date(`${newDate}T${newEndTime}:00`);

    if (startsAt >= endsAt) {
      setSubmitError('End time must be after start time');
      return;
    }

    if (newJoinUrl && !newJoinUrl.startsWith('http://') && !newJoinUrl.startsWith('https://')) {
      setSubmitError('Meeting link must start with https:// or http://');
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleClass({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        courseId: newCourseId,
        batchId: newBatchId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        joinUrl: newJoinUrl.trim() || undefined,
        room: newRoom.trim() || undefined,
      });

      setScheduleModalOpen(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to schedule live class');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalSession) return;
    setIsSubmitting(true);
    try {
      await cancelClass(cancelModalSession.id, cancelReason);
      setCancelModalSession(null);
      setCancelReason('');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <TeacherShell pageTitle="Live Classes & Timetable">
      <div className="p-4 md:p-6 lg:p-8 space-y-6">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/20 via-transparent to-transparent pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 border border-white/15">
                <Radio size={14} className="text-rose-400 animate-pulse" />
                <span>Live Interactive Teaching Suite</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Live Classes & Timetable
              </h1>
              <p className="text-blue-100 text-sm max-w-2xl font-normal leading-relaxed">
                Schedule, manage, and conduct real-time theological lectures, biblical seminars, and
                record session attendance for your assigned student batches.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/teacher/timetable"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition border border-white/20 backdrop-blur-md cursor-pointer"
              >
                <Calendar size={16} />
                <span>View Timetable</span>
              </Link>
              <button
                type="button"
                onClick={handleOpenScheduleModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-800 hover:bg-blue-50 text-sm font-bold shadow-lg transition transform active:scale-95 cursor-pointer"
              >
                <Plus size={18} />
                <span>Schedule Live Class</span>
              </button>
            </div>
          </div>
        </div>

        {/* 7 KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 md:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Total Classes</span>
              <Calendar size={16} className="text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-800">
                {metrics.totalScheduled}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Scheduled & Active</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Classes Today</span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amber-600">
                {metrics.classesToday}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Today's lectures</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Upcoming</span>
              <Clock size={16} className="text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-indigo-600">
                {metrics.upcomingClasses}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Future sessions</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
            {metrics.ongoingClasses > 0 && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Live Now</span>
              <Radio size={16} className="text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-rose-600">
                {metrics.ongoingClasses}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Currently in session</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Completed</span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-emerald-600">
                {metrics.completedClasses}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Lectures delivered</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">Cancelled</span>
              <XCircle size={16} className="text-rose-500" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-600">
                {metrics.cancelledClasses}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Archived / Cancelled</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">My Batches</span>
              <Users size={16} className="text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-purple-600">
                {metrics.totalAssignedBatches}
              </div>
              <div className="text-[11px] text-slate-400 font-medium">Assigned cohorts</div>
            </div>
          </div>
        </div>

        {/* Filters and Controls Toolbar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              {(
                [
                  { id: 'ALL', label: 'All Sessions' },
                  { id: 'UPCOMING', label: 'Upcoming' },
                  { id: 'LIVE', label: 'Live Now' },
                  { id: 'COMPLETED', label: 'Completed' },
                  { id: 'CANCELLED', label: 'Cancelled' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatus(tab.id);
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    status === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right Controls: View Switch & Refresh */}
            <div className="flex items-center gap-2 self-end lg:self-auto">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewType('cards')}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewType === 'cards'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('table')}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    viewType === 'table'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Table View"
                >
                  <TableIcon size={16} />
                </button>
              </div>

              <button
                type="button"
                onClick={refresh}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="Refresh sessions"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Search & Dropdown Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by class title, room, batch..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Course Filter */}
            <div>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700"
              >
                <option value="ALL">All Assigned Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Filter */}
            <div>
              <select
                value={batchId}
                onChange={(e) => {
                  setBatchId(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-700"
              >
                <option value="ALL">All Assigned Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.courseTitle})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs animate-pulse space-y-4"
              >
                <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                <div className="h-20 bg-slate-50 rounded-xl" />
                <div className="h-8 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-rose-500" />
            <h3 className="text-base font-bold text-rose-900">Failed to load live classes</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <Radio size={32} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">No Live Classes Scheduled</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {search || courseId !== 'ALL' || batchId !== 'ALL' || status !== 'ALL'
                  ? 'No sessions matched your filter criteria. Try adjusting your search query or filters.'
                  : 'You have not scheduled any live interactive lectures yet. Click the button below to schedule your first class with Google Meet.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenScheduleModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Schedule Live Class</span>
            </button>
          </div>
        ) : viewType === 'cards' ? (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => {
              const start = new Date(session.startsAt);
              const end = new Date(session.endsAt);
              const isLive = session.status === 'LIVE' || (start <= new Date() && end >= new Date() && session.status !== 'CANCELLED');
              const isCancelled = session.status === 'CANCELLED';
              const isCompleted = session.status === 'COMPLETED' || end < new Date();

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                    isLive
                      ? 'border-rose-400 ring-2 ring-rose-500/20 shadow-rose-100'
                      : isCancelled
                      ? 'border-slate-200 opacity-75'
                      : 'border-slate-200/80 shadow-xs'
                  }`}
                >
                  <div className="p-5 space-y-3.5 flex-1">
                    {/* Top Row: Course Pill & Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold truncate max-w-[180px]">
                        {session.courseTitle}
                      </span>

                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-extrabold uppercase tracking-wide">
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                          LIVE NOW
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                          CANCELLED
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase">
                          SCHEDULED
                        </span>
                      )}
                    </div>

                    {/* Class Title */}
                    <div>
                      <Link
                        href={`/teacher/live-classes/${session.id}`}
                        className="font-bold text-slate-800 text-base hover:text-blue-600 transition block line-clamp-1"
                      >
                        {session.title}
                      </Link>
                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                        <Users size={12} className="text-purple-500" />
                        <span>{session.batchName}</span>
                      </div>
                    </div>

                    {/* Date & Time Pill */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <Calendar size={14} className="text-blue-600 shrink-0" />
                        <span>
                          {start.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock size={14} className="text-slate-400 shrink-0" />
                        <span>
                          {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Attendance stats & Room */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="font-medium">
                        Room:{' '}
                        <span className="text-slate-700 font-semibold">{session.room || 'Google Meet'}</span>
                      </span>
                      <span className="font-medium">
                        Attendance:{' '}
                        <span className="text-blue-600 font-bold">
                          {session.attendanceCount}/{session.enrolledCount}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                    <Link
                      href={`/teacher/live-classes/${session.id}`}
                      className="text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-1"
                    >
                      <span>Roster & Details</span>
                      <ChevronRight size={14} />
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveRecordingSession(session)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                          session.recordingUrl
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                        title={session.recordingUrl ? 'Watch class recording' : 'Attach class recording URL'}
                      >
                        <PlayCircle size={13} />
                        <span>{session.recordingUrl ? 'Recording' : 'Add Recording'}</span>
                      </button>

                      {session.joinUrl && !isCancelled && (
                        <a
                          href={session.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                        >
                          <Video size={13} />
                          <span>Join Class</span>
                          <ExternalLink size={11} />
                        </a>
                      )}

                      {!isCancelled && !isCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelModalSession(session);
                            setCancelReason('');
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Cancel Class"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Session Title</th>
                    <th className="py-3 px-4">Course & Batch</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Room</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((session) => {
                    const start = new Date(session.startsAt);
                    const end = new Date(session.endsAt);
                    const isLive = session.status === 'LIVE' || (start <= new Date() && end >= new Date() && session.status !== 'CANCELLED');
                    const isCancelled = session.status === 'CANCELLED';
                    const isCompleted = session.status === 'COMPLETED' || end < new Date();

                    return (
                      <tr key={session.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-800 max-w-[200px] truncate">
                          <Link href={`/teacher/live-classes/${session.id}`} className="hover:text-blue-600">
                            {session.title}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 truncate max-w-[160px]">{session.courseTitle}</div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{session.batchName}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          <div>{start.toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-400">
                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{session.room || 'Google Meet'}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-blue-600">{session.attendanceCount}</span>
                          <span className="text-slate-400">/{session.enrolledCount}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isLive ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold text-[10px] uppercase border border-rose-200">
                              LIVE
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                              CANCELLED
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-200">
                              COMPLETED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] uppercase border border-blue-200">
                              SCHEDULED
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                          {session.joinUrl && !isCancelled && (
                            <a
                              href={session.joinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition"
                            >
                              <Video size={11} />
                              <span>Join</span>
                            </a>
                          )}
                          <Link
                            href={`/teacher/live-classes/${session.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold text-[11px] hover:bg-slate-50 transition"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{sessions.length}</span> of{' '}
              <span className="font-bold text-slate-800">{totalCount}</span> sessions
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 font-bold text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Schedule Live Class Modal */}
        {scheduleModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-100 my-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Video size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Schedule Live Class
                    </h3>
                    <p className="text-xs text-slate-500">Google Meet & Virtual Classroom</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {submitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
                {/* Course Selection */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Course <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newCourseId}
                    onChange={(e) => {
                      setNewCourseId(e.target.value);
                      const matchingBatches = batches.filter((b) => b.courseId === e.target.value);
                      setNewBatchId(matchingBatches[0]?.id || '');
                    }}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="" disabled>
                      Select Course
                    </option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Batch Selection */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batch / Cohort <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newBatchId}
                    onChange={(e) => setNewBatchId(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="" disabled>
                      Select Batch
                    </option>
                    {filteredModalBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Class Title */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Class Title / Topic <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Biblical Hermeneutics: Covenantal Typologies"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                  </input>
                </div>

                {/* Description */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Agenda & Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of the lecture topic and required preparation..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Date & Times */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Start Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      End Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Meeting URL & Provider */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Meeting Platform</span>
                    <div className="flex gap-2">
                      {(['GOOGLE_MEET', 'ZOOM', 'TEAMS', 'OTHER'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setNewPlatform(p);
                            if (p === 'GOOGLE_MEET' && !newJoinUrl.includes('meet.google.com')) {
                              setNewJoinUrl('https://meet.google.com/');
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                            newPlatform === p
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {p.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Meeting Link (Google Meet / Zoom URL)
                    </label>
                    <input
                      type="url"
                      value={newJoinUrl}
                      onChange={(e) => setNewJoinUrl(e.target.value)}
                      placeholder="https://meet.google.com/abc-defg-hij"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Room / Venue Name
                    </label>
                    <input
                      type="text"
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      placeholder="e.g. Main Theological Stream A"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Scheduling...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        <span>Confirm & Schedule</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {cancelModalSession && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center font-bold">
                  <XCircle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Cancel Live Class</h3>
                  <p className="text-xs text-slate-500">This action will notify enrolled students</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to cancel the session{' '}
                <span className="font-bold text-slate-800">"{cancelModalSession.title}"</span>?
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Rescheduled due to faculty retreat"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setCancelModalSession(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Keep Class
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmCancel}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        <MediaPlayerModal
          open={Boolean(activeRecordingSession)}
          onClose={() => setActiveRecordingSession(null)}
          title={activeRecordingSession?.title || 'Class Recording'}
          subtitle={
            activeRecordingSession
              ? `${activeRecordingSession.courseTitle} • ${activeRecordingSession.batchName}`
              : undefined
          }
          sourceUrlOrKey={activeRecordingSession?.recordingUrl}
          lessonNotes={activeRecordingSession?.description}
          downloadable={false}
          canAttachUrl={true}
          onSaveVideoUrl={async (newUrl) => {
            if (!activeRecordingSession) return;
            const res = await fetch(
              `/api/teachers/live-classes/${activeRecordingSession.id}`,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordingUrl: newUrl }),
              }
            );
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(json.message || json.error || 'Failed to save recording URL');
            }
            refresh();
          }}
        />
      </div>
    </TeacherShell>
  );
}

