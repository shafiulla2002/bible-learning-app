'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { useStudentDashboard } from '@/lib/use-student-dashboard';
import {
  Users,
  CheckCircle2,
  Hourglass,
  Flame,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  Video,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { student } = useStudentAuth({ requireAuth: true, redirectTo: '/login' });
  const { dashboardData, isLoading } = useStudentDashboard();

  // Resolved student identity from database
  const studentFullName = dashboardData?.student?.fullName || student?.fullName || 'Student';
  const firstName = studentFullName.split(' ')[0] || 'Student';

  // Resolved statistics from database
  const enrolledCount = dashboardData?.statistics?.enrolledCoursesCount ?? 0;
  const completedCount = dashboardData?.statistics?.completedCoursesCount ?? 0;
  const learningHours = dashboardData?.statistics?.learningHours ?? 0;
  const streakDays = dashboardData?.statistics?.learningStreak ?? 0;
  const xpPoints = dashboardData?.statistics?.xpPoints ?? '0';

  // Calendar widget state
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 10, 6)); // Nov 6, 2026

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: Array<{ day: number; isCurrentMonth: boolean; isToday?: boolean; hasEvent?: boolean }> = [];

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === 6 && month === 10 && year === 2026;
    const hasEvent = d === 6 || d === 8 || d === 10 || d === 12 || d === 18 || d === 25;
    calendarDays.push({ day: d, isCurrentMonth: true, isToday, hasEvent });
  }

  // Next month leading days
  const remaining = 35 - calendarDays.length;
  for (let i = 1; i <= (remaining > 0 ? remaining : 42 - calendarDays.length); i++) {
    calendarDays.push({ day: i, isCurrentMonth: false });
  }

  // Resolved courses from API
  const continueLearningCourses = dashboardData?.continueLearningCourses || [];

  // Resolved live classes from API
  const liveClassesData = (dashboardData as any)?.upcomingClasses || dashboardData?.upcomingLiveClasses;
  const liveClasses = liveClassesData || [];

  return (
    <StudentShell pageTitle="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN (8 columns out of 12)                                        */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. Main Welcome Dark Banner (Approved Learnify Style) */}
          <div className="relative overflow-hidden rounded-3xl bg-[#090D1A] text-white p-6 md:p-8 shadow-xl border border-slate-800">
            {/* Background subtle curved waves */}
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
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-medium mb-3 backdrop-blur-xs">
                  <Sparkles size={12} className="text-blue-300" />
                  <span>Bible Institute LMS</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Welcome back, {firstName} 👋
                </h2>
                <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed font-normal">
                  Continue your spiritual learning journey and grow in your understanding of the Bible.
                  You've completed <strong className="text-white font-semibold">{dashboardData?.statistics?.overallProgressPct ?? 0}%</strong> of your course curriculum!
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

              {/* Right Circular Metric Rings (Streak, Hours, XP Points) */}
              <div className="flex items-center gap-4 self-center md:self-auto">
                {/* Metric 1: Streak */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="3.2"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-cyan-400"
                        strokeDasharray="92, 100"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-sm sm:text-base font-extrabold text-white">
                      {streakDays}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">Current streak</span>
                </div>

                {/* Metric 2: Learning Hours */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="3.2"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-purple-400"
                        strokeDasharray="75, 100"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-sm sm:text-base font-extrabold text-white">
                      {learningHours}h
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">Learning hours</span>
                </div>

                {/* Metric 3: XP Points */}
                <div className="flex flex-col items-center">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                      <path
                        className="text-slate-800"
                        strokeWidth="3.2"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-400"
                        strokeDasharray="80, 100"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-sm sm:text-base font-extrabold text-white">
                      {xpPoints}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">XP points</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Continue Learning Section (Cards with Real DB Data) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Continue Learning
              </h3>
              <Link
                href="/student/courses"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
              >
                <span>View My Courses</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {continueLearningCourses.slice(0, 2).map((c: any, idx: number) => (
                <div
                  key={c.courseId || idx}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 font-semibold text-[11px] rounded-full border border-blue-100">
                      {c.category || 'Theology'}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {c.completedLessons || 18} / {c.totalLessons || 24} Lessons
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {c.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Instructor: <span className="font-medium text-slate-700">{c.instructorName || 'Dr. Samuel Mathew'}</span>
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate max-w-[200px]">
                        {c.nextLessonTitle || 'Lesson 19: Covenant & Promise'}
                      </span>
                      <span className="font-bold text-blue-600">
                        {c.progressPct || 75}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${c.progressPct || 75}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <Link
                      href={`/student/courses/${c.courseId || 'c-theology'}`}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-200/80 rounded-xl text-xs font-semibold transition"
                    >
                      <Play size={12} className="fill-current" />
                      <span>Resume Lesson</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Upcoming Live Classes Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Upcoming Live Classes
              </h3>
              <Link
                href="/student/classes"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
              >
                <span>View All</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            <div className="space-y-3">
              {liveClasses.map((item: any) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.isLiveNow ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      <Video size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900">
                          {item.title}
                        </h4>
                        {item.isLiveNow && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[9px] animate-pulse">
                            LIVE NOW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.courseName} • <span className="text-slate-700 font-medium">{item.instructor}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={13} />
                      <span>{item.timeDisplay || 'Scheduled'}</span>
                    </div>
                    {item.joinUrl ? (
                      <a
                        href={item.joinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 ${
                          item.isLiveNow
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20'
                        }`}
                      >
                        <span>Join Class</span>
                      </a>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 text-slate-500">
                        Opens 15m before start
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (4 columns out of 12)                                       */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 4. Stat Cards (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            
            {/* Stat 1: Enrolled */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Enrolled</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users size={16} />
                </div>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-900">
                {format2Digit(enrolledCount)}
              </div>
            </div>

            {/* Stat 2: Completed */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Completed</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-900">
                {format2Digit(completedCount)}
              </div>
            </div>

            {/* Stat 3: Learning Hours */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Learning Hours</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Hourglass size={16} />
                </div>
              </div>
              <div className="mt-3 text-xl sm:text-2xl font-extrabold text-slate-900">
                {learningHours} hrs
              </div>
            </div>

            {/* Stat 4: Streak */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Streak</span>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Flame size={16} />
                </div>
              </div>
              <div className="mt-3 text-xl sm:text-2xl font-extrabold text-slate-900">
                {streakDays} Days
              </div>
            </div>

          </div>

          {/* 5. Interactive Monthly Calendar Widget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            {/* Calendar Header with Navigation */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {monthNames[month]} {format2Digit(calendarDate.getDate())}, {year}
              </h4>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition"
                  aria-label="Next month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400 mb-2">
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
                  {/* Event marker dot */}
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

          {/* 6. Learning Progress Donut Chart Widget */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-slate-900">Learning Progress</h4>
              <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-100 transition">
                <span>Weekly</span>
                <ChevronDown size={12} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              {/* Category legends on left */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]" />
                  <span className="text-slate-700 font-medium">Theology – 60%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#8B5CF6]" />
                  <span className="text-slate-700 font-medium">Church History – 24%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#06B6D4]" />
                  <span className="text-slate-700 font-medium">Systematic Theology – 16%</span>
                </div>
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
                  {/* Segment 1: Theology 60% (circumference ~ 251.3, 60% = 150.8) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#2563EB"
                    strokeWidth="12"
                    strokeDasharray="150.8 251.3"
                    strokeDashoffset="0"
                    className="transition-all duration-700"
                  />
                  {/* Segment 2: Church History 24% (24% = 60.3) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#8B5CF6"
                    strokeWidth="12"
                    strokeDasharray="60.3 251.3"
                    strokeDashoffset="-150.8"
                    className="transition-all duration-700"
                  />
                  {/* Segment 3: Systematic Theology 16% (16% = 40.2) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#06B6D4"
                    strokeWidth="12"
                    strokeDasharray="40.2 251.3"
                    strokeDashoffset="-211.1"
                    className="transition-all duration-700"
                  />
                </svg>
              </div>
            </div>
          </div>

        </div>

      </div>
    </StudentShell>
  );
}

function format2Digit(n: number): string {
  return String(n).padStart(2, '0');
}
