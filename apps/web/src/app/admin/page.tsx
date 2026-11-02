'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  dashboardApi,
  DashboardOverviewDto,
  RecentPaymentDto,
  RecentAdmissionDto,
  UpcomingSessionDto,
} from '@/lib/api';
import {
  EnrollmentBarChart,
  FinancialAreaChart,
  CourseDistributionBars,
  AttendanceDonutChart,
  formatINR,
} from '@/components/dashboard/dashboard-charts';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  CalendarCheck,
  CreditCard,
  Settings,
  Download,
  Plus,
  TrendingUp,
  Search,
  ArrowUpRight,
  ChevronRight,
  Clock,
  Layers,
  Video,
  RefreshCw,
  FileText,
  AlertCircle,
  Building2,
  CheckCircle2,
  Receipt,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: 'Active' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

type DateRangeOption = 'TODAY' | '7D' | '30D' | 'THIS_MONTH' | 'PREV_MONTH' | 'ALL';

export default function AdminDashboardPage() {
  const [instituteId, setInstituteId] = useState<string>('inst-1');
  const [dateRange, setDateRange] = useState<DateRangeOption>('30D');
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & filter for transactions table
  const [txSearch, setTxSearch] = useState<string>('');
  const [txStatusFilter, setTxStatusFilter] = useState<string>('ALL');
  const [txPage, setTxPage] = useState<number>(1);
  const txPerPage = 5;

  // Resolve instituteId from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id') || 'inst-1';
      setInstituteId(stored);
    }
  }, []);

  // Fetch dashboard overview
  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let fromDate: string | undefined;
      const now = new Date();

      if (dateRange === 'TODAY') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateRange === '7D') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromDate = d.toISOString();
      } else if (dateRange === '30D') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDate = d.toISOString();
      } else if (dateRange === 'THIS_MONTH') {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (dateRange === 'PREV_MONTH') {
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      }

      const res = await dashboardApi.getOverview(instituteId, { from: fromDate });
      setOverview(res);
    } catch (err: any) {
      console.warn('Dashboard overview API unavailable, using initial state:', err.message);
      // Fallback empty data structure with zero values so UI never crashes
      setOverview({
        kpi: {
          totalStudents: 0,
          activeStudents: 0,
          totalTeachers: 0,
          activeTeachers: 0,
          totalCourses: 0,
          publishedCourses: 0,
          activeBatches: 0,
          totalFeeCollected: 0,
          totalFeePending: 0,
          upcomingSessionsCount: 0,
          attendancePercentage: null,
        },
        enrolmentTrend: [],
        financialTrend: [],
        courseDistribution: [],
        recentAdmissions: [],
        upcomingSessions: [],
        recentPayments: [],
      });
      setErrorMsg(err.message || 'Unable to connect to dashboard API');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, dateRange]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Filtered transactions
  const filteredPayments = useMemo(() => {
    if (!overview?.recentPayments) return [];
    return overview.recentPayments.filter((p) => {
      const matchesSearch =
        p.studentName.toLowerCase().includes(txSearch.toLowerCase()) ||
        p.invoiceNumber.toLowerCase().includes(txSearch.toLowerCase()) ||
        (p.courseName && p.courseName.toLowerCase().includes(txSearch.toLowerCase()));
      const matchesStatus =
        txStatusFilter === 'ALL' || p.status.toUpperCase() === txStatusFilter.toUpperCase();
      return matchesSearch && matchesStatus;
    });
  }, [overview?.recentPayments, txSearch, txStatusFilter]);

  const totalTxPages = Math.max(1, Math.ceil(filteredPayments.length / txPerPage));
  const paginatedPayments = useMemo(() => {
    const start = (txPage - 1) * txPerPage;
    return filteredPayments.slice(start, start + txPerPage);
  }, [filteredPayments, txPage]);

  // Export report to CSV
  const handleExportReport = () => {
    if (!overview) return;
    const k = overview.kpi;
    const csvContent = [
      ['Bible Institute Management - Overview Analytics Report'],
      ['Generated On', new Date().toLocaleString('en-IN')],
      ['Institute ID', instituteId],
      ['Date Range Filter', dateRange],
      [],
      ['Metric', 'Value'],
      ['Total Students', k.totalStudents],
      ['Active Students', k.activeStudents],
      ['Total Faculty / Teachers', k.totalTeachers],
      ['Active Faculty', k.activeTeachers],
      ['Total Courses', k.totalCourses],
      ['Published Courses', k.publishedCourses],
      ['Active Batches', k.activeBatches],
      ['Total Fee Collected (INR)', Math.round(k.totalFeeCollected / 100)],
      ['Pending Fees (INR)', Math.round(k.totalFeePending / 100)],
      ['Upcoming Live Sessions', k.upcomingSessionsCount],
      ['Attendance Rate (%)', k.attendancePercentage ?? 'N/A'],
      [],
      ['Recent Student Admissions'],
      ['Admission No', 'Student Name', 'Course', 'Status', 'Date'],
      ...overview.recentAdmissions.map((s) => [
        s.admissionNo,
        s.fullName,
        s.courseName || '-',
        s.status,
        new Date(s.createdAt).toLocaleDateString('en-IN'),
      ]),
      [],
      ['Recent Fee Transactions'],
      ['Invoice No', 'Student Name', 'Amount (INR)', 'Mode', 'Date', 'Status'],
      ...overview.recentPayments.map((p) => [
        p.invoiceNumber,
        p.studentName,
        Math.round(p.amount / 100),
        p.paymentMode,
        new Date(p.paymentDate).toLocaleDateString('en-IN'),
        p.status,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `institute-analytics-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const k = overview?.kpi;

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-7 pb-12">
        {/* ── Top Header Section ────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                Grace Bible Institute • Portal Active
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
              Institute Administration Overview
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Monitor your institute&apos;s academic and financial performance in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date range filter pills */}
            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-medium text-slate-600">
              {(
                [
                  { id: '7D', label: '7 Days' },
                  { id: '30D', label: '30 Days' },
                  { id: 'THIS_MONTH', label: 'This Month' },
                  { id: 'ALL', label: 'All Time' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDateRange(opt.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dateRange === opt.id
                      ? 'bg-white text-blue-600 font-semibold shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportReport}
              disabled={isLoading || !overview}
              className="gap-1.5 rounded-xl border-slate-200 shadow-2xs hover:bg-slate-50"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export Report</span>
            </Button>

            <Link href="/admin/students">
              <Button variant="primary" size="sm" className="gap-1.5 rounded-xl">
                <Plus size={14} />
                <span>Add Student</span>
              </Button>
            </Link>

            <button
              onClick={() => fetchOverview()}
              title="Refresh Analytics"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* ── Optional Notification Banner if Error ─────────────────────────── */}
        {errorMsg && (
          <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>
                Backend API synchronization notice: Displaying cached/demo aggregation metrics ({errorMsg}).
              </span>
            </div>
            <button
              onClick={() => fetchOverview()}
              className="font-semibold underline hover:text-amber-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── 8 Premium KPI Summary Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
          {/* Card 1: Total Students */}
          <Link href="/admin/students" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-blue-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Students
                </span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
                  <Users size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : k?.totalStudents.toLocaleString() ?? '0'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {k?.activeStudents ?? 0} Active
                </span>
                <span className="text-[11px] text-slate-400 group-hover:text-blue-600 transition flex items-center gap-0.5">
                  View <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 2: Active Batches */}
          <Link href="/admin/batches" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-purple-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Active Batches
                </span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition">
                  <Layers size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : k?.activeBatches.toLocaleString() ?? '0'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-purple-600 font-medium">In session</span>
                <span className="text-[11px] text-slate-400 group-hover:text-purple-600 transition flex items-center gap-0.5">
                  Manage <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 3: Total Courses */}
          <Link href="/admin/courses" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-indigo-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Courses & Curriculum
                </span>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition">
                  <BookOpen size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : k?.totalCourses.toLocaleString() ?? '0'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-indigo-600 font-medium">
                  {k?.publishedCourses ?? 0} Published
                </span>
                <span className="text-[11px] text-slate-400 group-hover:text-indigo-600 transition flex items-center gap-0.5">
                  Browse <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 4: Faculty & Teachers */}
          <Link href="/admin/teachers" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-sky-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Faculty & Teachers
                </span>
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-105 transition">
                  <GraduationCap size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : k?.totalTeachers.toLocaleString() ?? '0'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-sky-600 font-medium">
                  {k?.activeTeachers ?? 0} Active Staff
                </span>
                <span className="text-[11px] text-slate-400 group-hover:text-sky-600 transition flex items-center gap-0.5">
                  Directory <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 5: Total Fee Collection */}
          <Link href="/admin/finance" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-emerald-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Fee Collection
                </span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-emerald-700 tracking-tight">
                  {isLoading ? '...' : formatINR(k?.totalFeeCollected ?? 0)}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-emerald-600 font-semibold">Realized revenue</span>
                <span className="text-[11px] text-slate-400 group-hover:text-emerald-600 transition flex items-center gap-0.5">
                  Ledger <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 6: Pending Fees */}
          <Link href="/admin/finance" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-amber-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Pending Fees
                </span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition">
                  <Clock size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-amber-700 tracking-tight">
                  {isLoading ? '...' : formatINR(k?.totalFeePending ?? 0)}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-amber-600 font-medium">Awaiting payment</span>
                <span className="text-[11px] text-slate-400 group-hover:text-amber-600 transition flex items-center gap-0.5">
                  Invoices <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 7: Live Sessions */}
          <Link href="/admin/batches" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-rose-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Upcoming Live Classes
                </span>
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition">
                  <Video size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : k?.upcomingSessionsCount.toLocaleString() ?? '0'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-rose-600 font-medium">Scheduled soon</span>
                <span className="text-[11px] text-slate-400 group-hover:text-rose-600 transition flex items-center gap-0.5">
                  Schedule <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>

          {/* Card 8: Attendance Rate */}
          <Link href="/admin/attendance" className="block group">
            <div className="premium-card p-5 bg-white transition group-hover:border-teal-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Attendance Health
                </span>
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition">
                  <CalendarCheck size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {isLoading ? '...' : k?.attendancePercentage !== null ? `${k?.attendancePercentage}%` : 'N/A'}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                <span className="text-teal-600 font-medium">Institute Average</span>
                <span className="text-[11px] text-slate-400 group-hover:text-teal-600 transition flex items-center gap-0.5">
                  Roster <ChevronRight size={12} />
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* ── Analytics & Graphical Reports (Two-Column Layout) ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Student Enrollment Analytics */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Student Enrollment Trends
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly new student enrolments across all theological courses
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-blue-600" /> New Students
                </span>
              </div>
            </div>

            <EnrollmentBarChart data={overview?.enrolmentTrend ?? []} />
          </Card>

          {/* Chart 2: Financial Performance Analytics */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Financial Performance & Inflow
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fee collection revenue vs pending balance trends
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Collected
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending
                </span>
              </div>
            </div>

            <FinancialAreaChart data={overview?.financialTrend ?? []} />
          </Card>
        </div>

        {/* ── Second Analytics Row: Course Distribution & Attendance ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Course Distribution */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Student Distribution by Course
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Active enrolments concentrated across key curriculum tracks
                </p>
              </div>
              <Link href="/admin/courses">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                  View All Courses
                </Button>
              </Link>
            </div>

            <CourseDistributionBars data={overview?.courseDistribution ?? []} />
          </Card>

          {/* Card: Institute Attendance Health */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Attendance & Academic Engagement
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Aggregate lecture and session attendance across active cohorts
                </p>
              </div>
              <Link href="/admin/attendance">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                  Full Roster
                </Button>
              </Link>
            </div>

            <AttendanceDonutChart percentage={overview?.kpi.attendancePercentage ?? null} />
          </Card>
        </div>

        {/* ── Financial Transactions Table (Inspired by Reference Screenshot) ── */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Recent Financial Transactions
                </h3>
                <Badge variant="primary">Real-time</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified payment invoices and fee receipts from the billing module
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student, invoice..."
                  value={txSearch}
                  onChange={(e) => {
                    setTxSearch(e.target.value);
                    setTxPage(1);
                  }}
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 bg-slate-50/50"
                />
              </div>

              {/* Status filter dropdown */}
              <select
                value={txStatusFilter}
                onChange={(e) => {
                  setTxStatusFilter(e.target.value);
                  setTxPage(1);
                }}
                className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>

              <Link href="/admin/finance">
                <Button variant="outline" size="sm" className="text-xs rounded-xl gap-1">
                  <span>View All Invoices</span>
                  <ArrowUpRight size={12} />
                </Button>
              </Link>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Enrolled Course</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Payment Mode</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {paginatedPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No matching financial transactions found
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((p) => {
                    const initials = p.studentName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {initials}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{p.studentName}</div>
                              <div className="text-[10px] text-slate-400">{p.paymentNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {p.courseName || 'Theology Degree Program'}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {p.invoiceNumber}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {formatINR(p.amount)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">
                            {p.paymentMode}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              p.status === 'COMPLETED'
                                ? 'success'
                                : p.status === 'PENDING'
                                ? 'warning'
                                : 'danger'
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link href="/admin/finance">
                            <button
                              title="View Invoice Receipt"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                            >
                              <Receipt size={15} />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredPayments.length > txPerPage && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Showing {(txPage - 1) * txPerPage + 1} to{' '}
                {Math.min(txPage * txPerPage, filteredPayments.length)} of {filteredPayments.length} transactions
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage === 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 text-xs"
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-slate-700">
                  Page {txPage} of {totalTxPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage === totalTxPages}
                  onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                  className="px-2.5 py-1 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Two Columns: Recent Admissions & Upcoming Schedule ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Recent Student Admissions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Recent Student Admissions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Latest admissions requiring approval or verification
                </p>
              </div>
              <Link href="/admin/students">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                  View All Students
                </Button>
              </Link>
            </div>

            <div className="space-y-3">
              {overview?.recentAdmissions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No recent student admissions recorded
                </div>
              ) : (
                overview?.recentAdmissions.slice(0, 5).map((admission) => {
                  const initials = admission.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <div
                      key={admission.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition border border-slate-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-xs truncate">
                            {admission.fullName}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {admission.admissionNo} • {admission.courseName || 'Enrolled'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            admission.status === 'ACTIVE'
                              ? 'success'
                              : admission.status === 'UNDER_REVIEW'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {admission.status}
                        </Badge>
                        <Link href={`/admin/students`}>
                          <Button size="sm" variant="outline" className="text-[11px] py-1 px-2.5">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Right: Upcoming Live Sessions Schedule */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Upcoming Live Classes & Sessions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheduled webinars, lectures and faculty meetings
                </p>
              </div>
              <Link href="/admin/batches">
                <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                  Full Schedule
                </Button>
              </Link>
            </div>

            <div className="space-y-3">
              {overview?.upcomingSessions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No upcoming live sessions scheduled
                </div>
              ) : (
                overview?.upcomingSessions.slice(0, 5).map((session) => {
                  const startDate = new Date(session.startsAt);
                  const isToday = startDate.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={session.id}
                      className="p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition border border-slate-100 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Video size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-xs truncate">
                            {session.title}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {session.courseTitle} • {session.teacherName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-bold text-slate-800">
                          {isToday
                            ? 'Today ' +
                              startDate.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : startDate.toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {session.room || session.batchName}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
}
