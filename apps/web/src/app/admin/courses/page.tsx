'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  GraduationCap,
  Clock,
  Layers,
  Users,
  Eye,
  CheckCircle,
  FileEdit,
  Archive,
  ArrowRight,
  Sparkles,
  ChevronRight,
  FolderOpen,
  LayoutDashboard,
  Calendar,
  CreditCard,
  Settings,
  AlertCircle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  courseApi,
  CourseDto,
  CourseCategoryDto,
  resolveVerifiedAdminContext,
} from '@/lib/api';


const COURSE_THEMES = [
  {
    headerBg: 'bg-[#1b6ee4]',
    circleBg: 'bg-[#1253af]',
    textSub: 'text-blue-100',
  },
  {
    headerBg: 'bg-[#278648]',
    circleBg: 'bg-[#1b6635]',
    textSub: 'text-emerald-100',
  },
  {
    headerBg: 'bg-[#dd7019]',
    circleBg: 'bg-[#b6530b]',
    textSub: 'text-amber-100',
  },
  {
    headerBg: 'bg-[#7c3aed]',
    circleBg: 'bg-[#5b21b6]',
    textSub: 'text-purple-100',
  },
  {
    headerBg: 'bg-[#0891b2]',
    circleBg: 'bg-[#0e7490]',
    textSub: 'text-cyan-100',
  },
];

function formatLevel(level?: string) {
  if (!level) return 'Beginner';
  switch (level.toUpperCase()) {
    case 'BEGINNER':
      return 'Beginner';
    case 'INTERMEDIATE':
      return 'Intermediate';
    case 'ADVANCED':
      return 'Advanced';
    default:
      return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  }
}

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} /> },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Attendance', href: '/admin/attendance', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
];

