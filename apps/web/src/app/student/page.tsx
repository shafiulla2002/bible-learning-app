'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
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
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { student, profile, institute, activeEnrolmentCount, isLoading } = useStudentAuth();
  const firstName = student?.fullName ? student.fullName.split(' ')[0] : 'Grace';

  // Calendar state for the mini calendar widget
  const currentDate = new Date();
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2026, 10, 5)); // Nov 2026 matching local app time

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

  // Generate days for the mini calendar
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
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
    const isToday = d === 5 && month === 10 && year === 2026;
    const hasEvent = d === 5 || d === 8 || d === 12 || d === 18 || d === 25;
    calendarDays.push({ day: d, isCurrentMonth: true, isToday, hasEvent });
  }

  // Next month leading days to complete grid
  const remaining = 35 - calendarDays.length;
  for (let i = 1; i <= (remaining > 0 ? remaining : 42 - calendarDays.length); i++) {
    calendarDays.push({ day: i, isCurrentMonth: false });
  }

  return (
    <StudentShell pageTitle="Dashboard">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN (approx 65% width: 8 columns) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. Main Welcome Banner (Dark SaaS Mesh with Metric Badges) */}
          <div className="relative overflow-hidden rounded-3xl bg-[#090D1A] text-white p-6 md:p-8 shadow-xl border border-slate-800">
            {/* Background decorative curved lines matching reference */}
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
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                  Welcome back, {firstName} 👋
                </h2>
                <p className="text-slate-300 text-xs md:text-sm mt-2 leading-relaxed font-normal">
                  Continue your spiritual learning journey and grow in your understanding of the Bible.
                  You've completed <strong className="text-white font-semibold">85%</strong> of your weekly goal!
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
                    <span className="text-sm font-bold text-white leading-none">14</span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium mt-1.5 whitespace-nowrap">Current streak</span>
                </div>

                {/* Metric Ring 2: Hours */}
                <div className="flex flex-col items-center">
                  <div className="w-13 h-13 rounded-full border-2 border-purple-400/80 bg-purple-950/30 flex items-center justify-center p-2 text-center shadow-sm">
                    <span className="text-sm font-bold text-white leading-none">38h</span>
                  </div>
                  <span className="text-[10px] text-slate-300 font-medium mt-1.5 whitespace-nowrap">Learning hours</span>
                </div>

                {/* Metric Ring 3: Points / XP */}
                <div className="flex flex-col items-center">
                  <div className="w-13 h-13 rounded-full border-2 border-teal-400/80 bg-teal-950/30 flex items-center justify-center p-2 text-center shadow-sm">
                    <span className="text-sm font-bold text-white leading-none">2.4K</span>
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

            <div className="space-y-3.5">
              {/* Horizontal Course Card 1 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-blue-200 hover:shadow-md transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-16 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white shrink-0 shadow-sm relative overflow-hidden">
                    <BookOpen size={24} className="text-blue-200" />
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-black/40 px-1 py-0.5 rounded text-white/90">
                      BIB-101
                    </span>
                  </div>
                  {/* Details */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      Theology
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      Introduction to Biblical Studies
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">16/20 Lessons Completed</p>
                    {/* Progress bar */}
                    <div className="mt-2 w-48 sm:w-60 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#2563EB] h-full rounded-full transition-all duration-500" style={{ width: '80%' }} />
                    </div>
                  </div>
                </div>

                {/* Action button & Percentage on right */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <Link
                    href="/student/courses"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-1.5 text-xs font-semibold transition"
                  >
                    <span>Resume Lesson</span>
                  </Link>
                  <span className="text-xs font-medium text-slate-500">80% Complete</span>
                </div>
              </div>

              {/* Horizontal Course Card 2 */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-blue-200 hover:shadow-md transition duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-16 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-900 flex items-center justify-center text-white shrink-0 shadow-sm relative overflow-hidden">
                    <BookOpen size={24} className="text-teal-200" />
                    <span className="absolute bottom-1 right-1 text-[8px] font-bold bg-black/40 px-1 py-0.5 rounded text-white/90">
                      HERM-201
                    </span>
                  </div>
                  {/* Details */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                      Hermeneutics
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      Hermeneutics and Biblical Interpretation
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">30/60 Lessons Completed</p>
                    {/* Progress bar */}
                    <div className="mt-2 w-48 sm:w-60 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#2563EB] h-full rounded-full transition-all duration-500" style={{ width: '50%' }} />
                    </div>
                  </div>
                </div>

                {/* Action button & Percentage on right */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <Link
                    href="/student/courses"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-1.5 text-xs font-semibold transition"
                  >
                    <span>Resume Lesson</span>
                  </Link>
                  <span className="text-xs font-medium text-slate-500">50% Complete</span>
                </div>
              </div>
            </div>
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
                    {/* Row 1: Live Now */}
                    <tr className="hover:bg-blue-50/40 transition">
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        Biblical Interpretation & Exegesis
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        Dr. Sarah Jenkins
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          LIVE
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <a
                          href="https://meet.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold text-xs px-4 py-1.5 rounded-full shadow-sm transition"
                        >
                          Join Now
                        </a>
                      </td>
                    </tr>

                    {/* Row 2: Upcoming */}
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        Covenantal Theology Seminar
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        Dr. David Chan
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        02:30 PM
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => alert('Reminder set for 02:30 PM session')}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 px-3.5 py-1.5 text-xs font-semibold transition"
                        >
                          Set Reminder
                        </button>
                      </td>
                    </tr>

                    {/* Row 3: Tomorrow */}
                    <tr className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        Church History: The Early Fathers
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        Prof. Emily Watson
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-600">
                        Tomorrow
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => alert('Reminder set for tomorrow session')}
                          className="inline-flex items-center gap-1 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 px-3.5 py-1.5 text-xs font-semibold transition"
                        >
                          Set Reminder
                        </button>
                      </td>
                    </tr>
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
                  {String(activeEnrolmentCount || 24).padStart(2, '0')}
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
                  06
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
                  45 hrs
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
                  7 Days
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

          {/* 6. Learning Progress Widget (Multi-segment Donut Chart) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
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
                  <span className="text-slate-700 font-medium">Pastoral Care – 16%</span>
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
                  {/* Segment 3: Pastoral Care 16% (16% = 40.2) */}
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

function dFormat(n: number): string {
  return String(n).padStart(2, '0');
}
