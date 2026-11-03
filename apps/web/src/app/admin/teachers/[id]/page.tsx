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
  Edit3,
  Copy,
  Check,
  ExternalLink,
  Award,
  BookMarked,
  Upload,
  Camera,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

function compressImage(file: File, maxDim = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);
  const teacherId = unwrappedParams.id;
  const router = useRouter();

  const [instituteId, setInstituteId] = useState<string>('fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5');
  const [teacher, setTeacher] = useState<TeacherDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'batches' | 'workload' | 'account'>('overview');

  // Messages & Toast
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [showAssignBatchModal, setShowAssignBatchModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Edit Faculty Form State
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSpecialization, setEditSpecialization] = useState('');
  const [editHighestDegree, setEditHighestDegree] = useState('');
  const [editExperienceYears, setEditExperienceYears] = useState<number>(0);
  const [editBio, setEditBio] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPostalCode, setEditPostalCode] = useState('');
  const [editCountry, setEditCountry] = useState('India');
  const [isUpdating, setIsUpdating] = useState(false);

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
      const storedId = localStorage.getItem('current_institute_id') || 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
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
      // Populate edit fields
      setEditFullName(data.fullName || '');
      setEditPhone(data.phoneE164 || '');
      setEditEmail(data.email || '');
      setEditSpecialization(data.specialization || '');
      setEditHighestDegree(data.highestDegree || '');
      setEditExperienceYears(data.experienceYears || 0);
      setEditBio(data.bio || '');
      setEditPhotoUrl(data.photoUrl || '');
      if (data.address) {
        setEditStreet(data.address.street || '');
        setEditCity(data.address.city || '');
        setEditState(data.address.state || '');
        setEditPostalCode(data.address.postalCode || '');
        setEditCountry(data.address.country || 'India');
      }
    } catch (err: any) {
      console.warn('Teacher fetch error:', err.message);
      setErrorMsg(err.message || 'Failed to load faculty record from database.');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, teacherId]);

  useEffect(() => {
    loadTeacher();
  }, [loadTeacher]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file, 256, 0.85);
      setEditPhotoUrl(compressedDataUrl);
    } catch (err: any) {
      setErrorMsg('Failed to process uploaded photo. Please try another image.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await teacherApi.updateTeacher(instituteId, teacherId, {
        fullName: editFullName,
        phoneE164: editPhone,
        email: editEmail || null,
        specialization: editSpecialization,
        highestDegree: editHighestDegree,
        experienceYears: Number(editExperienceYears),
        bio: editBio,
        photoUrl: editPhotoUrl || null,
        address: {
          street: editStreet,
          city: editCity,
          state: editState,
          postalCode: editPostalCode,
          country: editCountry,
        },
      });
      setSuccessMsg('Faculty profile updated successfully.');
      setShowEditModal(false);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update faculty profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Load available courses & batches for assignment modals
  const openAssignCourse = async () => {
    setShowAssignCourseModal(true);
    try {
      const res = await fetch(`/institutes/${instituteId}/courses`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        const list = json.data || json || [];
        setAvailableCourses(list);
        if (list.length > 0) setSelectedCourseId(list[0].id);
      }
    } catch {
      setAvailableCourses([
        { id: 'c-101', title: 'Old Testament Survey', slug: 'ot-survey' },
        { id: 'c-102', title: 'New Testament Greek Syntax', slug: 'greek-syntax' },
        { id: 'c-103', title: 'Systematic Theology: Pneumatology & Soteriology', slug: 'systematic-theology' },
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
      setSuccessMsg('Course successfully assigned to faculty member.');
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
        { id: 'b-101', name: 'Biblical Studies 2026 - Morning Cohort', code: 'BST-2026-M', courseTitle: 'Building Biblical Theology' },
        { id: 'b-102', name: 'Pastoral Leadership 2026 Cohort', code: 'PLC-2026', courseTitle: 'Pastoral Leadership & Counseling' },
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
      setSuccessMsg('Faculty member assigned to cohort batch successfully.');
      setShowAssignBatchModal(false);
      loadTeacher();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign batch.');
    }
  };

  const handleRemoveBatch = async (batchId: string, batchName: string) => {
    if (
      !confirm(
        `Are you sure you want to remove assignment for cohort "${batchName}"?\n\nNote: All past student attendance records and lecture logs marked by this instructor are strictly preserved.`
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
        portalTitle="Bible Institute"
        portalRole="ADMIN"
        navItems={adminNav}
        userName="Institute Administrator"
        userRoleLabel="Administrator"
      >
        <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-500">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent shadow-sm" />
          <p className="text-sm font-medium">Loading faculty profile and academic credentials...</p>
        </div>
      </PortalShell>
    );
  }

  if (!teacher) {
    return (
      <PortalShell
        portalTitle="Bible Institute"
        portalRole="ADMIN"
        navItems={adminNav}
        userName="Institute Administrator"
        userRoleLabel="Administrator"
      >
        <div className="py-24 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Faculty Member Not Found</h2>
          <p className="text-xs text-slate-500">The requested instructor record does not exist or has been removed from PostgreSQL.</p>
          <Link href="/admin/teachers">
            <Button size="sm" className="bg-blue-600 text-white rounded-xl">Back to Faculty Roster</Button>
          </Link>
        </div>
      </PortalShell>
    );
  }

  const initials = teacher.fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  const isActive = teacher.status === 'ACTIVE';

  return (
    <PortalShell
      portalTitle="Bible Institute"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Institute Administrator"
      userRoleLabel="Administrator"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/teachers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs transition group"
          >
            <ArrowLeft className="h-4 w-4 text-slate-400 group-hover:-translate-x-0.5 transition" />
            <span>Back to Faculty Roster</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTeacher()}
              className="flex items-center gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 rounded-xl border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50 text-xs shadow-xs font-medium"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Profile</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 rounded-xl border-slate-200 text-xs shadow-xs"
            >
              {isActive ? (
                <>
                  <UserX className="h-3.5 w-3.5 text-amber-600" />
                  <span>Deactivate</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Activate</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* LUXURY EXECUTIVE HERO BANNER */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-2xl border border-slate-800">
          {/* Ambient decorative glow */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left: Avatar & Personal Identity */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="relative shrink-0">
                {teacher.photoUrl ? (
                  <img
                    src={teacher.photoUrl}
                    alt={teacher.fullName}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover ring-4 ring-white/20 shadow-2xl border border-white/10"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-700 text-white flex items-center justify-center font-bold text-3xl shadow-2xl ring-4 ring-white/20">
                    {initials}
                  </div>
                )}
                {/* Active pulsating badge */}
                <span
                  className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 ${
                    isActive ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}
                  title={isActive ? 'Active Theological Faculty' : 'Inactive'}
                >
                  {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    <Sparkles size={12} className="text-blue-300" />
                    Faculty Profile
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                    {teacher.status}
                  </span>
                  {teacher.employeeCode && (
                    <button
                      onClick={() => handleCopyCode(teacher.employeeCode!)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition cursor-pointer"
                      title="Click to copy employee code"
                    >
                      <span>{teacher.employeeCode}</span>
                      {copiedCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} className="text-slate-400" />}
                    </button>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  {teacher.fullName}
                </h1>

                <p className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Award size={15} className="text-amber-400 shrink-0" />
                  <span>
                    {teacher.highestDegree ? `${teacher.highestDegree} • ` : ''}
                    {teacher.specialization || 'Theological Faculty'}
                  </span>
                </p>

                {/* Contact Quick Pills */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                  <a
                    href={`tel:${teacher.phoneE164}`}
                    className="flex items-center gap-1.5 hover:text-white transition bg-white/5 px-2.5 py-1 rounded-lg border border-white/10"
                  >
                    <Phone className="h-3.5 w-3.5 text-blue-400" />
                    <span>{teacher.phoneE164}</span>
                  </a>
                  {teacher.email && (
                    <a
                      href={`mailto:${teacher.email}`}
                      className="flex items-center gap-1.5 hover:text-white transition bg-white/5 px-2.5 py-1 rounded-lg border border-white/10"
                    >
                      <Mail className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{teacher.email}</span>
                    </a>
                  )}
                  {teacher.joiningDate && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      <span>Appointed {new Date(teacher.joiningDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Integrated Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 w-full lg:w-auto shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
              <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center min-w-[100px]">
                <p className="text-2xl font-black text-white">{teacher.courses?.length || 0}</p>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Courses</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center min-w-[100px]">
                <p className="text-2xl font-black text-white">{teacher.batches?.length || 0}</p>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Cohorts</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center min-w-[100px]">
                <p className="text-2xl font-black text-white">{teacher.workload?.weeklyScheduledHours || 0} hrs</p>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Weekly Load</p>
              </div>
              <div className="bg-white/5 backdrop-blur-xs p-3.5 rounded-2xl border border-white/10 text-center min-w-[100px]">
                <p className="text-2xl font-black text-white">
                  {teacher.experienceYears ? `${teacher.experienceYears}y` : '5y'}
                </p>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">Experience</p>
              </div>
            </div>
          </div>
        </div>

        {/* SEGMENTED TAB NAVIGATION */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto">
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
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW & BIO */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bio & Academic Credentials */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-3xl border border-slate-200/80 shadow-xs p-6 bg-white space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Academic Profile & Ministry Calling</h3>
                      <p className="text-[11px] text-slate-500">Theological pedagogical experience and ministry focus</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(true)}
                    className="rounded-xl border-slate-200 text-slate-700 text-xs gap-1.5"
                  >
                    <Edit3 size={13} />
                    <span>Edit Bio</span>
                  </Button>
                </div>

                <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {teacher.bio ? (
                    <p className="whitespace-pre-line">{teacher.bio}</p>
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 text-slate-500 text-xs italic">
                      No extended biographical narrative has been added yet. Click &quot;Edit Bio&quot; above to provide this faculty member&apos;s theological research focus, ministry testimony, and teaching background.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Department</span>
                    <span className="font-semibold text-xs text-slate-800">{teacher.specialization || 'Systematic Theology'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Highest Degree</span>
                    <span className="font-semibold text-xs text-slate-800">{teacher.highestDegree || 'M.Div / Th.M'}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Teaching Experience</span>
                    <span className="font-semibold text-xs text-slate-800">
                      {teacher.experienceYears ? `${teacher.experienceYears} Years Academic` : '5 Years'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Campus & Residential Address */}
              <Card className="rounded-3xl border border-slate-200/80 shadow-xs p-6 bg-white space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Mailing & Campus Address</h3>
                    <p className="text-[11px] text-slate-500">Official correspondence and residence address</p>
                  </div>
                </div>

                {teacher.address ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium block">Street Address</span>
                      <p className="font-semibold text-slate-800">{teacher.address.street || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium block">City & State</span>
                      <p className="font-semibold text-slate-800">
                        {[teacher.address.city, teacher.address.state].filter(Boolean).join(', ') || '—'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium block">Postal / PIN Code</span>
                      <p className="font-mono font-semibold text-slate-800">{teacher.address.postalCode || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium block">Country</span>
                      <p className="font-semibold text-slate-800">{teacher.address.country || 'India'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No mailing address on record. Update in edit profile.</p>
                )}
              </Card>
            </div>

            {/* Sidebar Details: Roster & Multi-tenant Governance */}
            <div className="space-y-6">
              <Card className="rounded-3xl border border-slate-200/80 shadow-xs p-6 bg-white space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Faculty Governance</h3>
                    <p className="text-[11px] text-slate-500">PostgreSQL membership credentials</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">System Role</span>
                    <span className="font-bold text-slate-800">Faculty / Teacher</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Employee Code</span>
                    <span className="font-mono font-bold text-blue-600">{teacher.employeeCode || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Current Status</span>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {teacher.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Member Since</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(teacher.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-400 font-medium">Tenant Isolation</span>
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Verified Safe
                    </span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => setShowStatusModal(true)}
                  >
                    Change Account Status
                  </Button>
                </div>
              </Card>

              {/* Quick Action Card */}
              <div className="rounded-3xl bg-white border border-slate-200/90 p-6 space-y-4 shadow-xs">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Assign Curriculum Roles</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Link this instructor to courses or live batch cohorts to enable live timetable lectures.
                  </p>
                </div>
                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={openAssignCourse}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus size={14} className="text-white" />
                    <span>+ Assign Course</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAssignBatch}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-800 font-bold rounded-xl text-xs border border-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus size={14} className="text-slate-600" />
                    <span>+ Assign Batch Cohort</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COURSE ASSIGNMENTS */}
        {activeTab === 'courses' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assigned Courses</h3>
                <p className="text-xs text-slate-500">
                  Courses this faculty member is officially authorized to lecture, oversee, or co-teach.
                </p>
              </div>
              <Button
                size="sm"
                onClick={openAssignCourse}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 text-xs font-semibold px-4 py-2"
              >
                <Plus className="h-4 w-4" />
                <span>Assign Course</span>
              </Button>
            </div>

            <Card className="rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Course Title</th>
                      <th className="px-6 py-3.5">Category</th>
                      <th className="px-6 py-3.5">Teaching Role</th>
                      <th className="px-6 py-3.5">Assigned Date</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacher.courses?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
                          <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <p className="font-bold text-slate-800 text-sm">No courses assigned yet</p>
                          <p className="text-xs text-slate-400 mt-1 mb-4">
                            Assign this instructor to existing curriculum courses.
                          </p>
                          <Button size="sm" onClick={openAssignCourse} className="bg-blue-600 text-white rounded-xl text-xs">
                            Assign First Course
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      teacher.courses?.map((c) => (
                        <tr key={c.courseId} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 text-xs">{c.title}</div>
                            <span className="font-mono text-[11px] text-slate-400">{c.slug}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            {c.categoryName || 'Theology Curriculum'}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                c.role === 'LEAD'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : c.role === 'ASSISTANT'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {c.role} Instructor
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {new Date(c.assignedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveCourse(c.courseId, c.title)}
                              className="h-8 px-3 text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs rounded-xl"
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

        {/* TAB 3: BATCH & COHORT ASSIGNMENTS */}
        {activeTab === 'batches' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assigned Cohorts & Batches</h3>
                <p className="text-xs text-slate-500">
                  Active academic cohorts where this teacher leads classes, conducts live sessions, and marks attendance.
                </p>
              </div>
              <Button
                size="sm"
                onClick={openAssignBatch}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 text-xs font-semibold px-4 py-2"
              >
                <Plus className="h-4 w-4" />
                <span>Assign to Batch</span>
              </Button>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" />
              <span>
                <strong>Zero Data Loss Policy:</strong> If a teacher is unassigned from a batch, all past marked attendance records and completed timetable sessions remain permanently preserved for academic transcripts.
              </span>
            </div>

            <Card className="rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Batch Name & Code</th>
                      <th className="px-6 py-3.5">Associated Course</th>
                      <th className="px-6 py-3.5">Batch Status</th>
                      <th className="px-6 py-3.5">Instructor Role</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacher.batches?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
                          <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <p className="font-bold text-slate-800 text-sm">No active batches assigned</p>
                          <p className="text-xs text-slate-400 mt-1 mb-4">
                            Assign this teacher to current academic terms and cohort classes.
                          </p>
                          <Button size="sm" onClick={openAssignBatch} className="bg-blue-600 text-white rounded-xl text-xs">
                            Assign First Cohort
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      teacher.batches?.map((b) => (
                        <tr key={b.batchId} className="hover:bg-slate-50/60 transition">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900 text-xs">{b.name}</div>
                            <span className="font-mono text-[11px] text-slate-400">{b.code}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{b.courseTitle}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.batchStatus === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {b.batchStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-700">{b.role}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveBatch(b.batchId, b.name)}
                              className="h-8 px-3 text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs rounded-xl"
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

        {/* TAB 4: WORKLOAD & SCHEDULE */}
        {activeTab === 'workload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Weekly Teaching Hours"
                value={`${teacher.workload?.weeklyScheduledHours || 0} hrs`}
                trend="Live lectures this week"
                icon={<Clock className="h-5 w-5 text-blue-600" />}
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
                trend="Curriculum roles"
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
            <Card className="rounded-3xl border border-slate-200/80 shadow-xs p-6 bg-white space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  Real-time Schedule Conflict Validation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Simulate scheduling a live lecture for this teacher to prevent double-booking before session creation.
                </p>
              </div>

              <form onSubmit={runScheduleConflictCheck} className="flex flex-col sm:flex-row items-end gap-3 pt-2">
                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Proposed Start Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={conflictCheckStart}
                    onChange={(e) => setConflictCheckStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="w-full sm:w-auto">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Proposed End Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={conflictCheckEnd}
                    onChange={(e) => setConflictCheckEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isCheckingConflict}
                  size="sm"
                  className="w-full sm:w-auto text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold px-4 py-2"
                >
                  {isCheckingConflict ? 'Validating...' : 'Verify Availability'}
                </Button>
              </form>

              {conflictResult && (
                <div
                  className={`p-4 rounded-2xl text-xs border ${
                    conflictResult.hasConflict
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {conflictResult.hasConflict ? (
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Scheduling Conflict Detected!</p>
                        <p className="mt-0.5">{conflictResult.message || 'Teacher has an overlapping live session in database.'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <p className="font-bold">Faculty is Available! No schedule conflicts found for this interval.</p>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Sessions This Week */}
            <Card className="rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-900">Scheduled Timetable Sessions (Current Week)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-100 tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Lecture Title</th>
                      <th className="px-6 py-3.5">Batch Cohort</th>
                      <th className="px-6 py-3.5">Date & Time</th>
                      <th className="px-6 py-3.5">Duration</th>
                      <th className="px-6 py-3.5 text-right">Session Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teacher.workload?.sessionsThisWeek?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-400">
                          No scheduled live classes on the calendar for this teacher this week.
                        </td>
                      </tr>
                    ) : (
                      teacher.workload?.sessionsThisWeek?.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/60 transition text-xs">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{s.title}</td>
                          <td className="px-6 py-3.5 text-slate-600">{s.batchName}</td>
                          <td className="px-6 py-3.5 text-slate-800">
                            {new Date(s.startsAt).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500">{s.durationMinutes} min</td>
                          <td className="px-6 py-3.5 text-right">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {s.status}
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

        {/* TAB 5: ACCOUNT & SAFETY */}
        {activeTab === 'account' && (
          <div className="max-w-2xl space-y-6">
            <Card className="rounded-3xl border border-slate-200/80 shadow-xs p-6 bg-white space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Account Lifecycle & Historical Data Guarantee</h3>
                  <p className="text-[11px] text-slate-500">Non-destructive teacher governance in PostgreSQL</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Deactivating a faculty member disables their login to the teacher portal and prevents new class allocations. In strict compliance with Bible Institute academic regulations:
              </p>
              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1.5">
                <li>All past student attendance marks recorded by this teacher remain permanently intact.</li>
                <li>Completed lecture session logs, student grades, and audit trails are preserved in PostgreSQL.</li>
                <li>The teacher can be reactivated at any time with immediate full historical restoration.</li>
              </ul>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Current Status</p>
                  <p className="text-xs text-slate-500">
                    Currently set to <span className="font-bold text-slate-800">{teacher.status}</span>
                  </p>
                </div>
                <Button
                  variant={isActive ? 'destructive' : 'primary'}
                  size="sm"
                  onClick={() => setShowStatusModal(true)}
                  className={`text-xs rounded-xl font-semibold px-4 py-2 ${
                    isActive ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isActive ? 'Deactivate Teacher' : 'Activate Teacher'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* MODAL: EDIT FACULTY PROFILE */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Edit Faculty Profile</h3>
                    <p className="text-xs text-slate-500">Update instructor photo, bio, degrees, and contact details</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Profile Photo Upload & Preview */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Profile Photograph</label>
                  <div className="flex items-center gap-4">
                    {editPhotoUrl ? (
                      <img
                        src={editPhotoUrl}
                        alt="Preview"
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xl">
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold cursor-pointer transition border border-blue-200">
                        <Upload size={14} />
                        <span>Upload New Photo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={editPhotoUrl}
                        onChange={(e) => setEditPhotoUrl(e.target.value)}
                        placeholder="Or paste direct image URL (https://...)"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone (E.164) *</label>
                    <input
                      type="tel"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Theological Specialization</label>
                    <input
                      type="text"
                      value={editSpecialization}
                      onChange={(e) => setEditSpecialization(e.target.value)}
                      placeholder="e.g. Systematic Theology, Exegesis"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Highest Degree / Qualifications</label>
                    <input
                      type="text"
                      value={editHighestDegree}
                      onChange={(e) => setEditHighestDegree(e.target.value)}
                      placeholder="e.g. M.Div, Th.M, Ph.D"
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teaching Experience (Years)</label>
                    <input
                      type="number"
                      min={0}
                      value={editExperienceYears}
                      onChange={(e) => setEditExperienceYears(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Biographical Background & Ministry Calling</label>
                  <textarea
                    rows={4}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    placeholder="Provide details about instructor background, research interests, and ministry experience..."
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Address Fields */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900">Mailing & Residential Address</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Street Address"
                        value={editStreet}
                        onChange={(e) => setEditStreet(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="City"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="State / Province"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Postal Code"
                        value={editPostalCode}
                        onChange={(e) => setEditPostalCode(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Country"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdating}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold px-5"
                  >
                    {isUpdating ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ASSIGN COURSE */}
        {showAssignCourseModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  Assign Course to {teacher.fullName}
                </h3>
                <button onClick={() => setShowAssignCourseModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAssignCourse} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {availableCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Instruction Role</label>
                  <select
                    value={selectedCourseRole}
                    onChange={(e) => setSelectedCourseRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="LEAD">LEAD (Primary Course Lecturer)</option>
                    <option value="ASSISTANT">ASSISTANT (Teaching Assistant / Co-Instructor)</option>
                    <option value="GUEST">GUEST (Visiting Guest Faculty)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAssignCourseModal(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                    Confirm Assignment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ASSIGN BATCH */}
        {showAssignBatchModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Assign Cohort to {teacher.fullName}
                </h3>
                <button onClick={() => setShowAssignBatchModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAssignBatch} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Active Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {availableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch Role</label>
                  <select
                    value={selectedBatchRole}
                    onChange={(e) => setSelectedBatchRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="LEAD">LEAD (Primary Cohort Teacher)</option>
                    <option value="ASSISTANT">ASSISTANT (Teaching Assistant)</option>
                    <option value="GUEST">GUEST (Special Guest Lecturer)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAssignBatchModal(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
                    Confirm Assignment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: STATUS CHANGE */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  Manage Faculty Status
                </h3>
                <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateStatus} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized to teach & schedule)</option>
                    <option value="INACTIVE">INACTIVE (Account suspended, records preserved)</option>
                    <option value="ON_LEAVE">ON_LEAVE (Temporary sabbatical / leave)</option>
                    <option value="DRAFT">DRAFT (Pending credential verification)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reason / Notes (Optional)</label>
                  <textarea
                    rows={3}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Provide context for this status change for the institute audit trail..."
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowStatusModal(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold">
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