export default function AdminCoursesPage() {
  const [instituteId, setInstituteId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('current_institute_id');
      if (stored) return stored;
    }
    return 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
  });

  // Real Database State (Strict Zero-Mock: empty by default)
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [categories, setCategories] = useState<CourseCategoryDto[]>([]);
  const [totalCourses, setTotalCourses] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Course Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newLevel, setNewLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [newLanguage, setNewLanguage] = useState('English');
  const [newPricing, setNewPricing] = useState<'FREE' | 'PAID'>('PAID');
  const [newPrice, setNewPrice] = useState('18500');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast
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
        if (ctx?.instituteId) setInstituteId(ctx.instituteId);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fetch categories
  useEffect(() => {
    if (!instituteId) return;
    courseApi
      .getCategories(instituteId)
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
          if (data.length > 0 && !newCategoryId) {
            setNewCategoryId(data[0].id);
          }
        }
      })
      .catch(() => {});
  }, [instituteId]);

  // Fetch courses from PostgreSQL
  const fetchCourses = useCallback(async () => {
    if (!instituteId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await courseApi.getCourses(instituteId, {
        limit: 50,
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? (statusFilter as any) : undefined,
        categoryId: categoryFilter !== 'ALL' ? categoryFilter : undefined,
      });

      if (res && Array.isArray(res.data)) {
        setCourses(res.data);
        setTotalCourses(res.meta?.total ?? res.data.length);
      } else {
        setCourses([]);
        setTotalCourses(0);
      }
    } catch (err: any) {
      setCourses([]);
      setTotalCourses(0);
      setErrorMessage(err?.message || 'Unable to connect to live courses database');
    } finally {
      setIsLoading(false);
    }
  }, [instituteId, search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Filtered List for client level filter
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesLevel = levelFilter === 'ALL' || c.level === levelFilter;
      return matchesLevel;
    });
  }, [courses, levelFilter]);

  // KPIs
  const publishedCourses = courses.filter((c) => c.status === 'PUBLISHED').length;
  const draftCourses = courses.filter((c) => c.status === 'DRAFT').length;
  const totalLessons = courses.reduce((acc, c) => acc + (c.lessonsCount || 0), 0);

  // Handle Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Please enter a valid course title');
      return;
    }
    if (newDescription.trim().length < 10) {
      setFormError('Course description must be at least 10 characters');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const created = await courseApi.createCourse(instituteId, {
        title: newTitle.trim(),
        description: newDescription.trim(),
        categoryId: newCategoryId || undefined,
        level: newLevel,
        language: newLanguage,
        pricingType: newPricing,
        price: newPricing === 'PAID' ? parseInt(newPrice, 10) || 0 : 0,
        currency: 'INR',
        status: newStatus,
      });

      showToast(`Course "${created.title}" successfully created and saved in PostgreSQL!`);
      setShowAddModal(false);
      setNewTitle('');
      setNewDescription('');
      fetchCourses();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Status
  const handleToggleStatus = async (courseId: string, newStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    try {
      await courseApi.updateStatus(instituteId, courseId, newStatus);
      showToast(`Course status updated to ${newStatus}`);
      fetchCourses();
    } catch (err: any) {
      showToast(`Failed to update status: ${err?.message || 'Server error'}`);
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
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
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
            <Button size="sm" variant="outline" onClick={fetchCourses} className="gap-1 h-7 text-xs">
              <RefreshCw size={12} /> Retry
            </Button>
          </div>
        )}

        {/* Header with Title and Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">
                Academic Curriculum Studio
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Courses & Curriculum Management
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Live PostgreSQL theological curriculum: modules, chapters, lessons, and assigned faculty.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="gap-1.5 shadow-sm shadow-blue-500/20"
            >
              <Plus size={15} />
              Create New Course
            </Button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Courses"
            value={totalCourses}
            icon={<BookOpen size={20} />}
            trend={`${publishedCourses} Active in Catalog`}
            trendPositive={true}
            colorScheme="blue"
          />
          <StatCard
            title="Published Catalog"
            value={publishedCourses}
            icon={<CheckCircle size={20} />}
            trend="Open for Admissions"
            trendPositive={true}
            colorScheme="emerald"
          />
          <StatCard
            title="Curriculum Drafts"
            value={draftCourses}
            icon={<FileEdit size={20} />}
            trend={draftCourses > 0 ? 'Work in Progress' : 'All Published'}
            trendPositive={false}
            colorScheme="amber"
          />
          <StatCard
            title="Curriculum Lessons"
            value={totalLessons}
            icon={<Layers size={20} />}
            trend="Structured Content"
            trendPositive={true}
            colorScheme="purple"
          />
        </div>

        {/* Filter and Search Bar */}
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search course title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published Only</option>
                <option value="DRAFT">Drafts Only</option>
                <option value="ARCHIVED">Archived Only</option>
              </select>
            </div>

            {/* Level Filter */}
            <div>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Academic Levels</option>
                <option value="BEGINNER">Beginner Level</option>
                <option value="INTERMEDIATE">Intermediate Level</option>
                <option value="ADVANCED">Advanced Level</option>
              </select>
            </div>
          </div>

          {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || levelFilter !== 'ALL') && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredCourses.length} matching courses</span>
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setLevelFilter('ALL');
                }}
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
              >
                <RotateCcw size={12} />
                Clear Filters
              </button>
            </div>
          )}
        </Card>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 border border-slate-200">
            <div className="inline-flex items-center gap-2 text-sm">
              <RefreshCw size={18} className="animate-spin text-blue-600" />
              <span>Querying verified courses from PostgreSQL...</span>
            </div>
          </div>
        ) : filteredCourses.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen size={36} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No courses found in database</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Click &apos;Create New Course&apos; above to add courses directly to PostgreSQL.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((c, idx) => {
              const theme = COURSE_THEMES[idx % COURSE_THEMES.length];
              const initial = (c.title?.trim()[0] || 'C').toUpperCase();

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between group"
                >
                  {/* Top Header Banner with Stripes Pattern */}
                  <div
                    className={`relative p-5 pb-6 ${theme.headerBg} text-white overflow-visible`}
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08) 12px, transparent 12px, transparent 24px)',
                    }}
                  >
                    <h3 className="font-bold text-white text-base sm:text-lg tracking-tight leading-snug line-clamp-1 pr-14">
                      <Link href={`/admin/courses/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </h3>
                    <p className={`text-xs ${theme.textSub} font-medium mt-1`}>
                      {c.category?.name || 'General Theology'} · {formatLevel(c.level)}
                    </p>

                    {/* Overlapping Circular Avatar / Initial Badge */}
                    <div
                      className={`absolute right-5 -bottom-6 w-13 h-13 rounded-full border-[3px] border-white shadow-md flex items-center justify-center text-white font-bold text-xl select-none z-10 ${theme.circleBg}`}
                    >
                      {initial}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 pt-7 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[34px]">
                        {c.description || 'Comprehensive biblical theology curriculum and theological instruction.'}
                      </p>

                      {/* Quick Stats Grid: Modules, Lessons, Students */}
                      <div className="flex items-center gap-6 pt-4 pb-1">
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight">
                            {c.modulesCount || 0}
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">Modules</span>
                        </div>
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight">
                            {c.lessonsCount || 0}
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">Lessons</span>
                        </div>
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight">
                            {c.enrolledCount || 0}
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">Students</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Status Pill & Price on left, Archive & Studio on right */}
                    <div className="pt-4 border-t border-slate-100 flex items-end justify-between">
                      <div className="space-y-1">
                        <div>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              c.status === 'PUBLISHED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                : c.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {c.status === 'PUBLISHED' ? 'Published' : c.status === 'DRAFT' ? 'Draft' : 'Archived'}
                          </span>
                        </div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900">
                          {c.pricing === 'FREE' || c.price === 0
                            ? 'Free'
                            : `₹${(c.price || 0).toLocaleString('en-IN')}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold">
                        {c.status === 'PUBLISHED' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c.id, 'ARCHIVED')}
                            className="text-slate-500 hover:text-slate-800 transition cursor-pointer"
                          >
                            Archive
                          </button>
                        ) : c.status === 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c.id, 'PUBLISHED')}
                            className="text-emerald-600 hover:text-emerald-700 transition cursor-pointer"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(c.id, 'PUBLISHED')}
                            className="text-blue-600 hover:text-blue-700 transition cursor-pointer"
                          >
                            Restore
                          </button>
                        )}

                        <Link
                          href={`/admin/courses/${c.id}`}
                          className="text-blue-600 hover:text-blue-800 font-bold hover:underline transition"
                        >
                          Studio
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create New Course */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 my-8">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Course</h3>
                  <p className="text-xs text-slate-500">
                    Saves a verified course record directly in the PostgreSQL database
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Systematic Theology: Doctrine of Salvation"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <select
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Academic Level
                    </label>
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="BEGINNER">Beginner Level</option>
                      <option value="INTERMEDIATE">Intermediate Level</option>
                      <option value="ADVANCED">Advanced Level</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing</label>
                    <select
                      value={newPricing}
                      onChange={(e) => setNewPricing(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PAID">Paid Tuition Course</option>
                      <option value="FREE">Free Public Course</option>
                    </select>
                  </div>

                  {newPricing === 'PAID' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tuition Fee (₹ INR)
                      </label>
                      <input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide a theological overview of what this course covers..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PUBLISHED">Published (Visible in Catalog)</option>
                    <option value="DRAFT">Draft (Under Development)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving to Database...' : 'Create Course'}
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
