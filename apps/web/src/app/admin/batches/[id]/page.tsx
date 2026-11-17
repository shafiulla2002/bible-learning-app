'use client';

import React, { useState, useEffect, useCallback, useMemo, use } from 'react';
import Link from 'next/link';
import {
  batchApi,
  studentApi,
  teacherApi,
  resolveActiveInstituteId,
  resolveVerifiedAdminContext,
} from '@/lib/api';
import {
  Calendar,
  ArrowLeft,
  Users,
  GraduationCap,
  Clock,
  BookOpen,
  Plus,
  Search,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRightLeft,
  ShieldCheck,
  X,
  Sparkles,
  MapPin,
  CalendarDays,
  Repeat,
  Info,
  LayoutDashboard,
  CreditCard,
  Settings,
  Copy,
  Check,
  ChevronRight,
  UserPlus,
  CalendarPlus,
  Layers,
  Filter,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  usePercentageProgress,
  PercentageProgressLoader,
} from '@/components/ui/loading-skeleton';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const batchId = unwrappedParams.id;

  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('current_institute_id') || '';
    }
    return '';
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'faculty' | 'timetable'>('overview');
  const [adminName, setAdminName] = useState('Institute Administrator');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // 1. Initial State with instant cache retrieval to eliminate lag
  const [batch, setBatch] = useState<{
    id: string;
    courseId: string;
    name: string;
    code: string;
    courseTitle: string;
    courseSlug: string;
    academicYear: string;
    term: string;
    startDate: string;
    endDate: string;
    capacity: number;
    status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(`batch_detail_${batchId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.name && parsed.name !== 'Loading Cohort...') return parsed;
        }
      } catch {}
    }
    return {
      id: batchId,
      courseId: '',
      name: '',
      code: '',
      courseTitle: '',
      courseSlug: '',
      academicYear: '',
      term: '',
      startDate: '',
      endDate: '',
      capacity: 40,
      status: 'ACTIVE',
    };
  });

  const [students, setStudents] = useState<Array<{
    id: string;
    admissionNo: string;
    fullName: string;
    email: string;
    phone: string;
    enrolledAt: string;
    status: string;
  }>>([]);

  const [teachers, setTeachers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    role: 'LEAD' | 'ASSISTANT';
    specialization: string;
  }>>([]);

  const [sessions, setSessions] = useState<Array<{
    id: string;
    title: string;
    teacherName: string;
    room: string;
    startsAt: string;
    endsAt: string;
    isRecurring: boolean;
    status: string;
  }>>([]);

  const [transferLogs, setTransferLogs] = useState<Array<{
    id: string;
    studentName: string;
    admissionNo: string;
    sourceBatch: string;
    targetBatch: string;
    reason: string;
    transferredBy: string;
    transferredAt: string;
  }>>([]);

  // Async Modal Datasets
  const [instituteStudents, setInstituteStudents] = useState<Array<{
    id: string;
    admissionNo: string;
    fullName: string;
    email: string;
  }>>([]);

  const [instituteTeachers, setInstituteTeachers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    specialization: string;
  }>>([]);

  const [eligibleTargetBatches, setEligibleTargetBatches] = useState<Array<{
    id: string;
    name: string;
    code: string;
    capacity: number;
    enrolledCount: number;
  }>>([]);

  const [isLoading, setIsLoading] = useState<boolean>(!batch.name);

  // Smooth Percentage Progress (0% -> 100%)
  const { progress, isComplete, stageMessage } = usePercentageProgress({
    isLoading: isLoading && !batch.name,
    minDurationMs: 800,
  });

  // Modals state
  const [showEnrolModal, setShowEnrolModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedStudentForTransfer, setSelectedStudentForTransfer] = useState<any>(null);
  const [transferTargetBatchId, setTransferTargetBatchId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showAssignTeacherModal, setShowAssignTeacherModal] = useState(false);

  // Forms
  const [newClass, setNewClass] = useState({
    title: '',
    teacherProfileId: '',
    room: 'Lecture Hall A',
    startsAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    endsAt: new Date(Date.now() + 86400000 + 5400000).toISOString().slice(0, 16),
  });
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const [recurringForm, setRecurringForm] = useState({
    title: 'Weekly Practicum Session',
    teacherProfileId: '',
    room: 'Lecture Hall A',
    daysOfWeek: [1, 3],
    startTime: '10:00',
    endTime: '11:30',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    exceptions: '',
  });
  const [recurringPreview, setRecurringPreview] = useState<string | null>(null);
  const [selectedEnrollStudentId, setSelectedEnrollStudentId] = useState('');
  const [assignTeacherForm, setAssignTeacherForm] = useState<{
    teacherProfileId: string;
    role: 'LEAD' | 'ASSISTANT';
  }>({
    teacherProfileId: '',
    role: 'ASSISTANT',
  });

  // Copy Code helper
  const handleCopyCode = () => {
    if (!batch.code) return;
    navigator.clipboard.writeText(batch.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  // 2. Fetch primary batch data immediately (Fast Path)
  const loadBatchDetail = useCallback(async (explicitInstId?: string) => {
    const activeInstId = explicitInstId || instituteId || (typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') : '') || '';
    if (!activeInstId || !batchId) return;

    try {
      if (!batch.name) setIsLoading(true);

      // Primary fast fetch: single batch query returns instantly (<100ms)
      const live = await batchApi.getBatch(activeInstId, batchId);
      if (!live) return;

      const updatedBatch = {
        id: live.id,
        courseId: live.courseId || '',
        name: live.name,
        code: live.code,
        courseTitle: live.courseTitle || 'Course Program',
        courseSlug: live.courseSlug || '',
        academicYear: live.academicYearName || 'Current Academic Year',
        term: live.termName || 'Term 1',
        startDate: live.startDate?.slice(0, 10) || '—',
        endDate: live.endDate?.slice(0, 10) || '—',
        capacity: live.capacity || 40,
        status: (live.status || 'ACTIVE') as any,
      };

      setBatch(updatedBatch);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`batch_detail_${batchId}`, JSON.stringify(updatedBatch));
        } catch {}
      }

      const enrolledList = Array.isArray(live.enrolments)
        ? live.enrolments.map((enr: any) => ({
            id: enr.studentProfileId || enr.id,
            admissionNo: enr.studentProfile?.admissionNo || `ADM-${enr.id.slice(0, 4)}`,
            fullName: enr.studentProfile?.membership?.user?.fullName || 'Student',
            email: enr.studentProfile?.membership?.user?.email || '',
            phone: enr.studentProfile?.membership?.user?.phoneE164 || '',
            enrolledAt: enr.enrolledAt ? String(enr.enrolledAt).slice(0, 10) : '',
            status: enr.status || 'ACTIVE',
          }))
        : [];
      setStudents(enrolledList);

      const batchTeachersList = Array.isArray(live.teachers)
        ? live.teachers.map((t: any) => ({
            id: t.teacherProfileId || t.id,
            name: t.fullName || t.name || 'Faculty Member',
            email: t.email || '',
            role: (t.role === 'LEAD' ? 'LEAD' : 'ASSISTANT') as 'LEAD' | 'ASSISTANT',
            specialization: t.specialization || 'Theological Studies',
          }))
        : [];
      setTeachers(batchTeachersList);

      if (Array.isArray(live.timetable)) {
        setSessions(
          live.timetable.map((s: any) => ({
            id: s.id,
            title: s.title,
            teacherName: s.teacherName || 'Faculty',
            room: s.room || 'Lecture Hall A',
            startsAt: s.startsAt ? String(s.startsAt).replace('Z', '') : '',
            endsAt: s.endsAt ? String(s.endsAt).replace('Z', '') : '',
            isRecurring: Boolean(s.isRecurring),
            status: s.status || 'SCHEDULED',
          })),
        );
      }

      if (Array.isArray(live.transferLogs)) {
        setTransferLogs(
          live.transferLogs.map((tl: any) => ({
            id: tl.id,
            studentName: tl.studentName,
            admissionNo: tl.admissionNo,
            sourceBatch: tl.sourceBatch,
            targetBatch: tl.targetBatch,
            reason: tl.reason || 'Administrative Transfer',
            transferredBy: tl.transferredBy || 'Administrator',
            transferredAt: tl.transferredAt ? new Date(tl.transferredAt).toISOString().replace('T', ' ').slice(0, 16) : '',
          })),
        );
      }

      setIsLoading(false);

      // Secondary non-blocking async queries for modals
      Promise.all([
        studentApi.getStudents(activeInstId, { limit: 100 }).catch(() => ({ data: [] as any[] })),
        teacherApi.getTeachers(activeInstId, { limit: 100 }).catch(() => ({ data: [] as any[] })),
        batchApi.getBatches(activeInstId).catch(() => []),
      ]).then(([studRes, teachRes, allBatches]) => {
        const mappedTeachers = (teachRes?.data || []).map((t: any) => ({
          id: t.id,
          name: t.fullName || t.user?.fullName || 'Faculty Member',
          email: t.email || t.user?.email || '',
          specialization: t.specialization || 'Bible & Theology',
        }));
        setInstituteTeachers(mappedTeachers);

        const defaultTeacherId = batchTeachersList[0]?.id || mappedTeachers[0]?.id || '';
        setNewClass((prev) =>
          prev.teacherProfileId ? prev : { ...prev, teacherProfileId: defaultTeacherId },
        );
        setRecurringForm((prev) =>
          prev.teacherProfileId ? prev : { ...prev, teacherProfileId: defaultTeacherId },
        );
        setAssignTeacherForm((prev) =>
          prev.teacherProfileId ? prev : { ...prev, teacherProfileId: mappedTeachers[0]?.id || '' },
        );

        const enrolledIds = new Set(enrolledList.map((s: any) => s.id));
        const availableStudents = (studRes?.data || [])
          .map((s: any) => ({
            id: s.id,
            admissionNo: s.admissionNo || 'N/A',
            fullName: s.fullName || s.membership?.user?.fullName || 'Student',
            email: s.email || s.membership?.user?.email || '',
          }))
          .filter((st: any) => !enrolledIds.has(st.id));
        setInstituteStudents(availableStudents);
        if (availableStudents.length > 0) {
          setSelectedEnrollStudentId(availableStudents[0].id);
        }

        const transferTargets = (allBatches || [])
          .filter((b: any) => b.id !== batchId && b.courseId === live.courseId && b.status === 'ACTIVE')
          .map((b: any) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            capacity: b.capacity || 40,
            enrolledCount: b.enrolledCount || 0,
          }));
        setEligibleTargetBatches(transferTargets);
        if (transferTargets.length > 0) {
          setTransferTargetBatchId((prev) => (prev ? prev : transferTargets[0].id));
        }
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to load batch detail from PostgreSQL.');
      setIsLoading(false);
    }
  }, [instituteId, batchId, batch.name]);

  // Context resolution & Mount trigger
  useEffect(() => {
    let active = true;
    const init = async () => {
      let activeId = instituteId || (typeof window !== 'undefined' ? localStorage.getItem('current_institute_id') : '') || '';
      if (activeId) {
        loadBatchDetail(activeId);
      }
      try {
        const ctx = await resolveVerifiedAdminContext();
        if (!active) return;
        if (ctx?.user?.fullName) setAdminName(ctx.user.fullName);
        if (ctx?.instituteId && ctx.instituteId !== activeId) {
          setInstituteId(ctx.instituteId);
          loadBatchDetail(ctx.instituteId);
        }
      } catch {
        const stored = await resolveActiveInstituteId();
        if (stored && active && stored !== activeId) {
          setInstituteId(stored);
          loadBatchDetail(stored);
        }
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [batchId, loadBatchDetail, instituteId]);

  // Dynamic calculations
  const fillPercentage = Math.round((students.length / Math.max(batch.capacity, 1)) * 100);
  const remainingSeats = Math.max(0, batch.capacity - students.length);
  const leadTeachers = useMemo(() => teachers.filter((t) => t.role === 'LEAD'), [teachers]);
  const assistantTeachers = useMemo(() => teachers.filter((t) => t.role === 'ASSISTANT'), [teachers]);
  const leadTeacherName = leadTeachers[0]?.name || (teachers.length > 0 ? teachers[0].name : 'No Lead Assigned');

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  // Conflict Checking
  const handleCheckConflict = async (overrides?: Partial<typeof newClass>) => {
    const candidate = { ...newClass, ...overrides };
    if (!candidate.startsAt || !candidate.endsAt) return;
    try {
      const res = await batchApi.checkConflict(instituteId, {
        batchId,
        teacherProfileId: candidate.teacherProfileId || undefined,
        room: candidate.room || undefined,
        startsAt: new Date(candidate.startsAt).toISOString(),
        endsAt: new Date(candidate.endsAt).toISOString(),
      });
      if (res.hasConflict) {
        setConflictWarning(
          `Conflict detected: Room "${candidate.room}" or selected faculty already has an overlapping session during this slot.`,
        );
      } else {
        setConflictWarning(null);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Unable to verify scheduling conflict.');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conflictWarning) return;
    if (!newClass.teacherProfileId) {
      setActionError('Assign or select a faculty instructor before scheduling a class.');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    try {
      await batchApi.createSchedule(instituteId, {
        batchId,
        teacherProfileId: newClass.teacherProfileId,
        title: newClass.title,
        room: newClass.room,
        startsAt: new Date(newClass.startsAt).toISOString(),
        endsAt: new Date(newClass.endsAt).toISOString(),
      });
      await loadBatchDetail();
      setShowScheduleModal(false);
      showNotice('Single class session scheduled successfully.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to schedule class.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleGenerateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.teacherProfileId) {
      setActionError('Select a teacher before generating recurring sessions.');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    try {
      const exceptionDates = recurringForm.exceptions
        ? recurringForm.exceptions.split(',').map((d) => d.trim()).filter(Boolean)
        : [];

      const res = await batchApi.generateRecurringWeeklySchedule(instituteId, {
        batchId,
        teacherProfileId: recurringForm.teacherProfileId,
        title: recurringForm.title,
        room: recurringForm.room,
        daysOfWeek: recurringForm.daysOfWeek,
        startTime: recurringForm.startTime,
        endTime: recurringForm.endTime,
        startDate: recurringForm.startDate,
        endDate: recurringForm.endDate,
        exceptions: exceptionDates,
      });

      setRecurringPreview(`Successfully generated ${res.createdCount || 0} weekly recurring sessions!`);
      await loadBatchDetail();
      setTimeout(() => {
        setShowRecurringModal(false);
        setRecurringPreview(null);
      }, 900);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to generate recurring weekly schedule.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollStudentId) {
      setActionError('Select a student to enroll in this batch.');
      return;
    }

    if (students.length >= batch.capacity) {
      setActionError(`Batch capacity limit reached (${batch.capacity} students max). Enrolment rejected.`);
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    try {
      await batchApi.enrollStudent(instituteId, batchId, selectedEnrollStudentId);
      await loadBatchDetail();
      setShowEnrolModal(false);
      showNotice('Student enrolled in cohort successfully.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to enroll student in cohort.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForTransfer || !transferTargetBatchId || !transferReason.trim()) {
      setActionError('Target batch and transfer reason are required.');
      return;
    }

    setSubmittingAction(true);
    setActionError(null);
    try {
      await batchApi.transferStudent(instituteId, batchId, {
        studentProfileId: selectedStudentForTransfer.id,
        targetBatchId: transferTargetBatchId,
        reason: transferReason.trim(),
      });
      await loadBatchDetail();
      setShowTransferModal(false);
      setSelectedStudentForTransfer(null);
      setTransferReason('');
      showNotice('Student transferred and academic audit trail preserved.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to execute batch transfer.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTeacherForm.teacherProfileId) {
      setActionError('Select a teacher to assign.');
      return;
    }
    setSubmittingAction(true);
    setActionError(null);
    try {
      await batchApi.assignTeacher(instituteId, batchId, {
        teacherProfileId: assignTeacherForm.teacherProfileId,
        role: assignTeacherForm.role,
      });
      await loadBatchDetail();
      setShowAssignTeacherModal(false);
      showNotice('Faculty member assigned to cohort.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to assign faculty member.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRemoveTeacher = async (teacherProfileId: string) => {
    setActionError(null);
    try {
      await batchApi.removeTeacher(instituteId, batchId, teacherProfileId);
      await loadBatchDetail();
      showNotice('Faculty assignment removed.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to remove faculty member.');
    }
  };

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName={adminName}
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6 pb-12">
        {/* Error and Notice Alerts */}
        {actionError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-xs text-rose-800 flex items-center justify-between gap-3 shadow-xs">
            <span className="flex items-center gap-2 font-medium">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              {actionError}
            </span>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionNotice && (
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5 shadow-xs">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionNotice}</span>
          </div>
        )}

        {/* ── PERCENTAGE PROGRESS LOADER (Shown while loading initial batch data) ── */}
        {!batch.name || (!isComplete && isLoading) ? (
          <PercentageProgressLoader
            progress={progress}
            stageMessage={stageMessage}
            title="Synchronizing Batch & Cohort Records"
            subtitle="Fetching live PostgreSQL curriculum, active student enrolments, assigned faculty, and scheduled timetable..."
            variant="hero"
            showCheckpoints={true}
          />
        ) : (
          <>
            {/* ── 1. MODERN BREADCRUMB & HERO HEADER ── */}
            <div className="space-y-3">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <Link
                  href="/admin/batches"
                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors font-medium"
                >
                  <ArrowLeft size={14} />
                  <span>Batches & Classes</span>
                </Link>
                <ChevronRight size={13} className="text-slate-300" />
                <span className="text-slate-800 font-bold truncate max-w-xs">{batch.name}</span>
              </div>

              {/* Hero Banner Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs relative overflow-hidden">
                {/* Subtle decorative background gradient */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-500/5 via-indigo-500/5 to-transparent rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left Column: Title & Metadata Tags */}
                  <div className="space-y-3 max-w-2xl">
                    {/* Meta Tags Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Cohort Code Badge with Copy button */}
                      <button
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-mono font-bold text-xs transition border border-slate-200 cursor-pointer"
                        title="Click to copy cohort code"
                      >
                        <span>{batch.code}</span>
                        {copiedCode ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} className="text-slate-400" />
                        )}
                      </button>

                      {/* Course Title Badge */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 text-blue-700 font-semibold border border-blue-200/70">
                        <BookOpen size={13} className="text-blue-600" />
                        <span>{batch.courseTitle}</span>
                      </span>

                      {/* Academic Period Pill */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 text-purple-700 font-semibold border border-purple-200/70">
                        <CalendarDays size={13} className="text-purple-600" />
                        <span>{batch.academicYear} • {batch.term}</span>
                      </span>

                      {/* Status Badge */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        <span>{batch.status}</span>
                      </span>
                    </div>

                    {/* Main Cohort Title */}
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {batch.name}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-3">
                        <span>Cohort Schedule: <strong className="text-slate-700">{batch.startDate}</strong> to <strong className="text-slate-700">{batch.endDate}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Capacity: <strong className="text-slate-700">{batch.capacity} Students</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Primary Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecurringModal(true)}
                      className="text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 gap-1.5 py-2 px-3.5"
                    >
                      <Repeat size={14} className="text-slate-600" />
                      <span>Recurring Schedule</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScheduleModal(true)}
                      className="text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 gap-1.5 py-2 px-3.5"
                    >
                      <CalendarPlus size={14} className="text-slate-600" />
                      <span>Add Single Class</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowEnrolModal(true)}
                      className="text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs gap-1.5 py-2 px-4 cursor-pointer"
                    >
                      <UserPlus size={14} />
                      <span>Enrol Student</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2. SEGMENTED NAVIGATION TABS ── */}
            <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1.5 overflow-x-auto text-xs font-semibold text-slate-600">
              {[
                { id: 'overview', label: 'Cohort Overview', icon: <Info size={15} /> },
                {
                  id: 'students',
                  label: `Enrolled Students (${students.length}/${batch.capacity})`,
                  icon: <Users size={15} />,
                  countBadge: `${students.length}/${batch.capacity}`,
                },
                {
                  id: 'faculty',
                  label: `Teaching Faculty (${teachers.length})`,
                  icon: <GraduationCap size={15} />,
                  countBadge: `${teachers.length}`,
                },
                {
                  id: 'timetable',
                  label: `Timetable & Live Sessions (${sessions.length})`,
                  icon: <Clock size={15} />,
                  countBadge: `${sessions.length}`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs font-bold'
                      : 'hover:text-slate-900 text-slate-600'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* ── TAB 1: OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 3 Redesigned KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Card 1: Enrolment Capacity */}
                  <Card className="p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Enrolment Capacity
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users size={17} />
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-baseline justify-between">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                          {students.length} <span className="text-xl font-bold text-slate-400">/ {batch.capacity}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          {fillPercentage}% Filled
                        </span>
                      </div>

                      {/* Smooth Progress Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                        <div
                          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, fillPercentage)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5 font-medium">
                        <ShieldCheck size={14} className="text-emerald-600" />
                        <span>Concurrency-safe Lock</span>
                      </span>
                      <span className="font-bold text-slate-700">{remainingSeats} seats available</span>
                    </div>
                  </Card>

                  {/* Card 2: Active Faculty */}
                  <Card className="p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Active Faculty
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <GraduationCap size={17} />
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      <div className="flex items-baseline justify-between">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                          {teachers.length}
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                          {leadTeachers.length} Lead • {assistantTeachers.length} Assistants
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 pt-1">
                        Lead Instructor: <strong className="text-slate-800 font-semibold">{leadTeacherName}</strong>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-500">Curriculum Exegesis Staff</span>
                      <button
                        onClick={() => setShowAssignTeacherModal(true)}
                        className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        + Assign
                      </button>
                    </div>
                  </Card>

                  {/* Card 3: Scheduled Classes */}
                  <Card className="p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Scheduled Classes
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Clock size={17} />
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      <div className="flex items-baseline justify-between">
                        <div className="text-3xl font-black text-slate-900 tracking-tight">
                          {sessions.length}
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Conflict-Free</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 pt-1">
                        Lecture hours protected with teacher & hall double-booking prevention.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-500">Weekly Live Practicum</span>
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        + Schedule
                      </button>
                    </div>
                  </Card>
                </div>

                {/* Batch Parameters & Settings Card */}
                <Card className="p-6 sm:p-7 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Cohort Parameters & Academic Configuration
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Verified dates, curriculum syllabi linkage, and isolation parameters for this cohort.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 w-fit">
                      <ShieldCheck size={14} className="text-emerald-600" />
                      <span>Tenant Isolated</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    {/* Item 1 */}
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Cohort Name</span>
                      <span className="text-sm font-bold text-slate-900 block">{batch.name}</span>
                    </div>

                    {/* Item 2 */}
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Unique Identifier Code</span>
                      <span className="text-sm font-mono font-bold text-blue-600 block">{batch.code}</span>
                    </div>

                    {/* Item 3 */}
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Course Program Syllabus</span>
                      <span className="text-sm font-bold text-slate-900 block">{batch.courseTitle}</span>
                    </div>

                    {/* Item 4 */}
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Academic Period & Term</span>
                      <span className="text-sm font-bold text-slate-900 block">{batch.academicYear} — {batch.term}</span>
                    </div>

                    {/* Item 5 */}
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Start Date</span>
                      <span className="text-sm font-bold text-slate-900 block">{batch.startDate}</span>
                    </div>

                    {/* Item 6 */}
                    <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Graduation / End Date</span>
                      <span className="text-sm font-bold text-slate-900 block">{batch.endDate}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ── TAB 2: ENROLLED STUDENTS & TRANSFERS ── */}
            {activeTab === 'students' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Enrolled Students Roster</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manage student admissions, capacity constraints, and inter-batch student transfers.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student or admission no..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 w-56"
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowEnrolModal(true)}
                      className="text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5 py-2 px-3.5"
                    >
                      <UserPlus size={14} />
                      <span>Enrol Student</span>
                    </Button>
                  </div>
                </div>

                {/* Students Table */}
                <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-5">Admission No</th>
                          <th className="py-3 px-5">Student Name</th>
                          <th className="py-3 px-5">Contact Details</th>
                          <th className="py-3 px-5">Enrolment Date</th>
                          <th className="py-3 px-5">Status</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No students found in this cohort.
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-5 font-mono font-bold text-blue-600">
                                {st.admissionNo}
                              </td>
                              <td className="py-3.5 px-5">
                                <div className="font-bold text-slate-900">{st.fullName}</div>
                                <div className="text-[11px] text-slate-400">{st.email}</div>
                              </td>
                              <td className="py-3.5 px-5 text-slate-500">
                                {st.phone || '—'}
                              </td>
                              <td className="py-3.5 px-5 text-slate-500 font-medium">
                                {st.enrolledAt || '—'}
                              </td>
                              <td className="py-3.5 px-5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>Enrolled</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStudentForTransfer(st);
                                    setShowTransferModal(true);
                                  }}
                                  className="text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 gap-1.5 ml-auto"
                                >
                                  <ArrowRightLeft size={13} className="text-slate-500" />
                                  <span>Transfer Batch</span>
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Batch Transfer History Log */}
                <Card className="p-6 rounded-3xl border border-slate-200/90 bg-white shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <ArrowRightLeft className="text-blue-600" size={18} />
                      <h4 className="font-bold text-slate-900 text-sm">Batch Transfer Audit Trail</h4>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Permanent audit trail of academic progression
                    </span>
                  </div>

                  {transferLogs.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      No transfer records logged yet for this cohort.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {transferLogs.map((log) => (
                        <div key={log.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{log.studentName}</span>
                              <span className="font-mono text-slate-400">({log.admissionNo})</span>
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              From <strong className="text-slate-800">{log.sourceBatch}</strong> &rarr; To{' '}
                              <strong className="text-blue-600">{log.targetBatch}</strong>
                            </div>
                            <div className="text-blue-700 mt-0.5 font-medium">
                              Reason: {log.reason}
                            </div>
                          </div>
                          <div className="text-right text-slate-400">
                            <div>Initiated by: <span className="font-medium text-slate-600">{log.transferredBy}</span></div>
                            <div className="text-[11px] font-mono mt-0.5">{log.transferredAt}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── TAB 3: TEACHING FACULTY ── */}
            {activeTab === 'faculty' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Assigned Faculty Staff</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Support for one Lead Instructor and multiple Assistant Teaching Faculty members.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAssignTeacherModal(true)}
                    className="text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5 py-2 px-3.5"
                  >
                    <Plus size={15} />
                    <span>Assign Teacher</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {teachers.map((t) => (
                    <Card
                      key={t.id}
                      className={`p-6 rounded-3xl border shadow-xs space-y-4 ${
                        t.role === 'LEAD' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200/90 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                          {t.name[0]}
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            t.role === 'LEAD'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {t.role === 'LEAD' ? 'Lead Faculty' : 'Assistant Teacher'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{t.email}</p>
                        <p className="text-xs text-blue-700 font-semibold mt-2">{t.specialization}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Tenant Verified</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeacher(t.id)}
                          className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 4: TIMETABLE & LIVE SESSIONS ── */}
            {activeTab === 'timetable' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">Class Timetable & Live Sessions</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Conflict-protected schedule preventing teacher, room, and cohort double-booking.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecurringModal(true)}
                      className="text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 gap-1.5"
                    >
                      <Repeat size={14} className="text-slate-600" />
                      <span>Recurring Schedule</span>
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowScheduleModal(true)}
                      className="text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Schedule Class</span>
                    </Button>
                  </div>
                </div>

                {/* Sessions Table */}
                <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <tr>
                          <th className="py-3 px-5">Class Topic</th>
                          <th className="py-3 px-5">Instructor</th>
                          <th className="py-3 px-5">Location / Room</th>
                          <th className="py-3 px-5">Time Slot</th>
                          <th className="py-3 px-5">Type</th>
                          <th className="py-3 px-5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sessions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              No sessions scheduled yet. Click &quot;Schedule Class&quot; or &quot;Recurring Schedule&quot; above.
                            </td>
                          </tr>
                        ) : (
                          sessions.map((sess) => (
                            <tr key={sess.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-5 font-bold text-slate-900">
                                {sess.title}
                              </td>
                              <td className="py-3.5 px-5 text-slate-700 font-medium">
                                {sess.teacherName}
                              </td>
                              <td className="py-3.5 px-5 text-slate-500 flex items-center gap-1.5">
                                <MapPin size={13} className="text-blue-600 shrink-0" />
                                <span>{sess.room}</span>
                              </td>
                              <td className="py-3.5 px-5 text-slate-600 font-mono text-[11px]">
                                {sess.startsAt.replace('T', ' ')} to {sess.endsAt.slice(11, 16)}
                              </td>
                              <td className="py-3.5 px-5">
                                {sess.isRecurring ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">
                                    <Repeat size={11} /> Weekly Recurring
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    Single Class
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                                  Scheduled
                                </span>
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

      {/* ── MODALS (Functionality 100% Preserved) ── */}

      {/* MODAL 1: ENROL STUDENT */}
      {showEnrolModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Users className="text-blue-600" size={20} />
                <span>Enrol Student in Batch</span>
              </h3>
              <button
                onClick={() => setShowEnrolModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEnrollStudent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Select Institute Student *</label>
                {instituteStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 border border-slate-200 rounded-xl bg-slate-50">
                    All active students are enrolled in this cohort, or no other student profiles exist.
                  </p>
                ) : (
                  <select
                    required
                    value={selectedEnrollStudentId}
                    onChange={(e) => setSelectedEnrollStudentId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {instituteStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.admissionNo}){st.email ? ` — ${st.email}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="bg-blue-50/70 border border-blue-200/60 p-3 rounded-2xl text-xs text-blue-800 flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                <span>
                  Current capacity: <strong>{students.length}/{batch.capacity}</strong>. Concurrency-safe limit enforcement.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEnrolModal(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingAction || !selectedEnrollStudentId}
                  className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submittingAction ? 'Enrolling...' : 'Confirm Enrolment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFER STUDENT */}
      {showTransferModal && selectedStudentForTransfer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="text-blue-600" size={20} />
                <span>Student Batch Transfer</span>
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferStudent} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-1 text-xs">
                <span className="text-slate-400 font-semibold block">Transferring Student:</span>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedStudentForTransfer.fullName} ({selectedStudentForTransfer.admissionNo})
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Source Batch (Current)</label>
                <input
                  type="text"
                  disabled
                  value={batch.name}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-100 text-slate-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Target Batch (Same Course Program) *</label>
                {eligibleTargetBatches.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 border border-slate-200 rounded-xl bg-slate-50">
                    No other active cohorts exist for this course program. Create another cohort first.
                  </p>
                ) : (
                  <select
                    required
                    value={transferTargetBatchId}
                    onChange={(e) => setTransferTargetBatchId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {eligibleTargetBatches.map((tb) => (
                      <option key={tb.id} value={tb.id}>
                        {tb.name} ({tb.code}) — Capacity: {tb.enrolledCount}/{tb.capacity}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Transfer Reason *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Provide an administrative reason (e.g. Schedule clash, relocation)..."
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-2xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Academic Record Preservation:</strong> Historical learning records, submissions, grades, and completed attendance will not be lost.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                  Execute Atomic Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SCHEDULE SINGLE CLASS WITH CONFLICT DETECTOR */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Clock className="text-blue-600" size={20} />
                <span>Schedule Single Class</span>
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Class Title / Topic *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduction to Biblical Manuscripts"
                  value={newClass.title}
                  onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Instructor *</label>
                  <select
                    required
                    value={newClass.teacherProfileId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClass({ ...newClass, teacherProfileId: val });
                      handleCheckConflict({ teacherProfileId: val });
                    }}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {instituteTeachers.length === 0 && (
                      <option value="">No faculty profiles available</option>
                    )}
                    {instituteTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Classroom / Hall</label>
                  <input
                    type="text"
                    value={newClass.room}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClass({ ...newClass, room: val });
                      handleCheckConflict({ room: val });
                    }}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Starts At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newClass.startsAt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClass({ ...newClass, startsAt: val });
                      handleCheckConflict({ startsAt: val });
                    }}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Ends At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newClass.endsAt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewClass({ ...newClass, endsAt: val });
                      handleCheckConflict({ endsAt: val });
                    }}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {conflictWarning ? (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <span>{conflictWarning}</span>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>No scheduling conflicts detected for this teacher, room, and batch slot.</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={!!conflictWarning} className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                  Save Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECURRING WEEKLY SCHEDULING */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Repeat className="text-blue-600" size={20} />
                  <span>Generate Recurring Weekly Schedule</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Validates conflict detection for every occurrence with exception dates.
                </p>
              </div>
              <button
                onClick={() => setShowRecurringModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateRecurring} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Weekly Series Title *</label>
                  <input
                    type="text"
                    required
                    value={recurringForm.title}
                    onChange={(e) => setRecurringForm({ ...recurringForm, title: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Instructor *</label>
                  <select
                    required
                    value={recurringForm.teacherProfileId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, teacherProfileId: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {instituteTeachers.length === 0 && (
                      <option value="">No faculty available</option>
                    )}
                    {instituteTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Days of Week *</label>
                <div className="flex gap-2">
                  {[
                    { label: 'Mon', val: 1 },
                    { label: 'Tue', val: 2 },
                    { label: 'Wed', val: 3 },
                    { label: 'Thu', val: 4 },
                    { label: 'Fri', val: 5 },
                    { label: 'Sat', val: 6 },
                  ].map((d) => (
                    <button
                      type="button"
                      key={d.val}
                      onClick={() => {
                        const exists = recurringForm.daysOfWeek.includes(d.val);
                        setRecurringForm({
                          ...recurringForm,
                          daysOfWeek: exists
                            ? recurringForm.daysOfWeek.filter((x) => x !== d.val)
                            : [...recurringForm.daysOfWeek, d.val],
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        recurringForm.daysOfWeek.includes(d.val)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Daily Start Time</label>
                  <input
                    type="time"
                    required
                    value={recurringForm.startTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Daily End Time</label>
                  <input
                    type="time"
                    required
                    value={recurringForm.endTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endTime: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Series Start Date</label>
                  <input
                    type="date"
                    required
                    value={recurringForm.startDate}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Series End Date</label>
                  <input
                    type="date"
                    required
                    value={recurringForm.endDate}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endDate: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Exception / Holiday Dates (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="e.g. 2026-10-02, 2026-11-14"
                  value={recurringForm.exceptions}
                  onChange={(e) => setRecurringForm({ ...recurringForm, exceptions: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {recurringPreview && (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold">{recurringPreview}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowRecurringModal(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white">
                  Generate Recurring Classes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSIGN TEACHER */}
      {showAssignTeacherModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <GraduationCap className="text-blue-600" size={20} />
                <span>Assign Teaching Faculty</span>
              </h3>
              <button
                onClick={() => setShowAssignTeacherModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignTeacher} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Teacher *</label>
                {instituteTeachers.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 border border-slate-200 rounded-xl bg-slate-50">
                    No active faculty members found in this institute. Create a teacher profile first.
                  </p>
                ) : (
                  <select
                    required
                    value={assignTeacherForm.teacherProfileId}
                    onChange={(e) =>
                      setAssignTeacherForm({ ...assignTeacherForm, teacherProfileId: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {instituteTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.specialization})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Faculty Role</label>
                <select
                  value={assignTeacherForm.role}
                  onChange={(e) =>
                    setAssignTeacherForm({
                      ...assignTeacherForm,
                      role: e.target.value === 'LEAD' ? 'LEAD' : 'ASSISTANT',
                    })
                  }
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="ASSISTANT">Assistant Teacher</option>
                  <option value="LEAD">Lead Teacher (Demotes existing lead)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAssignTeacherModal(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingAction || !assignTeacherForm.teacherProfileId}
                  className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submittingAction ? 'Assigning...' : 'Assign Faculty'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
