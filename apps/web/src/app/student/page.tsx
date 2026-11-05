'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { useStudentDashboard } from '@/lib/use-student-dashboard';
import {
  BookOpen,
  CheckCircle2,
  Hourglass,
  Flame,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Bell,
  Users,
  Video,
  Clock,
  Sparkles,
  ExternalLink,
  Calendar as CalendarIcon,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { student, profile, institute } = useStudentAuth();
  const { dashboardData, isLoading, error, refresh } = useStudentDashboard();

  // Resolved student display information
  const studentName = dashboardData?.student?.fullName || student?.fullName || 'Student';
  const firstName = studentName.split(' ')[0] || 'Student';
  const stats = dashboardData?.statistics || {
    enrolledCoursesCount: 0,
    completedCoursesCount: 0,
    learningHours: 0,
    learningStreak: 0,
    xpPoints: '0',
    overallProgressPct: 0,
  };

  // Calendar state for the interactive mini calendar widget
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 10, 5)); // Nov 2026 local app date

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  // Calendar day calculation
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Map calendar events by date string "YYYY-MM-DD"
  const eventDateSet = new Set(
    (dashboardData?.calendarEvents || []).map((e) => e.date)
  );

  const calendarDays: Array<{
    day: number;
    isCurrentMonth: boolean;
    isToday?: boolean;
    hasEvent?: boolean;
    dateStr: string;
  }> = [];

  // Trailing previous month days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonthDate = new Date(year, month - 1, d);
    const dateStr = prevMonthDate.toISOString().split('T')[0];
    calendarDays.push({
      day: d,
      isCurrentMonth: false,
      hasEvent: eventDateSet.has(dateStr),
      dateStr,
    });
  }

  // Current month days
  const now = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const currentDayDate = new Date(year, month, d);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday =
      d === now.getDate() &&
      month === now.getMonth() &&
      year === now.getFullYear();
    const hasEvent = eventDateSet.has(dateStr);

    calendarDays.push({
      day: d,
      isCurrentMonth: true,
      isToday,
      hasEvent,
      dateStr,
    });
  }

  // Leading next month days
  const remaining = 35 - calendarDays.length;
  const trailingCount = remaining > 0 ? remaining : 42 - calendarDays.length;
  for (let i = 1; i <= trailingCount; i++) {
    const nextMonthDate = new Date(year, month + 1, i);
    const dateStr = nextMonthDate.toISOString().split('T')[0];
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      hasEvent: eventDateSet.has(dateStr),
      dateStr,
    });
  }

  // Donut chart calculations
  const categories = dashboardData?.learningProgressChart?.categories || [
    { name: 'Theology', percentage: 60, color: '#2563EB' },
    { name: 'Church History', percentage: 24, color: '#8B5CF6' },
    { name: 'Pastoral Care', percentage: 16, color: '#06B6D4' },
  ];

  const circumference = 2 * Math.PI * 40; // 251.327
  let cumulativeOffset = 0;

  return (
    <StudentShell pageTitle="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN (approx 65% width: 8 columns) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. Main Welcome Banner (Dark SaaS Mesh with Dynamic Metric Badges) */}
          <div className="relative overflow-hidden rounded-3xl bg-[#090D1A] text-white p-6 md:p-8 shadow-xl border border-slate-800">
            {/* Background decorative curved lines */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none opacity-20">
              <svg viewBox="0 0 400 200" fill="none" className="w-full h-full object-cover">
                <path d="M0 100 C 150 20, 250 180, 400 100" stroke="#38BDF8" strokeWidth="1.5" />
                <path d="M0 120 C 150 40, 250 200, 400 120" stroke="#818CF8" strokeWidth="1.5" />
                <path d="M0 80 C 150 0, 250 160, 400 80" stroke="#C084FC" strokeWidth="1.5" />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left Welcome Content */}
              <div className="max-w-md">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-300 text-[11px] font-semibold mb-3 backdrop-blur-sm border border-white/10">
                  <Sparkles size={12} className="text-amber-300" />
                  <span>{dashboardData?.institute?.name || institute?.name || 'Bible Institute LMS'}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Welcome back, {firstName} 👋
                </h2>
                <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed font-normal">
                  Continue your spiritual learning journey and grow in your understanding of the Bible.
                  You've completed <strong className="text-white font-semibold">{stats.overallProgressPct}%</strong> of your course curriculum!
                </p>
                <div className="mt-5">
                  <Link
                    href="/student/courses"
                    className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-blue-600 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition shadow-lg shadow-blue-500/25"
                  >
                    <span>Continue Learning</span>
                  </Link>
                </div>
              </div>

              {/* Right Circular Metric Rings (Streak, Hours, Points) */}
              <div className="flex items-center gap-4 self-center md:self-auto shrink-0 bg-white/5 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
                {/* Metric Ring 1: Streak */}
                <div className="flex flex-col items-center">
                  <div className="w-13 h-13 rounded-full border-2 border-cyan-400/80 bg-cyan-950/30 flex items-center justify-center p-2 text-center shadow-sm">
                    <span className="text-sm font-bold text-white leading-none">
                      {stats.learningStreak}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium mt-1.5 whitespace-nowrap">Current streak</span>
                </div>

                {/* Metric Ring 2: Hours */}
                <div className="flex flex-col items-center">
                  <div className="w-13 h-13 rounded-full border-2 border-purple-400/80 bg-purple-950/30 flex items-center justify-center p-2 text-center shadow-sm">
                    <span className="text-sm font-bold text-white leading-none">
                      {stats.learningHours}h
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium mt-1.5 whitespace-nowrap">Learning hours</span>
                </div>

                {/* Metric Ring 3: Points / XP */}
                <div className="flex flex-col items-center">
                  <div className="w-13 h-13 rounded-full border-2 border-teal-400/80 bg-teal-950/30 flex items-center justify-center p-2 text-center shadow-sm">
                    <span className="text-sm font-bold text-white leading-none">
                      {stats.xpPoints}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium mt-1.5 whitespace-nowrap">XP points</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Continue Learning Section (Horizontal Course Cards) */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Continue Learning</h3>
              <Link
                href="/student/courses"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                View My Courses
              </Link>
            </div>

            {isLoading ? (
              // Loading Skeleton
              <div className="space-y-3.5">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200 animate-pulse flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-16 bg-slate-200 rounded-xl" />
                      <div className="space-y-2">
                        <div className="w-24 h-3 bg-slate-200 rounded" />
                        <div className="w-48 h-4 bg-slate-200 rounded" />
                        <div className="w-32 h-3 bg-slate-200 rounded" />
                      </div>
                    </div>
                    <div className="w-24 h-8 bg-slate-200 rounded-full" />
                  </div>
                ))}
              </div>
            ) : dashboardData?.continueLearningCourses && dashboardData.continueLearningCourses.length > 0 ? (
              // Real Enrolled Course Cards
              <div className="space-y-3.5">
                {dashboardData.continueLearningCourses.map((course, idx) => {
                  const gradient = idx % 2 === 0
                    ? 'from-blue-700 to-indigo-900'
                    : 'from-emerald-700 to-teal-900';
                  const badgeColor = idx % 2 === 0 ? 'text-blue-600' : 'text-teal-600';

                  return (
                    <div
                      key={course.enrolmentId || idx}
                      className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-blue-200 hover:shadow-md transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        {/* Course Thumbnail */}
                        <div className={`w-20 h-16 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-sm relative overflow-hidden`}>
                          {course.coverImage ? (
                            <img
                              src={course.coverImage}
                              alt={course.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <BookOpen size={24} className="text-white/80" />
                          )}
                          {course.batchName && (
                            <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-black/50 px-1 py-0.5 rounded text-white/90">
                              Cohort
                            </span>
                          )}
                        </div>

                        {/* Course Details */}
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                            {course.category}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {course.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {course.completedLessons}/{course.totalLessons} Lessons Completed
                            {course.instructorName && (
                              <span className="ml-2 text-slate-400">• {course.instructorName}</span>
                            )}
                          </p>

                          {/* Progress bar */}
                          <div className="mt-2 w-48 sm:w-60 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#2563EB] h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, course.progressPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action button & Percentage on right */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <Link
                          href={`/student/courses/${course.courseId}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-1.5 text-xs font-semibold transition"
                        >
                          <span>Resume Lesson</span>
                        </Link>
                        <span className="text-xs font-medium text-slate-500">
                          {course.progressPct}% Complete
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Empty State (0 active enrolments)
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <BookOpen size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-900">No active enrolments yet</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  You are not currently enrolled in any active courses. Check the course catalog or contact your institute administrator.
                </p>
                <div className="mt-4">
                  <Link
                    href="/student/courses"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <span>Browse Course Catalog</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 3. Upcoming Live Classes Section (Roster Table) */}
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Upcoming Live Classes</h3>
              <Link
                href="/student/classes"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              >
                View All
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60">
                      <th className="py-3.5 px-5">Class Name</th>
                      <th className="py-3.5 px-4">Instructor</th>
                      <th className="py-3.5 px-4">Time</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                          Loading scheduled live classes...
                        </td>
                      </tr>
                    ) : dashboardData?.upcomingLiveClasses && dashboardData.upcomingLiveClasses.length > 0 ? (
                      dashboardData.upcomingLiveClasses.map((session) => {
                        const startsAt = new Date(session.startsAt);
                        const isLive = session.status === 'LIVE';
                        const timeStr = startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <tr key={session.id} className="hover:bg-blue-50/40 transition">
                            <td className="py-3.5 px-5 font-bold text-slate-900">
                              <div>{session.title}</div>
                              <div className="text-[11px] font-normal text-slate-400">{session.courseName}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 font-medium">
                              {session.instructor}
                            </td>
                            <td className="py-3.5 px-4">
                              {isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  LIVE
                                </span>
                              ) : (
                                <span className="font-medium text-slate-600">{timeStr}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              {session.canJoin || isLive ? (
                                <a
                                  href={session.joinUrl || 'https://meet.google.com'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-4 py-1.5 rounded-full shadow-sm transition"
                                >
                                  <span>Join Now</span>
                                  <ExternalLink size={12} />
                                </a>
                              ) : (
                                <button
                                  onClick={() => alert(`Reminder set for session: ${session.title}`)}
                                  className="inline-flex items-center gap-1 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 px-3.5 py-1.5 text-xs font-semibold transition"
                                >
                                  <span>Set Reminder</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                          <Video size={20} className="mx-auto mb-1 text-slate-300" />
                          No live classes scheduled for your batches today.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (approx 35% width: 4 columns) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 4. Compact 4-Card Metric Grid (2x2) */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Metric 1: Enrolled */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                <Users size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Enrolled</p>
                <p className="text-2xl font-extrabold text-slate-900 leading-tight mt-0.5">
                  {String(stats.enrolledCoursesCount).padStart(2, '0')}
                </p>
              </div>
            </div>

            {/* Metric 2: Completed */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Completed</p>
                <p className="text-2xl font-extrabold text-slate-900 leading-tight mt-0.5">
                  {String(stats.completedCoursesCount).padStart(2, '0')}
                </p>
              </div>
            </div>

            {/* Metric 3: Learning Hours */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                <Hourglass size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Learning Hours</p>
                <p className="text-2xl font-extrabold text-slate-900 leading-tight mt-0.5">
                  {stats.learningHours} hrs
                </p>
              </div>
            </div>

            {/* Metric 4: Streak */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                <Flame size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-400">Streak</p>
                <p className="text-2xl font-extrabold text-slate-900 leading-tight mt-0.5">
                  {stats.learningStreak} Days
                </p>
              </div>
            </div>
          </div>

          {/* 5. Academic Mini Calendar Widget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            {/* Header: Date + Nav Arrows */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900">
                {monthNames[month]} {dFormat(currentMonthDate.getDate())}, {year}
              </h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                  title="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                  title="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-1.5 gap-x-1 text-center text-xs">
              {calendarDays.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center justify-center py-0.5">
                  <div
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-xs transition ${
                      item.isToday
                        ? 'bg-[#2563EB] text-white font-bold shadow-md shadow-blue-500/30'
                        : item.isCurrentMonth
                        ? 'text-slate-800 hover:bg-slate-100'
                        : 'text-slate-300'
                    }`}
                  >
                    {item.day}
                  </div>
                  {/* Real Event Marker Dot */}
                  {item.hasEvent && !item.isToday && (
                    <span className="w-1 h-1 rounded-full bg-blue-600 mt-0.5" />
                  )}
                  {item.isToday && (
                    <span className="w-1 h-1 rounded-full bg-white -mt-1 z-10" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 6. Learning Progress Widget (Multi-segment Donut Chart) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900">Learning Progress</h4>
              <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-100 transition">
                <span>Overall</span>
                <ChevronDown size={12} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* Category legends on left */}
              <div className="space-y-2 text-xs">
                {categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-slate-700 font-medium">
                      {cat.name} – {cat.percentage}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Circular multi-segment Donut SVG on right */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F1F5F9"
                    strokeWidth="12"
                  />
                  {/* Category Arc Segments */}
                  {categories.map((cat, idx) => {
                    const segmentLength = (cat.percentage / 100) * circumference;
                    const strokeDasharray = `${segmentLength.toFixed(1)} ${circumference.toFixed(1)}`;
                    const strokeDashoffset = -cumulativeOffset;
                    cumulativeOffset += segmentLength;

                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke={cat.color}
                        strokeWidth="12"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-700"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

        </div>

      </div>
    </StudentShell>
  );
}

function dFormat(n: number): string {
  return String(n).padStart(2, '0');
}
