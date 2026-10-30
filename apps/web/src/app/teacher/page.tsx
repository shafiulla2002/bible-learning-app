'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  CalendarCheck,
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  FileCheck2,
  Bell,
  PlusCircle,
  CheckCircle2,
  UploadCloud,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

const teacherNav = [
  { label: 'Dashboard', href: '/teacher', icon: <LayoutDashboard size={18} /> },
  { label: 'Assigned Courses', href: '/teacher/courses', icon: <BookOpen size={18} /> },
  { label: 'Attendance', href: '/teacher/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'My Students', href: '/teacher/students', icon: <Users size={18} /> },
  { label: 'Live Sessions', href: '/teacher/classes', icon: <Calendar size={18} /> },
  { label: 'Grading & Submissions', href: '/teacher/grading', icon: <FileCheck2 size={18} />, badge: '6 New' },
  { label: 'Announcements', href: '/teacher/announcements', icon: <Bell size={18} /> },
];

export default function TeacherDashboardPage() {
  return (
    <PortalShell
      portalTitle="Teacher Portal"
      portalRole="TEACHER"
      navItems={teacherNav}
      userName="Dr. Samuel Mathew"
      userRoleLabel="Lead Faculty"
      theme="dark"
    >
      <div className="space-y-8">
        {/* Welcome & Quick Action Header (EduFlow Style) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome Back, Dr. Samuel
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Here is what is happening with your Bible courses and student submissions today.
            </p>
          </div>

          {/* Quick Action Tiles */}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" className="gap-1.5">
              <PlusCircle size={15} />
              Create Assignment
            </Button>
            <Link href="/teacher/attendance">
              <Button variant="outline" size="sm" className="gap-1.5">
                <CheckCircle2 size={15} />
                Mark Attendance
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="gap-1.5">
              <UploadCloud size={15} />
              Upload Material
            </Button>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Classes"
            value="12"
            icon={<BookOpen size={20} />}
            trend="+2 This Term"
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Total Students"
            value="186"
            icon={<Users size={20} />}
            trend="+18 Enrolled"
            trendPositive={true}
            colorScheme="purple"
          />
          <StatCard
            title="Pending Submissions"
            value="24"
            icon={<FileCheck2 size={20} />}
            trend="Needs Grading"
            trendPositive={false}
            colorScheme="amber"
          />
          <StatCard
            title="Attendance Rate"
            value="94%"
            icon={<Calendar size={20} />}
            trend="+3.2% vs last term"
            trendPositive={true}
            colorScheme="emerald"
          />
        </div>

        {/* Main 2-Column Area: Recent Activity & Upcoming Classes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Submissions Queue */}
          <Card>
            <CardHeader
              title="Recent Submissions"
              subtitle="Student assignments awaiting your review and grading"
              action={
                <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                  View All
                </span>
              }
            />
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    GT
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Grace Thomas</h5>
                    <p className="text-[11px] text-slate-500">Theology Essay 2 · Submitted 1h ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">To Grade</Badge>
                  <Button size="sm" variant="outline" className="text-xs px-2.5 py-1">
                    Grade
                  </Button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    DJ
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Daniel Joseph</h5>
                    <p className="text-[11px] text-slate-500">Church History Timeline · Submitted 3h ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">To Grade</Badge>
                  <Button size="sm" variant="outline" className="text-xs px-2.5 py-1">
                    Grade
                  </Button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                    EW
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">Esther Williams</h5>
                    <p className="text-[11px] text-slate-500">Hermeneutics Reflection · Graded</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">92 / 100</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* Upcoming Live Sessions to Host */}
          <Card>
            <CardHeader
              title="Today's Teaching Schedule"
              subtitle="Scheduled Google Meet classes"
              action={
                <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                  Schedule Class
                </span>
              }
            />
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center font-bold">
                    <span className="text-xs">07:30</span>
                    <span className="text-[9px] font-normal uppercase">PM</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-slate-900">
                        Biblical Interpretation Q&A
                      </h5>
                      <Badge variant="live">Starting in 20m</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Batch 2026-A · 32 Students Enrolled
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="primary">
                  Start Meet
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex flex-col items-center justify-center font-bold">
                    <span className="text-xs">10:00</span>
                    <span className="text-[9px] font-normal uppercase">AM</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900">
                      Foundations of Bible Study
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tomorrow · Batch 2026-B · 45 Students
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Prepare Notes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
