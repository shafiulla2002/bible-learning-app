'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { teacherApi, TeacherDetailDto, batchApi } from '@/lib/api';
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  CreditCard,
  Building2,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  Briefcase,
  Layers,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  ShieldCheck,
  RotateCcw,
  UserCheck,
  UserX,
  CalendarDays,
  FileText,
  Sparkles,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export default function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const teacherId = unwrappedParams.id;
  const router = useRouter();

  const [instituteId, setInstituteId] = useState<string>('inst-1');
  const [teacher, setTeacher] = useState<TeacherDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'batches' | 'workload' | 'account'>('overview');

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [showAssignBatchModal, setShowAssignBatchModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Assign course form
  const [availableCourses, setAvailableCourses] = useState<Array<{ id: string; title: string; slug: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourseRole, setSelectedCourseRole] = useState<'LEAD' | 'ASSISTANT' | 'GUEST'>('LEAD');

  // Assign batch form
  const [availableBatches, setAvailableBatches] = useState<Array<{ id: string; name: string; code: string; courseTitle?: string }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedBatchRole, setSelectedBatchRole] = useState<'LEAD' | 'ASSISTANT' | 'GUEST'>('LEAD');

  // Status form
  const [newStatus, setNewStatus] = useState<string>('ACTIVE');
  const [statusReason, setStatusReason] = useState<string>('');

  // Conflict check state
  const [conflictCheckStart, setConflictCheckStart] = useState<string>('');
  const [conflictCheckEnd, setConflictCheckEnd] = useState<string>('');
  const [conflictResult, setConflictResult] = useState<any>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('current_institute_id') || 'inst-1';
      setInstituteId(storedId);
    }
  }, []);

  const loadTeacher = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await teacherApi.getTeacher(instituteId, teacherId);
      setTeacher(data);
      setNewStatus(data.status);
    } catch (err: any) {
      console.warn('Teacher fetch fallback:', err.message);
      // Fallback preview data for prototype preview
      setTeacher({
        id: teacherId,
        employeeCode: 'FAC-2026-0001',
        fullName: 'Dr. Samuel V. Mathews',
        phoneE164: '+91 98401 23456',
        email: 's.mathews@faithseminary.edu',
        specialization: 'Systematic Theology',
        highestDegree: 'Ph.D in Biblical Studies',
        experienceYears: 14,
        status: 'ACTIVE',
        bio: 'Senior Lecturer in Systematic Theology and Reformed Soteriology with 14 years of teaching across Asian seminaries.',
        address: {
          street: '124 Seminary Campus Road',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          postalCode: '560025',
        },
        assignedCoursesCount: 2,
        assignedBatchesCount: 2,
        joiningDate: '2020-06-01',
        createdAt: '2020-06-01T00:00:00.000Z',
        courses: [
          {
            courseId: 'c-1',
            title: 'Biblical Exegesis & Hermeneutics',
            slug: 'biblical-exegesis',
            categoryName: 'Theology',
            role: 'LEAD',
            assignedAt: '2026-01-10T00:00:00.000Z',
          },
          {
            courseId: 'c-2',
            title: 'Systematic Theology I: God & Creation',
            slug: 'systematic-theology-1',
            categoryName: 'Theology',
            role: 'LEAD',
            assignedAt: '2026-01-12T00:00:00.000Z',
          },
        ],
        batches: [
          {
            batchId: 'b-1',
            name: 'Diploma Cohort Alpha 2026',
            code: 'DIB-2026-A',
            courseTitle: 'Diploma in Biblical Studies',
            role: 'LEAD',
            batchStatus: 'ACTIVE',
            startDate: '2026-07-01',
            endDate: '2026-12-20',
          },
          {
            batchId: 'b-2',
            name: 'M.Div Evening Cohort 2026',
            code: 'MDIV-2026-EV',
            courseTitle: 'Master of Divinity',
            role: 'ASSISTANT',
            batchStatus: 'ACTIVE',
            startDate: '2026-08-01',
            endDate: '2027-05-30',
          },
        ],
        workload: {
          totalCourses: 2,
          totalBatches: 2,
          upcomingSessionsCount: 4,
          weeklyScheduledHours: 6,
          sessionsThisWeek: [
            {
              id: 'ls-1',
              batchId: 'b-1',
              batchName: 'Diploma Cohort Alpha 2026',
              title: 'Covenant Theology & Dispensational Perspectives',
              startsAt: '2026-11-04T10:00:00.000Z',
              endsAt: '2026-11-04T11:30:00.000Z',
              status: 'SCHEDULED',
              durationMinutes: 90,
            },
            {
              id: 'ls-2',
              batchId: 'b-1',
              batchName: 'Diploma Cohort Alpha 2026',
              title: 'The Doctrine of the Trinity in Nicene Creed',
              startsAt: '2026-11-06T10:00:00.000Z',
              endsAt: '2026-11-06T11:30:00.000Z',
              status: 'SCHEDULED',
              durationMinutes: 90,
            },
          ],
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, teacherId]);

  useEffect(() => {
    loadTeacher();
  }, [loadTeacher]);

  // Load available courses & batches for assignment modals
  const openAssignCourse = async () => {
    setShowAssignCourseModal(true);
    try {
      const res = await fetch(`http://localhost:4000/institutes/${instituteId}/courses`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json || [];
        setAvailableCourses(list);
        if (list.length > 0) setSelectedCourseId(list[0].id);
      } else {
        // Fallback
        setAvailableCourses([
          { id: 'c-101', title: 'Old Testament Survey', slug: 'ot-survey' },
          { id: 'c-102', title: 'New Testament Greek Syntax', slug: 'greek-syntax' },
          { id: 'c-103', title: 'Pauline Epistles & Pastoral Care', slug: 'pauline-epistles' },
        ]);
        setSelectedCourseId('c-101');
      }
    } catch {
      setAvailableCourses([
        { id: 'c-101', title: 'Old Testament Survey', slug: 'ot-survey' },
        { id: 'c-102', title: 'New Testament Greek Syntax', slug: 'greek-syntax' },
        { id: 'c-103', title: 'Pauline Epistles & Pastoral Care', slug: 'pauline-epistles' },
      ]);
      setSelectedCourseId('c-101');
    }
  };

  const handleAssignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    setErrorMsg(null);
    try {
      await teacherApi.assignCourse(instituteId, teacherId, {
        courseId: selectedCourseId,
        role: selectedCourseRole,
      });
      setSuccessMsg('Course assigned to faculty member successfully.');
      setShowAssignCourseModal(false);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign course.');
    }
  };

  const handleRemoveCourse = async (courseId: string, courseTitle: string) => {
    if (!confirm(`Are you sure you want to remove assignment for "${courseTitle}"?`)) return;
    setErrorMsg(null);
    try {
      await teacherApi.removeCourse(instituteId, teacherId, courseId);
      setSuccessMsg(`Course assignment "${courseTitle}" removed.`);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove course assignment.');
    }
  };

  const openAssignBatch = async () => {
    setShowAssignBatchModal(true);
    try {
      const res = await batchApi.getBatches(instituteId, { status: 'ACTIVE' });
      const list = Array.isArray(res) ? res : ((res as any).data || []);
      setAvailableBatches(list);
      if (list.length > 0) setSelectedBatchId(list[0].id);
    } catch {
      setAvailableBatches([
        { id: 'b-101', name: 'Biblical Hebrew Morning Cohort', code: 'HEB-2026-AM', courseTitle: 'Hebrew Grammar' },
        { id: 'b-102', name: 'Pastoral Leadership Weekend', code: 'PAS-2026-WK', courseTitle: 'Pastoral Theology' },
      ]);
      setSelectedBatchId('b-101');
    }
  };

  const handleAssignBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;
    setErrorMsg(null);
    try {
      await teacherApi.assignBatch(instituteId, teacherId, {
        batchId: selectedBatchId,
        role: selectedBatchRole,
      });
      setSuccessMsg('Faculty member assigned to batch cohort successfully.');
      setShowAssignBatchModal(false);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign batch.');
    }
  };

  const handleRemoveBatch = async (batchId: string, batchName: string) => {
    if (
      !confirm(
        `Are you sure you want to remove assignment for batch "${batchName}"?\n\nNote: All past marked attendance records and completed session logs by this instructor will be strictly preserved.`,
      )
    )
      return;
    setErrorMsg(null);
    try {
      await teacherApi.removeBatch(instituteId, teacherId, batchId);
      setSuccessMsg(`Batch assignment "${batchName}" removed. Historical records preserved.`);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove batch assignment.');
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await teacherApi.updateStatus(instituteId, teacherId, newStatus, statusReason);
      setSuccessMsg(`Faculty member status updated to ${newStatus}.`);
      setShowStatusModal(false);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update faculty status.');
    }
  };

  const runScheduleConflictCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conflictCheckStart || !conflictCheckEnd) return;
    setIsCheckingConflict(true);
    setConflictResult(null);
    try {
      const res = await teacherApi.checkScheduleConflict(instituteId, {
        teacherProfileId: teacherId,
        startsAt: new Date(conflictCheckStart).toISOString(),
        endsAt: new Date(conflictCheckEnd).toISOString(),
      });
      setConflictResult(res);
    } catch (err: any) {
      setConflictResult({ hasConflict: true, message: err.message });
    } finally {
      setIsCheckingConflict(false);
    }
  };

  if (isLoading) {
    return (
      <PortalShell
        portalTitle="Institute Admin"
        portalRole="ADMIN"
        navItems={adminNav}
        userName="Institute Administrator"
        userRoleLabel="Administrator"
      >
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm">Loading faculty profile and academic assignments...</p>
        </div>
      </PortalShell>
    );
  }

  if (!teacher) {
    return (
      <PortalShell
        portalTitle="Institute Admin"
        portalRole="ADMIN"
        navItems={adminNav}
        userName="Institute Administrator"
        userRoleLabel="Administrator"
      >
        <div className="py-24 text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-bold">Faculty Member Not Found</h2>
          <p className="text-xs text-muted-foreground">The requested instructor record does not exist or has been removed.</p>
          <Link href="/admin/teachers">
            <Button size="sm">Back to Faculty Roster</Button>
          </Link>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Institute Administrator"
      userRoleLabel="Administrator"
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/teachers">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0 rounded-full">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  Faculty Profile
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {teacher.employeeCode || 'ID: ' + teacher.id.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 mt-0.5">
                {teacher.fullName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTeacher()}
              className="flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5"
            >
              {teacher.status === 'ACTIVE' ? (
                <>
                  <UserX className="h-4 w-4 text-amber-600" />
                  Deactivate Account
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                  Activate Account
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-destructive/70 hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Profile Summary Card */}
        <Card className="p-6 border shadow-sm bg-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-2xl shrink-0">
                {teacher.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">{teacher.fullName}</h2>
                  <Badge
                    variant={
                      teacher.status === 'ACTIVE'
                        ? 'success'
                        : teacher.status === 'DRAFT'
                        ? 'warning'
                        : 'neutral'
                    }
                  >
                    {teacher.status}
                  </Badge>
                  {teacher.employeeCode && (
                    <span className="font-mono text-xs px-2 py-0.5 bg-muted rounded border text-muted-foreground">
                      {teacher.employeeCode}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {teacher.highestDegree ? `${teacher.highestDegree} in ` : ''}
                  {teacher.specialization || 'Theological Studies'}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{teacher.phoneE164}</span>
                  </div>
                  {teacher.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{teacher.email}</span>
                    </div>
                  )}
                  {teacher.joiningDate && (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>Appointed {new Date(teacher.joiningDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
              <div className="text-center px-3">
                <p className="text-2xl font-bold text-foreground">{teacher.courses?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Courses</p>
              </div>
              <div className="text-center px-3 border-l">
                <p className="text-2xl font-bold text-foreground">{teacher.batches?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Cohorts</p>
              </div>
              <div className="text-center px-3 border-l">
                <p className="text-2xl font-bold text-foreground">
                  {teacher.workload?.weeklyScheduledHours || 0} hrs
                </p>
                <p className="text-xs text-muted-foreground">Weekly Load</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="border-b flex items-center gap-2 overflow-x-auto text-sm">
          {[
            { id: 'overview', label: 'Overview & Bio', icon: <FileText className="h-4 w-4" /> },
            { id: 'courses', label: `Courses (${teacher.courses?.length || 0})`, icon: <BookOpen className="h-4 w-4" /> },
            { id: 'batches', label: `Batches & Cohorts (${teacher.batches?.length || 0})`, icon: <Calendar className="h-4 w-4" /> },
            { id: 'workload', label: 'Workload & Schedule', icon: <Clock className="h-4 w-4" /> },
            { id: 'account', label: 'Account & Safety', icon: <ShieldCheck className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bio & Ministry Background */}
            <div className="md:col-span-2 space-y-6">
              <Card className="border shadow-sm p-6 bg-card space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Academic Profile & Ministry Experience
                </h3>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {teacher.bio ||
                    'No extended biographical summary provided. You can update this instructor’s background in the edit profile section.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t text-xs">
                  <div>
                    <span className="text-muted-foreground block">Specialization</span>
                    <span className="font-medium text-foreground">{teacher.specialization || 'General Theology'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Highest Degree</span>
                    <span className="font-medium text-foreground">{teacher.highestDegree || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Teaching Experience</span>
                    <span className="font-medium text-foreground">
                      {teacher.experienceYears ? `${teacher.experienceYears} Years` : 'Not specified'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Residential & Postal Address */}
              <Card className="border shadow-sm p-6 bg-card space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Mailing & Residential Address
                </h3>
                {teacher.address ? (
                  <div className="text-xs space-y-1 text-foreground/80">
                    {teacher.address.street && <p>{teacher.address.street}</p>}
                    <p>
                      {[teacher.address.city, teacher.address.state, teacher.address.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {teacher.address.country && <p>{teacher.address.country}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No address on record.</p>
                )}
              </Card>
            </div>

            {/* Sidebar Details */}
            <div className="space-y-6">
              <Card className="border shadow-sm p-6 bg-card space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Account & Institute Roster
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-semibold text-foreground">Faculty / Teacher</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Employee Code</span>
                    <span className="font-mono text-foreground">{teacher.employeeCode || 'Auto'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={teacher.status === 'ACTIVE' ? 'success' : 'neutral'}
                      className="text-[10px]"
                    >
                      {teacher.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Member Since</span>
                    <span className="text-foreground">
                      {new Date(teacher.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowStatusModal(true)}
                  >
                    Change Account Status
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tab 2: Course Assignments */}
        {activeTab === 'courses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Assigned Courses</h3>
                <p className="text-xs text-muted-foreground">
                  Courses this faculty member is officially authorized to lecture, oversee, or co-teach.
                </p>
              </div>
              <Button
                size="sm"
                onClick={openAssignCourse}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Assign Course
              </Button>
            </div>

            <Card className="border shadow-sm overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/40 text-xs font-medium text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="px-6 py-3">Course Title</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Teaching Role</th>
                      <th className="px-6 py-3">Assigned Date</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teacher.courses?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="font-semibold text-foreground">No courses assigned yet</p>
                          <p className="text-xs text-muted-foreground">
                            Assign this instructor to existing curriculum courses.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      teacher.courses?.map((c) => (
                        <tr key={c.courseId} className="hover:bg-muted/30 transition">
                          <td className="px-6 py-4 font-medium text-foreground">
                            {c.title}
                            <span className="block text-xs font-mono text-muted-foreground">
                              {c.slug}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {c.categoryName || 'Curriculum'}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                c.role === 'LEAD'
                                  ? 'primary'
                                  : c.role === 'ASSISTANT'
                                  ? 'info'
                                  : 'neutral'
                              }
                              className="text-xs"
                            >
                              {c.role} Instructor
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-xs text-muted-foreground">
                            {new Date(c.assignedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveCourse(c.courseId, c.title)}
                              className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:border-destructive text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Remove
                            </Button>
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

        {/* Tab 3: Batch Assignments */}
        {activeTab === 'batches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Assigned Batches & Cohorts</h3>
                <p className="text-xs text-muted-foreground">
                  Active academic cohorts where this teacher leads classes, conducts live sessions, and marks attendance.
                </p>
              </div>
              <Button
                size="sm"
                onClick={openAssignBatch}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground"
              >
                <Plus className="h-4 w-4" />
                Assign to Batch
              </Button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Historical Record Protection:</strong> If a teacher is unassigned from a batch, all past marked attendance records and completed timetable sessions remain permanently preserved for audit and academic transcripts.
              </span>
            </div>

            <Card className="border shadow-sm overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/40 text-xs font-medium text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="px-6 py-3">Batch Name & Code</th>
                      <th className="px-6 py-3">Associated Course</th>
                      <th className="px-6 py-3">Batch Status</th>
                      <th className="px-6 py-3">Instructor Role</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teacher.batches?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="font-semibold text-foreground">No active batches assigned</p>
                          <p className="text-xs text-muted-foreground">
                            Assign this teacher to current academic terms and cohort classes.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      teacher.batches?.map((b) => (
                        <tr key={b.batchId} className="hover:bg-muted/30 transition">
                          <td className="px-6 py-4 font-medium text-foreground">
                            {b.name}
                            <span className="block text-xs font-mono text-muted-foreground">
                              {b.code}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-foreground/90">
                            {b.courseTitle}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={b.batchStatus === 'ACTIVE' ? 'success' : 'neutral'}
                              className="text-xs"
                            >
                              {b.batchStatus}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="neutral" className="text-xs">
                              {b.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveBatch(b.batchId, b.name)}
                              className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:border-destructive text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Remove
                            </Button>
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

        {/* Tab 4: Workload & Timetable Schedule */}
        {activeTab === 'workload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Weekly Teaching Hours"
                value={`${teacher.workload?.weeklyScheduledHours || 0} hrs`}
                trend="Live lectures this week"
                icon={<Clock className="h-5 w-5 text-primary" />}
                colorScheme="blue"
              />
              <StatCard
                title="Active Cohorts"
                value={(teacher.workload?.totalBatches || 0).toString()}
                trend="Assigned classes"
                icon={<Calendar className="h-5 w-5 text-indigo-600" />}
                colorScheme="purple"
              />
              <StatCard
                title="Assigned Courses"
                value={(teacher.workload?.totalCourses || 0).toString()}
                trend="Curriculum responsibilities"
                icon={<BookOpen className="h-5 w-5 text-emerald-600" />}
                colorScheme="emerald"
              />
              <StatCard
                title="Scheduled Sessions"
                value={(teacher.workload?.upcomingSessionsCount || 0).toString()}
                trend="Upcoming live meetings"
                icon={<Sparkles className="h-5 w-5 text-amber-600" />}
                colorScheme="amber"
              />
            </div>

            {/* Conflict Detection Tool */}
            <Card className="border shadow-sm p-6 bg-card space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Check Schedule Conflict (Real-time Validation)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Simulate scheduling a live lecture for this teacher to prevent double-booking before session creation.
                </p>
              </div>

              <form onSubmit={runScheduleConflictCheck} className="flex flex-col sm:flex-row items-end gap-3">
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-medium text-foreground mb-1">Proposed Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={conflictCheckStart}
                    onChange={(e) => setConflictCheckStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-medium text-foreground mb-1">Proposed End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={conflictCheckEnd}
                    onChange={(e) => setConflictCheckEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <Button type="submit" disabled={isCheckingConflict} size="sm" className="w-full sm:w-auto text-xs">
                  {isCheckingConflict ? 'Validating...' : 'Verify Availability'}
                </Button>
              </form>

              {conflictResult && (
                <div
                  className={`p-4 rounded-lg text-xs border ${
                    conflictResult.hasConflict
                      ? 'bg-destructive/10 border-destructive/20 text-destructive'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  }`}
                >
                  {conflictResult.hasConflict ? (
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                      <div>
                        <p className="font-semibold">Scheduling Conflict Detected!</p>
                        <p className="mt-0.5">{conflictResult.message || 'Teacher has an overlapping live session.'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="font-semibold">Faculty is Available! No schedule conflicts found for this interval.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Sessions This Week */}
            <Card className="border shadow-sm overflow-hidden bg-card">
              <div className="px-6 py-4 border-b bg-muted/20">
                <h3 className="text-sm font-semibold">Scheduled Timetable Sessions (Current Week)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/40 text-xs font-medium text-muted-foreground uppercase border-b">
                    <tr>
                      <th className="px-6 py-3">Lecture Title</th>
                      <th className="px-6 py-3">Batch Cohort</th>
                      <th className="px-6 py-3">Date & Time</th>
                      <th className="px-6 py-3">Duration</th>
                      <th className="px-6 py-3 text-right">Session Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teacher.workload?.sessionsThisWeek?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-xs text-muted-foreground">
                          No scheduled live classes on the calendar for this teacher this week.
                        </td>
                      </tr>
                    ) : (
                      teacher.workload?.sessionsThisWeek?.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30 transition text-xs">
                          <td className="px-6 py-3.5 font-medium text-foreground">{s.title}</td>
                          <td className="px-6 py-3.5 text-muted-foreground">{s.batchName}</td>
                          <td className="px-6 py-3.5 text-foreground">
                            {new Date(s.startsAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground">{s.durationMinutes} min</td>
                          <td className="px-6 py-3.5 text-right">
                            <Badge variant={s.status === 'SCHEDULED' ? 'neutral' : 'success'} className="text-[10px]">
                              {s.status}
                            </Badge>
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

        {/* Tab 5: Account & Safety */}
        {activeTab === 'account' && (
          <div className="max-w-2xl space-y-6">
            <Card className="border shadow-sm p-6 bg-card space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Account Lifecycle & Historical Data Guarantee
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deactivating a faculty member account disables their login to the teacher portal and prevents new class assignments. However, in strict accordance with Bible Institute academic regulations:
              </p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                <li>All student attendance marks recorded by this teacher remain intact.</li>
                <li>Completed lecture session logs, student grades, and audit trails are preserved permanently.</li>
                <li>The teacher can be reactivated at any time with full historical restoration.</li>
              </ul>

              <div className="pt-4 border-t flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Current Account Status</p>
                  <p className="text-xs text-muted-foreground">
                    Currently set to <span className="font-bold text-foreground">{teacher.status}</span>
                  </p>
                </div>
                <Button
                  variant={teacher.status === 'ACTIVE' ? 'destructive' : 'primary'}
                  size="sm"
                  onClick={() => setShowStatusModal(true)}
                  className="text-xs"
                >
                  {teacher.status === 'ACTIVE' ? 'Deactivate Teacher' : 'Activate Teacher'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Modal: Assign Course */}
        {showAssignCourseModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Assign Course to {teacher.fullName}
                </h3>
                <button onClick={() => setShowAssignCourseModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAssignCourse} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Select Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {availableCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Instruction Role</label>
                  <select
                    value={selectedCourseRole}
                    onChange={(e) => setSelectedCourseRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="LEAD">LEAD (Primary Course Lecturer)</option>
                    <option value="ASSISTANT">ASSISTANT (Teaching Assistant / Co-Instructor)</option>
                    <option value="GUEST">GUEST (Visiting Guest Faculty)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAssignCourseModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                    Confirm Assignment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Assign Batch */}
        {showAssignBatchModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Assign Batch Cohort to {teacher.fullName}
                </h3>
                <button onClick={() => setShowAssignBatchModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAssignBatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Select Active Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Batch Role</label>
                  <select
                    value={selectedBatchRole}
                    onChange={(e) => setSelectedBatchRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="LEAD">LEAD (Primary Cohort Teacher)</option>
                    <option value="ASSISTANT">ASSISTANT (Teaching Assistant)</option>
                    <option value="GUEST">GUEST (Special Guest Lecturer)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAssignBatchModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                    Confirm Assignment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Status Change */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Manage Faculty Status
                </h3>
                <button onClick={() => setShowStatusModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized to teach & schedule)</option>
                    <option value="INACTIVE">INACTIVE (Account suspended, records preserved)</option>
                    <option value="ON_LEAVE">ON_LEAVE (Temporary sabbatical/leave)</option>
                    <option value="DRAFT">DRAFT (Pending credential verification)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Reason / Notes (Optional)</label>
                  <textarea
                    rows={3}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Provide context for this status change for the institute audit trail..."
                    className="w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowStatusModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground">
                    Update Status
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
