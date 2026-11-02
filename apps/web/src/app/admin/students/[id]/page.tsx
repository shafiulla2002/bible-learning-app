'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  studentApi,
  StudentDetailDto,
  resolveVerifiedAdminContext,
} from '@/lib/api';
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
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'GUARDIAN' | 'ENROLMENTS'>('PERSONAL');
  const [notification, setNotification] = useState<string | null>(null);

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

  useEffect(() => {
    fetchStudentData();
  }, [fetchStudentData]);

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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xl shadow-md">
                  {initials}
                </div>
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
                Course Enrolments ({student.enrolments?.length || 0})
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
                      <span className="font-semibold text-slate-900">{student.fullName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Admission Number</span>
                      <span className="font-mono font-semibold text-slate-900">{student.admissionNo}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Date of Birth</span>
                      <span className="font-semibold text-slate-900">
                        {student.dateOfBirth ? student.dateOfBirth.split('T')[0] : 'Not specified'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Gender</span>
                      <span className="font-semibold text-slate-900">{student.gender || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Preferred Language</span>
                      <span className="font-semibold text-slate-900">{student.preferredLanguage || 'English'}</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Church & Education Background" />
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Home Church</span>
                      <span className="font-semibold text-slate-900">{student.church || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Highest Education</span>
                      <span className="font-semibold text-slate-900">{student.educationLevel || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Admitted On</span>
                      <span className="font-semibold text-slate-900">
                        {student.admissionDate ? student.admissionDate.split('T')[0] : 'N/A'}
                      </span>
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
                      <span className="font-semibold text-slate-900">{student.guardian?.name || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Relationship</span>
                      <span className="font-semibold text-slate-900">{student.guardian?.relation || 'Emergency Contact'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Contact Number</span>
                      <span className="font-semibold text-slate-900">{student.guardian?.phoneNumber || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Emergency Priority</span>
                      <span className="font-semibold text-emerald-600">Recorded in Database</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Residential Address" />
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Street / Area</span>
                      <span className="font-semibold text-slate-900">{student.address?.street || 'Not provided'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">City & State</span>
                      <span className="font-semibold text-slate-900">
                        {student.address?.city || 'Not specified'} {student.address?.state ? `, ${student.address?.state}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Postal Code</span>
                      <span className="font-semibold text-slate-900">{student.address?.postalCode || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Country</span>
                      <span className="font-semibold text-slate-900">{student.address?.country || 'India'}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'ENROLMENTS' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader title="Active Course Enrolments" />
                  {(!student.enrolments || student.enrolments.length === 0) ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No active course enrolments recorded for this student.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {student.enrolments.map((enrol) => (
                        <div
                          key={enrol.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-slate-900">{enrol.courseTitle}</h4>
                              <Badge variant={enrol.status === 'ACTIVE' ? 'success' : 'neutral'}>
                                {enrol.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Cohort: <strong>{enrol.batchName || 'Open Cohort'}</strong>
                            </p>
                          </div>

                          <div className="text-right text-xs text-slate-500">
                            <div>Enrolled: {enrol.enrolledAt ? enrol.enrolledAt.split('T')[0] : 'N/A'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </PortalShell>
  );
}
