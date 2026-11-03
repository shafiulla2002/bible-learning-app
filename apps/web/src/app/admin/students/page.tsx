'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  studentApi,
  courseApi,
  batchApi,
  StudentProfileSummaryDto,
  CourseDto,
  BatchDto,
  resolveVerifiedAdminContext,
  getCached,
  setCached,
} from '@/lib/api';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Calendar,
  Phone,
  Clock,
  RotateCcw,
  RefreshCw,
  Building2,
  GraduationCap,
  ShieldCheck,
  CreditCard,
  Trash2,
  Camera,
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

export default function StudentsDirectoryPage() {
  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id');
      if (stored) return stored;
    }
    return 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
  });

  // Live Database State (Strict Zero-Mock: starts empty)
  const [students, setStudents] = useState<StudentProfileSummaryDto[]>([]);
  const [liveStats, setLiveStats] = useState<{ total: number; activeCount: number; reviewCount: number; inactiveCount: number } | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');

  // Available options for selects
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [batches, setBatches] = useState<BatchDto[]>([]);

  // Add Student Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({
    avatarUrl: '',
    fullName: '',
    phoneNumber: '+91 ',
    email: '',
    gender: 'Male',
    church: '',
    preferredLanguage: 'English',
    courseId: '',
    batchId: '',
    guardianName: '',
    addressCity: '',
    status: 'ACTIVE' as const,
  });

  // Bulk Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importSummary, setImportSummary] = useState<{ total: number; valid: number; duplicates: number } | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Resolve admin context
  useEffect(() => {
    let active = true;
    resolveVerifiedAdminContext()
      .then((ctx) => {
        if (!active) return;
        if (ctx?.instituteId) {
          setInstituteId(ctx.instituteId);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch courses and batches for dropdowns
  useEffect(() => {
    if (!instituteId) return;
    courseApi
      .getCourses(instituteId, { limit: 100 })
      .then((res) => {
        if (res && Array.isArray(res.data)) {
          setCourses(res.data);
          if (res.data.length > 0 && !newStudent.courseId) {
            setNewStudent((prev) => ({ ...prev, courseId: res.data[0].id }));
          }
        }
      })
      .catch(() => {});

    batchApi
      .getBatches(instituteId)
      .then((res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setBatches(raw);
        if (raw.length > 0 && !newStudent.batchId) {
          setNewStudent((prev) => ({ ...prev, batchId: raw[0].id }));
        }
      })
      .catch(() => {});
  }, [instituteId]);

  // Fetch genuine student list from PostgreSQL
  const fetchStudents = useCallback(async () => {
    if (!instituteId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const cacheKey = `students:${instituteId}:${currentPage}:${pageSize}:${debouncedSearch}:${statusFilter}:${courseFilter}`;
      const cached = getCached<any>(cacheKey);
      if (cached && Array.isArray(cached.data)) {
        setStudents(cached.data);
        setTotalCount(cached.meta?.total ?? cached.data.length);
        setTotalPages(cached.meta?.totalPages ?? 1);
        if (cached.meta?.stats) {
          setLiveStats(cached.meta.stats);
        }
        setIsLoading(false);
      }

      const res = await studentApi.getStudents(instituteId, {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as any) : undefined,
        courseId: courseFilter !== 'ALL' ? courseFilter : undefined,
      });

      if (res && Array.isArray(res.data)) {
        setStudents(res.data);
        setTotalCount(res.meta?.total ?? res.data.length);
        setTotalPages(res.meta?.totalPages ?? 1);
        if ((res.meta as any)?.stats) {
          setLiveStats((res.meta as any).stats);
        }
        setCached(cacheKey, res, 30000);
      } else {
        setStudents([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      setStudents([]);
      setTotalCount(0);
      setErrorMessage(err?.message || 'Unable to connect to live students database');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, currentPage, pageSize, debouncedSearch, statusFilter, courseFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Handle Add Student Submit
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName || !newStudent.phoneNumber) {
      showToast('Please enter full name and phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await studentApi.createStudent(instituteId, {
        fullName: newStudent.fullName,
        phoneNumber: newStudent.phoneNumber,
        avatarUrl: newStudent.avatarUrl || undefined,
        email: newStudent.email || undefined,
        gender: newStudent.gender,
        church: newStudent.church || undefined,
        preferredLanguage: newStudent.preferredLanguage,
        courseId: newStudent.courseId || undefined,
        batchId: newStudent.batchId || undefined,
        guardianName: newStudent.guardianName || undefined,
        addressCity: newStudent.addressCity || undefined,
        status: newStudent.status,
      });

      showToast(`Student ${created.fullName} registered successfully with admission ID ${created.admissionNo}!`);
      setIsAddModalOpen(false);
      setPhotoPreview(null);
      setNewStudent({
        avatarUrl: '',
        fullName: '',
        phoneNumber: '+91 ',
        email: '',
        gender: 'Male',
        church: '',
        preferredLanguage: 'English',
        courseId: courses[0]?.id || '',
        batchId: batches[0]?.id || '',
        guardianName: '',
        addressCity: '',
        status: 'ACTIVE',
      });
      fetchStudents();
    } catch (err: any) {
      showToast(`Registration failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Student
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to permanently delete student "${studentName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await studentApi.deleteStudent(instituteId, studentId);
      showToast(`Student "${studentName}" has been permanently deleted.`);
      fetchStudents();
    } catch (err: any) {
      showToast(`Failed to delete student: ${err?.message || 'Server error'}`);
    }
  };

  // Handle Status Update
  const handleStatusChange = async (studentId: string, newStatus: any) => {
    try {
      await studentApi.updateStatus(instituteId, studentId, newStatus);
      showToast(`Student status updated to ${newStatus}`);
      fetchStudents();
    } catch (err: any) {
      showToast(`Failed to update status: ${err?.message || 'Server error'}`);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Admission No', 'Full Name', 'Phone', 'Email', 'Course', 'Batch', 'Status', 'Registered Date'];
    const rows = students.map((s) => [
      s.admissionNo,
      s.fullName,
      s.phoneNumber,
      s.email || '',
      s.enrolledCourseName || 'Unassigned',
      s.enrolledBatchName || 'Unassigned',
      s.status,
      s.admissionDate ? s.admissionDate.split('T')[0] : '',
    ]);

    const csvContent = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `students-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Student CSV export downloaded successfully');
  };

  // Bulk import simulation preview
  const handleSimulateCSVPreview = () => {
    const samplePreview = [
      { row: 1, name: 'Philip Mathew', phone: '+919876543290', email: 'philip.m@example.com', course: courses[0]?.title || 'Theology', status: 'VALID' },
      { row: 2, name: 'Mary Magdalene', phone: '+919876543291', email: 'mary.m@example.com', course: courses[0]?.title || 'Theology', status: 'VALID' },
    ];
    setImportPreview(samplePreview);
    setImportSummary({ total: 2, valid: 2, duplicates: 0 });
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    const validRows = importPreview.filter((r) => r.status === 'VALID');
    try {
      await studentApi.bulkImport(
        instituteId,
        validRows.map((r) => ({
          fullName: r.name,
          phoneNumber: r.phone,
          email: r.email,
        })),
        true,
      );
      showToast(`Successfully imported ${validRows.length} students into PostgreSQL!`);
      setIsImportModalOpen(false);
      setImportPreview(null);
      setImportSummary(null);
      fetchStudents();
    } catch (err: any) {
      showToast(`Import failed: ${err?.message || 'Server error'}`);
    }
  };

  // Compute live breakdown stats with database aggregates
  const stats = useMemo(() => {
    if (liveStats) {
      return {
        total: liveStats.total,
        active: liveStats.activeCount,
        review: liveStats.reviewCount,
        inactive: liveStats.inactiveCount,
      };
    }
    const total = totalCount;
    const active = students.filter((s) => s.status === 'ACTIVE').length;
    const review = students.filter((s) => s.status === 'UNDER_REVIEW').length;
    const inactive = students.filter((s) => s.status === 'INACTIVE' || s.status === 'REJECTED').length;
    return { total, active, review, inactive };
  }, [liveStats, students, totalCount]);

  return (
    <PortalShell
      portalTitle="Institute Admin"
      portalRole="ADMIN"
      navItems={adminNav}
      userName="Samuel Admin"
      userRoleLabel="Institute Administrator"
    >
      <div className="space-y-6">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Database Status Alert Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <Button size="sm" variant="outline" onClick={fetchStudents} className="gap-1 h-7 text-xs">
              <RefreshCw size={12} /> Retry
            </Button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Student Directory & Admissions
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {totalCount} Verified in Database
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live PostgreSQL directory of registered learners, admission records, and active course cohorts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
              <Download size={14} />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} className="gap-1.5">
              <Upload size={14} />
              Bulk Import
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-1.5">
              <Plus size={14} />
              Add Student
            </Button>
          </div>
        </div>

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Students"
            value={isLoading && !liveStats && students.length === 0 ? '—' : stats.total}
            icon={<Users size={20} />}
            trend={`${stats.active} Active Learners`}
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Active Learners"
            value={isLoading && !liveStats && students.length === 0 ? '—' : stats.active}
            icon={<CheckCircle2 size={20} />}
            trend="Attending classes"
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Under Review"
            value={isLoading && !liveStats && students.length === 0 ? '—' : stats.review}
            icon={<Clock size={20} />}
            trend={stats.review > 0 ? 'Requires Action' : 'All clear'}
            trendPositive={stats.review === 0}
            colorScheme="amber"
          />
          <StatCard
            title="Inactive Accounts"
            value={isLoading && !liveStats && students.length === 0 ? '—' : stats.inactive}
            icon={<XCircle size={20} />}
            trend="On leave / deferred"
            trendPositive={false}
            colorScheme="purple"
          />
        </div>

        {/* Search & Filter Toolbar */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by student name, admission number, phone, email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="INACTIVE">Inactive</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Course Filter */}
            <div>
              <select
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(search || statusFilter !== 'ALL' || courseFilter !== 'ALL') && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Filtered View</span>
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setCourseFilter('ALL');
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                <RotateCcw size={12} />
                Clear Filters
              </button>
            </div>
          )}
        </Card>

        {/* Live Student Data Table */}
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Admission No</th>
                  <th className="py-3.5 px-4">Course & Batch</th>
                  <th className="py-3.5 px-4">Admitted On</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Enrolments</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw size={18} className="animate-spin text-blue-600" />
                        <span>Querying verified student records from PostgreSQL...</span>
                      </div>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Users size={32} className="mx-auto mb-2 opacity-50 text-slate-300" />
                      <p className="font-semibold text-slate-600">No students found in database</p>
                      <p className="text-[11px] mt-0.5">Click &apos;Add Student&apos; above to register learners into PostgreSQL.</p>
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition group">
                      {/* Name & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              alt={s.fullName}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm shrink-0">
                              {(s.fullName || 'Student')
                                .split(' ')
                                .map((n: string) => n[0])
                                .slice(0, 2)
                                .join('')}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition">
                              <Link href={`/admin/students/${s.id}`}>{s.fullName}</Link>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>{s.phoneNumber}</span>
                              {s.church && (
                                <>
                                  <span>•</span>
                                  <span>{s.church}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Admission ID */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 text-[11px]">
                        {s.admissionNo}
                      </td>

                      {/* Course & Batch */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-xs">
                          {s.enrolledCourseName || 'Unassigned Course'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {s.enrolledBatchName || 'General Batch'}
                        </div>
                      </td>

                      {/* Admission Date */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {s.admissionDate ? s.admissionDate.split('T')[0] : 'N/A'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {s.status === 'ACTIVE' && <Badge variant="success">Active</Badge>}
                        {s.status === 'UNDER_REVIEW' && <Badge variant="warning">Under Review</Badge>}
                        {s.status === 'APPROVED' && <Badge variant="info">Approved</Badge>}
                        {s.status === 'INACTIVE' && <Badge variant="neutral">Inactive</Badge>}
                        {s.status === 'REJECTED' && <Badge variant="danger">Rejected</Badge>}
                      </td>

                      {/* Enrolments Count */}
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-900">
                          {s.totalEnrolments || 1} Enrolled
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/students/${s.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" title="View Profile">
                              <Eye size={14} className="mr-1 text-slate-500" />
                              Profile
                            </Button>
                          </Link>

                          {s.status === 'UNDER_REVIEW' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleStatusChange(s.id, 'APPROVED')}
                              className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                              title="Approve Admission"
                            >
                              Approve
                            </Button>
                          )}

                          {s.status === 'ACTIVE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(s.id, 'INACTIVE')}
                              className="h-8 px-2 text-xs text-slate-500 hover:text-rose-600 hover:border-rose-200"
                              title="Mark Inactive"
                            >
                              Deactivate
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteStudent(s.id, s.fullName)}
                            className="h-8 px-2 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
                            title="Delete Student"
                          >
                            <Trash2 size={13} className="mr-1 text-rose-500" />
                            Delete
                          </Button>

                          {s.status === 'INACTIVE' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(s.id, 'ACTIVE')}
                              className="h-8 px-2 text-xs text-emerald-600 hover:bg-emerald-50"
                              title="Reactivate"
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {students.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </Card>

        {/* Modal 1: Add Student Admission Form */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Student Admission & Enrollment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register a new student directly into the PostgreSQL database
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddStudentSubmit} className="space-y-5">
                {/* Student Photo Upload */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-4">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Student Profile Photograph
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                      {photoPreview || newStudent.avatarUrl ? (
                        <img
                          src={photoPreview || newStudent.avatarUrl}
                          alt="Student preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-slate-400 font-bold text-base">
                          {newStudent.fullName
                            ? newStudent.fullName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : 'STU'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs">
                          <Upload size={13} />
                          <span>Upload Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const result = reader.result as string;
                                  setPhotoPreview(result);
                                  setNewStudent((prev) => ({ ...prev, avatarUrl: result }));
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <span className="text-xs text-slate-400">or enter image URL:</span>
                      </div>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/... or paste image URL"
                        value={newStudent.avatarUrl.startsWith('data:') ? '' : newStudent.avatarUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewStudent((prev) => ({ ...prev, avatarUrl: val }));
                          setPhotoPreview(null);
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Info */}
                <div>
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                    1. Personal Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Timothy Paul"
                        value={newStudent.fullName}
                        onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mobile Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={newStudent.phoneNumber}
                        onChange={(e) => setNewStudent({ ...newStudent, phoneNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        placeholder="timothy@example.com"
                        value={newStudent.email}
                        onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                      <select
                        value={newStudent.gender}
                        onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Church Affiliation
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Grace Bible Fellowship"
                        value={newStudent.church}
                        onChange={(e) => setNewStudent({ ...newStudent, church: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Preferred Study Language
                      </label>
                      <select
                        value={newStudent.preferredLanguage}
                        onChange={(e) => setNewStudent({ ...newStudent, preferredLanguage: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="English">English</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Tamil">Tamil</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Course & Batch */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                    2. Course & Cohort Enrollment
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Course Selection
                      </label>
                      <select
                        value={newStudent.courseId}
                        onChange={(e) => setNewStudent({ ...newStudent, courseId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select Course --</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Batch</label>
                      <select
                        value={newStudent.batchId}
                        onChange={(e) => setNewStudent({ ...newStudent, batchId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select Cohort Batch --</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Initial Admission Status
                      </label>
                      <select
                        value={newStudent.status}
                        onChange={(e) => setNewStudent({ ...newStudent, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="ACTIVE">Active (Enrolled immediately)</option>
                        <option value="UNDER_REVIEW">Under Review (Interview scheduled)</option>
                        <option value="APPROVED">Approved (Pending fee payment)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Guardian / City */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                    3. Emergency Contact & City
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Guardian / Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paul (Father)"
                        value={newStudent.guardianName}
                        onChange={(e) => setNewStudent({ ...newStudent, guardianName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        City / Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bangalore, Karnataka"
                        value={newStudent.addressCity}
                        onChange={(e) => setNewStudent({ ...newStudent, addressCity: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
                    {isSubmitting ? 'Registering in PostgreSQL...' : 'Complete Admission'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Bulk CSV Import Dialog */}
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Bulk Student CSV Import</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Direct bulk upload of student records into PostgreSQL
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportPreview(null);
                    setImportSummary(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {!importPreview ? (
                <div className="space-y-4">
                  <div
                    onClick={handleSimulateCSVPreview}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/20 rounded-2xl p-8 text-center cursor-pointer transition"
                  >
                    <FileSpreadsheet size={36} className="mx-auto text-blue-600 mb-2" />
                    <p className="text-xs font-bold text-slate-800">
                      Click to load CSV preview batch
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Loads validated records into the database
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Total</span>
                      <strong className="text-slate-900 text-sm">{importSummary?.total}</strong>
                    </div>
                    <div>
                      <span className="text-emerald-500 block text-[10px] uppercase">Valid</span>
                      <strong className="text-emerald-600 text-sm">{importSummary?.valid}</strong>
                    </div>
                    <div>
                      <span className="text-rose-500 block text-[10px] uppercase">Duplicates</span>
                      <strong className="text-rose-600 text-sm">{importSummary?.duplicates}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImportPreview(null);
                        setImportSummary(null);
                      }}
                    >
                      Back
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleConfirmImport} className="bg-blue-600">
                      Import {importSummary?.valid} Valid Records
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
