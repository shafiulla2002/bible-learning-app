'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { financeApi, studentApi, FinanceOverviewDto, StudentProfileSummaryDto } from '@/lib/api';
import { formatINR } from '@/components/dashboard/dashboard-charts';
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
  Plus,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  FileText,
  X,
  Coins,
  Layers,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Notifications', href: '/admin/notifications', icon: <Bell size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <CalendarCheck size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

export default function AdminFinancePage() {
  const [instituteId, setInstituteId] = useState<string>('fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5');
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'structures'>('invoices');
  const [data, setData] = useState<FinanceOverviewDto | null>(null);
  const [students, setStudents] = useState<StudentProfileSummaryDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<FinanceOverviewDto['invoices'][0] | null>(null);

  // Form states
  const [structForm, setStructForm] = useState({
    name: '',
    categoryName: 'Tuition & Academic Fees',
    periodType: 'SEMESTER',
    amountInRupees: 15000,
    description: '',
  });

  const [invForm, setInvForm] = useState({
    studentProfileId: '',
    feeStructureId: '',
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    notes: '',
  });

  const [payForm, setPayForm] = useState({
    amountInRupees: 0,
    paymentMode: 'ONLINE',
    referenceNumber: '',
    remarks: '',
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id') || 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
      setInstituteId(stored);
    }
  }, []);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [overviewRes, studentsRes] = await Promise.all([
        financeApi.getOverview(instituteId),
        studentApi.getStudents(instituteId, { limit: 100 }),
      ]);
      setData(overviewRes);
      const studentList = studentsRes.data || [];
      setStudents(studentList);
      if (studentList.length > 0 && !invForm.studentProfileId) {
        setInvForm((f) => ({ ...f, studentProfileId: studentList[0].id }));
      }
      if (overviewRes.structures.length > 0 && !invForm.feeStructureId) {
        setInvForm((f) => ({ ...f, feeStructureId: overviewRes.structures[0].id }));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load financial records from PostgreSQL.');
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await financeApi.createFeeStructure(instituteId, structForm);
      setSuccessMsg(`Fee structure "${structForm.name}" created in PostgreSQL.`);
      setShowStructureModal(false);
      setStructForm({
        name: '',
        categoryName: 'Tuition & Academic Fees',
        periodType: 'SEMESTER',
        amountInRupees: 15000,
        description: '',
      });
      await loadFinanceData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create fee structure.');
    }
  };

  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await financeApi.issueInvoice(instituteId, invForm);
      setSuccessMsg('Student invoice generated and stored in PostgreSQL.');
      setShowInvoiceModal(false);
      await loadFinanceData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to issue invoice.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setErrorMsg(null);
    try {
      await financeApi.recordPayment(instituteId, {
        invoiceId: selectedInvoice.id,
        amountInRupees: Number(payForm.amountInRupees),
        paymentMode: payForm.paymentMode,
        referenceNumber: payForm.referenceNumber,
        remarks: payForm.remarks,
      });
      setSuccessMsg(`Payment recorded and receipt generated for ${selectedInvoice.invoiceNumber}.`);
      setShowPaymentModal(false);
      setSelectedInvoice(null);
      await loadFinanceData();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record payment.');
    }
  };

  const summary = data?.summary || {
    totalInvoicedPaise: 0,
    totalPaidPaise: 0,
    totalPendingPaise: 0,
    overdueAmountPaise: 0,
    totalInvoicesCount: 0,
    paidInvoicesCount: 0,
    pendingInvoicesCount: 0,
  };

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Institute Administrator"
      userRoleLabel="Administrator"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                Milestone 2.5 • Live PostgreSQL
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CreditCard className="text-blue-600 h-7 w-7" />
              Fee Management, Invoicing & Receipts
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Manage fee structures, student invoices, fee collections, and automated receipts persisted in PostgreSQL.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadFinanceData} className="gap-1.5 text-xs">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStructureModal(true)}
              className="gap-1.5 text-xs"
            >
              <Layers size={14} />
              New Fee Structure
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowInvoiceModal(true)}
              className="gap-1.5 text-xs"
            >
              <Plus size={14} />
              Issue Student Invoice
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Fee Collected"
            value={formatINR(summary.totalPaidPaise)}
            trend={`${summary.paidInvoicesCount} paid invoices`}
            icon={<Coins className="h-5 w-5 text-emerald-600" />}
            colorScheme="emerald"
          />
          <StatCard
            title="Total Invoiced"
            value={formatINR(summary.totalInvoicedPaise)}
            trend={`${summary.totalInvoicesCount} total invoices`}
            icon={<FileText className="h-5 w-5 text-blue-600" />}
            colorScheme="blue"
          />
          <StatCard
            title="Outstanding Balance"
            value={formatINR(summary.totalPendingPaise)}
            trend={`${summary.pendingInvoicesCount} awaiting settlement`}
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            colorScheme="amber"
          />
          <StatCard
            title="Overdue Dues"
            value={formatINR(summary.overdueAmountPaise)}
            trend="Past due date"
            icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
            colorScheme="purple"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          {[
            { id: 'invoices', label: `Student Invoices (${data?.invoices.length || 0})` },
            { id: 'payments', label: `Payments & Receipts (${data?.payments.length || 0})` },
            { id: 'structures', label: `Fee Structures (${data?.structures.length || 0})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === t.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <Card className="overflow-hidden border shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-3.5 px-4">Invoice No</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Paid</th>
                    <th className="py-3.5 px-4">Balance</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!data || data.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No invoices found in PostgreSQL. Click &ldquo;Issue Student Invoice&rdquo; to create one.
                      </td>
                    </tr>
                  ) : (
                    data.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{inv.studentName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{inv.admissionNo}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{inv.dueDate || '—'}</td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {formatINR(inv.totalAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-700 font-medium">
                          {formatINR(inv.paidAmount)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-amber-700">
                          {formatINR(inv.balanceAmount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              inv.status === 'PAID'
                                ? 'success'
                                : inv.status === 'PARTIALLY_PAID'
                                ? 'warning'
                                : 'info'
                            }
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {inv.balanceAmount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setPayForm({
                                  amountInRupees: Math.round(inv.balanceAmount / 100),
                                  paymentMode: 'ONLINE',
                                  referenceNumber: `UTR-${Date.now().toString().slice(-6)}`,
                                  remarks: 'Fee settlement',
                                });
                                setShowPaymentModal(true);
                              }}
                              className="text-xs h-7 px-2.5"
                            >
                              Record Payment
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Payments & Receipts Tab */}
        {activeTab === 'payments' && (
          <Card className="overflow-hidden border shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-3.5 px-4">Payment No</th>
                    <th className="py-3.5 px-4">Receipt No</th>
                    <th className="py-3.5 px-4">Invoice</th>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4">Net Amount</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!data || data.payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No payment records found in PostgreSQL.
                      </td>
                    </tr>
                  ) : (
                    data.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {p.paymentNumber}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-blue-600 font-semibold">
                          {p.receiptNumber || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{p.invoiceNumber}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{p.studentName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{p.admissionNo}</div>
                        </td>
                        <td className="py-3.5 px-4">{p.paymentMode}</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          {formatINR(p.netAmount)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="success">{p.status}</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Fee Structures Tab */}
        {activeTab === 'structures' && (
          <Card className="overflow-hidden border shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b">
                  <tr>
                    <th className="py-3.5 px-4">Structure Name</th>
                    <th className="py-3.5 px-4">Code</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Billing Cycle</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!data || data.structures.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No fee structures configured yet. Click &ldquo;New Fee Structure&rdquo; to add one.
                      </td>
                    </tr>
                  ) : (
                    data.structures.map((fs) => (
                      <tr key={fs.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{fs.name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{fs.code}</td>
                        <td className="py-3.5 px-4 text-slate-600">{fs.categoryName}</td>
                        <td className="py-3.5 px-4">{fs.periodType}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatINR(fs.amount)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={fs.isActive ? 'success' : 'neutral'}>
                            {fs.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Modal: Create Fee Structure */}
        {showStructureModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 bg-white space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-bold text-slate-900">Create Fee Structure</h3>
                <button onClick={() => setShowStructureModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleCreateStructure} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Structure Name *</label>
                  <input
                    type="text"
                    required
                    value={structForm.name}
                    onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
                    placeholder="e.g. Diploma Fall Semester Tuition"
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Fee Category</label>
                  <input
                    type="text"
                    value={structForm.categoryName}
                    onChange={(e) => setStructForm({ ...structForm, categoryName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Period Type</label>
                    <select
                      value={structForm.periodType}
                      onChange={(e) => setStructForm({ ...structForm, periodType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-white"
                    >
                      <option value="SEMESTER">SEMESTER</option>
                      <option value="ANNUAL">ANNUAL</option>
                      <option value="ONE_TIME">ONE_TIME</option>
                      <option value="MONTHLY">MONTHLY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Amount (INR) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={structForm.amountInRupees}
                      onChange={(e) =>
                        setStructForm({ ...structForm, amountInRupees: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowStructureModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Save Fee Structure
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal: Issue Invoice */}
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 bg-white space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-bold text-slate-900">Issue Student Invoice</h3>
                <button onClick={() => setShowInvoiceModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleIssueInvoice} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Select Student *</label>
                  <select
                    required
                    value={invForm.studentProfileId}
                    onChange={(e) => setInvForm({ ...invForm, studentProfileId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.admissionNo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Select Fee Structure *</label>
                  <select
                    required
                    value={invForm.feeStructureId}
                    onChange={(e) => setInvForm({ ...invForm, feeStructureId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="">-- Choose Fee Structure --</option>
                    {data?.structures.map((fs) => (
                      <option key={fs.id} value={fs.id}>
                        {fs.name} ({formatINR(fs.amount)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={invForm.dueDate}
                    onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowInvoiceModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Issue Invoice
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Modal: Record Payment */}
        {showPaymentModal && selectedInvoice && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md p-6 bg-white space-y-4 rounded-2xl">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Record Payment — {selectedInvoice.invoiceNumber}
                </h3>
                <button onClick={() => setShowPaymentModal(false)}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Amount Collected (INR) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={Math.round(selectedInvoice.balanceAmount / 100)}
                    value={payForm.amountInRupees}
                    onChange={(e) =>
                      setPayForm({ ...payForm, amountInRupees: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Payment Mode</label>
                  <select
                    value={payForm.paymentMode}
                    onChange={(e) => setPayForm({ ...payForm, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl bg-white"
                  >
                    <option value="ONLINE">ONLINE / UPI</option>
                    <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                    <option value="CASH">CASH</option>
                    <option value="CHEQUE">CHEQUE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Reference / UTR Number</label>
                  <input
                    type="text"
                    value={payForm.referenceNumber}
                    onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPaymentModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Confirm & Generate Receipt
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
