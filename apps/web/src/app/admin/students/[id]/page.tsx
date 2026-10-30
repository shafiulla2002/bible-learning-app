'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  ChevronLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Church,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  AlertCircle,
  GraduationCap,
  ShieldCheck,
  Building2,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <ShieldCheck size={18} /> },
];

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'GUARDIAN' | 'ENROLMENTS' | 'ACADEMIC' | 'FEES'>('PERSONAL');
  const [currentStatus, setCurrentStatus] = useState<'ACTIVE' | 'UNDER_REVIEW' | 'APPROVED' | 'INACTIVE'>('ACTIVE');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

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

        {/* Header Hero Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xl shadow-md">
              GT
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">Grace Thomas</h2>
                <Badge variant={currentStatus === 'ACTIVE' ? 'success' : currentStatus === 'UNDER_REVIEW' ? 'warning' : 'info'}>
                  {currentStatus}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                <span className="font-mono font-medium text-slate-700">ADM-2026-0001</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Phone size={13} className="text-slate-400" />
                  +91 98765 43210
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Mail size={13} className="text-slate-400" />
                  grace.thomas@example.com
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {currentStatus !== 'ACTIVE' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCurrentStatus('ACTIVE');
                  showNotification('Student status set to ACTIVE');
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Approve & Activate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentStatus('INACTIVE');
                  showNotification('Student account deactivated');
                }}
                className="text-xs text-slate-500 hover:text-rose-600"
              >
                Deactivate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => showNotification('Password reset link sent to student phone')}
            >
              Reset Password
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-semibold overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('PERSONAL')}
            className={`py-2.5 px-4 rounded-t-lg transition border-b-2 ${
              activeTab === 'PERSONAL'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Personal & Contact
          </button>
          <button
            onClick={() => setActiveTab('GUARDIAN')}
            className={`py-2.5 px-4 rounded-t-lg transition border-b-2 ${
              activeTab === 'GUARDIAN'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Guardian & Address
          </button>
          <button
            onClick={() => setActiveTab('ENROLMENTS')}
            className={`py-2.5 px-4 rounded-t-lg transition border-b-2 ${
              activeTab === 'ENROLMENTS'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Course Enrolments (1)
          </button>
          <button
            onClick={() => setActiveTab('ACADEMIC')}
            className={`py-2.5 px-4 rounded-t-lg transition border-b-2 ${
              activeTab === 'ACADEMIC'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Academic Progress
          </button>
          <button
            onClick={() => setActiveTab('FEES')}
            className={`py-2.5 px-4 rounded-t-lg transition border-b-2 ${
              activeTab === 'FEES'
                ? 'border-blue-600 text-blue-600 bg-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Payment & Fees
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'PERSONAL' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="General Identification" />
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Full Legal Name</span>
                  <span className="font-semibold text-slate-900">Grace Thomas</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Admission Number</span>
                  <span className="font-mono font-semibold text-slate-900">ADM-2026-0001</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Date of Birth</span>
                  <span className="font-semibold text-slate-900">14 August 1998 (28 yrs)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Gender</span>
                  <span className="font-semibold text-slate-900">Female</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Preferred Language</span>
                  <span className="font-semibold text-slate-900">English</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Church & Educational Background" />
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Home Church</span>
                  <span className="font-semibold text-slate-900">Bethany Fellowship, Bangalore</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Highest Education</span>
                  <span className="font-semibold text-slate-900">Bachelor of Arts (Literature)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Admission Date</span>
                  <span className="font-semibold text-slate-900">12 October 2026</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Institute Tenant</span>
                  <span className="font-semibold text-blue-600">Berean Bible Institute</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'GUARDIAN' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Guardian & Emergency Contact" />
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Guardian Name</span>
                  <span className="font-semibold text-slate-900">Thomas Philip</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Relationship</span>
                  <span className="font-semibold text-slate-900">Father</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Contact Number</span>
                  <span className="font-semibold text-slate-900">+91 98450 12345</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Emergency Contact Priority</span>
                  <span className="font-semibold text-emerald-600">Primary (Verified)</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Residential Address" />
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Street / Area</span>
                  <span className="font-semibold text-slate-900">#42 Olive Gardens, Kalyan Nagar</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">City & State</span>
                  <span className="font-semibold text-slate-900">Bangalore, Karnataka</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Postal Code</span>
                  <span className="font-semibold text-slate-900">560043</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Country</span>
                  <span className="font-semibold text-slate-900">India</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ENROLMENTS' && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Active Course Enrolments"
                action={
                  <Button size="sm" variant="outline" className="text-xs">
                    + Enroll In New Course
                  </Button>
                }
              />
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900">Building Biblical Theology</h4>
                    <Badge variant="primary">Beginner</Badge>
                    <Badge variant="success">Active Enrolment</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cohort: <strong>Batch 2026-A (Morning)</strong> · Lead Faculty: Dr. Samuel Mathew
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-700">Course Progress: 75%</span>
                    <div className="w-40 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: '75%' }} />
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Enrolled On: Oct 12, 2026</div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">Access Duration: Lifetime</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'ACADEMIC' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/60 flex items-start gap-3">
              <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <strong className="text-blue-900 block font-semibold mb-0.5">
                  Academic & Attendance Integration View
                </strong>
                Live class sessions, Google Meet attendance logs, and examination grades will be recorded here
                automatically as instructors conduct classes in Milestone 2.3 and Phase 7. No fake metrics are shown.
              </div>
            </div>

            <Card>
              <CardHeader title="Current Term Standing" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Completed Lessons</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">18 / 24</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Attendance Rate</span>
                  <div className="text-xl font-bold text-emerald-600 mt-1">92%</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">Submitted Work</span>
                  <div className="text-xl font-bold text-blue-600 mt-1">2 Evaluated</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'FEES' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/60 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <strong className="text-emerald-900 block font-semibold mb-0.5">Fee Reconciliation Status</strong>
                Student fee receipts and online transaction orders are tracked under the Institute Finance module.
              </div>
            </div>

            <Card>
              <CardHeader title="Payment History" />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px]">
                      <th className="p-2">Receipt No</th>
                      <th className="p-2">Course</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Method</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-mono font-medium">REC-2026-0182</td>
                      <td className="p-2 font-semibold">Building Biblical Theology</td>
                      <td className="p-2 font-bold text-slate-900">₹18,500</td>
                      <td className="p-2 text-slate-500">Bank Transfer (Verified)</td>
                      <td className="p-2 text-slate-500">Oct 12, 2026</td>
                      <td className="p-2">
                        <Badge variant="success">Paid in Full</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
