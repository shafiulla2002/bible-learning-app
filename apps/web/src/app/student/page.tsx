'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  FileCheck2,
  Award,
  CreditCard,
  Flame,
  Clock,
  Zap,
  PlayCircle,
  Video,
  CalendarCheck,
} from 'lucide-react';

const studentNav = [
  { label: 'Dashboard', href: '/student', icon: <LayoutDashboard size={18} /> },
  { label: 'My Courses', href: '/student/courses', icon: <BookOpen size={18} /> },
  { label: 'Live Classes', href: '/student/classes', icon: <Video size={18} />, badge: 'LIVE' },
  { label: 'Attendance', href: '/student/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Assignments', href: '/student/assignments', icon: <FileCheck2 size={18} /> },
  { label: 'Certificates', href: '/student/certificates', icon: <Award size={18} /> },
  { label: 'Payments & Receipts', href: '/student/payments', icon: <CreditCard size={18} /> },
];

export default function StudentDashboardPage() {
  return (
    <PortalShell
      portalTitle="Learner Portal"
      portalRole="STUDENT"
      navItems={studentNav}
      userName="Grace Thomas"
      userRoleLabel="Enrolled Student"
    >
      <div className="space-y-8">
        {/* Top Banner (Learnify Style) */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white p-6 md:p-8 relative overflow-hidden shadow-xl shadow-blue-900/10">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/20">
                Bible Institute LMS · Fall Term
              </span>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Welcome back, Grace 👋
              </h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                You've completed <strong className="text-white">72%</strong> of your weekly learning goal.
                Your next live class on <strong className="text-white">Biblical Theology</strong> starts today at 7:30 PM.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Button variant="primary" size="md">
                  Resume Lesson
                </Button>
                <Button variant="outline" size="md" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  View Syllabus
                </Button>
              </div>
            </div>

            {/* Streak & XP Metric Rings */}
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 self-start md:self-auto">
              <div className="text-center px-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-1">
                  <Flame size={24} />
                </div>
                <div className="text-xl font-bold">14</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Day Streak</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center px-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-1">
                  <Clock size={24} />
                </div>
                <div className="text-xl font-bold">38h</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Study Hours</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center px-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-1">
                  <Zap size={24} />
                </div>
                <div className="text-xl font-bold">2.4k</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">XP Points</div>
              </div>
            </div>
          </div>
        </div>

        {/* Continue Learning Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Continue Learning</h3>
            <span className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
              View All Enrolled Courses
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course Card 1 */}
            <Card className="flex flex-col justify-between hover:border-blue-200">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="primary">Theology</Badge>
                  <span className="text-xs font-semibold text-slate-500">18 / 24 Lessons</span>
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Building Biblical Theology
                </h4>
                <p className="text-xs text-slate-500 mt-1">Instructor: Dr. Samuel Mathew</p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                    <span>Lesson 19: Covenant & Promise</span>
                    <span className="font-semibold text-blue-600">75%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: '75%' }} />
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <PlayCircle size={16} className="text-blue-600" />
                  <span>28 mins remaining</span>
                </div>
                <Button size="sm" variant="primary">
                  Resume
                </Button>
              </div>
            </Card>

            {/* Course Card 2 */}
            <Card className="flex flex-col justify-between hover:border-blue-200">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="info">Biblical Studies</Badge>
                  <span className="text-xs font-semibold text-slate-500">6 / 16 Lessons</span>
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Hermeneutics & Exegesis
                </h4>
                <p className="text-xs text-slate-500 mt-1">Instructor: Dr. Mary Thomas</p>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                    <span>Lesson 7: Historical Context</span>
                    <span className="font-semibold text-sky-600">38%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-sky-500 h-full rounded-full transition-all duration-500" style={{ width: '38%' }} />
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <PlayCircle size={16} className="text-sky-600" />
                  <span>45 mins remaining</span>
                </div>
                <Button size="sm" variant="outline">
                  Resume
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Live Classes & Deadlines Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Live Classes */}
          <Card className="lg:col-span-2">
            <CardHeader
              title="Upcoming Live Classes"
              subtitle="Google Meet sessions for your enrolled batches"
            />
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    LIVE
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-slate-900">
                        Biblical Interpretation Q&A
                      </h5>
                      <Badge variant="live">Now</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Batch 2026-A · Host: Dr. Mary Thomas
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="primary" className="shrink-0 bg-blue-600">
                  Join Google Meet
                </Button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs shrink-0">
                    TOM
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      Church History: Reformation Period
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tomorrow at 10:00 AM IST · Rev. Joseph David
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0">
                  Add to Calendar
                </Button>
              </div>
            </div>
          </Card>

          {/* Pending Submissions */}
          <Card>
            <CardHeader
              title="Pending Submissions"
              subtitle="Assignments due soon"
            />
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-800">Theology Essay 2</span>
                  <Badge variant="warning">Due Nov 3</Badge>
                </div>
                <p className="text-[11px] text-slate-500">Building Biblical Theology</p>
                <div className="mt-2 text-right">
                  <span className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                    Submit file →
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-800">Mid-Term Quiz</span>
                  <Badge variant="info">30 mins</Badge>
                </div>
                <p className="text-[11px] text-slate-500">Hermeneutics</p>
                <div className="mt-2 text-right">
                  <span className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">
                    Start Quiz →
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
