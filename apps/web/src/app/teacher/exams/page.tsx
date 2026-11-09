'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  Search,
  Plus,
  Calendar,
  Clock,
  BookOpen,
  Library,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Edit,
  X,
  FileText,
  Award,
  HelpCircle,
  GraduationCap,
  ListFilter,
  LayoutGrid,
  Table,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherExams, TeacherExamItem } from '@/lib/use-teacher-exams';
import { useTeacherCourses } from '@/lib/use-teacher-courses';

export default function TeacherExamsPage() {
  const {
    exams,
    metrics,
    totalCount,
    totalPages,
    page,
    search,
    courseId,
    batchId,
    status,
    isLoading,
    error,
    setPage,
    setSearch,
    setCourseId,
    setBatchId,
    setStatus,
    refresh,
    createExam,
  } = useTeacherExams();

  const { courses: assignedCourses } = useTeacherCourses(100);

  const [searchInput, setSearchInput] = useState(search);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Create Exam Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    courseId: '',
    batchId: '',
    title: '',
    instructions: '',
    type: 'EXAM',
    durationMin: 60,
    totalMarks: 100,
    passMarks: 40,
    startAt: '',
    endAt: '',
    status: 'DRAFT',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCourseId('ALL');
    setBatchId('ALL');
    setStatus('ALL');
    setPage(1);
  };

  const handleOpenCreateModal = () => {
    setModalError(null);
    const defaultCourseId = assignedCourses[0]?.id || '';
    const now = new Date();
    const startStr = now.toISOString().slice(0, 16);
    const endStr = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 16);

    setCreateForm({
      courseId: defaultCourseId,
      batchId: '',
      title: '',
      instructions: '',
      type: 'EXAM',
      durationMin: 60,
      totalMarks: 100,
      passMarks: 40,
      startAt: startStr,
      endAt: endStr,
      status: 'DRAFT',
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      setModalError('Examination title is required');
      return;
    }
    if (!createForm.courseId) {
      setModalError('Please select a course');
      return;
    }
    if (createForm.totalMarks <= 0) {
      setModalError('Total marks must be greater than zero');
      return;
    }
    if (createForm.passMarks > createForm.totalMarks) {
      setModalError('Pass marks cannot exceed total marks');
      return;
    }
    if (createForm.durationMin <= 0) {
      setModalError('Duration must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      await createExam({
        courseId: createForm.courseId,
        batchId: createForm.batchId || undefined,
        title: createForm.title.trim(),
        instructions: createForm.instructions.trim() || undefined,
        type: createForm.type,
        durationMin: Number(createForm.durationMin),
        totalMarks: Number(createForm.totalMarks),
        passMarks: Number(createForm.passMarks),
        startAt: createForm.startAt ? new Date(createForm.startAt).toISOString() : undefined,
        endAt: createForm.endAt ? new Date(createForm.endAt).toISOString() : undefined,
        status: createForm.status,
      });
      setCreateModalOpen(false);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to create examination');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCourse = assignedCourses.find((c) => c.id === createForm.courseId);
  const availableBatches = selectedCourse?.assignedBatches || [];

  return (
    <TeacherShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCheck2 className="w-7 h-7 text-emerald-600" />
              Examinations & Online Tests
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Create, schedule, build question banks, and evaluate online tests for your assigned courses.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Examination
            </button>
          </div>
        </div>

        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-500">Total Exams</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{metrics.total}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-emerald-600">Published</div>
            <div className="text-xl font-bold text-emerald-700 mt-1">{metrics.published}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-amber-600">Drafts</div>
            <div className="text-xl font-bold text-amber-700 mt-1">{metrics.draft}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-blue-600">Scheduled</div>
            <div className="text-xl font-bold text-blue-700 mt-1">{metrics.scheduled}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-purple-600">Completed</div>
            <div className="text-xl font-bold text-purple-700 mt-1">{metrics.completed}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-indigo-600">Total Attempts</div>
            <div className="text-xl font-bold text-indigo-700 mt-1">{metrics.totalAttempts}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-rose-600">Pending Eval</div>
            <div className="text-xl font-bold text-rose-700 mt-1">{metrics.pendingEvaluations}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-teal-600">Avg Score</div>
            <div className="text-xl font-bold text-teal-700 mt-1">{metrics.avgScore} pts</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search examination title or course..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Course Filter */}
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setBatchId('ALL');
                  setPage(1);
                }}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Assigned Courses</option>
                {assignedCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="COMPLETED">Completed</option>
              </select>

              {/* View Switcher */}
              <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-md ${
                    viewMode === 'cards' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md ${
                    viewMode === 'table' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Table View"
                >
                  <Table className="w-4 h-4" />
                </button>
              </div>

              {(search || courseId !== 'ALL' || batchId !== 'ALL' || status !== 'ALL') && (
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button
              onClick={() => refresh()}
              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                  <div className="h-5 bg-slate-200 rounded-full w-16"></div>
                </div>
                <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                  <div className="h-8 bg-slate-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && exams.length === 0 && (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileCheck2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Examinations Found</h3>
            <p className="text-sm text-slate-500 mb-6">
              {search || courseId !== 'ALL' || status !== 'ALL'
                ? 'No examinations matched your filters. Try adjusting your search query.'
                : 'You have not created any examinations for your assigned courses yet.'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Your First Exam
            </button>
          </div>
        )}

        {/* Content: Card View */}
        {!isLoading && !error && exams.length > 0 && viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {exam.type}
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        exam.status === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : exam.status === 'DRAFT'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {exam.status}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 line-clamp-2 hover:text-emerald-600 transition-colors mb-2">
                    <Link href={`/teacher/exams/${exam.id}`}>{exam.title}</Link>
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{exam.courseTitle}</span>
                    </div>
                    {exam.batchName && (
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{exam.batchName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {exam.durationMin} mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-slate-400" />
                        {exam.totalMarks} marks (Pass: {exam.passMarks})
                      </span>
                    </div>
                  </div>

                  {/* Badges / Stats */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mb-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Questions</div>
                      <div className="text-sm font-semibold text-slate-800">{exam.questionCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Attempts</div>
                      <div className="text-sm font-semibold text-slate-800">{exam.totalAttempts}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Pending</div>
                      <div
                        className={`text-sm font-semibold ${
                          exam.pendingEvaluations > 0 ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {exam.pendingEvaluations}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/teacher/exams/${exam.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Manage Questions
                  </Link>
                  <Link
                    href={`/teacher/exams/${exam.id}/results`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    Results ({exam.totalAttempts})
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content: Table View */}
        {!isLoading && !error && exams.length > 0 && viewMode === 'table' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Exam Title</th>
                    <th className="px-4 py-3">Course & Batch</th>
                    <th className="px-4 py-3">Duration / Marks</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Attempts / Pending</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {exams.map((exam) => (
                    <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        <Link href={`/teacher/exams/${exam.id}`} className="hover:text-emerald-600 line-clamp-1">
                          {exam.title}
                        </Link>
                        <span className="text-[11px] text-slate-400 uppercase font-mono">{exam.type}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <div className="line-clamp-1 text-xs font-medium">{exam.courseTitle}</div>
                        <div className="text-[11px] text-slate-400">{exam.batchName}</div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <div>{exam.durationMin} mins</div>
                        <div className="text-slate-400">
                          {exam.totalMarks} pts (Pass: {exam.passMarks})
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">
                        {exam.questionCount} Qs
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            exam.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exam.status === 'DRAFT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <div className="font-semibold text-slate-800">{exam.totalAttempts} attempts</div>
                        {exam.pendingEvaluations > 0 ? (
                          <span className="text-rose-600 font-medium">
                            {exam.pendingEvaluations} pending evaluation
                          </span>
                        ) : (
                          <span className="text-emerald-600">All evaluated</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        <Link
                          href={`/teacher/exams/${exam.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          <Edit className="w-3 h-3" />
                          Questions
                        </Link>
                        <Link
                          href={`/teacher/exams/${exam.id}/results`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                        >
                          <GraduationCap className="w-3 h-3" />
                          Results
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-xs text-slate-500">
              Showing Page <span className="font-medium text-slate-900">{page}</span> of{' '}
              <span className="font-medium text-slate-900">{totalPages}</span> ({totalCount} total exams)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}

        {/* Create Examination Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-600" />
                  Create New Examination
                </h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Exam Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Biblical Hermeneutics Mid-Term Online Exam"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Course Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Course <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={createForm.courseId}
                      onChange={(e) => setCreateForm({ ...createForm, courseId: e.target.value, batchId: '' })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Course</option>
                      {assignedCourses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Batch Scope (Optional)
                    </label>
                    <select
                      value={createForm.batchId}
                      onChange={(e) => setCreateForm({ ...createForm, batchId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">All Batches in Course</option>
                      {availableBatches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.studentCount} students)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Type & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Type</label>
                    <select
                      value={createForm.type}
                      onChange={(e) => setCreateForm({ ...createForm, type: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="EXAM">Final / Mid-Term Examination</option>
                      <option value="QUIZ">Short Quiz / Class Test</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Duration (Minutes) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={600}
                      value={createForm.durationMin}
                      onChange={(e) => setCreateForm({ ...createForm, durationMin: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Marks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Total Marks <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={1000}
                      value={createForm.totalMarks}
                      onChange={(e) => setCreateForm({ ...createForm, totalMarks: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Passing Marks <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={createForm.totalMarks}
                      value={createForm.passMarks}
                      onChange={(e) => setCreateForm({ ...createForm, passMarks: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Scheduling */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Window (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={createForm.startAt}
                      onChange={(e) => setCreateForm({ ...createForm, startAt: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      End / Expiry Window (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={createForm.endAt}
                      onChange={(e) => setCreateForm({ ...createForm, endAt: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={createForm.instructions}
                    onChange={(e) => setCreateForm({ ...createForm, instructions: e.target.value })}
                    placeholder="Instructions regarding allowed notes, submission policies, timer rules..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Initial Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="modalStatus"
                        value="DRAFT"
                        checked={createForm.status === 'DRAFT'}
                        onChange={() => setCreateForm({ ...createForm, status: 'DRAFT' })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      Save as Draft (Add questions before publishing)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="modalStatus"
                        value="PUBLISHED"
                        checked={createForm.status === 'PUBLISHED'}
                        onChange={() => setCreateForm({ ...createForm, status: 'PUBLISHED' })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      Publish Immediately
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Create Examination
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
