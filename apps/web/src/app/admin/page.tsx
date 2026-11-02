'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  dashboardApi,
  resolveVerifiedAdminContext,
  DashboardOverviewDto,
  DateRangePreset,
  ExportReportType,
  TransactionItemDto,
  KpiComparisonDto,
} from '@/lib/api';
import {
  EnrollmentBarChart,
  FinancialAreaChart,
  CourseDistributionBars,
  BatchDistributionBars,
  AttendanceDonutChart,
  formatINR,
} from '@/components/dashboard/dashboard-charts';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  GraduationCap,
  BookOpen,
  Calendar,
  CalendarCheck,
  CreditCard,
  Settings,
  Bell,
  Download,
  Plus,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Clock,
  Video,
  RefreshCw,
  Receipt,
  Eye,
  X,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Activity,
  Briefcase,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: <Bell size={18} />,
  },
  {
    label: 'Students & Admissions',
    href: '/admin/students',
    icon: <Users size={18} />,
  },
  {
    label: 'Faculty & Teachers',
    href: '/admin/teachers',
    icon: <GraduationCap size={18} />,
  },
  {
    label: 'Courses & Curriculum',
    href: '/admin/courses',
    icon: <BookOpen size={18} />,
  },
  {
    label: 'Batches & Classes',
    href: '/admin/batches',
    icon: <Calendar size={18} />,
  },
  {
    label: 'Attendance',
    href: '/admin/attendance',
    icon: <CalendarCheck size={18} />,
  },
  {
    label: 'Finance & Payments',
    href: '/admin/finance',
    icon: <CreditCard size={18} />,
  },
  {
    label: 'Institute Settings',
    href: '/admin/settings',
    icon: <Settings size={18} />,
  },
];

const DATE_PRESET_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: 'Last 7 Days' },
  { value: '30D', label: 'Last 30 Days' },
  { value: 'THIS_MONTH', label: 'This Month' },
  { value: 'PREV_MONTH', label: 'Previous Month' },
  { value: 'THIS_TERM', label: 'This Academic Term' },
  { value: 'THIS_YEAR', label: 'This Academic Year' },
  { value: 'CUSTOM', label: 'Custom Date Range' },
];

const EXPORT_OPTIONS: Array<{
  type: ExportReportType;
  label: string;
  desc: string;
  roles: string[];
}> = [
  {
    type: 'enrollments',
    label: 'Student Enrollment Report',
    desc: 'Admissions, courses, batches & registration dates',
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'ACADEMIC_COORDINATOR'],
  },
  {
    type: 'fee-collection',
    label: 'Fee Collection Report',
    desc: 'Verified payments, receipts & net collections',
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'FINANCE_OFFICER'],
  },
  {
    type: 'pending-fees',
    label: 'Pending Fee Report',
    desc: 'Outstanding invoice balances & due dates',
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'FINANCE_OFFICER'],
  },
  {
    type: 'attendance',
    label: 'Attendance Report',
    desc: 'Batch-wise attendance rates & status counts',
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'ACADEMIC_COORDINATOR'],
  },
  {
    type: 'teacher-workload',
    label: 'Teacher Workload Report',
    desc: 'Faculty courses, batches & scheduled teaching hours',
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'ACADEMIC_COORDINATOR'],
  },
  {
    type: 'transactions',
    label: 'Transaction Ledger Report',
    desc: 'Complete fee payment & reversal audit ledger',
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'FINANCE_OFFICER'],
  },
];

