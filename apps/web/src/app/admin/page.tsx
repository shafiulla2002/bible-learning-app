'use client';

import React from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CreditCard,
  Settings,
  Download,
  Plus,
  TrendingUp,
  CalendarCheck,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

export default function AdminDashboardPage() {
  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-8">
        {/* Header with Title and Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Institute Administration
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Oversee enrollment numbers, faculty assignments, courses, and financial health.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download size={14} />
              Export Report
            </Button>
            <Button variant="primary" size="sm" className="gap-1.5">
              <Plus size={14} />
              New Course
            </Button>
          </div>
        </div>

        {/* 4 Stat Cards (UStudy Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Students"
            value="342"
            icon={<Users size={20} />}
            trend="+12.4% this month"
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Active Courses"
            value="16"
            icon={<BookOpen size={20} />}
            trend="4 in draft"
            trendPositive={true}
            colorScheme="purple"
          />
          <StatCard
            title="Total Revenue"
            value="₹4,85,000"
            icon={<CreditCard size={20} />}
            trend="+18.5% YoY"
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Pending Fees"
            value="₹42,500"
            icon={<TrendingUp size={20} />}
            trend="4 accounts"
            trendPositive={false}
            colorScheme="amber"
          />
        </div>

        {/* Student Enrolment Directory Table (from prototype data) */}
        <Card>
          <CardHeader
            title="Recent Student Admissions & Enrolments"
            subtitle="Admissions requiring approval and active enrollments"
            action={
              <Button size="sm" variant="outline">
                View All Students
              </Button>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 px-2">Student Name</th>
                  <th className="pb-3 px-2">Enrolled Course</th>
                  <th className="pb-3 px-2">Admission Date</th>
                  <th className="pb-3 px-2">Status</th>
                  <th className="pb-3 px-2">Fee Paid</th>
                  <th className="pb-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                <tr className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                        GT
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">Grace Thomas</div>
                        <div className="text-[10px] text-slate-400">grace.thomas@example.com</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium">Biblical Theology</td>
                  <td className="py-3 px-2 text-slate-500">Oct 12, 2026</td>
                  <td className="py-3 px-2">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="py-3 px-2 font-semibold text-slate-900">₹18,500</td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="ghost" className="text-xs">
                      Review
                    </Button>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                        DJ
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">Daniel Joseph</div>
                        <div className="text-[10px] text-slate-400">daniel.j@example.com</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium">Church History</td>
                  <td className="py-3 px-2 text-slate-500">Oct 10, 2026</td>
                  <td className="py-3 px-2">
                    <Badge variant="success">Active</Badge>
                  </td>
                  <td className="py-3 px-2 font-semibold text-slate-900">₹16,000</td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="ghost" className="text-xs">
                      Review
                    </Button>
                  </td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xs">
                        EW
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">Esther Williams</div>
                        <div className="text-[10px] text-slate-400">esther.w@example.com</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium">Pastoral Leadership</td>
                  <td className="py-3 px-2 text-slate-500">Oct 08, 2026</td>
                  <td className="py-3 px-2">
                    <Badge variant="warning">Under Review</Badge>
                  </td>
                  <td className="py-3 px-2 font-semibold text-slate-900">Pending</td>
                  <td className="py-3 px-2 text-right">
                    <Button size="sm" variant="primary" className="text-xs px-2.5 py-1">
                      Approve
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PortalShell>
  );
}
