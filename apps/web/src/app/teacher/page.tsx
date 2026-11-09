'use client';

import React from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  FileCheck2,
  Users,
  Radio,
  BookOpen,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
  GraduationCap,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Award,
  Video,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherDashboard } from '@/lib/use-teacher-dashboard';

export default function TeacherDashboardPage() {
  const {
    data,
    teacher,
    institute,
    statistics,
    todaySchedule,
    assignedBatches,
    pendingAssignments,
    upcomingEvents,
    attendanceSummary,
    isLoading,
    error,
    refresh,
  } = useTeacherDashboard({ requireAuth: false });

  // Format current institute date
  const currentDateFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const teacherName = teacher?.fullName || 'Faculty Instructor';
  const instituteName = institute?.name || 'Grace Bible Institute';
  const specialization = teacher?.specialization || 'Theology & Biblical Studies';
  const employeeCode = teacher?.employeeCode || 'FACULTY';

  return (
    <TeacherShell pageTitle="Faculty Dashboard">
      <div className="space-y-6">

        {/* Error State Banner with Retry */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Failed to load real-time analytics</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* A. Welcome Header Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-[#1E293B] to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-md border border-white/10">
                <Sparkles size={13} className="text-blue-400" />
                <span>{instituteName} • Faculty Academic Portal</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Welcome back, {teacherName}! 👋
              </h1>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {specialization} • ID: <span className="text-white font-mono font-semibold">{employeeCode}</span>.
                Manage your assigned theological cohorts, record live lecture attendance, and evaluate coursework submissions.
              </p>
              <div className="pt-1 text-[11px] text-blue-300/90 font-medium flex items-center gap-2">
                <Calendar size={13} className="text-blue-400" />
                <span>Today: {currentDateFormatted}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/teacher/attendance"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Mark Attendance</span>
              </Link>
              <Link
                href="/teacher/assignments"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
              >
                <FileCheck2 size={16} />
                <span>Assignments</span>
              </Link>
              <Link
                href="/teacher/classes"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition cursor-pointer"
              >
                <Radio size={16} />
                <span>Live Classes</span>
              </Link>
            </div>
          </div>
        </div>

        {/* B. Live Statistics Cards (6 Metric Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          
          {/* Card 1: Assigned Batches */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Assigned Batches
              </p>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-slate-900">
                {isLoading ? '...' : statistics.assignedBatchesCount}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Active Teaching Cohorts</p>
            </div>
          </div>

          {/* Card 2: Assigned Students */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Assigned Students
              </p>
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-slate-900">
                {isLoading ? '...' : statistics.assignedStudentsCount}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Enrolled Across Batches</p>
            </div>
          </div>

          {/* Card 3: Instructing Courses */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Instructing Courses
              </p>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <BookOpen size={16} />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-slate-900">
                {isLoading ? '...' : statistics.instructingCoursesCount}
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Curriculum Modules</p>
            </div>
          </div>

          {/* Card 4: Today's Classes */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Today's Classes
              </p>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <Radio size={16} />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-slate-900">
                {isLoading ? '...' : statistics.todayClassesCount}
              </h3>
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">Scheduled For Today</p>
            </div>
          </div>

          {/* Card 5: Pending Assignments */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Pending Reviews
              </p>
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <FileCheck2 size={16} />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-slate-900">
                {isLoading ? '...' : statistics.pendingAssignmentsCount}
              </h3>
              <p className="text-[11px] text-orange-600 font-medium mt-0.5">Awaiting Grading</p>
            </div>
          </div>

          {/* Card 6: Attendance Overview */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Cohort Attendance
              </p>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarCheck size={16} />
              </div>
            </div>
            <div className="mt-2">
              <h3 className="text-2xl font-black text-slate-900">
                {isLoading ? '...' : `${statistics.attendanceRatePct}%`}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {statistics.totalAttendanceRecords} Records Logged
              </p>
            </div>
          </div>

        </div>

        {/* Two-Column Core Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column (2 Cols wide on desktop): Schedule, Batches & Assignments */}
          <div className="lg:col-span-2 space-y-6">

            {/* C. Today's Teaching Schedule */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Today's Teaching Schedule</h2>
                  <p className="text-xs text-slate-500">Live lecture sessions and cohort timetable for today</p>
                </div>
                <Link
                  href="/teacher/timetable"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                >
                  <span>View Timetable</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                  <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
              ) : todaySchedule.length > 0 ? (
                <div className="space-y-3">
                  {todaySchedule.map((session) => {
                    const startFormatted = new Date(session.startsAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const endFormatted = new Date(session.endsAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={session.id}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                            <Radio size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{session.title}</h4>
                            <p className="text-xs text-slate-600 font-medium">
                              {session.courseTitle} • {session.batchName}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {startFormatted} - {endFormatted}
                              </span>
                              {session.room && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-200/70 font-mono text-[10px]">
                                  {session.room}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {session.joinUrl ? (
                          <a
                            href={session.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition self-start sm:self-center"
                          >
                            <Video size={14} />
                            <span>Join Live Class</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-slate-500 px-3 py-1.5 rounded-lg bg-slate-100 self-start sm:self-center">
                            Scheduled
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <Clock size={20} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No classes scheduled for today</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    You have no scheduled live lecture sessions for today. Upcoming timetable events are listed in your schedule view.
                  </p>
                  <Link
                    href="/teacher/timetable"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold mt-4 shadow-xs transition"
                  >
                    <span>View Weekly Timetable</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>

            {/* D. My Assigned Batches Preview */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">My Assigned Batches</h2>
                  <p className="text-xs text-slate-500">Active student cohorts under your direct theological instruction</p>
                </div>
                <Link
                  href="/teacher/batches"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                >
                  <span>View All Batches</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                  <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
              ) : assignedBatches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignedBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 transition shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              batch.teacherRole === 'LEAD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {batch.teacherRole} FACULTY
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-slate-500">
                            {batch.code || 'COHORT'}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{batch.name}</h4>
                        <p className="text-xs text-slate-600 line-clamp-1">{batch.courseTitle}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Users size={13} className="text-slate-400" />
                          <span>{batch.enrolledStudentsCount} Active Students</span>
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {batch.term || batch.academicYear || 'Academic 2026'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40">
                  <p className="text-xs font-semibold text-slate-600">No active cohorts assigned yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Your assigned teaching batches will appear here once registered by institute administration.
                  </p>
                </div>
              )}
            </div>

            {/* E. Assignments Awaiting Grading */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Assignments Awaiting Grading</h2>
                  <p className="text-xs text-slate-500">Student submissions pending your review and evaluation</p>
                </div>
                <Link
                  href="/teacher/assignments"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                >
                  <span>Grading Queue</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-16 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
              ) : pendingAssignments.length > 0 ? (
                <div className="space-y-3">
                  {pendingAssignments.map((assignment) => {
                    const dueFormatted = new Date(assignment.dueAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <div
                        key={assignment.id}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                            <FileCheck2 size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{assignment.title}</h4>
                            <p className="text-xs text-slate-600">
                              {assignment.courseTitle} {assignment.batchName ? `• ${assignment.batchName}` : ''}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Due: {dueFormatted} • Max Marks: {assignment.maxMarks}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-start sm:self-center">
                          <div className="text-right">
                            <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-extrabold">
                              {assignment.pendingReviewCount} Pending
                            </span>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {assignment.submissionCount} Total Submitted
                            </p>
                          </div>
                          <Link
                            href={`/teacher/assignments`}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                          >
                            <ChevronRight size={16} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle2 size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-800">All submissions graded!</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    There are no unreviewed student assignments pending in your grading queue.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Right Column (1 Col wide on desktop): Upcoming, Attendance Overview & Quick Actions */}
          <div className="space-y-6">

            {/* F. Upcoming Classes & Examinations */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Upcoming Schedule</h2>
                  <p className="text-xs text-slate-500">Live sessions & examinations</p>
                </div>
                <Link
                  href="/teacher/timetable"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                >
                  <span>All</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="h-14 bg-slate-100 rounded-xl animate-pulse" />
                </div>
              ) : upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 4).map((evt) => {
                    const eventDateFormatted = new Date(evt.eventDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={evt.id}
                        className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                              evt.eventType === 'LIVE_CLASS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {evt.eventType === 'LIVE_CLASS' ? 'LIVE CLASS' : 'EXAMINATION'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {eventDateFormatted}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{evt.title}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {evt.courseTitle} {evt.batchName ? `• ${evt.batchName}` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40">
                  <p className="text-xs font-medium text-slate-600">No upcoming events scheduled</p>
                </div>
              )}
            </div>

            {/* Attendance Summary Mini-Card */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">Attendance Analytics</h2>
              <p className="text-xs text-slate-500 mb-4">Historical cohort participation overview</p>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-center mb-4">
                <span className="text-3xl font-black text-emerald-700">
                  {isLoading ? '...' : `${attendanceSummary.attendanceRatePct}%`}
                </span>
                <p className="text-xs font-semibold text-emerald-800 mt-1">Average Cohort Attendance Rate</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Present</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{attendanceSummary.presentCount}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Absent</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{attendanceSummary.absentCount}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Sessions</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{attendanceSummary.totalSessionsMarked}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Total Logs</span>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{attendanceSummary.totalRecords}</p>
                </div>
              </div>

              <Link
                href="/teacher/attendance"
                className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                <span>Open Attendance Register</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* G. Faculty Quick Actions (8 Navigation Shortcuts) */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">Faculty Quick Access</h2>
              <p className="text-xs text-slate-500 mb-4">Direct shortcuts to active faculty modules</p>

              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href="/teacher/batches"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <Layers size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">My Batches</span>
                </Link>

                <Link
                  href="/teacher/students"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <Users size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">My Students</span>
                </Link>

                <Link
                  href="/teacher/attendance"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <CalendarCheck size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Attendance</span>
                </Link>

                <Link
                  href="/teacher/assignments"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <FileCheck2 size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Assignments</span>
                </Link>

                <Link
                  href="/teacher/exams"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <GraduationCap size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Examinations</span>
                </Link>

                <Link
                  href="/teacher/classes"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <Radio size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Live Classes</span>
                </Link>

                <Link
                  href="/teacher/timetable"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <Clock size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Timetable</span>
                </Link>

                <Link
                  href="/teacher/materials"
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-200 transition group flex flex-col justify-between"
                >
                  <BookOpen size={18} className="text-blue-600 mb-2 group-hover:scale-110 transition" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Study Materials</span>
                </Link>
              </div>
            </div>

          </div>

        </div>

      </div>
    </TeacherShell>
  );
}
