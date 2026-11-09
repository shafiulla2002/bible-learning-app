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
  Percent,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherAssignments, TeacherAssignmentItem } from '@/lib/use-teacher-assignments';
import { useTeacherCourses } from '@/lib/use-teacher-courses';

export default function TeacherAssignmentsPage() {
  const {
    assignments,
    totalCount,
    totalPages,
    page,
    limit,
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
    createAssignment,
  } = useTeacherAssignments();

  const { courses: assignedCourses } = useTeacherCourses(100);

  const [searchInput, setSearchInput] = useState(search);

  // Create Assignment Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    courseId: '',
    batchId: '',
    title: '',
    instructions: '',
    dueAt: '',
    maxMarks: 100,
    status: 'PUBLISHED',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

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
    setModalSuccess(null);
    const defaultCourseId = assignedCourses[0]?.id || '';
    // Set default dueAt to 7 days from now at 23:59
    const d = new Date(Date.now() + 7 * 86400000);
    d.setHours(23, 59, 0, 0);
    const localIso = d.toISOString().slice(0, 16);

    setCreateForm({
      courseId: defaultCourseId,
      batchId: '',
      title: '',
      instructions: '',
      dueAt: localIso,
      maxMarks: 100,
      status: 'PUBLISHED',
    });
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.courseId || !createForm.title.trim() || !createForm.instructions.trim() || !createForm.dueAt) {
      setModalError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      await createAssignment({
        courseId: createForm.courseId,
        batchId: createForm.batchId || undefined,
        title: createForm.title.trim(),
        instructions: createForm.instructions.trim(),
        dueAt: new Date(createForm.dueAt).toISOString(),
        maxMarks: Number(createForm.maxMarks) || 100,
        status: createForm.status,
      });

      setModalSuccess('Assignment created successfully!');
      setTimeout(() => {
        setCreateModalOpen(false);
        refresh();
      }, 1000);
    } catch (err: any) {
      setModalError(err?.message || 'Error creating assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aggregated totals
  const totalSubmissions = assignments.reduce((acc, a) => acc + a.submittedCount, 0);
  const totalGraded = assignments.reduce((acc, a) => acc + a.gradedCount, 0);
  const totalPending = assignments.reduce((acc, a) => acc + a.pendingCount, 0);

  const getStatusBadge = (asgStatus: string) => {
    switch (asgStatus.toUpperCase()) {
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Published
          </span>
        );
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={11} className="text-amber-500" />
            Draft
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {asgStatus}
          </span>
        );
    }
  };

  return (
    <TeacherShell pageTitle="Assignments & Grading Management">
      <div className="space-y-6">

        {/* 1. Header Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/20 backdrop-blur-md">
                <FileCheck2 size={13} className="text-blue-400" />
                <span>Academic Evaluation & Grading</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Assignments & Submissions
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Create cohort assignments, inspect student submission essays and attachments, record marks, and provide written faculty feedback.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg transition"
              >
                <Plus size={15} />
                Create Assignment
              </button>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 mt-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <FileCheck2 size={14} className="text-blue-400" />
                <span>Total Assignments</span>
              </div>
              <div className="text-2xl font-black text-white">{totalCount}</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <Users size={14} className="text-indigo-400" />
                <span>Submissions Received</span>
              </div>
              <div className="text-2xl font-black text-white">{totalSubmissions}</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>Graded & Finalized</span>
              </div>
              <div className="text-2xl font-black text-white">{totalGraded}</div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                <Clock size={14} className="text-amber-400" />
                <span>Pending Evaluations</span>
              </div>
              <div className="text-2xl font-black text-white">
                {assignments.reduce((acc, a) => acc + (a.submittedCount - a.gradedCount), 0)}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search assignments by title, course or instructions..."
              className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {/* Course Filter Dropdown */}
            <select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">All Assigned Courses</option>
              {assignedCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>

            {/* Status Filter Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-medium">
              {[
                { label: 'All', value: 'ALL' },
                { label: 'Published', value: 'PUBLISHED' },
                { label: 'Draft', value: 'DRAFT' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStatus(tab.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    status === tab.value
                      ? 'bg-white text-slate-900 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => refresh()}
              title="Refresh assignments"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* 3. Error Banner */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-rose-600 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
            <button
              onClick={() => refresh()}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4. Assignments Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-16 bg-slate-50 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileCheck2 size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-900">No Assignments Found</h3>
              <p className="text-sm text-slate-500">
                {search || courseId !== 'ALL' || status !== 'ALL'
                  ? 'No assignments matched your current filters. Try resetting filters.'
                  : 'You have not created any assignments for your assigned courses yet.'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              {(search || courseId !== 'ALL' || status !== 'ALL') && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Clear Filters
                </button>
              )}
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
              >
                Create First Assignment
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((asg) => {
              const due = new Date(asg.dueAt);
              const isPastDue = Date.now() > due.getTime();

              const gradingProgressPct =
                asg.submittedCount > 0
                  ? Math.round((asg.gradedCount / asg.submittedCount) * 100)
                  : 0;

              return (
                <div
                  key={asg.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    {/* Top Row: Course and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 truncate max-w-[200px]">
                        {asg.courseTitle}
                      </span>
                      {getStatusBadge(asg.status)}
                    </div>

                    {/* Assignment Title */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {asg.title}
                    </h3>

                    {/* Cohort & Marks Row */}
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Library size={13} className="text-indigo-500" />
                        <span>{asg.batchName}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        Max: {asg.maxMarks} marks
                      </span>
                    </div>

                    {/* Instructions Preview */}
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      {asg.instructions}
                    </p>

                    {/* Due Date Indicator */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar size={13} className={isPastDue ? 'text-rose-500' : 'text-slate-400'} />
                      <span className={isPastDue ? 'text-rose-600 font-medium' : 'text-slate-600 font-medium'}>
                        Due: {due.toLocaleDateString()} at {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isPastDue && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                          Closed
                        </span>
                      )}
                    </div>

                    {/* Submission & Grading Metrics */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-500">
                          Submissions: <strong className="text-slate-800">{asg.submittedCount}</strong> / {asg.totalStudents}
                        </span>
                        <span className="text-slate-500">
                          Graded: <strong className="text-emerald-600">{asg.gradedCount}</strong>
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${gradingProgressPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{asg.pendingCount} pending</span>
                        {asg.lateCount > 0 && (
                          <span className="text-amber-600 font-medium">
                            {asg.lateCount} late
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Link
                    href={`/teacher/assignments/${asg.id}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                  >
                    <FileCheck2 size={14} />
                    <span>Manage Submissions & Grade</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total assignments)
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || isLoading}
                onClick={() => setPage(page - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <button
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage(page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 6. Create Assignment Modal */}
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Plus size={18} className="text-blue-600" />
                  Create Course Assignment
                </div>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {modalError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  {modalError}
                </div>
              )}

              {modalSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  {modalSuccess}
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {/* Course Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Course *
                  </label>
                  <select
                    value={createForm.courseId}
                    onChange={(e) => setCreateForm({ ...createForm, courseId: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Choose Course --</option>
                    {assignedCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assignment Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Hermeneutical Principles Essay"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instructions & Prompt *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={createForm.instructions}
                    onChange={(e) => setCreateForm({ ...createForm, instructions: e.target.value })}
                    placeholder="Provide full assignment requirements, formatting expectations, word limits, and guidelines..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Due Date & Max Marks Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Due Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={createForm.dueAt}
                      onChange={(e) => setCreateForm({ ...createForm, dueAt: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Maximum Marks *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      required
                      value={createForm.maxMarks}
                      onChange={(e) => setCreateForm({ ...createForm, maxMarks: parseInt(e.target.value, 10) || 100 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Publication Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Publication Status
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={createForm.status === 'PUBLISHED'}
                        onChange={() => setCreateForm({ ...createForm, status: 'PUBLISHED' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Publish Immediately (Visible to enrolled students)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={createForm.status === 'DRAFT'}
                        onChange={() => setCreateForm({ ...createForm, status: 'DRAFT' })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>Save as Draft</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Assignment'}
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

