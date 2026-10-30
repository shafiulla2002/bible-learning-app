'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  GraduationCap,
  Clock,
  Layers,
  Users,
  Eye,
  MoreVertical,
  CheckCircle,
  FileEdit,
  Archive,
  ArrowRight,
  Sparkles,
  DollarSign,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { PortalShell } from '@/components/layout/portal-shell';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Settings,
} from 'lucide-react';

const adminNav = [
  { label: 'Overview', href: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: 'Students & Admissions', href: '/admin/students', icon: <Users size={18} />, badge: '3 Pending' },
  { label: 'Faculty & Teachers', href: '/admin/teachers', icon: <GraduationCap size={18} /> },
  { label: 'Courses & Curriculum', href: '/admin/courses', icon: <BookOpen size={18} /> },
  { label: 'Batches & Classes', href: '/admin/batches', icon: <Calendar size={18} /> },
  { label: 'Finance & Payments', href: '/admin/finance', icon: <CreditCard size={18} /> },
  { label: 'Institute Settings', href: '/admin/settings', icon: <Settings size={18} /> },
];

interface CourseItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language: string;
  pricing: 'FREE' | 'PAID';
  price: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  leadTeacher: string;
  modulesCount: number;
  lessonsCount: number;
  durationHours: number;
  enrolledStudents: number;
  description: string;
  gradient: string;
}

