'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Download,
  Search,
  Filter,
  Edit3,
  X,
  Check,
  History,
  HelpCircle,
  BookOpen,
  Users,
  CreditCard,
  Settings,
  GraduationCap,
  Building2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  attendanceApi,
  batchApi,
  AttendanceOverviewDto,
  BatchDto,
  resolveVerifiedAdminContext,
  resolveActiveInstituteId,
} from '@/lib/api';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export interface AttendanceRecordItem {
  id: string;
  date: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  mode: string;
  remarks?: string;
  markedAt?: string;
  student: {
    id: string;
    admissionNo: string;
    fullName: string;
  };
  batch: {
    id: string;
    name: string;
  };
  course: {
    title: string;
  };
}

export default function AdminAttendancePage() {
  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id');
      if (stored) return stored;
    }
    return '';
  });

  useEffect(() => {
    if (!instituteId) {
      resolveActiveInstituteId().then((id) => {
        if (id) setInstituteId(id);
      });
    }
  }, [instituteId]);

  // Genuine Database State (Strict Zero-Mock: empty by default)
  const [overview, setOverview] = useState<AttendanceOverviewDto | null>(null);
  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Edit record modal
  const [editingRecord, setEditingRecord] = useState<AttendanceRecordItem | null>(null);
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'>('PRESENT');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Resolve admin context
  useEffect(() => {
    let active = true;
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (!active) return;
        if (ctx?.instituteId) setInstituteId(ctx.instituteId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch batches for filter dropdown
  useEffect(() => {
    if (!instituteId) return;
    batchApi
      .getBatches(instituteId)
      .then((res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setBatches(raw);
      })
      .catch(() => {});
  }, [instituteId]);

  // Load genuine overview and records from PostgreSQL
  const loadAttendanceData = useCallback(async () => {
    if (!instituteId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const overviewParams: any = {};
      if (selectedBatchId !== 'ALL') overviewParams.batchId = selectedBatchId;

      const recordsParams: any = {};
      if (selectedBatchId !== 'ALL') recordsParams.batchId = selectedBatchId;
      if (selectedStatus !== 'ALL') recordsParams.status = selectedStatus;
      if (dateFilter) recordsParams.date = dateFilter;
      if (searchQuery.trim()) recordsParams.search = searchQuery.trim();

      const [overviewRes, recordsRes] = await Promise.allSettled([
        attendanceApi.getOverview(instituteId, overviewParams),
        attendanceApi.getRecords(instituteId, recordsParams),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverview(overviewRes.value);
      } else {
        setOverview(null);
      }

      if (recordsRes.status === 'fulfilled' && recordsRes.value && Array.isArray(recordsRes.value.data)) {
        setRecords(recordsRes.value.data as any);
      } else {
        setRecords([]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to query attendance from PostgreSQL');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, selectedBatchId, selectedStatus, dateFilter, searchQuery]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  // Handle Update Record
  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setIsSubmitting(true);
    try {
      await attendanceApi.updateIndividualAttendance(instituteId, editingRecord.id, {
        status: editStatus,
        remarks: editRemarks,
      });

      setSaveSuccessMessage(`Attendance for ${editingRecord.student.fullName} updated with audit trail.`);
      setTimeout(() => setSaveSuccessMessage(''), 4000);
      setEditingRecord(null);
      loadAttendanceData();
    } catch (err: any) {
      alert(`Failed to update attendance: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const summary = overview?.summary || {
    totalRecords: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    excusedCount: 0,
    attendancePercentage: null,
  };

  const batchList = overview?.batches || [];

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6 pb-12">
        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadAttendanceData} className="gap-1 h-7 text-xs">
              <RefreshCw size={12} /> Retry
            </Button>
          </div>
        )}

        {/* Success Alert Banner */}
        {saveSuccessMessage && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {/* Header with Title and Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <CalendarCheck size={20} />
              </span>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Attendance Management
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live PostgreSQL roll-call records, cohort breakdown, and immutable audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/teacher/attendance">
              <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                <Edit3 size={14} />
                Open Faculty Roll-Call
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Attendance Rate"
            value={summary.attendancePercentage !== null ? `${summary.attendancePercentage}%` : '0%'}
            icon={<TrendingUp size={20} />}
            trend={`${summary.presentCount + summary.lateCount} of ${summary.totalRecords} sessions`}
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Total Sessions Marked"
            value={summary.totalRecords.toString()}
            icon={<Calendar size={20} />}
            trend={`${batchList.length} Active Cohorts`}
            trendPositive={true}
            colorScheme="purple"
          />
          <StatCard
            title="Present & Late"
            value={`${summary.presentCount + summary.lateCount}`}
            icon={<CheckCircle2 size={20} />}
            trend={`${summary.presentCount} On-time · ${summary.lateCount} Late`}
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Absences & Leaves"
            value={`${summary.absentCount + summary.excusedCount}`}
            icon={<XCircle size={20} />}
            trend={`${summary.absentCount} Absent · ${summary.excusedCount} Excused`}
            trendPositive={false}
            colorScheme="amber"
          />
        </div>

        {/* Batch-by-Batch Performance Overview */}
        <Card className="overflow-hidden border border-slate-200 shadow-sm p-0">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Batch Attendance Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">Performance metrics across verified cohorts</p>
            </div>
            <Badge variant="neutral">{batchList.length} Batches</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Batch Name & Course</th>
                  <th className="py-3 px-4">Enrolled Learners</th>
                  <th className="py-3 px-4">Total Records</th>
                  <th className="py-3 px-4">Present</th>
                  <th className="py-3 px-4">Late</th>
                  <th className="py-3 px-4">Absent</th>
                  <th className="py-3 px-4">Excused</th>
                  <th className="py-3 px-4 text-right">Attendance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No cohort attendance recorded yet in PostgreSQL.
                    </td>
                  </tr>
                ) : (
                  batchList.map((b) => (
                    <tr key={b.batchId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{b.batchName}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{b.courseTitle}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{b.totalEnrolled} students</td>
                      <td className="py-3 px-4 text-slate-600">{b.totalRecords} sessions</td>
                      <td className="py-3 px-4 text-emerald-600 font-semibold">{b.presentCount}</td>
                      <td className="py-3 px-4 text-amber-600 font-semibold">{b.lateCount}</td>
                      <td className="py-3 px-4 text-rose-600 font-semibold">{b.absentCount}</td>
                      <td className="py-3 px-4 text-blue-600 font-semibold">{b.excusedCount}</td>
                      <td className="py-3 px-4 text-right">
                        {b.attendancePercentage !== null ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              b.attendancePercentage >= 90
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : b.attendancePercentage >= 75
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {b.attendancePercentage}%
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No records</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Detailed Attendance Records Directory */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recorded Attendance Logs</h3>
              <p className="text-xs text-slate-500">Live roster records with audit logs on status revisions</p>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student or admission no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 md:w-56"
                />
              </div>

              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2 bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Batches</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1.5 px-2 bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="EXCUSED">Excused</option>
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-200 py-1 px-2 bg-white text-slate-700 focus:outline-none"
              />

              {(searchQuery || selectedBatchId !== 'ALL' || selectedStatus !== 'ALL' || dateFilter) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedBatchId('ALL');
                    setSelectedStatus('ALL');
                    setDateFilter('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 p-1.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden border border-slate-200 shadow-sm p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Course & Batch</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw size={16} className="animate-spin text-blue-600" />
                          <span>Loading attendance records from PostgreSQL...</span>
                        </div>
                      </td>
                    </tr>
                  ) : records.length > 0 ? (
                    records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-700">{r.date}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{r.student.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{r.student.admissionNo}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{r.course?.title}</div>
                          <div className="text-[11px] text-slate-400">{r.batch?.name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {r.mode}
                          </span>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(r.status)}</td>
                        <td className="py-3 px-4 text-slate-600 italic">
                          {r.remarks || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2.5 gap-1"
                            onClick={() => {
                              setEditingRecord(r);
                              setEditStatus(r.status);
                              setEditRemarks(r.remarks || '');
                            }}
                          >
                            <Edit3 size={12} />
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No attendance records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Quick Edit Modal */}
        {editingRecord && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-base font-bold text-slate-900">Revise Attendance Record</h4>
                  <p className="text-xs text-slate-500">Changes will be immutably recorded in the database audit log</p>
                </div>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="text-slate-400 hover:text-slate-700 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateRecord} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student</label>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800">
                    {editingRecord.student.fullName} ({editingRecord.student.admissionNo}) — {editingRecord.date}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditStatus(s)}
                        className={`p-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                          editStatus === s
                            ? s === 'PRESENT'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20'
                              : s === 'LATE'
                              ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-500/20'
                              : s === 'ABSENT'
                              ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-500/20'
                              : 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {editStatus === s && <Check size={13} />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Remarks / Justification <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Enter reason for revision (e.g. submitted medical note, corrected roll-call error)"
                    className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRecord(null)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Audit Logged Revision'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
