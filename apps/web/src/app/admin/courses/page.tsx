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
  BookMarked,
  UploadCloud,
  FileText,
  CheckCircle2,
  Trash2,
  ExternalLink,
  File,
  Download,
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
  const [instituteId, setInstituteId] = useState<string>('');
  const [adminName, setAdminName] = useState<string>('Institute Admin');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

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
  const [courseTypeFilter, setCourseTypeFilter] = useState<'ALL' | 'REGULAR' | 'BOOK'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Modal Mode: REGULAR vs BOOK
  const [creationType, setCreationType] = useState<'REGULAR' | 'BOOK'>('REGULAR');
  const [activeBookModalTab, setActiveBookModalTab] = useState<'FORM' | 'PREVIEW'>('FORM');

  // Book Course Form state
  const [bookTitle, setBookTitle] = useState('');
  const [bookCoverImage, setBookCoverImage] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [bookCategoryId, setBookCategoryId] = useState('');
  const [bookPricing, setBookPricing] = useState<'FREE' | 'PAID'>('PAID');
  const [bookPrice, setBookPrice] = useState('499');
  const [bookPublicationInfo, setBookPublicationInfo] = useState('');
  const [bookLanguage, setBookLanguage] = useState('English');
  const [bookStatus, setBookStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');

  // Book PDF Upload state
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [uploadedPdfInfo, setUploadedPdfInfo] = useState<{
    storageKey: string;
    originalFilename: string;
    fileSize: number;
    pageCount: number;
  } | null>(null);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);

  // New Course Form state (all monetary inputs in INR rupees -> converted to paise on submit)
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newLevel, setNewLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [newCourseType, setNewCourseType] = useState<'SELF_PACED' | 'COHORT' | 'LIVE' | 'DIPLOMA' | 'CERTIFICATE'>('COHORT');
  const [newLearningMode, setNewLearningMode] = useState<'ONLINE' | 'OFFLINE' | 'HYBRID'>('ONLINE');
  const [newDurationLabel, setNewDurationLabel] = useState('12 Weeks');
  const [newEligibility, setNewEligibility] = useState('');
  const [newLanguage, setNewLanguage] = useState('English');
  const [newPricing, setNewPricing] = useState<'FREE' | 'PAID'>('PAID');
  const [newPrice, setNewPrice] = useState('18500');
  const [newRegistrationFee, setNewRegistrationFee] = useState('0');
  const [newRequiresApproval, setNewRequiresApproval] = useState(true);
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
        else {
          setIsLoading(false);
          setErrorMessage('No active institute session found. Please log in to continue.');
        }
        if (ctx?.user?.fullName) setAdminName(ctx.user.fullName);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        setErrorMessage('Unable to verify administrator session.');
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!instituteId) return;
    try {
      const data = await courseApi.getCategories(instituteId);
      if (Array.isArray(data)) {
        setCategories(data);
        if (data.length > 0 && !newCategoryId) {
          setNewCategoryId(data[0].id);
        }
      }
    } catch {
      // Ignore transient category fetch errors
    }
  }, [instituteId, newCategoryId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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

  // Filtered List for client level & course type filter
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesLevel = levelFilter === 'ALL' || c.level === levelFilter;
      const isBook = c.courseType === 'BOOK';
      const matchesType =
        courseTypeFilter === 'ALL' ||
        (courseTypeFilter === 'BOOK' && isBook) ||
        (courseTypeFilter === 'REGULAR' && !isBook);
      return matchesLevel && matchesType;
    });
  }, [courses, levelFilter, courseTypeFilter]);

  // KPIs
  const publishedCourses = courses.filter((c) => c.status === 'PUBLISHED').length;
  const draftCourses = courses.filter((c) => c.status === 'DRAFT').length;
  const totalBooks = courses.filter((c) => c.courseType === 'BOOK').length;
  const totalLessons = courses.reduce((acc, c) => acc + (c.lessonCount ?? c.lessonsCount ?? 0), 0);

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || newCategoryName.trim().length < 2) {
      setCategoryError('Category name must be at least 2 characters');
      return;
    }
    setCategoryError('');
    try {
      const created = await courseApi.createCategory(instituteId, { name: newCategoryName.trim() });
      setNewCategoryName('');
      await fetchCategories();
      if (created?.id) setNewCategoryId(created.id);
      showToast(`Category "${created.name}" created.`);
    } catch (err: any) {
      setCategoryError(err?.message || 'Failed to create category');
    }
  };

  // Handle Delete Category
  const handleDeleteCategory = async (categoryId: string) => {
    if (!instituteId) return;
    try {
      await courseApi.deleteCategory(instituteId, categoryId);
      await fetchCategories();
      showToast('Category deleted.');
    } catch (err: any) {
      setCategoryError(err?.message || 'Unable to delete category');
    }
  };

  // Handle Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) {
      setFormError('Active institute session required');
      return;
    }
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
      const priceRupees = parseFloat(newPrice) || 0;
      const regFeeRupees = parseFloat(newRegistrationFee) || 0;
      const created = await courseApi.createCourse(instituteId, {
        title: newTitle.trim(),
        description: newDescription.trim(),
        categoryId: newCategoryId || undefined,
        level: newLevel,
        courseType: newCourseType,
        learningMode: newLearningMode,
        durationLabel: newDurationLabel.trim() || undefined,
        eligibility: newEligibility.trim() || undefined,
        language: newLanguage,
        pricing: newPricing,
        price: newPricing === 'PAID' ? Math.round(priceRupees * 100) : 0,
        registrationFee: Math.round(regFeeRupees * 100),
        requiresApproval: newRequiresApproval,
        status: newStatus,
      });

      showToast(`Course "${created.title}" successfully created and saved in PostgreSQL!`);
      setShowAddModal(false);
      setNewTitle('');
      setNewDescription('');
      setNewEligibility('');
      fetchCourses();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create course');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle PDF file selection & upload with progress
  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setPdfUploadError('Please select a valid PDF file.');
      return;
    }

    const maxBytes = 150 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPdfUploadError('PDF file size exceeds 150MB limit.');
      return;
    }

    if (!instituteId) {
      setPdfUploadError('No active institute session.');
      return;
    }

    setPdfUploadError(null);
    setIsUploadingPdf(true);
    setPdfUploadProgress(0);

    try {
      const res = await courseApi.uploadBookPdf(instituteId, file, (pct) => {
        setPdfUploadProgress(pct);
      });
      setUploadedPdfInfo(res);
      showToast(`Uploaded "${file.name}" (${res.pageCount} pages, ${(res.fileSize / (1024 * 1024)).toFixed(1)} MB)`);
    } catch (err: any) {
      setPdfUploadError(err.message || 'Failed to upload PDF file.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Handle Remove Uploaded PDF
  const handleRemoveUploadedPdf = async () => {
    if (!uploadedPdfInfo?.storageKey || !instituteId) {
      setUploadedPdfInfo(null);
      setPdfUploadProgress(0);
      setPdfUploadError(null);
      return;
    }
    try {
      await courseApi.deleteUploadedPdf(instituteId, uploadedPdfInfo.storageKey);
    } catch (e) {}
    setUploadedPdfInfo(null);
    setPdfUploadProgress(0);
    setPdfUploadError(null);
    showToast('Removed uploaded PDF.');
  };

  // Handle Create Book Course
  const handleCreateBookCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId) {
      setFormError('Active institute session required');
      return;
    }
    if (bookTitle.trim().length < 2) {
      setFormError('Book title must be at least 2 characters');
      return;
    }
    if (bookAuthor.trim().length < 2) {
      setFormError('Author name is required');
      return;
    }
    if (bookDescription.trim().length < 10) {
      setFormError('Book description must be at least 10 characters');
      return;
    }
    if (!uploadedPdfInfo?.storageKey) {
      setFormError('Please upload the book PDF file before publishing.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const priceRupees = parseFloat(bookPrice) || 0;
      const created = await courseApi.createCourse(instituteId, {
        title: bookTitle.trim(),
        description: bookDescription.trim(),
        categoryId: bookCategoryId || undefined,
        level: 'BEGINNER',
        courseType: 'BOOK',
        learningMode: 'ONLINE',
        language: bookLanguage,
        pricing: bookPricing,
        price: bookPricing === 'PAID' ? Math.round(priceRupees * 100) : 0,
        registrationFee: 0,
        requiresApproval: false,
        status: bookStatus,
        coverImage: bookCoverImage.trim() || undefined,
        author: bookAuthor.trim(),
        pdfStorageKey: uploadedPdfInfo.storageKey,
        pdfOriginalName: uploadedPdfInfo.originalFilename,
        pdfFileSize: uploadedPdfInfo.fileSize,
        pdfPageCount: uploadedPdfInfo.pageCount,
        publicationInfo: bookPublicationInfo.trim() || undefined,
      });

      showToast(`Book Course "${created.title}" successfully created and saved!`);
      setShowAddModal(false);
      // Reset book form
      setBookTitle('');
      setBookAuthor('');
      setBookDescription('');
      setBookCoverImage('');
      setBookPublicationInfo('');
      setUploadedPdfInfo(null);
      fetchCourses();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create book course');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Course (soft-archive)
  const handleDeleteCourse = async (courseId: string, title: string) => {
    if (!instituteId) return;
    try {
      await courseApi.deleteCourse(instituteId, courseId);
      showToast(`Course "${title}" removed from active catalog.`);
      fetchCourses();
    } catch (err: any) {
      showToast(`Failed to delete course: ${err?.message || 'Server error'}`);
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
      userName={adminName}
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
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryModal(true)}
              className="gap-1.5"
            >
              <Layers size={15} />
              Categories ({categories.length})
            </Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search course or book title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Course Type Filter */}
            <div>
              <select
                value={courseTypeFilter}
                onChange={(e) => setCourseTypeFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types (Courses & Books)</option>
                <option value="REGULAR">Regular Courses Only</option>
                <option value="BOOK">📖 Book Courses Only</option>
              </select>
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

          {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || levelFilter !== 'ALL' || courseTypeFilter !== 'ALL') && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredCourses.length} matching courses/books</span>
              <button
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setLevelFilter('ALL');
                  setCourseTypeFilter('ALL');
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
              const isBook = c.courseType === 'BOOK';
              const initial = isBook ? '📖' : (c.title?.trim()[0] || 'C').toUpperCase();

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between group"
                >
                  {/* Top Header Banner with Stripes Pattern */}
                  <div
                    className={`relative p-5 pb-6 ${isBook ? 'bg-[#0f4c3a]' : theme.headerBg} text-white overflow-visible`}
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08) 12px, transparent 12px, transparent 24px)',
                    }}
                  >
                    {isBook && (
                      <span className="bg-emerald-950/70 text-emerald-200 border border-emerald-400/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1">
                        <BookMarked size={11} /> eBook Course
                      </span>
                    )}
                    <h3 className="font-bold text-white text-base sm:text-lg tracking-tight leading-snug line-clamp-1 pr-14">
                      <Link href={`/admin/courses/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </h3>
                    <p className={`text-xs ${isBook ? 'text-emerald-100' : theme.textSub} font-medium mt-1`}>
                      {isBook ? `By ${c.author || 'Author'} · ` : ''}
                      {c.categoryName || c.category?.name || 'General Theology'} · {formatLevel(c.level)}
                      {c.durationLabel && !isBook ? ` · ${c.durationLabel}` : ''}
                    </p>

                    {/* Overlapping Circular Avatar / Initial Badge */}
                    <div
                      className={`absolute right-5 -bottom-6 w-13 h-13 rounded-full border-[3px] border-white shadow-md flex items-center justify-center text-white font-bold text-xl select-none z-10 ${
                        isBook ? 'bg-emerald-800' : theme.circleBg
                      }`}
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

                      {/* Quick Stats Grid: Modules/Pages, Lessons/Size, Students */}
                      <div className="flex items-center gap-6 pt-4 pb-1">
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight">
                            {isBook ? (c.pdfPageCount || 1) : (c.moduleCount ?? c.modulesCount ?? 0)}
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            {isBook ? 'Pages' : 'Modules'}
                          </span>
                        </div>
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight">
                            {isBook
                              ? c.pdfFileSize
                                ? `${(c.pdfFileSize / (1024 * 1024)).toFixed(1)} MB`
                                : 'PDF'
                              : (c.lessonCount ?? c.lessonsCount ?? 0)}
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            {isBook ? 'PDF Size' : 'Lessons'}
                          </span>
                        </div>
                        <div>
                          <span className="text-base sm:text-lg font-bold text-slate-900 block leading-tight">
                            {c.enrolledCount || 0}
                          </span>
                          <span className="text-xs text-slate-400 block mt-0.5">
                            {isBook ? 'Readers' : 'Students'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Status Pill & Price on left, Actions on right */}
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
                            : `₹${Math.round((c.price || 0) / 100).toLocaleString('en-IN')}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs font-semibold">
                        {isBook && c.pdfStorageKey && (
                          <a
                            href={`http://localhost:4000/api/v1/institutes/${instituteId}/courses/${c.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1"
                            title="Preview PDF Document"
                          >
                            <ExternalLink size={12} />
                            Preview
                          </a>
                        )}

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

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Archive and remove "${c.title}" from active catalog?`)) {
                              handleDeleteCourse(c.id, c.title);
                            }
                          }}
                          className="text-red-500 hover:text-red-700 transition cursor-pointer"
                        >
                          Remove
                        </button>

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

        {/* Modal: Create New Course / Book Course */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {creationType === 'BOOK' ? 'Create New Book Course (eBook)' : 'Create New Course'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {creationType === 'BOOK'
                      ? 'Upload a full PDF textbook with instant online reading and student enrollment'
                      : 'Saves a verified course record directly in the PostgreSQL database'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Course Type Switcher */}
              <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                <button
                  type="button"
                  onClick={() => setCreationType('REGULAR')}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                    creationType === 'REGULAR'
                      ? 'bg-white text-blue-600 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap size={15} />
                  Regular Course
                </button>
                <button
                  type="button"
                  onClick={() => setCreationType('BOOK')}
                  className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
                    creationType === 'BOOK'
                      ? 'bg-white text-indigo-600 shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen size={15} />
                  Book Course (eBook)
                </button>
              </div>

              {formError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* -------------------- REGULAR COURSE FORM -------------------- */}
              {creationType === 'REGULAR' && (
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Course Format</label>
                      <select
                        value={newCourseType}
                        onChange={(e) => setNewCourseType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="COHORT">Cohort Program</option>
                        <option value="SELF_PACED">Self-Paced Online</option>
                        <option value="LIVE">Live Seminar</option>
                        <option value="DIPLOMA">Diploma Track</option>
                        <option value="CERTIFICATE">Certificate Track</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Mode & Duration</label>
                      <div className="flex gap-2">
                        <select
                          value={newLearningMode}
                          onChange={(e) => setNewLearningMode(e.target.value as any)}
                          className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ONLINE">Online</option>
                          <option value="HYBRID">Hybrid</option>
                          <option value="OFFLINE">On-Campus</option>
                        </select>
                        <input
                          type="text"
                          placeholder="e.g. 12 Weeks"
                          value={newDurationLabel}
                          onChange={(e) => setNewDurationLabel(e.target.value)}
                          className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
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
                          min={0}
                          value={newPrice}
                          onChange={(e) => setNewPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Registration Fee (₹ INR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={newRegistrationFee}
                        onChange={(e) => setNewRegistrationFee(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newRequiresApproval}
                          onChange={(e) => setNewRequiresApproval(e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Require Admin Admission Approval
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Eligibility & Prerequisites
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. High School Diploma / Pastor Recommendation"
                      value={newEligibility}
                      onChange={(e) => setNewEligibility(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                    />
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
              )}

              {/* -------------------- BOOK COURSE FORM -------------------- */}
              {creationType === 'BOOK' && (
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveBookModalTab('FORM')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          activeBookModalTab === 'FORM'
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Book Details & PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveBookModalTab('PREVIEW')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          activeBookModalTab === 'PREVIEW'
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Eye size={13} />
                        Student Marketplace Preview
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">3D Online Reader Enabled</span>
                  </div>

                  {activeBookModalTab === 'FORM' ? (
                    <form onSubmit={handleCreateBookCourse} className="space-y-4">
                      {/* Title & Author */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Book Title *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Survey of the New Testament"
                            value={bookTitle}
                            onChange={(e) => setBookTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Author Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Dr. Arthur S. Maxwell"
                            value={bookAuthor}
                            onChange={(e) => setBookAuthor(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Category & Language */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Book Category
                          </label>
                          <select
                            value={bookCategoryId}
                            onChange={(e) => setBookCategoryId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">General / Theological Studies</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Language
                          </label>
                          <select
                            value={bookLanguage}
                            onChange={(e) => setBookLanguage(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="English">English</option>
                            <option value="Telugu">Telugu</option>
                            <option value="Hindi">Hindi</option>
                            <option value="Tamil">Tamil</option>
                            <option value="Malayalam">Malayalam</option>
                            <option value="Kannada">Kannada</option>
                            <option value="Spanish">Spanish</option>
                          </select>
                        </div>
                      </div>

                      {/* Pricing */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Pricing Model</label>
                          <select
                            value={bookPricing}
                            onChange={(e) => setBookPricing(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="PAID">Paid eBook</option>
                            <option value="FREE">Free Public eBook</option>
                          </select>
                        </div>

                        {bookPricing === 'PAID' && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Book Price (₹ INR) *
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={bookPrice}
                              onChange={(e) => setBookPrice(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* PDF Upload Section */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-700">
                          Complete Book PDF Upload *
                        </label>
                        {!uploadedPdfInfo && !isUploadingPdf && (
                          <div className="relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 rounded-xl p-5 text-center transition">
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={handlePdfFileSelect}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                <UploadCloud size={20} />
                              </div>
                              <p className="text-xs font-semibold text-slate-800">
                                Click or drag & drop to upload complete PDF
                              </p>
                              <p className="text-[11px] text-slate-500">
                                PDF format only (Max 150 MB). Page count is calculated automatically.
                              </p>
                            </div>
                          </div>
                        )}

                        {isUploadingPdf && (
                          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
                              <span>Uploading & verifying PDF...</span>
                              <span className="font-bold">{pdfUploadProgress}%</span>
                            </div>
                            <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${pdfUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {uploadedPdfInfo && (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <FileText size={18} />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-sm">
                                  {uploadedPdfInfo.originalFilename}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-emerald-800 font-medium">
                                  <span className="bg-emerald-100 px-1.5 py-0.5 rounded">
                                    {uploadedPdfInfo.pageCount} pages
                                  </span>
                                  <span>•</span>
                                  <span>{(uploadedPdfInfo.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 flex items-center gap-0.5">
                                    <CheckCircle2 size={12} /> Ready
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer px-2 py-1 rounded hover:bg-indigo-50 transition">
                                Replace
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  onChange={handlePdfFileSelect}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleRemoveUploadedPdf}
                                className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Remove uploaded PDF"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        )}

                        {pdfUploadError && (
                          <p className="text-[11px] text-rose-600 font-medium">{pdfUploadError}</p>
                        )}
                      </div>

                      {/* Cover Image URL & Preview */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Book Cover Image URL (optional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            placeholder="https://images.unsplash.com/... or uploaded cover URL"
                            value={bookCoverImage}
                            onChange={(e) => setBookCoverImage(e.target.value)}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                          />
                          {bookCoverImage && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                              <img
                                src={bookCoverImage}
                                alt="Cover preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as any).src = 'https://placehold.co/100x140?text=Cover';
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Publication Info */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Publication Information (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bethesda Academic Press, 2nd Edition, ISBN: 978-0123456789"
                          value={bookPublicationInfo}
                          onChange={(e) => setBookPublicationInfo(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Book Description / Synopsis *
                        </label>
                        <textarea
                          rows={3}
                          required
                          placeholder="Provide a comprehensive summary of the book topics, chapters, and academic outcomes..."
                          value={bookDescription}
                          onChange={(e) => setBookDescription(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Publication Status
                        </label>
                        <select
                          value={bookStatus}
                          onChange={(e) => setBookStatus(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="PUBLISHED">Published (Live on Student Marketplace immediately)</option>
                          <option value="DRAFT">Draft (Save privately for later)</option>
                        </select>
                      </div>

                      {/* Footer Actions */}
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
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          disabled={isSubmitting || isUploadingPdf}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {isSubmitting
                            ? 'Saving Book to Database...'
                            : bookStatus === 'PUBLISHED'
                            ? 'Publish Book Course'
                            : 'Save Draft Book'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    /* ---------------- PREVIEW TAB ---------------- */
                    <div className="space-y-4 py-2">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row gap-5">
                        <div className="w-full sm:w-40 h-56 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-900 to-slate-900 shadow-md shrink-0 flex items-center justify-center relative">
                          {bookCoverImage ? (
                            <img
                              src={bookCoverImage}
                              alt={bookTitle || 'Book Cover'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as any).src = 'https://placehold.co/300x420?text=Cover';
                              }}
                            />
                          ) : (
                            <div className="text-center p-3 text-white/80">
                              <BookOpen size={36} className="mx-auto mb-2 text-indigo-400" />
                              <p className="text-xs font-bold line-clamp-2">{bookTitle || 'Book Title'}</p>
                              <p className="text-[10px] text-slate-300 mt-1">{bookAuthor || 'Author Name'}</p>
                            </div>
                          )}
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-indigo-600 text-[10px] font-bold text-white shadow">
                            eBook
                          </span>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                              {categories.find((c) => c.id === bookCategoryId)?.name || 'Theology & Ministry'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500">{bookLanguage}</span>
                          </div>

                          <h4 className="text-base font-bold text-slate-900 leading-snug">
                            {bookTitle || 'Untitled Book'}
                          </h4>
                          <p className="text-xs font-medium text-slate-600">
                            By {bookAuthor || 'Author Unknown'}
                          </p>

                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                            {bookDescription || 'No description entered yet.'}
                          </p>

                          <div className="pt-2 flex items-center gap-4 text-xs text-slate-500">
                            <span>
                              Pages: <strong className="text-slate-800">{uploadedPdfInfo?.pageCount || '—'}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Size: <strong className="text-slate-800">{uploadedPdfInfo ? `${(uploadedPdfInfo.fileSize / (1024 * 1024)).toFixed(1)} MB` : '—'}</strong>
                            </span>
                          </div>

                          <div className="pt-2 flex items-center justify-between border-t border-slate-200 mt-3">
                            <div className="text-lg font-black text-slate-900">
                              {bookPricing === 'FREE' ? (
                                <span className="text-emerald-600">FREE</span>
                              ) : (
                                `₹${bookPrice}`
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled
                                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm opacity-90 cursor-not-allowed"
                              >
                                Add to Cart
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveBookModalTab('FORM')}
                        >
                          Back to Form
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleCreateBookCourse}
                          disabled={isSubmitting || isUploadingPdf}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {isSubmitting ? 'Saving...' : 'Publish Book Now'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manage Categories Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Course Categories</h3>
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              {categoryError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {categoryError}
                </div>
              )}
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
                <Button type="submit" variant="primary" size="sm">Add</Button>
              </form>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {categories.map((cat: any) => (
                  <div key={cat.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{cat.name}</p>
                      <p className="text-[11px] text-slate-400">{cat.slug}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-xs text-slate-400 py-4 text-center">No categories found yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