function renderComparisonPill(
  comp?: KpiComparisonDto,
  isCurrency = false,
  currency = 'INR',
) {
  if (!comp) return null;
  if (comp.changePct !== null) {
    const isUp = comp.changePct >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          isUp
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-rose-50 text-rose-700'
        }`}
        title={`Compared against previous equal period (${
          isCurrency
            ? formatINR(comp.previousPeriodValue || 0, currency)
            : comp.previousPeriodValue
        })`}
      >
        {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        <span>
          {isUp ? '+' : ''}
          {comp.changePct}%
        </span>
      </span>
    );
  }

  return (
    <span className="text-[11px] font-medium text-slate-500">
      {isCurrency
        ? `${formatINR(comp.periodValue, currency)} in period`
        : `+${comp.periodValue} in period`}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [instituteId, setInstituteId] = useState<string>('');
  const [viewerRole, setViewerRole] = useState<string>('INSTITUTE_ADMIN');
  const [viewerName, setViewerName] = useState<string>(
    'Institute Administrator',
  );
  const [instituteDisplayName, setInstituteDisplayName] =
    useState<string>('Bible Institute');

  // Global Date Filter state
  const [preset, setPreset] = useState<DateRangePreset>('30D');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [appliedCustom, setAppliedCustom] = useState<{
    from?: string;
    to?: string;
  }>({});

  // Dashboard Overview API state (strictly real backend data, zero fake datasets)
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Analytics sub-view tabs
  const [distributionView, setDistributionView] = useState<'COURSE' | 'BATCH'>(
    'COURSE',
  );
  const [attendanceSubView, setAttendanceSubView] = useState<
    'BATCH' | 'COURSE'
  >('BATCH');

  // Paginated Transactions Table state
  const [transactions, setTransactions] = useState<TransactionItemDto[]>([]);
  const [txPage, setTxPage] = useState<number>(1);
  const [txTotalPages, setTxTotalPages] = useState<number>(1);
  const [txTotalCount, setTxTotalCount] = useState<number>(0);
  const [txNetSumPaise, setTxNetSumPaise] = useState<number>(0);
  const [txSearchInput, setTxSearchInput] = useState<string>('');
  const [txAppliedSearch, setTxAppliedSearch] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('ALL');
  const [txMode, setTxMode] = useState<string>('ALL');
  const [txDateScoped, setTxDateScoped] = useState<boolean>(false);
  const [loadingTx, setLoadingTx] = useState<boolean>(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionItemDto | null>(null);
  const txLimit = 6;

  // Export Dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [exportingType, setExportingType] = useState<ExportReportType | null>(
    null,
  );
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 1. Resolve verified admin & institute context once on mount
  useEffect(() => {
    let active = true;
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (!active) return;
        setInstituteId(ctx.instituteId);
        setInstituteDisplayName(ctx.displayName || ctx.instituteName);
        setViewerName(ctx.user.fullName);
        setViewerRole(ctx.user.role);
      })
      .catch((err) => {
        if (!active) return;
        setOverviewError(
          err?.message ||
            'Could not verify institute session. Please ensure the API server is running and you are signed in.',
        );
        setLoadingOverview(false);
        setLoadingTx(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportMenuOpen]);

  // Build active date query object
  const buildDateQuery = useCallback(() => {
    if (preset === 'CUSTOM') {
      return {
        preset: 'CUSTOM' as DateRangePreset,
        from: appliedCustom.from,
        to: appliedCustom.to,
      };
    }
    return { preset };
  }, [preset, appliedCustom]);

  // 2. Fetch Dashboard Overview
  const fetchOverview = useCallback(async () => {
    if (!instituteId) return;
    if (preset === 'CUSTOM' && !appliedCustom.from && !appliedCustom.to) {
      return;
    }
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await dashboardApi.getOverview(
        instituteId,
        buildDateQuery(),
      );
      setOverview(data);
      if (data.institute?.displayName) {
        setInstituteDisplayName(data.institute.displayName);
      }
      if (data.viewer?.fullName) {
        setViewerName(data.viewer.fullName);
        setViewerRole(data.viewer.role);
      }
    } catch (err: any) {
      setOverviewError(
        err?.message || 'Failed to load institute dashboard analytics.',
      );
    } finally {
      setLoadingOverview(false);
    }
  }, [instituteId, preset, appliedCustom, buildDateQuery]);

  useEffect(() => {
    if (instituteId) {
      fetchOverview();
    }
  }, [instituteId, fetchOverview]);

  // 3. Fetch Paginated Transactions
  const fetchTransactions = useCallback(async () => {
    if (!instituteId) return;
    setLoadingTx(true);
    try {
      const dateParams = txDateScoped ? buildDateQuery() : {};
      const res = await dashboardApi.getTransactions(instituteId, {
        page: txPage,
        limit: txLimit,
        search: txAppliedSearch || undefined,
        status: txStatus !== 'ALL' ? txStatus : undefined,
        paymentMode: txMode !== 'ALL' ? txMode : undefined,
        ...dateParams,
      });
      setTransactions(res.data);
      setTxTotalPages(res.meta.totalPages);
      setTxTotalCount(res.meta.total);
      setTxNetSumPaise(res.summary.totalNetPaise);
    } catch {
      setTransactions([]);
      setTxTotalCount(0);
    } finally {
      setLoadingTx(false);
    }
  }, [
    instituteId,
    txPage,
    txLimit,
    txAppliedSearch,
    txStatus,
    txMode,
    txDateScoped,
    buildDateQuery,
  ]);

  useEffect(() => {
    if (instituteId) {
      fetchTransactions();
    }
  }, [instituteId, fetchTransactions]);

  // 4. Backend-powered CSV Report Export
  const handleExportReport = async (reportType: ExportReportType) => {
    if (!instituteId) return;
    setExportingType(reportType);
    setExportNotice(null);
    try {
      const exported = await dashboardApi.exportReport(instituteId, {
        type: reportType,
        ...buildDateQuery(),
      });
      const blob = new Blob([exported.csvContent], {
        type: exported.mimeType || 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exported.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMenuOpen(false);
      setExportNotice(
        `Exported "${exported.reportTitle}" (${exported.rowCount} records).`,
      );
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      setExportNotice(`Export failed: ${err?.message || 'Unauthorized'}`);
    } finally {
      setExportingType(null);
    }
  };

  // Role-based quick actions & export permissions
  const canManageAcademics =
    viewerRole === 'SUPER_ADMIN' ||
    viewerRole === 'INSTITUTE_ADMIN' ||
    viewerRole === 'ACADEMIC_COORDINATOR';
  const canManageFinance =
    viewerRole === 'SUPER_ADMIN' ||
    viewerRole === 'INSTITUTE_ADMIN' ||
    viewerRole === 'FINANCE_OFFICER';

  const authorizedExports = EXPORT_OPTIONS.filter((opt) =>
    opt.roles.includes(viewerRole),
  );

  const currency = overview?.institute?.currency || 'INR';
  const kpi = overview?.kpi;
  const fin = overview?.financialAnalytics;
  const att = overview?.attendanceAnalytics;
  const acad = overview?.teacherAcademicAnalytics;

  const formattedToday = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const roleLabel =
    viewerRole === 'FINANCE_OFFICER'
      ? 'Finance Officer'
      : viewerRole === 'ACADEMIC_COORDINATOR'
        ? 'Academic Coordinator'
        : viewerRole === 'SUPER_ADMIN'
          ? 'Super Administrator'
          : 'Institute Administrator';

  return (
    <PortalShell
      portalTitle="INSTITUTE ADMIN"
      portalRole="ADMIN"
      navItems={adminNav}
      userName={viewerName}
      userRoleLabel={roleLabel}
    >
      <div className="space-y-6 pb-8">
        {/* ── 1. PREMIUM DASHBOARD HEADER ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  {instituteDisplayName}
                </span>
                <span>•</span>
                <span>{formattedToday}</span>
                {overview?.dateFilter?.label && (
                  <>
                    <span>•</span>
                    <span className="text-slate-700">
                      Scope: {overview.dateFilter.label}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Welcome back, {viewerName.split(' ')[0]}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Monitor your institute&apos;s academic enrollments, faculty
                workload, attendance health, and financial performance.
              </p>
            </div>

            {/* Date Selector + Export Dropdown + Refresh */}
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Global Date Range"
                value={preset}
                onChange={(e) => {
                  const next = e.target.value as DateRangePreset;
                  setPreset(next);
                  if (next === 'CUSTOM' && !customFrom && !customTo) {
                    const end = new Date().toISOString().slice(0, 10);
                    const start = new Date(
                      Date.now() - 30 * 24 * 60 * 60 * 1000,
                    )
                      .toISOString()
                      .slice(0, 10);
                    setCustomFrom(start);
                    setCustomTo(end);
                    setAppliedCustom({ from: start, to: end });
                  }
                }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {DATE_PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Export Report Dropdown */}
              {authorizedExports.length > 0 && (
                <div className="relative" ref={exportMenuRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    className="text-xs gap-1.5"
                  >
                    <Download size={14} />
                    <span>Export Report</span>
                    <ChevronDown size={13} />
                  </Button>

                  {exportMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-40 py-2">
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">
                          Export CSV Report
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Scoped to {overview?.dateFilter?.label || 'selected range'}
                        </p>
                      </div>
                      <div className="py-1">
                        {authorizedExports.map((opt) => (
                          <button
                            key={opt.type}
                            type="button"
                            disabled={exportingType === opt.type}
                            onClick={() => handleExportReport(opt.type)}
                            className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-start gap-2.5 transition cursor-pointer disabled:opacity-50"
                          >
                            <FileSpreadsheet
                              size={15}
                              className="text-blue-600 mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                {opt.label}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {opt.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  fetchOverview();
                  fetchTransactions();
                }}
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                title="Refresh live metrics"
                aria-label="Refresh dashboard"
              >
                <RefreshCw
                  size={15}
                  className={loadingOverview ? 'animate-spin text-blue-600' : ''}
                />
              </button>
            </div>
          </div>

          {/* Custom Date Range Picker Bar */}
          {preset === 'CUSTOM' && (
            <div className="flex flex-wrap items-end gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  setAppliedCustom({
                    from: customFrom || undefined,
                    to: customTo || undefined,
                  })
                }
                className="text-xs"
              >
                Apply Date Filter
              </Button>
            </div>
          )}

          {/* Role-Authorized Quick Actions Bar */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Quick Actions:
              </span>
              {canManageAcademics && (
                <>
                  <Link href="/admin/students">
                    <Button
                      variant="primary"
                      size="sm"
                      className="text-xs gap-1.5"
                    >
                      <Plus size={13} />
                      <span>Add Student</span>
                    </Button>
                  </Link>
                  <Link href="/admin/teachers/new">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                    >
                      <GraduationCap size={13} />
                      <span>Add Teacher</span>
                    </Button>
                  </Link>
                  <Link href="/admin/courses">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                    >
                      <BookOpen size={13} />
                      <span>Create Course</span>
                    </Button>
                  </Link>
                  <Link href="/admin/batches">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                    >
                      <Layers size={13} />
                      <span>Create Batch</span>
                    </Button>
                  </Link>
                </>
              )}
              {canManageFinance && (
                <Link href="/admin/finance">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                  >
                    <CreditCard size={13} />
                    <span>View Fee Management</span>
                  </Button>
                </Link>
              )}
            </div>

            {exportNotice && (
              <span
                className={`text-xs font-medium px-3 py-1 rounded-lg ${
                  exportNotice.startsWith('Export failed')
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {exportNotice}
              </span>
            )}
          </div>
        </div>

        {/* Error State */}
        {overviewError && (
          <Card className="p-5 border border-rose-200 bg-rose-50/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle
                size={20}
                className="text-rose-600 shrink-0 mt-0.5"
              />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Unable to load live institute metrics
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">{overviewError}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOverview}
              className="text-xs shrink-0"
            >
              Retry Connection
            </Button>
          </Card>
        )}

        {/* ── 2. 8 PREMIUM KPI SUMMARY CARDS ───────────────────────────────── */}
        {loadingOverview && !overview ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 h-32 animate-pulse space-y-3"
              >
                <div className="h-3.5 bg-slate-100 rounded w-1/2" />
                <div className="h-7 bg-slate-100 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : (
          kpi && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* 1. Total Students */}
              <Link href="/admin/students" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Total Students
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {kpi.totalStudents.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    {renderComparisonPill(
                      kpi.comparisons?.studentsRegistered,
                      false,
                      currency,
                    )}
                    <span className="text-[11px] font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Directory <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 2. Active Students */}
              <Link href="/admin/students" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Active Students
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <UserCheck size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {kpi.activeStudents.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {kpi.totalStudents > 0
                        ? `${Math.round(
                            (kpi.activeStudents / kpi.totalStudents) * 100,
                          )}% active`
                        : 'No admissions yet'}
                      {kpi.pendingAdmissionsCount > 0
                        ? ` • ${kpi.pendingAdmissionsCount} pending`
                        : ''}
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Admissions <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 3. Total Teachers */}
              <Link href="/admin/teachers" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Total Teachers
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <GraduationCap size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {kpi.totalTeachers.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {kpi.activeTeachers} active
                      {kpi.onLeaveTeachers > 0
                        ? ` • ${kpi.onLeaveTeachers} on leave`
                        : ''}
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Faculty <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 4. Active Courses */}
              <Link href="/admin/courses" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Active Courses
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <BookOpen size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {kpi.publishedCourses.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {kpi.totalCourses} total
                      {kpi.draftCourses > 0
                        ? ` • ${kpi.draftCourses} in draft`
                        : ''}
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Curriculum <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 5. Active Batches */}
              <Link href="/admin/batches" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Active Batches
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Layers size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {kpi.activeBatches.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {kpi.totalBatches} total cohorts
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Batches <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 6. Total Fee Collection */}
              <Link href="/admin/finance" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Total Fee Collection
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CreditCard size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {formatINR(kpi.totalFeeCollected, currency)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    {renderComparisonPill(
                      kpi.comparisons?.feeCollection,
                      true,
                      currency,
                    )}
                    <span className="text-[11px] font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Ledger <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 7. Pending Fee Amount */}
              <Link href="/admin/finance" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Pending Fee Amount
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Receipt size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {formatINR(kpi.totalFeePending, currency)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {kpi.pendingInvoicesCount} open invoice
                      {kpi.pendingInvoicesCount === 1 ? '' : 's'}
                      {kpi.overdueFeeAmount > 0
                        ? ` • ${formatINR(kpi.overdueFeeAmount, currency)} overdue`
                        : ''}
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Invoices <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>

              {/* 8. Upcoming Live Sessions */}
              <Link href="/admin/batches" className="group block">
                <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all h-full flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      Upcoming Live Sessions
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Video size={18} />
                    </div>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {kpi.upcomingSessionsCount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                    <span className="text-slate-500 font-medium">
                      {kpi.sessionsTodayCount > 0
                        ? `${kpi.sessionsTodayCount} scheduled today`
                        : 'No classes remaining today'}
                    </span>
                    <span className="font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center">
                      Timetable <ChevronRight size={12} />
                    </span>
                  </div>
                </Card>
              </Link>
            </div>
          )
        )}

        {/* ── 3. STUDENT ENROLLMENT & FINANCIAL ANALYTICS CHARTS ───────────── */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Enrollment Analytics */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Student Enrollment Analytics
                  </h2>
                  <p className="text-xs text-slate-500">
                    Monthly student registrations and course enrollments
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-700" />
                    Registrations
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    Enrolments
                  </span>
                </div>
              </div>

              <EnrollmentBarChart data={overview.enrolmentTrend} />

              <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">
                    Standing Students
                  </span>
                  <span className="font-bold text-slate-900">
                    {overview.kpi.totalStudents}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">
                    Period Registrations
                  </span>
                  <span className="font-bold text-slate-900">
                    {overview.kpi.comparisons?.studentsRegistered.periodValue ??
                      0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">
                    Period Enrolments
                  </span>
                  <span className="font-bold text-blue-600">
                    {overview.kpi.comparisons?.enrolments.periodValue ?? 0}
                  </span>
                </div>
              </div>
            </Card>

            {/* Financial Analytics & Reports */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Financial Analytics & Fee Reports
                  </h2>
                  <p className="text-xs text-slate-500">
                    Monthly net collections vs outstanding invoice balances
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Collected
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Pending
                  </span>
                </div>
              </div>

              <FinancialAreaChart
                data={overview.financialTrend}
                currency={currency}
              />

              {/* Invoice Totals & Payment Status Breakdown */}
              {fin && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">
                        Total Invoiced
                      </span>
                      <span className="font-bold text-slate-900">
                        {formatINR(
                          fin.invoiceTotals.totalInvoicedPaise,
                          currency,
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">
                        Period Collected ({fin.paymentSummary.periodSuccessfulCount})
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatINR(fin.collectedInPeriodPaise, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">
                        Outstanding Balance
                      </span>
                      <span className="font-bold text-amber-600">
                        {formatINR(fin.pendingAmountPaise, currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {fin.paymentStatusBreakdown.map((b) => (
                      <span
                        key={b.status}
                        className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600 font-medium"
                      >
                        {b.label}:{' '}
                        <strong className="text-slate-900">{b.count}</strong> (
                        {formatINR(b.amountPaise, currency)})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── 4. ENROLLMENT DISTRIBUTION & ATTENDANCE ANALYTICS ────────────── */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enrollment Distribution by Course / Batch */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Enrollment Distribution
                    </h2>
                    <p className="text-xs text-slate-500">
                      Student concentration by curriculum track and batch cohort
                    </p>
                  </div>
                  <div className="inline-flex p-1 bg-slate-100 rounded-xl w-fit text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setDistributionView('COURSE')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        distributionView === 'COURSE'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      By Course
                    </button>
                    <button
                      type="button"
                      onClick={() => setDistributionView('BATCH')}
                      className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                        distributionView === 'BATCH'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      By Batch
                    </button>
                  </div>
                </div>

                {distributionView === 'COURSE' ? (
                  <CourseDistributionBars data={overview.courseDistribution} />
                ) : (
                  <BatchDistributionBars
                    data={overview.batchDistribution || []}
                  />
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {distributionView === 'COURSE'
                    ? `${overview.courseDistribution.length} active curriculum tracks`
                    : `${overview.batchDistribution?.length || 0} academic cohorts`}
                </span>
                <Link
                  href={
                    distributionView === 'COURSE'
                      ? '/admin/courses'
                      : '/admin/batches'
                  }
                  className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <span>
                    Manage{' '}
                    {distributionView === 'COURSE' ? 'Courses' : 'Batches'}
                  </span>
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            </Card>

            {/* Attendance Analytics */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Attendance Analytics
                    </h2>
                    <p className="text-xs text-slate-500">
                      Institute-wide roll-call rate & cohort engagement
                    </p>
                  </div>
                  <Link
                    href="/admin/attendance"
                    className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Attendance Module</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>

                <AttendanceDonutChart
                  percentage={
                    att
                      ? att.periodPercentage
                      : overview.kpi.attendancePercentage
                  }
                  presentCount={att?.presentCount ?? 0}
                  lateCount={att?.lateCount ?? 0}
                  absentCount={att?.absentCount ?? 0}
                  excusedCount={att?.excusedCount ?? 0}
                  totalRecords={att?.totalRecords ?? 0}
                  minThresholdPct={att?.minThresholdPct ?? 75}
                  trend={att?.trend ?? []}
                />

                {/* Batch-wise / Course-wise Attendance Breakdown */}
                {att && (att.byBatch.length > 0 || att.byCourse.length > 0) && (
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">
                        Cohort Attendance Breakdown
                      </span>
                      <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setAttendanceSubView('BATCH')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer ${
                            attendanceSubView === 'BATCH'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500'
                          }`}
                        >
                          Batches
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceSubView('COURSE')}
                          className={`px-2 py-0.5 rounded-md cursor-pointer ${
                            attendanceSubView === 'COURSE'
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500'
                          }`}
                        >
                          Courses
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {attendanceSubView === 'BATCH'
                        ? att.byBatch.slice(0, 4).map((b) => (
                            <div
                              key={b.batchId}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50"
                            >
                              <span className="font-medium text-slate-800 truncate pr-2">
                                {b.batchName}
                              </span>
                              <span
                                className={`font-bold shrink-0 ${
                                  b.attendancePercentage !== null &&
                                  b.attendancePercentage < att.minThresholdPct
                                    ? 'text-rose-600'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {b.attendancePercentage !== null
                                  ? `${b.attendancePercentage}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          ))
                        : att.byCourse.slice(0, 4).map((c) => (
                            <div
                              key={c.courseId}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50"
                            >
                              <span className="font-medium text-slate-800 truncate pr-2">
                                {c.courseTitle}
                              </span>
                              <span className="font-bold text-slate-900 shrink-0">
                                {c.attendancePercentage !== null
                                  ? `${c.attendancePercentage}%`
                                  : 'N/A'}
                              </span>
                            </div>
                          ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── 5. TEACHER & ACADEMIC WORKLOAD ANALYTICS ─────────────────────── */}
        {acad && (
          <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Faculty Workload & Academic Assignments
                </h2>
                <p className="text-xs text-slate-500">
                  Active instructors, leave status, course/batch assignments,
                  and scheduled teaching hours
                </p>
              </div>
              <Link
                href="/admin/teachers"
                className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <span>Manage Faculty Directory</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>

            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-400 text-[11px] block">
                  Total Faculty
                </span>
                <span className="text-base font-bold text-slate-900">
                  {acad.summary.totalTeachers}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-emerald-700 text-[11px] block">
                  Active Staff
                </span>
                <span className="text-base font-bold text-emerald-900">
                  {acad.summary.activeTeachers}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-amber-700 text-[11px] block">
                  On Leave
                </span>
                <span className="text-base font-bold text-amber-900">
                  {acad.summary.onLeaveTeachers}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <span className="text-blue-700 text-[11px] block">
                  Course Assignments
                </span>
                <span className="text-base font-bold text-blue-900">
                  {acad.summary.totalCourseAssignments}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-indigo-700 text-[11px] block">
                  Batch Assignments
                </span>
                <span className="text-base font-bold text-indigo-900">
                  {acad.summary.totalBatchAssignments}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100">
                <span className="text-purple-700 text-[11px] block">
                  Upcoming Classes
                </span>
                <span className="text-base font-bold text-purple-900">
                  {acad.summary.upcomingScheduledSessions}
                </span>
              </div>
            </div>

            {/* Teacher Workload Table */}
            {acad.teacherWorkload.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-xs text-slate-500">
                No faculty profiles registered yet. Use{' '}
                <Link
                  href="/admin/teachers/new"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Add Teacher
                </Link>{' '}
                to onboard instructors.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Faculty</th>
                      <th className="py-2.5 px-3 font-semibold">
                        Specialization
                      </th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-center">
                        Courses
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center">
                        Batches
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-center">
                        Upcoming Sessions
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right">
                        Scheduled Hours
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {acad.teacherWorkload.slice(0, 6).map((t) => (
                      <tr
                        key={t.teacherId}
                        className="hover:bg-slate-50/80 transition"
                      >
                        <td className="py-3 px-3">
                          <Link
                            href={`/admin/teachers/${t.teacherId}`}
                            className="font-semibold text-slate-900 hover:text-blue-600"
                          >
                            {t.fullName}
                          </Link>
                          {t.employeeCode && (
                            <span className="block text-[10px] font-mono text-slate-400">
                              {t.employeeCode}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {t.specialization || 'Theological Studies'}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              t.status === 'ACTIVE'
                                ? 'success'
                                : t.status === 'ON_LEAVE'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {t.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-800">
                          {t.assignedCoursesCount}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-800">
                          {t.assignedBatchesCount}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-blue-600">
                          {t.upcomingSessionsCount}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {t.scheduledHoursInPeriod} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── 6. RECENT FINANCIAL TRANSACTIONS TABLE (Screenshot 2 Style) ───── */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Recent Financial Transactions
                </h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  {txTotalCount} record{txTotalCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified fee payments and invoice receipts from Fee Management (
                {formatINR(txNetSumPaise, currency)} net total)
              </p>
            </div>

            {/* Search, Payment Status, Mode, Date Scope & View All */}
            <div className="flex flex-wrap items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setTxPage(1);
                  setTxAppliedSearch(txSearchInput.trim());
                }}
                className="relative"
              >
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={txSearchInput}
                  onChange={(e) => setTxSearchInput(e.target.value)}
                  placeholder="Student, invoice #, receipt..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </form>

              <select
                aria-label="Filter transactions by status"
                value={txStatus}
                onChange={(e) => {
                  setTxStatus(e.target.value);
                  setTxPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="PARTIALLY_REVERSED">Partially Reversed</option>
                <option value="REVERSED">Reversed</option>
              </select>

              <select
                aria-label="Filter transactions by payment method"
                value={txMode}
                onChange={(e) => {
                  setTxMode(e.target.value);
                  setTxPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Methods</option>
                <option value="ONLINE">Online</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="DEMAND_DRAFT">Demand Draft</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setTxDateScoped((prev) => !prev);
                  setTxPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  txDateScoped
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {txDateScoped ? 'In Date Filter' : 'All Dates'}
              </button>

              <Link href="/admin/finance">
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <span>View All</span>
                  <ArrowUpRight size={13} />
                </Button>
              </Link>
            </div>
          </div>

          {/* Table */}
          {loadingTx ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((r) => (
                <div
                  key={r}
                  className="h-10 bg-slate-100/80 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <Receipt size={26} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                No financial transactions found
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Recorded fee payments from the Fee Management module will appear
                in this ledger automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-5 font-semibold">Student Name</th>
                    <th className="py-3 px-4 font-semibold">Invoice #</th>
                    <th className="py-3 px-4 font-semibold">Course / Batch</th>
                    <th className="py-3 px-4 font-semibold">Payment Amount</th>
                    <th className="py-3 px-4 font-semibold">Payment Method</th>
                    <th className="py-3 px-4 font-semibold">Payment Date</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const initials = tx.studentName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const displayAmount = tx.netAmount ?? tx.amount;

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 transition"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {tx.studentName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {tx.admissionNo || tx.paymentNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 font-medium">
                          {tx.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-800 block truncate max-w-[190px]">
                            {tx.courseName || 'General Fee'}
                          </span>
                          {tx.batchName && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[190px]">
                              {tx.batchName}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatINR(displayAmount, currency)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {tx.paymentMode.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(tx.paymentDate).toLocaleDateString(
                            'en-IN',
                            {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            },
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              tx.status === 'COMPLETED'
                                ? 'success'
                                : tx.status === 'PARTIALLY_REVERSED'
                                  ? 'warning'
                                  : 'danger'
                            }
                          >
                            {tx.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTransaction(tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] transition cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loadingTx && txTotalCount > 0 && (
            <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Showing{' '}
                <strong className="text-slate-900">
                  {(txPage - 1) * txLimit + 1}–
                  {Math.min(txPage * txLimit, txTotalCount)}
                </strong>{' '}
                of <strong className="text-slate-900">{txTotalCount}</strong>{' '}
                transactions
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  className="text-xs gap-1"
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </Button>
                <span className="font-semibold text-slate-700 px-1.5">
                  {txPage} / {txTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage >= txTotalPages}
                  onClick={() =>
                    setTxPage((p) => Math.min(txTotalPages, p + 1))
                  }
                  className="text-xs gap-1"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── 7. RECENT ACTIVITIES & UPCOMING LIVE SCHEDULE ────────────────── */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities & Admissions */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Recent Activities & Admissions
                    </h2>
                    <p className="text-xs text-slate-500">
                      Live operational stream across admissions, faculty, fees &
                      settings
                    </p>
                  </div>
                  <Link
                    href="/admin/students"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    View Admissions
                  </Link>
                </div>

                {!overview.recentActivities ||
                overview.recentActivities.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-xs text-slate-500">
                    No recent institute activities recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {overview.recentActivities.slice(0, 7).map((act) => (
                      <Link
                        key={act.id}
                        href={act.link}
                        className="py-3 flex items-start justify-between gap-3 hover:bg-slate-50/70 px-2 -mx-2 rounded-xl transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                            {act.category === 'STUDENT' ? (
                              <Users size={14} className="text-blue-600" />
                            ) : act.category === 'TEACHER' ? (
                              <GraduationCap
                                size={14}
                                className="text-indigo-600"
                              />
                            ) : act.category === 'FEE' ? (
                              <CreditCard
                                size={14}
                                className="text-emerald-600"
                              />
                            ) : act.category === 'COURSE' ? (
                              <BookOpen size={14} className="text-purple-600" />
                            ) : act.category === 'BATCH' ? (
                              <Layers size={14} className="text-sky-600" />
                            ) : (
                              <Activity size={14} className="text-slate-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {act.title}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {act.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {act.status}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(act.timestamp).toLocaleDateString(
                              'en-IN',
                              {
                                day: 'numeric',
                                month: 'short',
                              },
                            )}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Upcoming Live Schedule */}
            <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Upcoming Schedule
                    </h2>
                    <p className="text-xs text-slate-500">
                      Scheduled live lectures, seminars & assigned faculty
                    </p>
                  </div>
                  <Link
                    href="/admin/batches"
                    className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Timetable & Scheduling</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>

                {overview.upcomingSessions.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-xs text-slate-500">
                    No upcoming live sessions currently scheduled.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {overview.upcomingSessions.slice(0, 6).map((sess) => {
                      const start = new Date(sess.startsAt);
                      const end = new Date(sess.endsAt);
                      return (
                        <Link
                          key={sess.id}
                          href={
                            sess.batchId
                              ? `/admin/batches/${sess.batchId}`
                              : '/admin/batches'
                          }
                          className="block p-3.5 rounded-xl border border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/20 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {sess.title}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {sess.courseTitle} • {sess.batchName}
                              </p>
                            </div>
                            <Badge
                              variant={
                                sess.status === 'LIVE' ? 'danger' : 'info'
                              }
                            >
                              {sess.status}
                            </Badge>
                          </div>
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Briefcase size={12} className="text-slate-400" />
                              {sess.teacherName}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} className="text-blue-500" />
                              {start.toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}
                              ,{' '}
                              {start.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              –{' '}
                              {end.toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ── TRANSACTION DETAIL MODAL ─────────────────────────────────────── */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Transaction Details
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedTransaction.paymentNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Student</span>
                <span className="font-bold text-slate-900">
                  {selectedTransaction.studentName}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Invoice Number</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedTransaction.invoiceNumber}
                </span>
              </div>
              {selectedTransaction.receiptNumber && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Receipt Number</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedTransaction.receiptNumber}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Course / Cohort</span>
                <span className="font-medium text-slate-800 text-right">
                  {selectedTransaction.courseName || 'General Fee'}
                  {selectedTransaction.batchName
                    ? ` (${selectedTransaction.batchName})`
                    : ''}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Gross Amount</span>
                <span className="font-semibold text-slate-800">
                  {formatINR(selectedTransaction.amount, currency)}
                </span>
              </div>
              {(selectedTransaction.reversedAmount || 0) > 0 && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-rose-600">Reversed Amount</span>
                  <span className="font-semibold text-rose-600">
                    -{formatINR(selectedTransaction.reversedAmount || 0, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-700 font-semibold">
                  Net Settled Amount
                </span>
                <span className="text-sm font-extrabold text-emerald-700">
                  {formatINR(
                    selectedTransaction.netAmount ?? selectedTransaction.amount,
                    currency,
                  )}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Payment Mode</span>
                <span className="font-medium text-slate-800">
                  {selectedTransaction.paymentMode.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Payment Date</span>
                <span className="text-slate-700">
                  {new Date(selectedTransaction.paymentDate).toLocaleString(
                    'en-IN',
                  )}
                </span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
                className="text-xs"
              >
                Close
              </Button>
              <Link href="/admin/finance">
                <Button variant="primary" size="sm" className="text-xs gap-1">
                  <span>Open Fee Ledger</span>
                  <ArrowUpRight size={13} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
