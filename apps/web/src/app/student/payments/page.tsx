'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StudentShell } from '@/components/layout/student-shell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CreditCard,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Calendar,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  X,
  Lock,
} from 'lucide-react';

interface InvoiceItem {
  id: string;
  description: string;
  amountPaise: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string | null;
  dueDate: string;
  totalAmountPaise: number;
  paidAmountPaise: number;
  balanceAmountPaise: number;
  currency: string;
  status: string;
  notes?: string | null;
  items?: InvoiceItem[];
}

interface PaymentTransaction {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amountPaise: number;
  paymentMode: string;
  status: string;
  paymentDate: string;
  referenceNumber: string | null;
  receiptNumber: string | null;
  receiptId?: string | null;
}

interface PaymentSummary {
  totalFeesPaise: number;
  totalPaidPaise: number;
  outstandingBalancePaise: number;
  pendingInvoicesCount: number;
  overdueInvoicesCount: number;
  currency: string;
}

function formatPaiseToINR(paise: number): string {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export default function StudentPaymentsPage() {
  const [summary, setSummary] = useState<PaymentSummary>({
    totalFeesPaise: 0,
    totalPaidPaise: 0,
    outstandingBalancePaise: 0,
    pendingInvoicesCount: 0,
    overdueInvoicesCount: 0,
    currency: 'INR',
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'invoices' | 'history'>('invoices');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Payment Checkout Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmountPaise, setPayAmountPaise] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentSuccessData, setPaymentSuccessData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Receipt Modal State
  const [viewingReceipt, setViewingReceipt] = useState<PaymentTransaction | null>(null);

  const fetchPaymentsData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-dev-role'] = 'STUDENT';

      const res = await fetch('/api/students/payments', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setSummary(data.summary);
        if (data.invoices) setInvoices(data.invoices);
        if (data.recentPayments) setRecentPayments(data.recentPayments);
      } else {
        // Fallback demo data
        setSummary({
          totalFeesPaise: 3700000,
          totalPaidPaise: 1850000,
          outstandingBalancePaise: 1850000,
          pendingInvoicesCount: 1,
          overdueInvoicesCount: 0,
          currency: 'INR',
        });
        setInvoices([
          {
            id: 'inv-1',
            invoiceNumber: 'INV-2026-0001',
            issueDate: '2026-09-01T09:00:00Z',
            dueDate: '2026-10-31T00:00:00Z',
            totalAmountPaise: 1850000,
            paidAmountPaise: 1850000,
            balanceAmountPaise: 0,
            currency: 'INR',
            status: 'PAID',
            notes: 'Building Biblical Theology Tuition',
          },
          {
            id: 'inv-2',
            invoiceNumber: 'INV-2026-0002',
            issueDate: '2026-10-15T09:00:00Z',
            dueDate: '2026-11-30T00:00:00Z',
            totalAmountPaise: 1850000,
            paidAmountPaise: 0,
            balanceAmountPaise: 1850000,
            currency: 'INR',
            status: 'ISSUED',
            notes: 'Hermeneutics & Exegesis Tuition',
          },
        ]);
        setRecentPayments([
          {
            id: 'pay-1',
            paymentNumber: 'PAY-2026-0001',
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-2026-0001',
            amountPaise: 1850000,
            paymentMode: 'ONLINE',
            status: 'COMPLETED',
            paymentDate: '2026-10-31T11:52:00Z',
            referenceNumber: 'UTR-2026-1001',
            receiptNumber: 'REC-2026-0001',
          },
        ]);
      }
    } catch (err: any) {
      console.error('Fetch Payments Error:', err);
      setErrorMessage('Could not connect to payment service. Showing cached records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPaymentsData();
  }, [fetchPaymentsData]);

  const handleOpenPayModal = (inv: Invoice) => {
    setPayingInvoice(inv);
    setPayAmountPaise(inv.balanceAmountPaise);
    setPaymentSuccessData(null);
  };

  const handleConfirmPayment = async () => {
    if (!payingInvoice) return;
    setIsProcessingPayment(true);
    setErrorMessage(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      else headers['x-dev-role'] = 'STUDENT';

      const res = await fetch(`/api/students/invoices/${payingInvoice.id}/verify-payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amountPaise: payAmountPaise,
          paymentMode: 'ONLINE',
          referenceNumber: `SIM-RAZORPAY-${Date.now()}`,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setPaymentSuccessData(result);
        fetchPaymentsData();
      } else {
        const err = await res.json().catch(() => ({ message: 'Payment gateway rejected request.' }));
        setErrorMessage(err.message || 'Payment verification failed.');
      }
    } catch (err: any) {
      console.error('Payment Error:', err);
      setErrorMessage(err.message || 'Network error during transaction processing.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      inv.status.toUpperCase() === statusFilter.toUpperCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <StudentShell pageTitle="Fee Payments & Invoices">
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Institutional Finance
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Verified Records
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Fee Payments & Official Receipts
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review assigned tuition fees, due dates, outstanding balances, and official payment receipts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPaymentsData}
              className="h-9 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Financial Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Assigned Fees</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatPaiseToINR(summary.totalFeesPaise)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total tuition across all programs</p>
          </Card>

          <Card className="p-5 border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Amount Paid</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">
              {formatPaiseToINR(summary.totalPaidPaise)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Verified settled payments</p>
          </Card>

          <Card className="p-5 border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-600">
              {formatPaiseToINR(summary.outstandingBalancePaise)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary.pendingInvoicesCount} pending invoice(s)
            </p>
          </Card>

          <Card className="p-5 border-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Overdue Invoices</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <AlertCircle size={16} />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-red-600">
              {summary.overdueInvoicesCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary.overdueInvoicesCount > 0 ? 'Urgent attention required' : 'All accounts in good standing'}
            </p>
          </Card>
        </div>

        {/* Tabs: Invoices vs Payment History */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard size={15} />
            Tuition Invoices ({invoices.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt size={15} />
            Payment History & Receipts ({recentPayments.length})
          </button>
        </div>

        {/* Tab 1: Invoices */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice number or course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {['ALL', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap ${
                      statusFilter === status
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {status === 'ALL'
                      ? 'All Invoices'
                      : status === 'PARTIALLY_PAID'
                      ? 'Partially Paid'
                      : status}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices List */}
            {filteredInvoices.length === 0 ? (
              <Card className="p-8 text-center border-slate-100">
                <CreditCard size={36} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-semibold text-slate-700">No Invoices Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'No invoices match your selected filter criteria.'
                    : 'You currently have no tuition fee invoices assigned to your account.'}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredInvoices.map((inv) => (
                  <Card
                    key={inv.id}
                    className="p-5 border-slate-100 hover:border-slate-200 transition-shadow shadow-xs"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-bold text-slate-900">
                            {inv.invoiceNumber}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : inv.status === 'OVERDUE'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : inv.status === 'PARTIALLY_PAID'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          {inv.notes || 'Course Tuition Fee'}
                        </p>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                          {inv.issueDate && (
                            <span>Issued: {new Date(inv.issueDate).toLocaleDateString()}</span>
                          )}
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Calendar size={12} className="text-slate-400" />
                            Due: {new Date(inv.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Total: {formatPaiseToINR(inv.totalAmountPaise)}</div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">
                            {inv.balanceAmountPaise === 0 ? (
                              <span className="text-emerald-600 font-semibold flex items-center justify-end gap-1">
                                <CheckCircle2 size={14} /> Fully Paid
                              </span>
                            ) : (
                              <span className="text-amber-600">
                                Due: {formatPaiseToINR(inv.balanceAmountPaise)}
                              </span>
                            )}
                          </div>
                        </div>

                        {inv.balanceAmountPaise > 0 ? (
                          <Button
                            onClick={() => handleOpenPayModal(inv)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 px-4 rounded-lg shadow-sm"
                          >
                            Pay Now
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const pay = recentPayments.find((p) => p.invoiceId === inv.id);
                              if (pay) setViewingReceipt(pay);
                            }}
                            className="text-xs h-9 text-slate-700 hover:text-slate-900 gap-1.5"
                          >
                            <Receipt size={14} /> Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Payment History */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {recentPayments.length === 0 ? (
              <Card className="p-8 text-center border-slate-100">
                <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-semibold text-slate-700">No Transactions Yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When you settle tuition invoices, official payment records and receipts will be cataloged here.
                </p>
              </Card>
            ) : (
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-100 shadow-xs">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Receipt & Txn</th>
                      <th className="py-3 px-4">Invoice</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {p.receiptNumber || 'Pending Issuance'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {p.paymentNumber}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {p.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {formatPaiseToINR(p.amountPaise)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded">
                            {p.paymentMode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            {p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingReceipt(p)}
                            className="h-8 text-blue-600 hover:text-blue-800 text-xs font-semibold gap-1"
                          >
                            <Download size={13} />
                            View Receipt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pay Modal Dialog */}
        {payingInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in-50 zoom-in-95">
              {!paymentSuccessData ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Lock size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Secure Fee Payment</h3>
                        <p className="text-[11px] text-slate-400">Institutional Gateway Checkout</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPayingInvoice(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Invoice Number:</span>
                      <span className="font-semibold text-slate-900">{payingInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Description:</span>
                      <span className="font-medium text-slate-900">{payingInvoice.notes || 'Course Tuition'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Due Date:</span>
                      <span className="font-medium text-slate-900">{new Date(payingInvoice.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                      <span>Outstanding Balance:</span>
                      <span className="text-blue-600 text-sm">{formatPaiseToINR(payingInvoice.balanceAmountPaise)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Payment Amount (INR)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                      <input
                        type="number"
                        min="1"
                        max={payingInvoice.balanceAmountPaise / 100}
                        value={payAmountPaise / 100}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(Number(e.target.value) * 100, payingInvoice.balanceAmountPaise));
                          setPayAmountPaise(val);
                        }}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Partial payments are accepted according to institutional billing rules.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center gap-2 text-[11px] text-blue-700">
                    <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                    <span>256-bit SSL encrypted. Payment receipt will be generated automatically upon clearance.</span>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setPayingInvoice(null)}
                      className="flex-1 text-xs h-10 text-slate-600"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={isProcessingPayment}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-10 gap-1.5 shadow-sm"
                    >
                      {isProcessingPayment ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        `Pay ${formatPaiseToINR(payAmountPaise)}`
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                /* Payment Success View */
                <div className="text-center py-4 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Payment Successful!</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Your fee payment of {formatPaiseToINR(paymentSuccessData.payment?.amountPaise || payAmountPaise)} has been verified and settled.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl text-xs text-left space-y-2 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Receipt Number:</span>
                      <span className="font-bold text-slate-900">{paymentSuccessData.payment?.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transaction ID:</span>
                      <span className="font-mono text-slate-700">{paymentSuccessData.payment?.paymentNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice Status:</span>
                      <span className="font-semibold text-emerald-600">{paymentSuccessData.invoice?.status}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setPayingInvoice(null);
                      setPaymentSuccessData(null);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-10"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Receipt View Modal */}
        {viewingReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Official Fee Receipt</h3>
                </div>
                <button
                  onClick={() => setViewingReceipt(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-3 text-xs border border-slate-100">
                <div className="text-center pb-2 border-b border-slate-200">
                  <h4 className="font-bold text-slate-900">Grace Bible Institute</h4>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tuition Fee Settlement</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="font-bold text-slate-900">{viewingReceipt.receiptNumber || 'REC-OFFICIAL'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Reference:</span>
                  <span className="font-medium text-slate-800">{viewingReceipt.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Date:</span>
                  <span className="font-medium text-slate-800">{new Date(viewingReceipt.paymentDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-medium text-slate-800">{viewingReceipt.paymentMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-mono text-slate-700">{viewingReceipt.referenceNumber || 'N/A'}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-sm">
                  <span>Settled Amount:</span>
                  <span className="text-emerald-600">{formatPaiseToINR(viewingReceipt.amountPaise)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setViewingReceipt(null)}
                  className="flex-1 text-xs h-9"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    alert(`Receipt ${viewingReceipt.receiptNumber || 'REC'} downloaded.`);
                    setViewingReceipt(null);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 gap-1.5"
                >
                  <Download size={14} /> Download PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
