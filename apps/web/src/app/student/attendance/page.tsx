'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Award,
  Video,
  FileCheck2,
  BookOpen,
  LayoutDashboard,
  CreditCard,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { StudentShell } from '@/components/layout/student-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { attendanceApi } from '@/lib/api';

const studentNav = [
  { label: 'Dashboard', href: '/student', icon: <LayoutDashboard size={18} /> },
  { label: 'My Courses', href: '/student/courses', icon: <BookOpen size={18} /> },
  { label: 'Live Classes', href: '/student/classes', icon: <Video size={18} />, badge: 'LIVE' },
  { label: 'Attendance', href: '/student/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Assignments', href: '/student/assignments', icon: <FileCheck2 size={18} /> },
  { label: 'Certificates', href: '/student/certificates', icon: <Award size={18} /> },
  { label: 'Payments & Receipts', href: '/student/payments', icon: <CreditCard size={18} /> },
];

interface StudentAttendanceData {
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
  };
  summary: {
    totalSessions: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    attendancePercentage: number | null;
  };
  monthlySummary: Array<{
    month: string;
    present: number;
    late: number;
    absent: number;
    excused: number;
    percentage: number | null;
  }>;
  records: Array<{
    id: string;
    batchName: string;
    date: string;
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
    mode: string;
    remarks?: string;
    sessionTitle?: string;
  }>;
}

const mockStudentAttendance: StudentAttendanceData = {
  student: {
    id: 'sp-grace',
    admissionNo: 'ADM-2026-088',
    fullName: 'Grace Thomas',
  },
  summary: {
    totalSessions: 32,
    presentCount: 28,
    lateCount: 2,
    absentCount: 1,
    excusedCount: 1,
    attendancePercentage: 97,
  },
  monthlySummary: [
    {
      month: '2026-10',
      present: 15,
      late: 1,
      absent: 0,
      excused: 1,
      percentage: 100,
    },
    {
      month: '2026-09',
      present: 13,
      late: 1,
      absent: 1,
      excused: 0,
      percentage: 93,
    },
  ],
  records: [
    {
      id: 'r-1',
      batchName: 'Diploma Cohort Alpha 2026',
      date: '2026-10-30',
      status: 'PRESENT',
      mode: 'DAILY_BATCH',
      remarks: 'Present & active in group discussion',
    },
    {
      id: 'r-2',
      batchName: 'Diploma Cohort Alpha 2026',
      date: '2026-10-29',
      status: 'PRESENT',
      mode: 'LIVE_SESSION',
      sessionTitle: 'Biblical Exegesis Live Seminar',
      remarks: 'Full session attended',
    },
    {
      id: 'r-3',
      batchName: 'Diploma Cohort Alpha 2026',
      date: '2026-10-25',
      status: 'EXCUSED',
      mode: 'DAILY_BATCH',
      remarks: 'Approved family commitment',
    },
    {
      id: 'r-4',
      batchName: 'Diploma Cohort Alpha 2026',
      date: '2026-10-22',
      status: 'LATE',
      mode: 'DAILY_BATCH',
      remarks: 'Joined 8 mins into lecture',
    },
    {
      id: 'r-5',
      batchName: 'Diploma Cohort Alpha 2026',
      date: '2026-09-15',
      status: 'ABSENT',
      mode: 'DAILY_BATCH',
      remarks: 'Unreported absence',
    },
  ],
};

