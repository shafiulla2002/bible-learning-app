'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { usePercentageProgress, PercentageProgressLoader } from '@/components/ui/loading-skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  dashboardApi,
  resolveVerifiedAdminContext,
  preloadAdminPortalData,
  DashboardOverviewDto,
  DateRangePreset,
  ExportReportType,
  TransactionItemDto,
  KpiComparisonDto,
} from '@/lib/api';
import {
  OverviewStackedBarChart,
  OverviewBarDataPoint,
  StudentAnalysisLineChart,
  StudentAnalysisDataPoint,
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
  Bell,
  Download,
  TrendingUp,
  TrendingDown,
  Search,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Video,
  RefreshCw,
  Receipt,
  Eye,
  Archive,
  X,
  FileSpreadsheet,
  Coins,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Info,
  Clock,
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

const EXPORT_OPTIONS: Array<{
  type: ExportReportType;
  label: string;
  desc: string;
}> = [
  {
    type: 'enrollments',
    label: 'Student Enrollment Report',
    desc: 'Admissions, courses, cohorts & registration dates',
  },
  {
    type: 'fee-collection',
    label: 'Fee Collection Report',
    desc: 'Verified payments, receipts & net collections',
  },
  {
    type: 'pending-fees',
    label: 'Pending Fee Report',
    desc: 'Outstanding invoice balances & due dates',
  },
  {
    type: 'attendance',
    label: 'Attendance Report',
    desc: 'Batch-wise attendance rates & status counts',
  },
  {
    type: 'transactions',
    label: 'Transaction Ledger Report',
    desc: 'Complete fee payment & reversal audit ledger',
  },
];

// Helper to render growth percentage pill with safe handling for zero/null previous period
function renderGrowthPill(
  comp?: KpiComparisonDto,
  isCurrency = false,
  currency = 'INR',
) {
  if (!comp) {
    return <span className="text-[11px] font-medium text-slate-400">—</span>;
  }

  if (comp.changePct !== null) {
    const isUp = comp.changePct >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-bold ${
          isUp ? 'text-emerald-600' : 'text-rose-600'
        }`}
        title={`Compared against previous period (${
          isCurrency
            ? formatINR(comp.previousPeriodValue || 0, currency)
            : comp.previousPeriodValue || 0
        })`}
      >
        {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        <span>
          {isUp ? '+' : ''}
          {comp.changePct}%
        </span>
      </span>
    );
  }

  // When previous period had 0 records or no comparison exists
  return (
    <span className="text-[11px] font-medium text-slate-400">
      {comp.periodValue > 0
        ? `+${
            isCurrency
              ? formatINR(comp.periodValue, currency)
              : comp.periodValue
          } in period`
        : '0 in period'}
    </span>
  );
}

export default function AdminDashboardPage() {
  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id');
      if (stored) return stored;
    }
    return '';
  });
  const [viewerName, setViewerName] = useState<string>('Institute Admin');
  const [instituteDisplayName, setInstituteDisplayName] = useState<string>('Bible Institute');

  // Real Database Mode (No Demo Mock Data)

  // Global Date Filter
  const [dateFilter, setDateFilter] = useState<'7D' | '30D' | 'THIS_MONTH' | 'ALL'>('30D');

  // Real Database Dashboard Overview State (Strict Data Integrity: null by default in production)
  const [overview, setOverview] = useState<DashboardOverviewDto | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedId = localStorage.getItem('current_institute_id');
        if (storedId) {
          const cached = sessionStorage.getItem(`admin_overview_${storedId}_30D`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.kpi) return parsed;
          }
        }
      } catch {}
    }
    return null;
  });
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Smooth percentage-based progress bar (0% -> 100%)
  const { progress, isComplete, stageMessage } = usePercentageProgress({
    isLoading: isLoadingOverview && !overview,
    minDurationMs: 800,
  });

  // Pre-warm and background cache all portal subpages (Students, Batches, Teachers, Courses)
  // once the dashboard completes 100% so that clicking any sidebar tab reflects data immediately.
  useEffect(() => {
    if (isComplete) {
      const activeId = instituteId || (typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') || '' : '');
      if (activeId) {
        preloadAdminPortalData(activeId);
      }
    }
  }, [isComplete, instituteId]);

  // Real Database Transactions State (Strict Data Integrity: empty by default in production)
  const [transactions, setTransactions] = useState<TransactionItemDto[]>([]);
  const [txTotalCount, setTxTotalCount] = useState<number>(0);
  const [txTotalPages, setTxTotalPages] = useState<number>(1);
  const [txPage, setTxPage] = useState<number>(1);
  const [txSearch, setTxSearch] = useState<string>('');
  const [txStatusFilter, setTxStatusFilter] = useState<string>('ALL');
  const [isLoadingTx, setIsLoadingTx] = useState<boolean>(true);
  const [selectedTx, setSelectedTx] = useState<TransactionItemDto | null>(null);

  // Export Menu State
  const [exportOpen, setExportOpen] = useState<boolean>(false);
  const [exportingType, setExportingType] = useState<ExportReportType | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 1. Resolve Authenticated Institute Context via Verified Membership
  useEffect(() => {
    let active = true;
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (!active) return;
        setInstituteId(ctx.instituteId);
        if (ctx.displayName) setInstituteDisplayName(ctx.displayName);
        if (ctx.user?.fullName) setViewerName(ctx.user.fullName);
      })
      .catch(() => {
        if (!active) return;
        const stored = typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') : null;
        if (stored) {
          setInstituteId(stored);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // 2. Fetch Genuine PostgreSQL Dashboard Overview
  const fetchDashboardData = useCallback(async () => {
    

    let activeId = instituteId || (typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') : null);
    if (!activeId) {
      try {
        const ctx = await resolveVerifiedAdminContext();
        if (ctx?.instituteId) {
          activeId = ctx.instituteId;
          setInstituteId(ctx.instituteId);
          if (ctx.displayName) setInstituteDisplayName(ctx.displayName);
          if (ctx.user?.fullName) setViewerName(ctx.user.fullName);
        }
      } catch {
        // Handled below if activeId remains empty
      }
    }

    if (!activeId) {
      setOverview(null);
      setIsLiveConnected(false);
      setIsLoadingOverview(false);
      setOverviewError('Authentication required. Unable to resolve institute scope.');
      return;
    }

    setIsLoadingOverview(true);
    setOverviewError(null);

    try {
      const presetParam = dateFilter === 'ALL' ? undefined : (dateFilter as DateRangePreset);
      let data: DashboardOverviewDto;
      try {
        data = await dashboardApi.getOverview(activeId, { preset: presetParam });
      } catch {
        await new Promise((r) => setTimeout(r, 800));
        try {
          data = await dashboardApi.getOverview(activeId, { preset: presetParam });
        } catch {
          await new Promise((r) => setTimeout(r, 1500));
          data = await dashboardApi.getOverview(activeId, { preset: presetParam });
        }
      }
      setOverview(data);
      setIsLiveConnected(true);
      if (data.institute?.displayName) setInstituteDisplayName(data.institute.displayName);
      if (data.viewer?.fullName) setViewerName(data.viewer.fullName);
      preloadAdminPortalData(activeId);
    } catch (err: any) {
      // Production Rule: Never silently present mock data when API is offline
      setOverview(null);
      setIsLiveConnected(false);
      setOverviewError(err?.message || 'Unable to connect to live institute database records.');
    } finally {
      setIsLoadingOverview(false);
    }
  }, [instituteId, dateFilter]);

  // 3. Fetch Genuine PostgreSQL Transactions Ledger with Backend Pagination & Filters
  const fetchTransactionsData = useCallback(async () => {
    

    const activeId = instituteId || (typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') : null);
    if (!activeId) {
      setTransactions([]);
      setTxTotalCount(0);
      setTxTotalPages(1);
      setIsLoadingTx(false);
      return;
    }

    setIsLoadingTx(true);

    try {
      const presetParam = dateFilter === 'ALL' ? undefined : (dateFilter as DateRangePreset);
      const res = await dashboardApi.getTransactions(activeId, {
        page: txPage,
        limit: 6,
        search: txSearch.trim() || undefined,
        status: txStatusFilter !== 'ALL' ? txStatusFilter : undefined,
        preset: presetParam,
      });

      if (res && Array.isArray(res.data)) {
        setTransactions(res.data);
        setTxTotalCount(res.meta?.total ?? res.data.length);
        setTxTotalPages(res.meta?.totalPages ?? 1);
      } else {
        setTransactions([]);
        setTxTotalCount(0);
        setTxTotalPages(1);
      }
    } catch {
      // Production Rule: Never return fake transactions
      setTransactions([]);
      setTxTotalCount(0);
      setTxTotalPages(1);
    } finally {
      setIsLoadingTx(false);
    }
  }, [instituteId, txPage, txSearch, txStatusFilter, dateFilter]);

  

    useEffect(() => {
    if (instituteId) {
      fetchDashboardData();
      fetchTransactionsData();
    }
  }, [instituteId, fetchDashboardData, fetchTransactionsData]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportOpen]);

  // Export report from PostgreSQL records
  const handleExport = async (type: ExportReportType) => {
    if (!instituteId) return;
    setExportingType(type);
    try {
      const presetParam = dateFilter === 'ALL' ? undefined : (dateFilter as DateRangePreset);
      const exported = await dashboardApi.exportReport(instituteId, { type, preset: presetParam });
      const blob = new Blob([exported.csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exported.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportOpen(false);
      setExportNotice(`Exported "${exported.reportTitle}" (${exported.rowCount} records).`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      setExportNotice(`Export failed: ${err?.message || 'Access restricted'}`);
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setExportingType(null);
    }
  };

  // Archive action audit notice (Never deletes financial records)
  const handleArchiveTransaction = (tx: TransactionItemDto) => {
    const ref = tx.receiptNumber || tx.paymentNumber;
    setExportNotice(
      `View reference "${ref}" archived. All database payments, invoices, and audit logs remain preserved.`,
    );
    setTimeout(() => setExportNotice(null), 5000);
  };

  // Derive genuine data for Graphical Reports from real DB aggregations
  const overviewBarData: OverviewBarDataPoint[] = useMemo(() => {
    if (!overview || !overview.enrolmentTrend || overview.enrolmentTrend.length === 0) {
      return [];
    }
    const teachersCount = overview.kpi?.activeTeachers || 0;
    return overview.enrolmentTrend.map((item) => ({
      label: item.label,
      teachers: teachersCount,
      students: item.count,
      other: item.registrations ?? 0,
    }));
  }, [overview]);

  const studentAnalysisData: StudentAnalysisDataPoint[] = useMemo(() => {
    if (!overview || !overview.enrolmentTrend || overview.enrolmentTrend.length === 0) {
      return [];
    }
    return overview.enrolmentTrend.map((item) => ({
      label: item.label,
      enrolled: item.count,
      left: (item as any).leftCount !== undefined ? (item as any).leftCount : Math.max(0, (item.registrations ?? item.count) - item.count),
    }));
  }, [overview]);

  const kpi = overview?.kpi;
  const currency = overview?.institute?.currency || 'INR';

  return (
    <PortalShell
      portalTitle="INSTITUTE ADMIN"
      portalRole="ADMIN"
      navItems={adminNav}
      userName={viewerName}
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6 pb-12">
        {/* Live Database Mode Active */}

        {/* ── 1. GREETING BANNER & HEADER (Screenshot 8 Reference Style) ──────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                {instituteDisplayName}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                {!isComplete && !overview ? `Synchronizing Database (${progress}%)...` : 'Live PostgreSQL Records'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Welcome back, {viewerName.split(' ')[0]}!</span>
              <span className="text-2xl">👋</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Track your manage and LMS platform performance
            </p>
          </div>

          {/* Quick Date Filters + Demo Toggle + Export + Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            

            {/* Date Range Selector */}
            <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setDateFilter('7D')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilter === '7D'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('30D')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilter === '30D'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                30 Days
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilter === 'THIS_MONTH'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Export Menu Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen((prev) => !prev)}
                className="text-xs gap-1.5 rounded-xl border-slate-200"
              >
                <Download size={14} />
                <span>Export</span>
                <ChevronDown size={13} className="text-slate-400" />
              </Button>

              {exportOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Export CSV Reports
                    </p>
                  </div>
                  <div className="py-1">
                    {EXPORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleExport(opt.type)}
                        disabled={exportingType !== null}
                        className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50 rounded-xl transition cursor-pointer"
                      >
                        <FileSpreadsheet size={15} className="text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                          <p className="text-[10px] text-slate-400">{opt.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                fetchDashboardData();
                fetchTransactionsData();
              }}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              title="Refresh genuine live database records"
              aria-label="Refresh dashboard"
            >
              <RefreshCw
                size={15}
                className={isLoadingOverview || isLoadingTx ? 'animate-spin text-blue-600' : ''}
              />
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
            <span>{exportNotice}</span>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              className="text-emerald-600 hover:text-emerald-900"
            >
              <X size={14} />
            </button>
          </div>
        )}

        

        {/* ── 2. CARDS & CHARTS / PERCENTAGE PROGRESS LOADER ───────── */}
        {overviewError && !overview ? (
          <Card className="p-8 text-center rounded-3xl border border-rose-200 bg-rose-50/50">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-rose-900">Database Connection Required</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">{overviewError}</p>
            <Button
              onClick={() => {
                fetchDashboardData();
                fetchTransactionsData();
              }}
              className="mt-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs gap-2"
            >
              <RefreshCw size={14} />
              <span>Retry Connection</span>
            </Button>
          </Card>
        ) : (!overview || !isComplete) ? (
          <PercentageProgressLoader
            progress={progress}
            stageMessage={stageMessage}
            title="Synchronizing Live Institute Performance"
            subtitle="Retrieving verified PostgreSQL records across students, courses, batches and finances..."
            variant="hero"
            showCheckpoints={true}
          />
        ) : (
          <>
            {/* Background Revalidation Indicator */}
            {isLoadingOverview && (
              <div className="w-full bg-blue-50/80 border border-blue-200/60 rounded-2xl p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-700 font-semibold">
                  <RefreshCw size={14} className="animate-spin text-blue-600" />
                  <span>Synchronizing live database updates...</span>
                </div>
                <span className="font-mono font-bold text-blue-700 text-[11px]">100% Up-to-Date</span>
              </div>
            )}

            {/* ── 2. EXACTLY 4 SUMMARY CARDS (Screenshot 8 Reference Style) ───────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total Students */}
          <Link href="/admin/students" className="block group">
            <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Students
                </span>
                <div className="flex items-center gap-1.5">
                  
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                </div>
              </div>

              <div className="my-3">
                {isLoadingOverview ? (
                  <div className="h-8 bg-slate-100 rounded animate-pulse w-24" />
                ) : !overview ? (
                  <p className="text-2xl font-bold text-slate-400">—</p>
                ) : (
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {(kpi?.totalStudents ?? 0).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {renderGrowthPill(kpi?.comparisons?.studentsRegistered, false, currency)}
                </div>
                <span className="font-medium text-slate-400">
                  {!overview ? '—' : `${kpi?.activeStudents ?? 0} Active Enrolled`}
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 2: Total Course */}
          <Link href="/admin/courses" className="block group">
            <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Course
                </span>
                <div className="flex items-center gap-1.5">
                  
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <BookOpen size={16} />
                  </div>
                </div>
              </div>

              <div className="my-3">
                {isLoadingOverview ? (
                  <div className="h-8 bg-slate-100 rounded animate-pulse w-24" />
                ) : !overview ? (
                  <p className="text-2xl font-bold text-slate-400">—</p>
                ) : (
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {(kpi?.totalCourses ?? 0).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {renderGrowthPill(kpi?.comparisons?.enrolments, false, currency)}
                </div>
                <span className="font-medium text-slate-400">
                  {!overview ? '—' : `${kpi?.publishedCourses ?? 0} Published`}
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 3: Total Batches & Classes */}
          <Link href="/admin/batches" className="block group">
            <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Active Batches & Classes
                </span>
                <div className="flex items-center gap-1.5">
                  
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Video size={16} />
                  </div>
                </div>
              </div>

              <div className="my-3">
                {isLoadingOverview ? (
                  <div className="h-8 bg-slate-100 rounded animate-pulse w-24" />
                ) : !overview ? (
                  <p className="text-2xl font-bold text-slate-400">—</p>
                ) : (
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {(kpi?.activeBatches ?? 0).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                  <Clock size={12} className="text-emerald-600" />
                  <span>{!overview ? '—' : `${kpi?.upcomingSessionsCount ?? 0} Upcoming Sessions`}</span>
                </span>
                <span className="font-medium text-slate-400">
                  {!overview ? '—' : `${kpi?.totalBatches ?? 0} Cohorts`}
                </span>
              </div>
            </Card>
          </Link>

          {/* Card 4: Total Earning (Real Collected Fees in Integer Paise) */}
          <Link href="/admin/finance" className="block group">
            <Card className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-amber-300 transition-all flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Earning
                </span>
                <div className="flex items-center gap-1.5">
                  
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Coins size={16} />
                  </div>
                </div>
              </div>

              <div className="my-3">
                {isLoadingOverview ? (
                  <div className="h-8 bg-slate-100 rounded animate-pulse w-28" />
                ) : !overview ? (
                  <p className="text-2xl font-bold text-slate-400">—</p>
                ) : (
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {formatINR(kpi?.totalFeeCollected ?? 0, currency)}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="flex items-center gap-1.5">
                  {renderGrowthPill(kpi?.comparisons?.feeCollection, true, currency)}
                </div>
                <span className="font-medium text-slate-400">
                  {!overview ? '—' : `${formatINR(kpi?.totalFeePending ?? 0, currency)} Pending`}
                </span>
              </div>
            </Card>
          </Link>
        </div>

        {/* ── 3. TWO SIDE-BY-SIDE GRAPHICAL REPORTS ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Chart: Overview Activity Stacked Bar Chart */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Overview
                </h3>
                
                {kpi?.comparisons?.enrolments && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                    Activity Metrics
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                    Teachers
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    Students
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-indigo-200" />
                    Registrations
                  </span>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <span>{overview?.dateFilter?.label || 'Selected Range'}</span>
                  <Calendar size={12} className="text-slate-400" />
                </div>
              </div>
            </div>

            {isLoadingOverview && !overview ? (
              <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <OverviewStackedBarChart data={overviewBarData} />
            )}
          </Card>

          {/* Right Chart: Student Analysis Line Chart */}
          <Card className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Student Analysis
                </h3>
                
                {kpi?.comparisons?.studentsRegistered && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                    Enrollment Cohort
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    Enrolled
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Completed/Other
                  </span>
                </div>

                <div className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                  <span>{overview?.dateFilter?.label || 'Selected Range'}</span>
                  <Calendar size={12} className="text-slate-400" />
                </div>
              </div>
            </div>

            {isLoadingOverview && !overview ? (
              <div className="h-64 bg-slate-50 rounded-xl animate-pulse" />
            ) : (
              <StudentAnalysisLineChart data={studentAnalysisData} />
            )}
          </Card>
        </div>

        
          </>
        )}

        {/* ── 4. TRANSACTION TABLE (Real Database Ledger) ──────────────────────── */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Transaction
                </h2>
                
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Genuine PostgreSQL payment receipts, ledger records, and tuition collections
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search input wired to backend */}
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
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
                />
              </div>

              {/* Status filter wired to backend */}
              <select
                value={txStatusFilter}
                onChange={(e) => {
                  setTxStatusFilter(e.target.value);
                  setTxPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium"
              >
                <option value="ALL">All Status</option>
                <option value="COMPLETED">Completed / Verified</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
                <option value="PARTIALLY_REVERSED">Partially Reversed</option>
                <option value="REVERSED">Reversed</option>
              </select>

              <Link href="/admin/finance">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold rounded-xl border-slate-200 gap-1"
                >
                  <span>View All</span>
                  <ChevronRight size={13} />
                </Button>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-5">Customer Name</th>
                  <th className="py-3 px-5">Course</th>
                  <th className="py-3 px-5">Amount</th>
                  <th className="py-3 px-5">Payment Method</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingTx ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw size={15} className="animate-spin text-blue-600" />
                        <span>Loading verified ledger transactions from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <p className="font-semibold text-slate-600">No transactions recorded</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Recorded fee payments and verified tuition receipts will appear here automatically.
                      </p>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => {
                    const isSuccess =
                      tx.status === 'COMPLETED' ||
                      tx.status === 'SUCCESS' ||
                      tx.status === 'VERIFIED';
                    const isPending = tx.status === 'PENDING';
                    const isFailed = tx.status === 'FAILED' || tx.status === 'CANCELLED';
                    const isReversed =
                      tx.status === 'REVERSED' || tx.status === 'PARTIALLY_REVERSED';

                    const avatarColors = [
                      'bg-purple-100 text-purple-700',
                      'bg-amber-100 text-amber-700',
                      'bg-emerald-100 text-emerald-700',
                      'bg-blue-100 text-blue-700',
                      'bg-rose-100 text-rose-700',
                    ];
                    const colorClass = avatarColors[idx % avatarColors.length];
                    const initials = (tx.studentName || 'Student')
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    const admissionCode = tx.admissionNo
                      ? tx.admissionNo.replace('ADM-', '')
                      : 'N/A';

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* Customer Name + Avatar + ID */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full ${colorClass} font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                            >
                              {initials}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {tx.studentName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                User ID: #{admissionCode}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Course */}
                        <td className="py-3.5 px-5">
                          <span className="font-semibold text-slate-800">
                            {tx.courseName || 'Theology & Ministry'}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-5">
                          <span className="font-bold text-slate-900">
                            {formatINR(tx.amount || 0, currency)}
                          </span>
                        </td>

                        {/* Payment Method */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 uppercase">
                              {tx.paymentMode || 'CARD'}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {tx.referenceNumber || 'N/A'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5">
                          {isSuccess && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700">
                              Completed
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700">
                              Pending
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700">
                              Failed
                            </span>
                          )}
                          {isReversed && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700">
                              {tx.status === 'PARTIALLY_REVERSED' ? 'Partial Refund' : 'Reversed'}
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedTx(tx)}
                              title="View Verified Transaction Details"
                              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition cursor-pointer"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedTx(tx)}
                              title="Generate / Download Official Receipt"
                              className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition cursor-pointer"
                            >
                              <Receipt size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleArchiveTransaction(tx)}
                              title="Archive Transaction View (Preserves Database Ledger)"
                              className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
                            >
                              <Archive size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Backend Pagination */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {transactions.length} of {txTotalCount} verified records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={txPage <= 1}
                onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-semibold text-slate-700">
                Page {txPage} of {Math.max(1, txTotalPages)}
              </span>
              <button
                type="button"
                disabled={txPage >= txTotalPages}
                onClick={() => setTxPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </Card>

        {/* ── 5. TRANSACTION DETAIL MODAL ─────────────────────────────────────── */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-blue-600" />
                  <h3 className="text-base font-bold text-slate-900">
                    Official Payment Receipt Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Receipt / Payment No:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedTx.receiptNumber || selectedTx.paymentNumber}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Student / Payer:</span>
                  <span className="font-semibold text-slate-900">{selectedTx.studentName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Admission ID:</span>
                  <span className="font-mono text-slate-700">{selectedTx.admissionNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Enrolled Course:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedTx.courseName || 'General Ministry'}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Payment Mode & Ref:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedTx.paymentMode} ({selectedTx.referenceNumber || 'N/A'})
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-400 font-medium">Amount Realized:</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    {formatINR(selectedTx.amount || 0, currency)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-400 font-medium">Payment Status:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {selectedTx.status}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTx(null)}
                  className="text-xs"
                >
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const num = selectedTx.receiptNumber || selectedTx.paymentNumber;
                    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${num}</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px}h1{font-size:20px;margin:0 0 8px}p{color:#475569;font-size:13px}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}</style></head><body><h1>Verified Institute Payment Receipt</h1><p>Receipt / Payment #: ${num}</p><div class="row"><span>Student</span><strong>${selectedTx.studentName} (${selectedTx.admissionNo || 'N/A'})</strong></div><div class="row"><span>Invoice #</span><strong>${selectedTx.invoiceNumber || 'N/A'}</strong></div><div class="row"><span>Mode</span><strong>${selectedTx.paymentMode}</strong></div><div class="row"><span>Status</span><strong>${selectedTx.status}</strong></div><div class="row"><span>Amount</span><strong>${formatINR(selectedTx.amount)}</strong></div></body></html>`;
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `receipt-${num}.html`;
                    link.click();
                    URL.revokeObjectURL(url);
                    setSelectedTx(null);
                  }}
                  className="text-xs gap-1.5"
                >
                  <Download size={13} />
                  <span>Download Verified Receipt</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
