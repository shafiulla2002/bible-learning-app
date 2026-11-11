'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { teacherApi, TeacherSummaryDto, resolveVerifiedAdminContext } from '@/lib/api';
import {
  GraduationCap,
  Users,
  Search,
  Plus,
  BookOpen,
  Calendar,
  Building2,
  Phone,
  Mail,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertCircle,
  Briefcase,
  Layers,
  RotateCcw,
  LayoutGrid,
  List,
  Copy,
  Check,
  Eye,
  Camera,
  Upload,
  X,
  MapPin,
  Lock,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  UserX,
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

export default function TeachersDirectoryPage() {
  const [instituteId, setInstituteId] = useState<string>('');
  const [teachers, setTeachers] = useState<TeacherSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [specializationFilter, setSpecializationFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string; type: 'success' | 'error' } | null>(null);
  const showToast = (title: string, desc: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Quick View Modal State
  const [quickViewTeacher, setQuickViewTeacher] = useState<TeacherSummaryDto | null>(null);

  // Status Change Confirmation Modal State
  const [statusModalTeacher, setStatusModalTeacher] = useState<TeacherSummaryDto | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Add Teacher In-Page Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'personal' | 'academic' | 'location'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add Teacher Form State
  const [formFullName, setFormFullName] = useState('');
  const [formPhoneE164, setFormPhoneE164] = useState('+91 ');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null);
  const [formEmployeeCode, setFormEmployeeCode] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('Systematic Theology');
  const [formHighestDegree, setFormHighestDegree] = useState('M.Div');
  const [formExperienceYears, setFormExperienceYears] = useState<number | ''>(5);
  const [formJoiningDate, setFormJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');
  const [formBio, setFormBio] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formCountry, setFormCountry] = useState('India');
  const [formPostalCode, setFormPostalCode] = useState('');

  // 1. Resolve Institute Context
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('current_institute_id') || '';
      if (storedId) setInstituteId(storedId);
    }
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (ctx?.instituteId) setInstituteId(ctx.instituteId);
      })
      .catch(() => {});
  }, []);

  // 2. Fetch Teachers from PostgreSQL
  const loadTeachers = useCallback(async (bypassCache = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: 50,
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (specializationFilter !== 'ALL') params.specialization = specializationFilter;

      const res = await teacherApi.getTeachers(instituteId, params);
      const list = Array.isArray(res?.data) ? res.data : [];
      setTeachers(list);
      setTotalPages(res?.meta?.totalPages || 1);
      setTotalCount(res?.meta?.total ?? list.length);
    } catch (err: any) {
      console.error('Error fetching teachers from PostgreSQL:', err.message);
      setErrorMsg(err.message || 'Unable to load faculty from database.');
      setTeachers([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, currentPage, debouncedSearch, statusFilter, specializationFilter]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // Distinct specializations for quick filter pills
  const availableSpecializations = useMemo(() => {
    const set = new Set<string>();
    teachers.forEach((t) => {
      if (t.specialization) set.add(t.specialization);
    });
    return Array.from(set);
  }, [teachers]);

  // Dynamic Statistics
  const activeCount = useMemo(() => teachers.filter((t) => t.status === 'ACTIVE').length, [teachers]);
  const totalCoursesAssigned = useMemo(
    () => teachers.reduce((sum, t) => sum + (t.assignedCoursesCount || 0), 0),
    [teachers],
  );
  const avgExperience = useMemo(() => {
    const list = teachers.filter((t) => typeof t.experienceYears === 'number');
    if (list.length === 0) return '10 yrs';
    const sum = list.reduce((acc, t) => acc + (t.experienceYears || 0), 0);
    return `${(sum / list.length).toFixed(1)} yrs`;
  }, [teachers]);

  // Image Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Photo size exceeds 5MB limit.');
      return;
    }
    try {
      const compressedDataUrl = await compressImage(file, 256, 0.85);
      setFormPhotoPreview(compressedDataUrl);
      setFormPhotoUrl(compressedDataUrl);
      setFormError(null);
    } catch {
      setFormError('Failed to process image file.');
    }
  };

  // Submit Handler for New Teacher Modal
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formFullName.trim()) {
      setFormError('Please provide the instructor full name.');
      setModalTab('personal');
      return;
    }

    const cleanPhone = formPhoneE164.trim();
    if (cleanPhone.length < 8) {
      setFormError('Please enter a valid phone number (e.g. +91 98765 43210).');
      setModalTab('personal');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        fullName: formFullName.trim(),
        phoneE164: cleanPhone,
        specialization: formSpecialization.trim() || undefined,
        highestDegree: formHighestDegree.trim() || undefined,
        status: formStatus,
        bio: formBio.trim() || undefined,
      };

      if (formEmail.trim()) payload.email = formEmail.trim();
      if (formEmployeeCode.trim()) payload.employeeCode = formEmployeeCode.trim();
      if (formExperienceYears !== '') payload.experienceYears = Number(formExperienceYears);
      if (formJoiningDate) payload.joiningDate = new Date(formJoiningDate).toISOString();
      if (formPhotoUrl) payload.photoUrl = formPhotoUrl;
      if (formPassword.trim()) payload.password = formPassword.trim();

      if (formStreet.trim() || formCity.trim() || formState.trim() || formPostalCode.trim()) {
        payload.address = {
          street: formStreet.trim(),
          city: formCity.trim(),
          state: formState.trim(),
          country: formCountry.trim(),
          postalCode: formPostalCode.trim(),
        };
      }

      const res = await teacherApi.createTeacher(instituteId, payload);

      // Instant UI Reflection: Prepend to state & increment counters
      const newTeacherSummary: TeacherSummaryDto = {
        id: res.id,
        employeeCode: res.employeeCode,
        fullName: res.fullName,
        phoneE164: res.phoneE164,
        email: res.email,
        specialization: res.specialization,
        highestDegree: res.highestDegree,
        experienceYears: res.experienceYears,
        status: (res.status as any) || 'ACTIVE',
        assignedCoursesCount: 0,
        assignedBatchesCount: 0,
        joiningDate: res.joiningDate,
        createdAt: res.createdAt || new Date().toISOString(),
        photoUrl: formPhotoUrl || null,
      };

      setTeachers((prev) => [newTeacherSummary, ...prev]);
      setTotalCount((c) => c + 1);

      showToast(
        'Teacher Registered Successfully',
        `Prof. ${res.fullName} (${res.employeeCode}) was created in PostgreSQL.`,
        'success'
      );

      // Reset form & close modal
      setIsAddModalOpen(false);
      setFormFullName('');
      setFormPhoneE164('+91 ');
      setFormEmail('');
      setFormPassword('');
      setFormPhotoUrl('');
      setFormPhotoPreview(null);
      setFormEmployeeCode('');
      setFormBio('');
      setFormStreet('');
      setFormCity('');
      setFormState('');
      setFormPostalCode('');
      setModalTab('personal');

      // Reload in background to ensure sync
      loadTeachers(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to register instructor. Please verify inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Toggle Handler (Deactivate / Activate)
  const handleToggleStatus = async () => {
    if (!statusModalTeacher) return;
    setStatusLoading(true);
    const targetStatus = statusModalTeacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    try {
      await teacherApi.updateStatus(instituteId, statusModalTeacher.id, targetStatus);

      // Reflect in local state
      setTeachers((prev) =>
        prev.map((t) => (t.id === statusModalTeacher.id ? { ...t, status: targetStatus as any } : t))
      );

      showToast(
        `Faculty Status Updated`,
        `${statusModalTeacher.fullName} is now ${targetStatus}. Historical records preserved.`,
        'success'
      );

      setStatusModalTeacher(null);
    } catch (err: any) {
      showToast('Status Update Failed', err.message || 'Unable to update faculty status.', 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Institute Administrator"
      userRoleLabel="Administrator"
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              toastMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          </div>
          <div>
            <p className="text-xs font-semibold">{toastMessage.title}</p>
            <p className="text-xs text-slate-300 mt-0.5">{toastMessage.desc}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Top Header & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-blue-50 text-blue-700 border border-blue-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                Live PostgreSQL Records
              </span>
              <span className="text-xs text-slate-400 font-medium">Faculty Roster</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <GraduationCap className="h-5 w-5" />
              </div>
              Faculty & Teacher Management
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Manage theological instructors, assign curriculum cohorts, and monitor instructional workloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-600 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid size={15} />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white text-blue-600 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table List View"
              >
                <List size={15} />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadTeachers(true)}
              className="flex items-center gap-1.5 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
              <span>Refresh</span>
            </Button>

            {/* In-Page Modal Trigger */}
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/20 font-medium px-4 py-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Teacher</span>
            </Button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Faculty"
            value={totalCount.toString()}
            trend={`${activeCount} Active in Database`}
            icon={<GraduationCap className="h-5 w-5 text-blue-600" />}
            colorScheme="blue"
          />
          <StatCard
            title="Active Teachers"
            value={activeCount.toString()}
            trend="Available for scheduling"
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            colorScheme="emerald"
          />
          <StatCard
            title="Course Assignments"
            value={totalCoursesAssigned.toString()}
            trend="Active teaching roles"
            icon={<BookOpen className="h-5 w-5 text-indigo-600" />}
            colorScheme="purple"
          />
          <StatCard
            title="Avg Faculty Experience"
            value={avgExperience}
            trend="Theological pedagogy"
            icon={<Briefcase className="h-5 w-5 text-amber-600" />}
            colorScheme="amber"
          />
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search faculty by name, phone, email, employee code, or subject..."
                className="w-full pl-10 pr-9 py-2.5 text-xs md:text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
                <option value="ON_LEAVE">On Leave</option>
              </select>

              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Specializations</option>
                {availableSpecializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Specialization Quick Pills */}
          {availableSpecializations.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Quick Filter:
              </span>
              <button
                onClick={() => setSpecializationFilter('ALL')}
                className={`text-xs px-2.5 py-1 rounded-lg transition font-medium ${
                  specializationFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({totalCount})
              </button>
              {availableSpecializations.slice(0, 6).map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSpecializationFilter(spec === specializationFilter ? 'ALL' : spec)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition font-medium ${
                    specializationFilter === spec
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-600">Querying verified faculty from PostgreSQL...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && teachers.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Faculty Members Found</h3>
            <p className="text-xs text-slate-500 mt-1.5 mb-6">
              {searchQuery
                ? `No instructors matched "${searchQuery}". Clear your search or reset filters.`
                : 'There are no faculty registered under this institute yet. Click below to register the first teacher.'}
            </p>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl"
            >
              <Plus size={16} />
              Register First Teacher
            </Button>
          </div>
        )}

        {/* MAIN VIEW 1: PREMIUM FACULTY CARDS GRID */}
        {!isLoading && teachers.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teachers.map((t) => {
              const initials = t.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('');
              const isActive = t.status === 'ACTIVE';

              return (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Avatar, Names & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {t.photoUrl ? (
                            <img
                              src={t.photoUrl}
                              alt={t.fullName}
                              className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20">
                              {initials}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            title={isActive ? 'Active' : 'Inactive'}
                          />
                        </div>

                        <div>
                          <Link
                            href={`/admin/teachers/${t.id}`}
                            className="text-sm font-bold text-slate-900 hover:text-blue-600 transition line-clamp-1 group-hover:text-blue-600"
                          >
                            {t.fullName}
                          </Link>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {t.highestDegree || 'Theology Faculty'}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    {/* Specialization & Code Row */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50/80 text-blue-700 font-medium text-[11px] border border-blue-100 truncate max-w-[200px]">
                          <Sparkles size={11} className="text-blue-500 shrink-0" />
                          <span className="truncate">{t.specialization || 'Theological Studies'}</span>
                        </span>

                        {t.employeeCode && (
                          <button
                            onClick={() => handleCopyCode(t.employeeCode!)}
                            className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md hover:bg-slate-200 transition"
                            title="Click to copy employee code"
                          >
                            <span>{t.employeeCode}</span>
                            {copiedCode === t.employeeCode ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} className="text-slate-400" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Contact Info */}
                      <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <a href={`tel:${t.phoneE164}`} className="hover:text-blue-600 transition truncate">
                            {t.phoneE164}
                          </a>
                        </div>
                        {t.email && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <a href={`mailto:${t.email}`} className="hover:text-blue-600 transition truncate">
                              {t.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Workload Metrics */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                      <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Courses</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{t.assignedCoursesCount || 0}</p>
                      </div>
                      <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Cohorts</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{t.assignedBatchesCount || 0}</p>
                      </div>
                      <div className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Experience</p>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">
                          {t.experienceYears ? `${t.experienceYears} yrs` : '5 yrs'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setQuickViewTeacher(t)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-slate-200/60"
                    >
                      <Eye size={13} />
                      Quick View
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setStatusModalTeacher(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition ${
                          isActive
                            ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>

                      <Link
                        href={`/admin/teachers/${t.id}`}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded-lg transition shadow-xs flex items-center gap-1"
                      >
                        Profile
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MAIN VIEW 2: POLISHED TABLE VIEW */}
        {!isLoading && teachers.length > 0 && viewMode === 'table' && (
          <Card className="border border-slate-200/80 shadow-xs overflow-hidden bg-white rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-left">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">Instructor</th>
                    <th className="px-4 py-3.5">Employee Code</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">Specialization</th>
                    <th className="px-4 py-3.5 text-center">Courses / Batches</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers.map((t) => {
                    const initials = t.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('');
                    const isActive = t.status === 'ACTIVE';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {t.photoUrl ? (
                              <img src={t.photoUrl} alt="" className="w-9 h-9 rounded-xl object-cover border" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-xs border border-blue-200">
                                {initials}
                              </div>
                            )}
                            <div>
                              <Link
                                href={`/admin/teachers/${t.id}`}
                                className="font-semibold text-slate-900 hover:text-blue-600 transition"
                              >
                                {t.fullName}
                              </Link>
                              <p className="text-[11px] text-slate-400">{t.highestDegree || 'Theology Faculty'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-700">
                            {t.employeeCode || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="text-slate-800 font-medium">{t.phoneE164}</p>
                          <p className="text-slate-400 text-xs">{t.email || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                            {t.specialization || 'General Studies'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <span className="text-slate-700 font-semibold">{t.assignedCoursesCount || 0}</span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-slate-700 font-semibold">{t.assignedBatchesCount || 0}</span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setQuickViewTeacher(t)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="Quick View"
                            >
                              <Eye size={15} />
                            </button>
                            <Link
                              href={`/admin/teachers/${t.id}`}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              Profile
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* MODAL 1: REGISTER NEW FACULTY MEMBER (IN-PAGE POPUP) */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Register Faculty Member</h3>
                    <p className="text-xs text-slate-500">
                      Creates instructor profile, user account, and faculty credentials in PostgreSQL.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Navigation Tabs */}
              <div className="flex border-b border-slate-100 px-6 bg-white gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalTab('personal')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    modalTab === 'personal'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  1. Personal & Account
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('academic')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    modalTab === 'academic'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  2. Academic & Ministry
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('location')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    modalTab === 'location'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  3. Address & Location
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleCreateTeacher} className="flex-1 overflow-y-auto p-6 space-y-4">
                {formError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* TAB 1: PERSONAL & ACCOUNT */}
                {modalTab === 'personal' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <div className="relative">
                        {formPhotoPreview ? (
                          <img
                            src={formPhotoPreview}
                            alt="Preview"
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg border-2 border-dashed border-blue-300">
                            <Camera size={22} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-900">Faculty Portrait / Photograph</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 mb-2">
                          JPG, PNG, or WebP. Auto-compressed into lightweight thumbnail.
                        </p>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition">
                          <Upload size={13} />
                          Upload Photograph
                          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formFullName}
                          onChange={(e) => setFormFullName(e.target.value)}
                          placeholder="e.g. Dr. Arthur Pink"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Mobile Phone (E.164) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={formPhoneE164}
                          onChange={(e) => setFormPhoneE164(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={formEmail}
                          onChange={(e) => setFormEmail(e.target.value)}
                          placeholder="faculty@bible-institute.org"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Initial Portal Password
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={formPassword}
                            onChange={(e) => setFormPassword(e.target.value)}
                            placeholder="Optional login password"
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-8 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ACADEMIC & MINISTRY */}
                {modalTab === 'academic' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Employee / Faculty Code</label>
                        <input
                          type="text"
                          value={formEmployeeCode}
                          onChange={(e) => setFormEmployeeCode(e.target.value)}
                          placeholder="Leave blank for auto FAC-2026-XXXX"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Primary Specialization
                        </label>
                        <select
                          value={formSpecialization}
                          onChange={(e) => setFormSpecialization(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="Systematic Theology">Systematic Theology</option>
                          <option value="Biblical Hebrew & Old Testament">Biblical Hebrew & Old Testament</option>
                          <option value="New Testament Greek & Exegesis">New Testament Greek & Exegesis</option>
                          <option value="Homiletics & World Missions">Homiletics & World Missions</option>
                          <option value="Church History & Historical Theology">Church History & Historical Theology</option>
                          <option value="Pastoral Counseling & Ministry">Pastoral Counseling & Ministry</option>
                          <option value="Biblical Hermeneutics">Biblical Hermeneutics</option>
                          <option value="Apologetics & Ethics">Apologetics & Ethics</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Highest Degree</label>
                        <select
                          value={formHighestDegree}
                          onChange={(e) => setFormHighestDegree(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="M.Div">M.Div (Master of Divinity)</option>
                          <option value="Th.M">Th.M (Master of Theology)</option>
                          <option value="Ph.D">Ph.D in Theology</option>
                          <option value="D.Min">D.Min (Doctor of Ministry)</option>
                          <option value="M.Th">M.Th</option>
                          <option value="B.Th">B.Th (Bachelor of Theology)</option>
                          <option value="M.A. Biblical Studies">M.A. Biblical Studies</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Experience (Years)</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={formExperienceYears}
                          onChange={(e) => setFormExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="e.g. 5"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Appointment Date</label>
                        <input
                          type="date"
                          value={formJoiningDate}
                          onChange={(e) => setFormJoiningDate(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Biographical / Ministry Summary</label>
                      <textarea
                        rows={3}
                        value={formBio}
                        onChange={(e) => setFormBio(e.target.value)}
                        placeholder="Brief summary of pastoral background, ministry experience, and research interests..."
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: LOCATION */}
                {modalTab === 'location' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Street Address</label>
                      <input
                        type="text"
                        value={formStreet}
                        onChange={(e) => setFormStreet(e.target.value)}
                        placeholder="e.g. 12 Grace Seminary Road"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                        <input
                          type="text"
                          value={formCity}
                          onChange={(e) => setFormCity(e.target.value)}
                          placeholder="e.g. Bangalore / Kurnool"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">State / Province</label>
                        <input
                          type="text"
                          value={formState}
                          onChange={(e) => setFormState(e.target.value)}
                          placeholder="e.g. Karnataka / AP"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Postal Code</label>
                        <input
                          type="text"
                          value={formPostalCode}
                          onChange={(e) => setFormPostalCode(e.target.value)}
                          placeholder="e.g. 560001"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
                        <input
                          type="text"
                          value={formCountry}
                          onChange={(e) => setFormCountry(e.target.value)}
                          placeholder="India"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2">
                    {modalTab !== 'personal' && (
                      <button
                        type="button"
                        onClick={() => setModalTab(modalTab === 'location' ? 'academic' : 'personal')}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
                      >
                        Back
                      </button>
                    )}

                    {modalTab !== 'location' ? (
                      <button
                        type="button"
                        onClick={() => setModalTab(modalTab === 'personal' ? 'academic' : 'location')}
                        className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition"
                      >
                        Continue
                      </button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-2"
                      >
                        {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        <span>Register Faculty Member</span>
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: QUICK VIEW FACULTY DETAILS */}
        {quickViewTeacher && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {quickViewTeacher.photoUrl ? (
                    <img
                      src={quickViewTeacher.photoUrl}
                      alt={quickViewTeacher.fullName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                      {quickViewTeacher.fullName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{quickViewTeacher.fullName}</h3>
                    <p className="text-xs text-blue-600 font-semibold">{quickViewTeacher.specialization}</p>
                  </div>
                </div>
                <button
                  onClick={() => setQuickViewTeacher(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Employee Code</span>
                  <span className="font-mono font-bold text-slate-800">{quickViewTeacher.employeeCode || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Highest Degree</span>
                  <span className="font-semibold text-slate-800">{quickViewTeacher.highestDegree || 'Theology Faculty'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Teaching Experience</span>
                  <span className="font-semibold text-slate-800">
                    {quickViewTeacher.experienceYears ? `${quickViewTeacher.experienceYears} Years` : '5 Years'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Mobile Phone</span>
                  <a href={`tel:${quickViewTeacher.phoneE164}`} className="text-blue-600 font-medium hover:underline">
                    {quickViewTeacher.phoneE164}
                  </a>
                </div>
                {quickViewTeacher.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Email</span>
                    <a href={`mailto:${quickViewTeacher.email}`} className="text-blue-600 font-medium hover:underline">
                      {quickViewTeacher.email}
                    </a>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Roster Status</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      quickViewTeacher.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {quickViewTeacher.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setQuickViewTeacher(null)} className="rounded-xl">
                  Close
                </Button>
                <Link href={`/admin/teachers/${quickViewTeacher.id}`}>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1">
                    <span>Full Profile & Workload</span>
                    <ExternalLink size={13} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: STATUS CHANGE CONFIRMATION */}
        {statusModalTeacher && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                {statusModalTeacher.status === 'ACTIVE' ? <UserX size={24} /> : <UserCheck size={24} />}
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">
                  {statusModalTeacher.status === 'ACTIVE'
                    ? `Deactivate ${statusModalTeacher.fullName}?`
                    : `Reactivate ${statusModalTeacher.fullName}?`}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {statusModalTeacher.status === 'ACTIVE'
                    ? 'The instructor will be marked inactive and hidden from active scheduling. All historical records, courses, and batches will be safely preserved.'
                    : 'The instructor will be restored to active status and will be immediately available for cohort scheduling.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusModalTeacher(null)}
                  disabled={statusLoading}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={statusLoading}
                  className={`rounded-xl text-white ${
                    statusModalTeacher.status === 'ACTIVE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {statusLoading ? 'Updating...' : statusModalTeacher.status === 'ACTIVE' ? 'Confirm Deactivation' : 'Confirm Activation'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
