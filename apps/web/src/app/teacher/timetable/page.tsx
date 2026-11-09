'use client';

import React from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Video,
  ExternalLink,
  Users,
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherTimetable, TimetableEvent, TimetableViewMode } from '@/lib/use-teacher-timetable';

export default function TeacherTimetablePage() {
  const {
    events,
    summary,
    courses,
    batches,
    viewMode,
    currentDate,
    courseId,
    batchId,
    isLoading,
    error,
    setViewMode,
    setCourseId,
    setBatchId,
    goToToday,
    goToPrevious,
    goToNext,
    refresh,
  } = useTeacherTimetable();

  // Format date range header text
  const getHeaderDateText = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } else if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } else {
      // Week
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(currentDate);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const monStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const sunStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${monStr} – ${sunStr}`;
    }
  };

  // Days of the week for week view
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Group events by day string (YYYY-MM-DD)
  const eventsByDay: Record<string, TimetableEvent[]> = {};
  events.forEach((ev) => {
    const dayKey = new Date(ev.startsAt).toISOString().split('T')[0];
    if (!eventsByDay[dayKey]) eventsByDay[dayKey] = [];
    eventsByDay[dayKey].push(ev);
  });

  return (
    <TeacherShell pageTitle="Teaching Timetable">
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              <Clock size={13} />
              <span>Interactive Faculty Schedule</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Class Timetable & Schedule
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              View your scheduled live lectures, biblical discussions, and classroom hours.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/teacher/live-classes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Plus size={15} />
              <span>Schedule Class</span>
            </Link>
          </div>
        </div>

        {/* Timetable Controls Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToPrevious}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                title="Previous"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                type="button"
                onClick={goToToday}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Today
              </button>

              <button
                type="button"
                onClick={goToNext}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                title="Next"
              >
                <ChevronRight size={18} />
              </button>

              <span className="text-sm font-extrabold text-slate-800 ml-2">
                {getHeaderDateText()}
              </span>
            </div>

            {/* View Mode Switch & Refresh */}
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs">
                {(['day', 'week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-lg font-bold capitalize transition cursor-pointer ${
                      viewMode === mode
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={refresh}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="Refresh schedule"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Filters: Course & Batch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">All Assigned Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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

        {/* Schedule Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Sessions</span>
            <span className="text-xl font-extrabold text-slate-800">{summary.totalEvents}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider block">Upcoming</span>
            <span className="text-xl font-extrabold text-indigo-600">{summary.upcoming}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider block">Live Now</span>
            <span className="text-xl font-extrabold text-rose-600">{summary.live}</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider block">Delivered</span>
            <span className="text-xl font-extrabold text-emerald-600">{summary.completed}</span>
          </div>
        </div>

        {/* Main Schedule Grid / View */}
        {isLoading ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded w-1/3" />
            <div className="h-64 bg-slate-100 rounded-2xl" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
            <AlertCircle size={32} className="mx-auto text-rose-500" />
            <h3 className="text-base font-bold text-rose-900">Failed to load schedule</h3>
            <p className="text-xs text-rose-700">{error}</p>
            <button
              type="button"
              onClick={refresh}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <CalendarIcon size={32} />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">No Classes Scheduled For This Period</h3>
              <p className="text-xs text-slate-500">
                You have no live classes scheduled in the selected date range. Click below to schedule a new class.
              </p>
            </div>
            <Link
              href="/teacher/live-classes"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition cursor-pointer"
            >
              <Plus size={16} />
              <span>Schedule Live Class</span>
            </Link>
          </div>
        ) : (
          /* Events List / Grid View */
          <div className="space-y-4">
            {events.map((event) => {
              const start = new Date(event.startsAt);
              const end = new Date(event.endsAt);
              const isLive = event.status === 'LIVE';
              const isCancelled = event.status === 'CANCELLED';
              const isCompleted = event.status === 'COMPLETED';

              return (
                <div
                  key={event.id}
                  className={`bg-white rounded-2xl p-5 border transition-all duration-200 hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isLive
                      ? 'border-rose-400 ring-2 ring-rose-500/20 shadow-rose-100'
                      : isCancelled
                      ? 'border-slate-200 opacity-70'
                      : 'border-slate-200/80 shadow-xs'
                  }`}
                >
                  {/* Left: Time and Date Pill */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 font-extrabold flex flex-col items-center justify-center text-xs shrink-0 shadow-inner">
                      <span className="text-[10px] uppercase font-bold text-blue-500">
                        {start.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-base font-black leading-tight">
                        {start.getDate()}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-extrabold text-slate-800">
                        {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {event.durationMinutes} minutes duration
                      </div>
                    </div>
                  </div>

                  {/* Center: Class and Course Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold">
                        {event.courseTitle}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold">
                        {event.batchName}
                      </span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-extrabold uppercase border border-rose-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          LIVE NOW
                        </span>
                      ) : isCancelled ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                          CANCELLED
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase border border-emerald-200">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase border border-blue-200">
                          SCHEDULED
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/teacher/live-classes/${event.id}`}
                      className="text-base font-bold text-slate-800 hover:text-blue-600 transition block"
                    >
                      {event.title}
                    </Link>

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Venue: <span className="font-semibold text-slate-700">{event.room}</span></span>
                      <span>•</span>
                      <span>Attendance: <span className="font-semibold text-blue-600">{event.attendanceCount}/{event.enrolledCount}</span></span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    {event.joinUrl && !isCancelled && (
                      <a
                        href={event.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
                      >
                        <Video size={14} />
                        <span>Join</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                    <Link
                      href={`/teacher/live-classes/${event.id}`}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
                    >
                      Roster & Attendance
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TeacherShell>
  );
}