export default function StudentAttendancePage() {
  const [data, setData] = useState<StudentAttendanceData>(mockStudentAttendance);
  const [filterMonth, setFilterMonth] = useState<string>('ALL');

  useEffect(() => {
    // Attempt real student attendance fetch
    const fetchStudentAttendance = async () => {
      try {
        const storedInst = typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') : null;
        const storedProfile = typeof window !== 'undefined' ? localStorage.getItem('current_student_profile_id') : null;
        const instId = storedInst || 'inst-default';
        const profileId = storedProfile || 'sp-grace';

        const res = await attendanceApi.getStudentHistory(instId, profileId);
        if (res?.summary) {
          setData(res as StudentAttendanceData);
        }
      } catch {
        // Keep mock fallback
      }
    };
    fetchStudentAttendance();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <Badge variant="success">Present</Badge>;
      case 'LATE':
        return <Badge variant="warning">Late</Badge>;
      case 'ABSENT':
        return <Badge variant="danger">Absent</Badge>;
      case 'EXCUSED':
        return <Badge variant="info">Excused</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const filteredRecords = data.records.filter((r) => {
    if (filterMonth === 'ALL') return true;
    return r.date.startsWith(filterMonth);
  });

  const pct = data.summary.attendancePercentage;

  return (
    <StudentShell pageTitle="Attendance & Participation">
      <div className="space-y-8 pb-12">
        {/* Banner with Progress Metric */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-6 md:p-8 relative overflow-hidden shadow-xl shadow-indigo-950/20">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/20">
                Biblical Studies · Attendance Tracking
              </span>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                My Attendance History
              </h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Track your class participation, live lecture check-ins, and leave approvals. Maintain at least <strong>75%</strong> attendance to qualify for graduation certifications.
              </p>
            </div>

            {/* Overall Attendance Card Widget */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-center min-w-[200px]">
              <div className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Overall Rate
              </div>
              <div className="text-4xl font-extrabold mt-1 text-white">
                {pct !== null ? `${pct}%` : 'N/A'}
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <CheckCircle2 size={12} />
                {pct !== null && pct >= 75 ? 'Good Standing' : pct === null ? 'No Sessions' : 'Needs Attention'}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Sessions"
            value={data.summary.totalSessions.toString()}
            icon={<Calendar size={20} />}
            trend={`${data.summary.totalSessions - data.summary.excusedCount} applicable sessions`}
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="On-Time Attendance"
            value={data.summary.presentCount.toString()}
            icon={<CheckCircle2 size={20} />}
            trend="Punctual sessions"
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Late Check-ins"
            value={data.summary.lateCount.toString()}
            icon={<Clock size={20} />}
            trend="Counts toward rate"
            trendPositive={true}
            colorScheme="amber"
          />
          <StatCard
            title="Excused Leaves"
            value={data.summary.excusedCount.toString()}
            icon={<Info size={20} />}
            trend="Non-penalizing"
            trendPositive={true}
            colorScheme="purple"
          />
        </div>

        {/* Monthly Summary Cards */}
        {data.monthlySummary.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Monthly Attendance Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.monthlySummary.map((m) => (
                <div
                  key={m.month}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-800 text-sm font-mono">{m.month}</span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {m.present} Present · {m.late} Late · {m.excused} Excused
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-base font-extrabold ${
                        (m.percentage ?? 0) >= 80 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {m.percentage !== null ? `${m.percentage}%` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chronological Activity Feed */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Attendance Log Feed</h3>
              <p className="text-xs text-slate-500">Full chronological record of daily roll-calls and live sessions</p>
            </div>

            {/* Month Filter */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 py-1.5 px-3 bg-white text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Recorded Dates</option>
              {data.monthlySummary.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month}
                </option>
              ))}
            </select>
          </div>

          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-medium">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Batch / Course</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Instructor Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">{r.date}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{r.batchName}</div>
                          {r.sessionTitle && (
                            <div className="text-[11px] text-blue-600 mt-0.5 flex items-center gap-1">
                              <Video size={11} />
                              {r.sessionTitle}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              r.mode === 'DAILY_BATCH'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}
                          >
                            {r.mode === 'DAILY_BATCH' ? 'DAILY ROLL-CALL' : 'LIVE SESSION'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(r.status)}</td>
                        <td className="py-3.5 px-4 text-slate-600 italic">
                          {r.remarks || <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No attendance records found for the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </StudentShell>
  );
}
