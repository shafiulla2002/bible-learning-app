'use client';

import React from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  FileCheck2,
  Users,
  Radio,
  BookOpen,
  PlusCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
  Layers,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherAuth } from '@/lib/use-teacher-auth';

export default function TeacherDashboardPage() {
  const { teacher, institute, stats } = useTeacherAuth({ requireAuth: false });

  const teacherName = teacher?.fullName || 'Faculty Instructor';
  const instituteName = institute?.name || 'Grace Bible Institute';
  const specialization = teacher?.specialization || 'Theology & Biblical Studies';
  const employeeCode = teacher?.employeeCode || 'FACULTY';

  return (
    <TeacherShell>
      <div className="space-y-6">
        
        {/* Welcome Hero Banner matching Learnify/Student blue aesthetic */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-[#1E293B] to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-md border border-white/10">
                <Sparkles size={13} className="text-blue-400" />
                <span>{instituteName} • Faculty Dashboard</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Welcome back, {teacherName}! 👋
              </h1>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                {specialization} • ID: <span className="text-white font-mono font-semibold">{employeeCode}</span>.
                Manage your assigned cohorts, record lecture attendance, and track student theological coursework.
              </p>
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
                <PlusCircle size={16} />
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

        {/* Foundation Stat Cards - Powered strictly by live API stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Assigned Batches
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.assignedBatchesCount}
              </h3>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Active Teaching Cohorts</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers size={22} />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Assigned Students
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.assignedStudentsCount}
              </h3>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">Enrolled Across Batches</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users size={22} />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Instructing Courses
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.assignedCoursesCount}
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-0.5">Curriculum Modules</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen size={22} />
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Faculty Status
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-lg font-extrabold text-slate-900">
                  {teacher?.status || 'ACTIVE'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Verified Profile</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
          </div>
        </div>

        {/* Phase 2 Feature Containers (Foundational Placeholders) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Pane: Today's Schedule & Quick Attendance */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Today&apos;s Teaching Schedule
                  </h2>
                  <p className="text-xs text-slate-500">
                    Live lecture sessions and cohort timetable for today
                  </p>
                </div>
                <Link
                  href="/teacher/timetable"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>View Timetable</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {/* Placeholder container for Phase 2 dynamic calendar queries */}
              <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                  <Clock size={20} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  Daily Class Schedule Connected
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Real-time lecture schedules, room links, and batch attendance triggers will appear here in Phase 2.
                </p>
                <div className="pt-2">
                  <Link
                    href="/teacher/attendance"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <CalendarCheck size={14} className="text-blue-600" />
                    <span>Open Attendance Register</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Assignments & Grading Container */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    Submissions Awaiting Grading
                  </h2>
                  <p className="text-xs text-slate-500">
                    Pending student theological essays, exegesis papers, and exam results
                  </p>
                </div>
                <Link
                  href="/teacher/assignments"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>All Assignments</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                  <FileCheck2 size={20} />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  Grading Queue Ready
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Incoming student submissions awaiting faculty review will be listed here with one-click evaluation in Phase 2 & 5.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Active Cohorts & Faculty Resources */}
          <div className="space-y-6">
            
            {/* Assigned Cohorts Box */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  My Assigned Batches
                </h3>
                <Link
                  href="/teacher/batches"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">Biblical Studies Cohort</p>
                    <p className="text-[10px] text-slate-500 font-medium">Morning Session • 2026</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                    Lead Faculty
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">Church History Cohort</p>
                    <p className="text-[10px] text-slate-500 font-medium">Evening Session • 2026</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    Faculty
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Faculty Quick Access
              </h3>
              <div className="space-y-1.5 text-xs font-semibold">
                <Link
                  href="/teacher/batches"
                  className="flex items-center justify-between p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Layers size={15} className="text-slate-400" />
                    <span>My Batches</span>
                  </span>
                  <ArrowRight size={13} className="text-slate-400" />
                </Link>
                <Link
                  href="/teacher/students"
                  className="flex items-center justify-between p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Users size={15} className="text-slate-400" />
                    <span>My Students Roster</span>
                  </span>
                  <ArrowRight size={13} className="text-slate-400" />
                </Link>
                <Link
                  href="/teacher/classes"
                  className="flex items-center justify-between p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <Radio size={15} className="text-slate-400" />
                    <span>Live Classes</span>
                  </span>
                  <ArrowRight size={13} className="text-slate-400" />
                </Link>
                <Link
                  href="/teacher/profile"
                  className="flex items-center justify-between p-2.5 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition"
                >
                  <span className="flex items-center gap-2.5">
                    <ShieldCheck size={15} className="text-slate-400" />
                    <span>Faculty Profile & Bio</span>
                  </span>
                  <ArrowRight size={13} className="text-slate-400" />
                </Link>
              </div>
            </div>

          </div>
        </div>

      </div>
    </TeacherShell>
  );
}
