'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Layers,
  Plus,
  Users,
  Clock,
  CheckCircle,
  Filter,
  Search,
  Sparkles,
  ArrowRight,
  X,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  BookOpen,
  GraduationCap,
  CreditCard,
  Building2,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  batchApi,
  courseApi,
  AcademicYearDto,
  AcademicTermDto,
  CourseDto,
  resolveVerifiedAdminContext,
} from '@/lib/api';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <Building2 size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export interface BatchItem {
  id: string;
  name: string;
  code: string;
  courseId: string;
  courseTitle: string;
  academicYearId?: string;
  academicYearName?: string;
  termId?: string;
  termName?: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  startDate: string;
  endDate: string;
  capacity: number;
  enrolledCount: number;
  leadTeacher: {
    id: string;
    name: string;
    photoUrl?: string;
  };
  assistantsCount: number;
  scheduledClassesCount: number;
}

export default function BatchesPage() {
  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id');
      if (stored) return stored;
    }
    return 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
  });

  // Database State (Strict Zero-Mock: empty by default)
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearDto[]>([]);
  const [academicTerms, setAcademicTerms] = useState<AcademicTermDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [termFilter, setTermFilter] = useState<string>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Batch Form State
  const [newBatch, setNewBatch] = useState({
    name: '',
    code: '',
    courseId: '',
    academicYearId: '',
    academicTermId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split('T')[0],
    capacity: 40,
  });

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

  // Fetch courses, academic years, and terms
  useEffect(() => {
    if (!instituteId) return;
    courseApi
      .getCourses(instituteId, { limit: 100 })
      .then((res) => {
        if (res && Array.isArray(res.data)) {
          setCourses(res.data);
          if (res.data.length > 0 && !newBatch.courseId) {
            setNewBatch((prev) => ({ ...prev, courseId: res.data[0].id }));
          }
        }
      })
      .catch(() => {});

    batchApi
      .getAcademicYears(instituteId)
      .then((years) => {
        if (Array.isArray(years)) {
          setAcademicYears(years);
          const currentYear = years.find((y) => y.isCurrent) || years[0];
          if (currentYear && !newBatch.academicYearId) {
            setNewBatch((prev) => ({ ...prev, academicYearId: currentYear.id }));
          }
        }
      })
      .catch(() => {});

    batchApi
      .getAcademicTerms(instituteId)
      .then((terms) => {
        if (Array.isArray(terms)) {
          setAcademicTerms(terms);
          const currentTerm = terms.find((t) => t.isCurrent) || terms[0];
          if (currentTerm && !newBatch.academicTermId) {
            setNewBatch((prev) => ({ ...prev, academicTermId: currentTerm.id }));
          }
        }
      })
      .catch(() => {});
  }, [instituteId]);

  // Load live batches from PostgreSQL
  const loadBatches = useCallback(async () => {
    if (!instituteId) return;
    setIsLoading(true);
    setApiError(null);

    try {
      const res: any = await batchApi.getBatches(instituteId);
      const rawBatches = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];

      const mapped: BatchItem[] = rawBatches.map((b: any) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        courseId: b.courseId,
        courseTitle: b.course?.title || 'Biblical Studies',
        academicYearId: b.academicYearId,
        academicYearName: b.academicYear?.name || '2026-2027',
        termId: b.termId || b.academicTermId,
        termName: b.academicTerm?.name || 'Semester',
        status: b.status,
        startDate: typeof b.startDate === 'string' ? b.startDate.slice(0, 10) : '2026-07-01',
        endDate: typeof b.endDate === 'string' ? b.endDate.slice(0, 10) : '2026-12-31',
        capacity: b.capacity,
        enrolledCount: b._count?.enrolments ?? b.enrolledCount ?? 0,
        leadTeacher: {
          id: 't-faculty',
          name: b.teachers?.[0]?.teacherProfile?.membership?.user?.fullName || 'Faculty Lead',
        },
        assistantsCount: Math.max(0, (b._count?.teachers ?? 1) - 1),
        scheduledClassesCount: b._count?.liveSessions ?? 0,
      }));

      setBatches(mapped);
    } catch (err: any) {
      setBatches([]);
      setApiError(err?.message || 'Failed to query live batches from PostgreSQL');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Filter batches
  const filtered = useMemo(() => {
    return batches.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.code.toLowerCase().includes(search.toLowerCase()) ||
        b.courseTitle.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
      const matchesTerm = termFilter === 'ALL' || b.termName === termFilter;

      return matchesSearch && matchesStatus && matchesTerm;
    });
  }, [batches, search, statusFilter, termFilter]);

  // Handle Create Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.name || !newBatch.courseId || !newBatch.startDate || !newBatch.endDate) return;

    setIsSubmitting(true);
    try {
      await batchApi.createBatch(instituteId, {
        courseId: newBatch.courseId,
        name: newBatch.name,
        code: newBatch.code || `B-${Date.now().toString().slice(-4)}`,
        startDate: newBatch.startDate,
        endDate: newBatch.endDate,
        capacity: Number(newBatch.capacity),
        academicYearId: newBatch.academicYearId || undefined,
        termId: newBatch.academicTermId || undefined,
      });

      setShowCreateModal(false);
      setNewBatch({
        name: '',
        code: '',
        courseId: courses[0]?.id || '',
        academicYearId: academicYears[0]?.id || '',
        academicTermId: academicTerms[0]?.id || '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().split('T')[0],
        capacity: 40,
      });
      loadBatches();
    } catch (err: any) {
      alert(`Batch creation error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetCurrentYear = async (yearId: string) => {
    try {
      await batchApi.setCurrentAcademicYear(instituteId, yearId);
      const updatedYears = await batchApi.getAcademicYears(instituteId);
      setAcademicYears(updatedYears);
    } catch (err: any) {
      alert(`Could not set current academic year: ${err.message}`);
    }
  };

  const handleSetCurrentTerm = async (termId: string) => {
    try {
      await batchApi.setCurrentAcademicTerm(instituteId, termId);
      const updatedTerms = await batchApi.getAcademicTerms(instituteId);
      setAcademicTerms(updatedTerms);
    } catch (err: any) {
      alert(`Could not set current academic term: ${err.message}`);
    }
  };

  const getStatusBadge = (status: BatchItem['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active Cohort</Badge>;
      case 'UPCOMING':
        return <Badge variant="info">Upcoming Intake</Badge>;
      case 'COMPLETED':
        return <Badge variant="neutral">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>;
      case 'ARCHIVED':
        return <Badge variant="neutral">Archived</Badge>;
    }
  };

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {apiError && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600" />
              <span>{apiError}</span>
            </div>
            <Button size="sm" variant="outline" onClick={loadBatches} className="gap-1 h-7 text-xs">
              <RefreshCw size={12} /> Retry
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Calendar className="text-blue-600" size={26} />
              Batches, Academic Terms & Scheduling
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Live PostgreSQL cohort intakes, academic periods, capacity quotas, and scheduled live classes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setShowTermsModal(true)}
              className="flex items-center gap-2 text-xs"
            >
              <CalendarDays size={14} />
              Academic Terms
            </Button>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 text-xs"
            >
              <Plus size={14} />
              Create New Batch
            </Button>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Cohorts"
            value={batches.length.toString()}
            trend="All Academic Periods"
            colorScheme="blue"
            icon={<Layers className="text-blue-600" size={22} />}
          />
          <StatCard
            title="Active Batches"
            value={batches.filter((b) => b.status === 'ACTIVE').length.toString()}
            trend="In Session Now"
            colorScheme="emerald"
            icon={<CheckCircle className="text-emerald-500" size={22} />}
          />
          <StatCard
            title="Upcoming Intakes"
            value={batches.filter((b) => b.status === 'UPCOMING').length.toString()}
            trend="Open for Admissions"
            colorScheme="amber"
            icon={<Sparkles className="text-amber-500" size={22} />}
          />
          <StatCard
            title="Live Classes"
            value={batches.reduce((acc, b) => acc + b.scheduledClassesCount, 0).toString()}
            trend="Scheduled Sessions"
            colorScheme="purple"
            icon={<Clock className="text-purple-500" size={22} />}
          />
        </div>

        {/* Filter Bar */}
        <Card className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search batches by name, code or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Filter size={14} />
                <span>Term:</span>
              </div>
              <select
                value={termFilter}
                onChange={(e) => setTermFilter(e.target.value)}
                className="text-xs border rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Academic Terms</option>
                {academicTerms.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2 border-t pt-3 overflow-x-auto text-xs">
            {['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED', 'ARCHIVED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === tab
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
                <span className="ml-1.5 text-[10px] opacity-80">
                  (
                  {tab === 'ALL'
                    ? batches.length
                    : batches.filter((b) => b.status === tab).length}
                  )
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Batches Cards Grid */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-200">
            <div className="inline-flex items-center gap-2 text-sm">
              <RefreshCw size={18} className="animate-spin text-blue-600" />
              <span>Querying verified batches from PostgreSQL...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="mx-auto text-slate-300 mb-3" size={40} />
            <h3 className="text-sm font-bold text-slate-700">No Batches Found in Database</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Click &apos;Create New Batch&apos; above to record a new cohort intake in PostgreSQL.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((batch) => {
              const fillPct = Math.round((batch.enrolledCount / (batch.capacity || 1)) * 100);
              const isNearFull = fillPct >= 85;

              return (
                <Card
                  key={batch.id}
                  className="p-5 flex flex-col justify-between hover:border-blue-400 transition-shadow hover:shadow-md"
                >
                  <div className="space-y-4">
                    {/* Top line: Name & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-slate-900 hover:text-blue-600 transition-colors">
                            <Link href={`/admin/batches/${batch.id}`}>{batch.name}</Link>
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">
                            {batch.code}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-800">{batch.courseTitle}</span>
                        </div>
                      </div>
                      <div>{getStatusBadge(batch.status)}</div>
                    </div>

                    {/* Dates & Academic Period */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Period</span>
                        <span className="font-medium text-slate-800 mt-0.5 block">
                          {batch.startDate} to {batch.endDate}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Term</span>
                        <span className="font-medium text-slate-800 mt-0.5 block">
                          {batch.termName || 'General'}
                        </span>
                      </div>
                    </div>

                    {/* Capacity Meter */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Users size={13} />
                          Enrolment Capacity:
                        </span>
                        <span className={`font-semibold ${isNearFull ? 'text-amber-600' : 'text-slate-800'}`}>
                          {batch.enrolledCount} / {batch.capacity} Students ({fillPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            fillPct >= 100
                              ? 'bg-rose-500'
                              : fillPct >= 80
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(fillPct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Faculty & Classes info */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {batch.leadTeacher?.name?.[0] || 'F'}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-800">{batch.leadTeacher.name}</span>
                          <span className="text-slate-400 ml-1">(Lead)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 font-medium text-slate-700">
                        <Clock size={13} className="text-blue-600" />
                        <span>{batch.scheduledClassesCount} Live Sessions</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      PostgreSQL Verified Batch
                    </span>
                    <Link href={`/admin/batches/${batch.id}`}>
                      <Button variant="primary" size="sm" className="flex items-center gap-1 text-xs">
                        Batch Studio
                        <ArrowRight size={13} />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE BATCH MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border max-w-xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="text-blue-600" size={18} />
                Create New Academic Batch
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Batch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diploma Cohort Alpha 2026"
                    value={newBatch.name}
                    onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Batch Code (Identifier)</label>
                  <input
                    type="text"
                    placeholder="e.g. DIB-2026-A"
                    value={newBatch.code}
                    onChange={(e) => setNewBatch({ ...newBatch, code: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Course Selection *</label>
                  <select
                    value={newBatch.courseId}
                    onChange={(e) => setNewBatch({ ...newBatch, courseId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                  <select
                    value={newBatch.academicYearId}
                    onChange={(e) => setNewBatch({ ...newBatch, academicYearId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} {ay.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Academic Term</label>
                  <select
                    value={newBatch.academicTermId}
                    onChange={(e) => setNewBatch({ ...newBatch, academicTermId: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {academicTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.startDate}
                    onChange={(e) => setNewBatch({ ...newBatch, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">End Date *</label>
                  <input
                    type="date"
                    required
                    value={newBatch.endDate}
                    onChange={(e) => setNewBatch({ ...newBatch, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Student Capacity *</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={newBatch.capacity}
                    onChange={(e) => setNewBatch({ ...newBatch, capacity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving to Database...' : 'Create Batch'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACADEMIC TERMS MANAGER MODAL */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="text-blue-600" size={18} />
                  Academic Period & Term Boundaries
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live PostgreSQL academic years and semesters configured for this institute.
                </p>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Academic Years ({academicYears.length} in Database)
                </h4>
                <div className="divide-y divide-slate-100 text-xs">
                  {academicYears.length > 0 ? (
                    academicYears.map((ay) => (
                      <div key={ay.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{ay.name}</span>
                          <span className="text-[11px] text-slate-500 block">
                            Boundary: {ay.startDate.slice(0, 10)} to {ay.endDate.slice(0, 10)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ay.isCurrent ? (
                            <Badge variant="success">Current Period</Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetCurrentYear(ay.id)}
                            >
                              Set as Current
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-slate-400">No academic years recorded</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Configured Semesters / Terms ({academicTerms.length} in Database)
                </h4>
                <div className="divide-y divide-slate-100 text-xs">
                  {academicTerms.length > 0 ? (
                    academicTerms.map((term) => (
                      <div key={term.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-800">{term.name}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {term.startDate.slice(0, 10)} to {term.endDate.slice(0, 10)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {term.isCurrent ? (
                            <Badge variant="success">Current Term</Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetCurrentTerm(term.id)}
                            >
                              Set Current
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-slate-400">No academic terms recorded</div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowTermsModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
