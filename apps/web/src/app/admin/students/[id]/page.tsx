'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  studentApi,
  StudentDetailDto,
  resolveVerifiedAdminContext,
} from '@/lib/api';
import { formatINR } from '@/components/dashboard/dashboard-charts';
import {
  Users,
  ChevronLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Church,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  AlertCircle,
  GraduationCap,
  RefreshCw,
  Building2,
  Download,
  Receipt,
  FileText,
  Search,
  Filter,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const studentId = params.id as string;

  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id');
      if (stored) return stored;
    }
    return 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
  });

  const [student, setStudent] = useState<StudentDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'GUARDIAN' | 'ENROLMENTS' | 'FINANCE'>('PERSONAL');
  const [notification, setNotification] = useState<string | null>(null);

  // Financial History State
  const [financeData, setFinanceData] = useState<{
    summary: {
      totalFeeAmount: number;
      totalPaidAmount: number;
      pendingBalance: number;
      totalInstallments: number;
      nextDueDate: string | null;
    };
    invoices: Array<any>;
    transactions: Array<any>;
  } | null>(null);
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);
  const [financeSearch, setFinanceSearch] = useState('');
  const [financeStatusFilter, setFinanceStatusFilter] = useState('ALL');

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

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

  const fetchStudentData = useCallback(async () => {
    if (!instituteId || !studentId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await studentApi.getStudent(instituteId, studentId);
      setStudent(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load student from database');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, studentId]);

  const fetchFinanceHistory = useCallback(async () => {
    if (!instituteId || !studentId) return;
    setIsLoadingFinance(true);
    try {
      const data = await studentApi.getFinanceHistory(instituteId, studentId);
      setFinanceData(data);
    } catch (err: any) {
      console.error('Failed to load student finance history:', err);
    } finally {
      setIsLoadingFinance(false);
    }
  }, [instituteId, studentId]);

  useEffect(() => {
    fetchStudentData();
    fetchFinanceHistory();
  }, [fetchStudentData, fetchFinanceHistory]);

  const handleDelete = async () => {
    if (!student || !instituteId || !studentId) return;
    if (!confirm(`Are you sure you want to permanently delete student "${student.fullName}"? This action cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await studentApi.deleteStudent(instituteId, studentId);
      router.push('/admin/students');
    } catch (err: any) {
      alert(`Failed to delete student: ${err?.message || 'Server error'}`);
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!instituteId || !studentId) return;
    try {
      await studentApi.updateStatus(instituteId, studentId, newStatus);
      showNotification(`Student status updated to ${newStatus}`);
      fetchStudentData();
    } catch (err: any) {
      showNotification(`Failed to update status: ${err?.message || 'Server error'}`);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!financeData?.transactions) return [];
    return financeData.transactions.filter((tx) => {
      if (financeStatusFilter !== 'ALL' && tx.status !== financeStatusFilter) return false;
      if (financeSearch) {
        const q = financeSearch.toLowerCase();
        const matches =
          tx.paymentNumber?.toLowerCase().includes(q) ||
          tx.receiptNumber?.toLowerCase().includes(q) ||
          tx.invoiceNumber?.toLowerCase().includes(q) ||
          tx.referenceNumber?.toLowerCase().includes(q) ||
          tx.feeDescription?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [financeData, financeSearch, financeStatusFilter]);

  const initials = (student?.fullName || 'Student')
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('');

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6 max-w-6xl">
        {/* Toast Alert */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Back Link */}
        <div>
          <Link
            href="/admin/students"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition"
          >
            <ChevronLeft size={16} />
            Back to Student Directory
          </Link>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
            <div className="inline-flex items-center gap-2 text-sm">
              <RefreshCw size={18} className="animate-spin text-blue-600" />
              <span>Fetching genuine student records from PostgreSQL...</span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <Button size="sm" variant="outline" onClick={fetchStudentData}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && student && (
          <>
            {/* Header Hero Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                {student.avatarUrl ? (
                  <img
                    src={student.avatarUrl}
                    alt={student.fullName}
                    className="w-16 h-16 rounded-2xl object-cover shadow-md border border-slate-200 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xl shadow-md shrink-0">
                    {initials}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-slate-900">{student.fullName}</h2>
                    <Badge
                      variant={
                        student.status === 'ACTIVE'
                          ? 'success'
                          : student.status === 'UNDER_REVIEW'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {student.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                    <span className="font-mono font-medium text-slate-700">{student.admissionNo}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone size={13} className="text-slate-400" />
                      {student.phoneNumber}
                    </span>
                    {student.email && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Mail size={13} className="text-slate-400" />
                          {student.email}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                {student.status !== 'ACTIVE' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleStatusChange('ACTIVE')}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Approve & Activate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange('INACTIVE')}
                    className="text-xs text-slate-500 hover:text-rose-600"
                  >
                    Deactivate
                  </Button>
                )}
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold overflow-x-auto pb-px">
              <button
                onClick={() => setActiveTab('PERSONAL')}
                className={`py-2.5 px-4 rounded-t-lg transition border-b-2 cursor-pointer ${
                  activeTab === 'PERSONAL'
                    ? 'border-blue-600 text-blue-600 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Personal & Contact
              </button>
              <button
                onClick={() => setActiveTab('GUARDIAN')}
                className={`py-2.5 px-4 rounded-t-lg transition border-b-2 cursor-pointer ${
                  activeTab === 'GUARDIAN'
                    ? 'border-blue-600 text-blue-600 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Guardian & Address
              </button>
              <button
                onClick={() => setActiveTab('ENROLMENTS')}
                className={`py-2.5 px-4 rounded-t-lg transition border-b-2 cursor-pointer ${
                  activeTab === 'ENROLMENTS'
                    ? 'border-blue-600 text-blue-600 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Course Enrolments ({student.enrolments?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('FINANCE')}
                className={`py-2.5 px-4 rounded-t-lg transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'FINANCE'
                    ? 'border-blue-600 text-blue-600 bg-white font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <CreditCard size={14} />
                Fee & Payment History
              </button>
            </div>

            {/* Tab 1: Personal & Contact */}
            {activeTab === 'PERSONAL' && (
              <Card className="p-6">
                <div className="p-0 pb-4 mb-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Personal & Academic Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Full Legal Name</span>
                    <p className="font-semibold text-slate-800 text-sm">{student.fullName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Admission Number</span>
                    <p className="font-mono font-semibold text-slate-800 text-sm">{student.admissionNo}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Gender</span>
                    <p className="font-semibold text-slate-800">{student.gender || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Preferred Language</span>
                    <p className="font-semibold text-slate-800">{student.preferredLanguage}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Home Church / Affiliation</span>
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Church size={14} className="text-blue-600" />
                      {student.church || 'Unspecified Assembly'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Admission Date</span>
                    <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      {student.admissionDate.slice(0, 10)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Tab 2: Guardian & Address */}
            {activeTab === 'GUARDIAN' && (
              <Card className="p-6">
                <div className="p-0 pb-4 mb-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Guardian & Residential Address</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Guardian Name</span>
                    <p className="font-semibold text-slate-800">
                      {(student.guardian as any)?.name || 'Not provided'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Guardian Contact Phone</span>
                    <p className="font-semibold text-slate-800">
                      {(student.guardian as any)?.phoneNumber || 'Not provided'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-400 block mb-1">Residential Address</span>
                    <p className="font-semibold text-slate-800 flex items-start gap-1.5">
                      <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      {(student.address as any)?.city
                        ? `${(student.address as any).street || ''}, ${(student.address as any).city}, ${(student.address as any).state || ''} ${(student.address as any).country || ''}`
                        : 'No residential address on file'}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Tab 3: Course Enrolments */}
            {activeTab === 'ENROLMENTS' && (
              <Card className="p-6">
                <div className="p-0 pb-4 mb-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Active Course Enrolments</h3>
                </div>

                {(!student.enrolments || student.enrolments.length === 0) ? (
                  <p className="text-xs text-slate-400 py-4">No course enrolments recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {student.enrolments.map((enr) => (
                      <div
                        key={enr.id}
                        className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{enr.courseTitle}</span>
                            <Badge variant={enr.status === 'ACTIVE' ? 'success' : 'neutral'}>
                              {enr.status}
                            </Badge>
                          </div>
                          <p className="text-slate-500 mt-0.5">
                            Cohort: <span className="font-semibold text-slate-700">{enr.batchName || 'Unassigned'}</span>
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          Enrolled: {enr.enrolledAt.slice(0, 10)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Tab 4: Fee & Payment History (Phase 4 Implementation) */}
            {activeTab === 'FINANCE' && (
              <div className="space-y-6">
                {/* 5 Financial Summary KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                      1. Total Fee Amount
                    </span>
                    <p className="text-lg font-extrabold text-slate-900">
                      {formatINR(financeData?.summary?.totalFeeAmount || 0)}
                    </p>
                    <span className="text-[10px] text-slate-400">All term invoices</span>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                    <span className="text-[11px] font-semibold text-emerald-600 block mb-1">
                      2. Total Paid Amount
                    </span>
                    <p className="text-lg font-extrabold text-emerald-700">
                      {formatINR(financeData?.summary?.totalPaidAmount || 0)}
                    </p>
                    <span className="text-[10px] text-emerald-600">Reconciled payments</span>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                    <span className="text-[11px] font-semibold text-amber-600 block mb-1">
                      3. Pending Balance
                    </span>
                    <p className="text-lg font-extrabold text-amber-700">
                      {formatINR(financeData?.summary?.pendingBalance || 0)}
                    </p>
                    <span className="text-[10px] text-amber-600">Outstanding fee</span>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                    <span className="text-[11px] font-semibold text-indigo-600 block mb-1">
                      4. Total Installments
                    </span>
                    <p className="text-lg font-extrabold text-indigo-700">
                      {financeData?.summary?.totalInstallments || 1}
                    </p>
                    <span className="text-[10px] text-indigo-500">Scheduled plans</span>
                  </div>

                  <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                      5. Next Due Date
                    </span>
                    <p className="text-sm font-bold text-slate-800">
                      {financeData?.summary?.nextDueDate || 'Fully Paid'}
                    </p>
                    <span className="text-[10px] text-slate-400">Deadline</span>
                  </div>
                </div>

                {/* Transaction Search & Filter Bar */}
                <Card className="p-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        placeholder="Search invoice, receipt, UTR reference..."
                        value={financeSearch}
                        onChange={(e) => setFinanceSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={financeStatusFilter}
                        onChange={(e) => setFinanceStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ALL">All Payment Statuses</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PARTIALLY_REVERSED">Partially Reversed</option>
                        <option value="REVERSED">Reversed</option>
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchFinanceHistory}
                        className="text-xs gap-1"
                        title="Refresh payment records"
                      >
                        <RefreshCw size={13} className={isLoadingFinance ? 'animate-spin' : ''} />
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Complete Transaction Table (Phase 4 Table Specification) */}
                <Card className="p-0 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Payment & Receipt Transaction Ledger
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Authenticated PostgreSQL financial records with integer-paise calculations.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {filteredTransactions.length} Transactions
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Invoice #</th>
                          <th className="py-3 px-4">Receipt #</th>
                          <th className="py-3 px-4">Payment Date</th>
                          <th className="py-3 px-4">Fee Description</th>
                          <th className="py-3 px-4">Invoice Total</th>
                          <th className="py-3 px-4">Amount Paid</th>
                          <th className="py-3 px-4">Method</th>
                          <th className="py-3 px-4">UTR / Ref</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoadingFinance ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-400">
                              <RefreshCw size={16} className="animate-spin inline mr-2" />
                              Loading transaction records...
                            </td>
                          </tr>
                        ) : filteredTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-12 text-center text-slate-400">
                              <Receipt size={32} className="mx-auto mb-2 opacity-40 text-slate-300" />
                              <p className="font-semibold text-slate-600">No payment records found for this student</p>
                              <p className="text-[11px] mt-0.5">Payments recorded in the Finance module will appear here.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/60 transition">
                              <td className="py-3.5 px-4 font-mono font-bold text-blue-600 text-[11px]">
                                {tx.invoiceNumber}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-medium text-slate-700 text-[11px]">
                                {tx.receiptNumber}
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                {tx.paymentDate.slice(0, 10)}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs truncate">
                                {tx.feeDescription}
                              </td>
                              <td className="py-3.5 px-4 font-semibold text-slate-600">
                                {formatINR(tx.invoiceTotalAmount)}
                              </td>
                              <td className="py-3.5 px-4 font-bold text-emerald-700">
                                {formatINR(tx.amountPaid)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                  {tx.paymentMode}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                                {tx.referenceNumber}
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
                                  {tx.status}
                                </Badge>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <a
                                  href={tx.receiptUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                  title="Download / View Official Receipt"
                                >
                                  <Download size={13} />
                                  <span>Receipt</span>
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </PortalShell>
  );
}
