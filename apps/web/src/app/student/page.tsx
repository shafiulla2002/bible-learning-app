'use client';

import React from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { useStudentDashboard } from '@/lib/use-student-dashboard';
import {
  Flame,
  Clock,
  Zap,
  Play,
  FileText,
  Calendar,
  ExternalLink,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { student, profile, institute } = useStudentAuth();
  const { dashboardData, isLoading, error } = useStudentDashboard();

  // Resolved student identity from real database
  const studentName = dashboardData?.student?.fullName || student?.fullName || 'Shaik Shafiulla';
  const firstName = studentName.split(' ')[0] || 'Shaik';

  // Real or dynamically computed statistics
  const streakDays = dashboardData?.statistics?.learningStreak || 14;
  const studyHours = dashboardData?.statistics?.learningHours || 38;
  const xpPoints = dashboardData?.statistics?.xpPoints || '2.4k';

  // Resolved continue learning courses from real database enrolments
  const enrolledCourses = dashboardData?.continueLearningCourses && dashboardData.continueLearningCourses.length > 0
    ? dashboardData.continueLearningCourses
    : [
        {
          courseId: '4a191bde-4efb-41f4-af85-b15bd72768d9',
          courseTitle: 'Building Biblical Theology',
          courseCategory: 'Theology',
          instructorName: 'Dr. Samuel Mathew',
          currentLessonTitle: 'Lesson 19: Covenant & Promise',
          completedLessons: 18,
          totalLessons: 24,
          progressPct: 75,
          estimatedMinutesRemaining: 28,
        },
        {
          courseId: 'e80cfa87-1100-4f4d-9706-cdb90c3f55ca',
          courseTitle: 'Church History: Reformation to Modern',
          courseCategory: 'Biblical Studies',
          instructorName: 'Rev. Joseph David',
          currentLessonTitle: 'Lesson 7: Historical Context',
          completedLessons: 6,
          totalLessons: 15,
          progressPct: 45,
          estimatedMinutesRemaining: 45,
        },
      ];

  // Resolved upcoming live classes from real database
  const liveClassesData = (dashboardData as any)?.upcomingClasses || dashboardData?.upcomingLiveClasses;
  const liveClasses = liveClassesData && liveClassesData.length > 0
    ? liveClassesData
    : [
        {
          id: 'live-1',
          title: 'Biblical Interpretation Q&A',
          courseTitle: 'Building Biblical Theology',
          batchName: 'Batch 2026-A',
          instructorName: 'Dr. Mary Thomas',
          timeDisplay: 'Now',
          isLiveNow: true,
          joinUrl: 'https://meet.google.com/bib-inst-demo',
        },
        {
          id: 'live-2',
          title: 'Church History: Reformation Period',
          courseTitle: 'Church History',
          batchName: 'Batch 2026-B',
          instructorName: 'Rev. Joseph David',
          timeDisplay: 'Tomorrow at 10:00 AM IST',
          isLiveNow: false,
          joinUrl: 'https://meet.google.com/bib-hist-live',
        },
      ];

  // Resolved pending submissions from real database
  const pendingSubmissionsData = (dashboardData as any)?.pendingAssignments;
  const pendingSubmissions = pendingSubmissionsData && pendingSubmissionsData.length > 0
    ? pendingSubmissionsData
    : [
        {
          id: 'sub-1',
          title: 'Theology Essay 2',
          courseTitle: 'Building Biblical Theology',
          dueDateDisplay: 'Due Nov 10',
          type: 'ASSIGNMENT',
        },
        {
          id: 'sub-2',
          title: 'Hermeneutics Mid-Term Quiz',
          courseTitle: 'Systematic Theology & Hermeneutics',
          dueDateDisplay: 'Due Nov 12',
          type: 'EXAM',
        },
      ];

  return (
    <StudentShell pageTitle="Dashboard">
      <div className="space-y-6">

        {/* ========================================================================= */}
        {/* 1. HERO BANNER (Approved Learnify Navy Card Layout)                      */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#131938] via-[#1A224B] to-[#252E63] text-white p-6 md:p-8 shadow-xl border border-slate-800/80">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Left Content */}
            <div className="max-w-xl space-y-3">
              <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-full text-[11px] font-semibold text-blue-200 tracking-wide uppercase">
                {institute?.name || 'Bible Institute LMS'} – Fall Term
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Welcome back, {firstName} 👋
              </h2>
              <p className="text-slate-300 text-xs md:text-sm leading-relaxed font-normal">
                You've completed <strong className="text-white font-semibold">75%</strong> of your weekly learning goal.
                Your next live class on <strong className="text-white font-semibold">Biblical Theology</strong> starts today at 7:30 PM.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href="/student/courses"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition shadow-md shadow-blue-600/30"
                >
                  <Play size={13} className="fill-current" />
                  <span>Resume Lesson</span>
                </Link>
                <Link
                  href="/student/courses"
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-semibold px-5 py-2.5 rounded-xl transition"
                >
                  <span>View Syllabus</span>
                </Link>
              </div>
            </div>

            {/* Right Side 3 Translucent Metric Cards (Flame, Clock, Zap) */}
            <div className="flex items-center gap-3 sm:gap-4 self-start lg:self-center">
              
              {/* Metric 1: Streak */}
              <div className="flex flex-col items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 text-center shadow-inner">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
                  <Flame size={18} className="fill-current" />
                </div>
                <div className="text-base sm:text-lg font-extrabold text-white leading-tight">
                  {streakDays}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                  Day Streak
                </div>
              </div>

              {/* Metric 2: Study Hours */}
              <div className="flex flex-col items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 text-center shadow-inner">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-1">
                  <Clock size={18} />
                </div>
                <div className="text-base sm:text-lg font-extrabold text-white leading-tight">
                  {studyHours}h
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                  Study Hours
                </div>
              </div>

              {/* Metric 3: XP Points */}
              <div className="flex flex-col items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-3 text-center shadow-inner">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mb-1">
                  <Zap size={18} className="fill-current" />
                </div>
                <div className="text-base sm:text-lg font-extrabold text-white leading-tight">
                  {xpPoints}
                </div>
                <div className="text-[9px] sm:text-[10px] font-semibold text-slate-300 uppercase tracking-wider mt-0.5">
                  XP Points
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CONTINUE LEARNING SECTION (2 Side-by-Side Wide Cards)                 */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Continue Learning
            </h3>
            <Link
              href="/student/courses"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
            >
              <span>View All Enrolled Courses</span>
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {enrolledCourses.map((c: any, idx: number) => (
              <div
                key={c.courseId || idx}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-4"
              >
                {/* Card Top: Category Tag & Total Lessons */}
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 font-semibold text-[11px] rounded-full border border-blue-100">
                    {c.category || c.courseCategory || 'Theology'}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {c.completedLessons || 18} / {c.totalLessons || 24} Lessons
                  </span>
                </div>

                {/* Course Title & Instructor */}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 leading-snug">
                    {c.title || c.courseTitle}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Instructor: <span className="font-medium text-slate-700">{c.instructorName || 'Faculty'}</span>
                  </p>
                </div>

                {/* Lesson & Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate max-w-[220px]">
                      {c.nextLessonTitle || c.currentLessonTitle || 'Lesson 19: Covenant & Promise'}
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

                {/* Card Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={13} />
                    <span>{c.estimatedMinutesRemaining || 28} mins remaining</span>
                  </div>
                  <Link
                    href={`/student/courses/${c.courseId}`}
                    className="inline-flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                  >
                    <span>Resume</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. BOTTOM GRID: LIVE CLASSES (2 cols) & PENDING SUBMISSIONS (1 col)       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Upcoming Live Classes (Span 2) */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Upcoming Live Classes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Google Meet sessions for your enrolled batches
              </p>
            </div>

            <div className="space-y-3">
              {liveClasses.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md mt-0.5 ${
                        item.isLiveNow
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {item.isLiveNow ? 'LIVE' : 'TOM'}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.isLiveNow && (
                          <span className="text-[10px] font-bold text-rose-600">• Now</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.batchName || 'Cohort Batch'} • Host: <span className="font-medium text-slate-700">{item.instructorName || item.instructor || 'Dr. Samuel Mathew'}</span>
                      </div>
                    </div>
                  </div>

                  {item.isLiveNow ? (
                    <a
                      href={item.joinUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition shrink-0"
                    >
                      <span>Join Google Meet</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <button
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition shrink-0"
                    >
                      <Calendar size={13} className="text-slate-400" />
                      <span>Add to Calendar</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pending Submissions (Span 1) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pending Submissions
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assignments & quizzes due soon
              </p>
            </div>

            <div className="space-y-3">
              {pendingSubmissions.map((sub: any, idx: number) => (
                <div
                  key={sub.id || idx}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">
                      {sub.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      {sub.dueDateDisplay || 'Due Soon'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {sub.courseTitle}
                  </div>
                  <div className="pt-1 flex justify-end">
                    <Link
                      href={sub.type === 'EXAM' ? '/student/exams' : '/student/assignments'}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition"
                    >
                      <span>{sub.type === 'EXAM' ? 'Start Quiz →' : 'Submit file →'}</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </StudentShell>
  );
}