const INITIAL_COURSES: CourseItem[] = [
  {
    id: 'crs-1',
    title: 'Building Biblical Theology',
    slug: 'biblical-theology',
    category: 'Biblical Theology',
    level: 'BEGINNER',
    language: 'English',
    pricing: 'PAID',
    price: 18500,
    status: 'PUBLISHED',
    leadTeacher: 'Dr. Samuel Mathew',
    modulesCount: 4,
    lessonsCount: 16,
    durationHours: 32,
    enrolledStudents: 42,
    description: 'A comprehensive study of redemptive history, biblical covenants, and overarching theological narrative.',
    gradient: 'from-blue-600 via-indigo-600 to-sky-700',
  },
  {
    id: 'crs-2',
    title: 'Church History: Reformation to Modern',
    slug: 'church-history',
    category: 'Church History',
    level: 'INTERMEDIATE',
    language: 'English',
    pricing: 'PAID',
    price: 16000,
    status: 'PUBLISHED',
    leadTeacher: 'Rev. Joseph David',
    modulesCount: 5,
    lessonsCount: 20,
    durationHours: 40,
    enrolledStudents: 36,
    description: 'Surveying the major turning points in the Christian church, doctrinal confessions, and historical figures.',
    gradient: 'from-amber-600 via-orange-600 to-red-700',
  },
  {
    id: 'crs-3',
    title: 'Biblical Hermeneutics & Exegesis',
    slug: 'hermeneutics',
    category: 'Biblical Studies',
    level: 'INTERMEDIATE',
    language: 'English',
    pricing: 'PAID',
    price: 19500,
    status: 'PUBLISHED',
    leadTeacher: 'Dr. Mary Thomas',
    modulesCount: 4,
    lessonsCount: 14,
    durationHours: 28,
    enrolledStudents: 51,
    description: 'Practical principles and sound literary methods for interpreting Old and New Testament passages.',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
  },
  {
    id: 'crs-4',
    title: 'Greek Grammar & Exegesis I',
    slug: 'greek-grammar-1',
    category: 'Biblical Languages',
    level: 'BEGINNER',
    language: 'English',
    pricing: 'PAID',
    price: 22000,
    status: 'PUBLISHED',
    leadTeacher: 'Dr. Mary Thomas',
    modulesCount: 6,
    lessonsCount: 24,
    durationHours: 48,
    enrolledStudents: 29,
    description: 'Foundational study of Koine Greek alphabet, morphology, vocabulary, and basic syntax of the New Testament.',
    gradient: 'from-purple-600 via-violet-600 to-fuchsia-700',
  },
  {
    id: 'crs-5',
    title: 'Systematic Theology: Doctrine of God',
    slug: 'systematic-theology-god',
    category: 'Biblical Theology',
    level: 'ADVANCED',
    language: 'English',
    pricing: 'PAID',
    price: 21000,
    status: 'DRAFT',
    leadTeacher: 'Dr. Samuel Mathew',
    modulesCount: 3,
    lessonsCount: 12,
    durationHours: 24,
    enrolledStudents: 0,
    description: 'Exhaustive examination of divine attributes, the Trinity, divine sovereignty, creation, and providence.',
    gradient: 'from-slate-700 via-zinc-800 to-neutral-900',
  },
  {
    id: 'crs-6',
    title: 'Old Testament Survey: Pentateuch',
    slug: 'ot-survey-pentateuch',
    category: 'Biblical Studies',
    level: 'BEGINNER',
    language: 'English',
    pricing: 'FREE',
    price: 0,
    status: 'DRAFT',
    leadTeacher: 'Rev. Joseph David',
    modulesCount: 2,
    lessonsCount: 8,
    durationHours: 16,
    enrolledStudents: 0,
    description: 'Introduction to Genesis through Deuteronomy, historical background, legal codes, and covenant themes.',
    gradient: 'from-rose-600 via-pink-600 to-amber-700',
  },
];

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseItem[]>(INITIAL_COURSES);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Course Form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Biblical Theology');
  const [newLevel, setNewLevel] = useState<'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'>('BEGINNER');
  const [newLanguage, setNewLanguage] = useState('English');
  const [newPricing, setNewPricing] = useState<'FREE' | 'PAID'>('PAID');
  const [newPrice, setNewPrice] = useState('18500');
  const [newTeacher, setNewTeacher] = useState('Dr. Samuel Mathew');
  const [newDescription, setNewDescription] = useState('');
  const [newStatus, setNewStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [formError, setFormError] = useState('');

  // KPIs
  const totalCourses = courses.length;
  const publishedCourses = courses.filter((c) => c.status === 'PUBLISHED').length;
  const draftCourses = courses.filter((c) => c.status === 'DRAFT').length;
  const totalLessons = courses.reduce((acc, c) => acc + c.lessonsCount, 0);

  // Filtered List
  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      search === '' ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.leadTeacher.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === 'ALL' || c.category.toLowerCase().includes(categoryFilter.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchesLevel = levelFilter === 'ALL' || c.level === levelFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesLevel;
  });

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError('Please enter a valid course title');
      return;
    }
    if (newDescription.trim().length < 10) {
      setFormError('Course description must be at least 10 characters');
      return;
    }

    const created: CourseItem = {
      id: `crs-${Date.now().toString().slice(-4)}`,
      title: newTitle.trim(),
      slug: newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: newCategory,
      level: newLevel,
      language: newLanguage,
      pricing: newPricing,
      price: newPricing === 'FREE' ? 0 : parseInt(newPrice, 10) || 0,
      status: newStatus,
      leadTeacher: newTeacher,
      modulesCount: 0,
      lessonsCount: 0,
      durationHours: 0,
      enrolledStudents: 0,
      description: newDescription.trim(),
      gradient: 'from-blue-600 via-indigo-600 to-sky-700',
    };

    setCourses([created, ...courses]);
    setShowAddModal(false);
    // Reset form
    setNewTitle('');
    setNewDescription('');
    setFormError('');
  };

  const handleToggleStatus = (courseId: string, newStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, status: newStatus } : c)),
    );
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
              Build theological courses, organize modules and chapters, attach lessons, and assign faculty.
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

        {/* KPI Cards */}
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Courses"
            value={totalCourses}
            trend={`${publishedCourses} Active`}
            trendPositive={true}
            colorScheme="blue"
            icon={<BookOpen size={20} className="text-blue-600" />}
          />
          <StatCard
            title="Published Courses"
            value={publishedCourses}
            trend="Ready for Enrolment"
            trendPositive={true}
            colorScheme="emerald"
            icon={<CheckCircle size={20} className="text-emerald-600" />}
          />
          <StatCard
            title="Drafts in Progress"
            value={draftCourses}
            trend="Under Review / Setup"
            trendPositive={false}
            colorScheme="amber"
            icon={<FileEdit size={20} className="text-amber-600" />}
          />
          <StatCard
            title="Curriculum Lessons"
            value={totalLessons}
            trend="Across All Semesters"
            trendPositive={true}
            colorScheme="purple"
            icon={<Layers size={20} className="text-indigo-600" />}
          />
        </div>

        {/* Filter Toolbar */}
        <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by course title, instructor, or subject..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              {[
                { key: 'ALL', label: 'All Categories' },
                { key: 'Theology', label: 'Theology' },
                { key: 'Biblical Studies', label: 'Biblical Studies' },
                { key: 'Church History', label: 'Church History' },
                { key: 'Languages', label: 'Languages' },
              ].map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${
                    categoryFilter === cat.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => (
            <Card
              key={course.id}
              className="group overflow-hidden border border-slate-200/80 bg-white hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Visual Header / Cover Banner */}
                <div className={`h-32 bg-gradient-to-r ${course.gradient} p-4 flex flex-col justify-between text-white relative`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-sm text-white border border-white/20">
                      {course.category}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        course.status === 'PUBLISHED'
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : course.status === 'DRAFT'
                          ? 'bg-amber-400 text-slate-900 font-bold'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {course.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
                      {course.level} • {course.language}
                    </span>
                    <h3 className="text-base font-bold text-white line-clamp-1 leading-snug drop-shadow-sm">
                      {course.title}
                    </h3>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {course.description}
                  </p>

                  {/* Instructor Pill */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                      {course.leadTeacher.charAt(course.leadTeacher.indexOf(' ') + 1) || 'T'}
                    </div>
                    <span className="text-xs text-slate-700 font-medium truncate">
                      {course.leadTeacher}
                    </span>
                  </div>

                  {/* Metadata Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Modules</div>
                      <div className="text-xs font-bold text-slate-700">{course.modulesCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Lessons</div>
                      <div className="text-xs font-bold text-slate-700">{course.lessonsCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Enrolled</div>
                      <div className="text-xs font-bold text-slate-700">{course.enrolledStudents}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer with Actions */}
              <div className="p-4 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900">
                    {course.pricing === 'FREE' ? (
                      <span className="text-emerald-600 font-extrabold">FREE</span>
                    ) : (
                      `₹${course.price.toLocaleString('en-IN')}`
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/admin/courses/${course.id}`}>
                    <Button variant="primary" size="sm" className="gap-1 text-xs">
                      Curriculum Builder
                      <ChevronRight size={13} />
                    </Button>
                  </Link>

                  {/* Quick Toggle Status */}
                  <select
                    value={course.status}
                    onChange={(e) =>
                      handleToggleStatus(course.id, e.target.value as any)
                    }
                    className="text-[11px] py-1 px-1.5 rounded border border-slate-200 text-slate-600 bg-white focus:outline-none"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Publish</option>
                    <option value="ARCHIVED">Archive</option>
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredCourses.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No courses match your filter</h4>
            <p className="text-xs text-slate-400 mt-1">Try resetting your search query or category filter.</p>
          </div>
        )}
      </div>

      {/* CREATE COURSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create New Theological Course</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up basic course details, category, pricing, and assigned lead instructor.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Biblical Hermeneutics & Exegesis"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Biblical Theology">Biblical Theology</option>
                    <option value="Biblical Studies">Biblical Studies</option>
                    <option value="Church History">Church History</option>
                    <option value="Biblical Languages">Biblical Languages</option>
                    <option value="Pastoral Care">Pastoral Care</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Academic Level
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BEGINNER">Beginner (Certificate / Dip)</option>
                    <option value="INTERMEDIATE">Intermediate (B.Th)</option>
                    <option value="ADVANCED">Advanced (M.Div)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lead Faculty / Teacher
                  </label>
                  <select
                    value={newTeacher}
                    onChange={(e) => setNewTeacher(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Dr. Samuel Mathew">Dr. Samuel Mathew (Theology)</option>
                    <option value="Dr. Mary Thomas">Dr. Mary Thomas (Biblical Studies)</option>
                    <option value="Rev. Joseph David">Rev. Joseph David (Church History)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Language
                  </label>
                  <select
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="English">English</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Hindi">Hindi</option>
                    <option value="Telugu">Telugu</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pricing Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewPricing('PAID')}
                      className={`flex-1 py-1.5 text-xs rounded-lg border font-medium ${
                        newPricing === 'PAID'
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      Paid Course
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPricing('FREE')}
                      className={`flex-1 py-1.5 text-xs rounded-lg border font-medium ${
                        newPricing === 'FREE'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      Free Course
                    </button>
                  </div>
                </div>

                {newPricing === 'PAID' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Price (₹ INR)
                    </label>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="18500"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description & Syllabus Overview <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline key theological themes, learning objectives, and recommended background reading..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Publication Status
                </label>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="initStatus"
                      checked={newStatus === 'DRAFT'}
                      onChange={() => setNewStatus('DRAFT')}
                    />
                    Save as Draft (Build curriculum before publishing)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer ml-3">
                    <input
                      type="radio"
                      name="initStatus"
                      checked={newStatus === 'PUBLISHED'}
                      onChange={() => setNewStatus('PUBLISHED')}
                    />
                    Publish Immediately
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="gap-1.5">
                  <Plus size={14} />
                  Create Course
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
