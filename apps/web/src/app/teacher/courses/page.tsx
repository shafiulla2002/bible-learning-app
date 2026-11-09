'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Filter,
  GraduationCap,
  Users,
  Library,
  Clock,
  Layers,
  FileText,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherCourses, TeacherCourseItem } from '@/lib/use-teacher-courses';

export default function TeacherCoursesPage() {
  const {
    courses,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    status,
    isLoading,
    error,
    setPage,
    setSearch,
    setStatus,
    refresh,
  } = useTeacherCourses();

  const [searchInput, setSearchInput] = useState(search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('ALL');
    setPage(1);
  };

  // Aggregated totals
  const totalBatches = courses.reduce((acc, c) => acc + c.batchCount, 0);
  const totalStudents = courses.reduce((acc, c) => acc + c.studentCount, 0);
  const totalLessons = courses.reduce((acc, c) => acc + c.curriculumStats.lessonCount, 0);

  const getStatusBadge = (courseStatus: string) => {
    switch (courseStatus.toUpperCase()) {
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
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {courseStatus}
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    const isLead = role.toUpperCase().includes('LEAD');
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          isLead
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-purple-50 text-purple-700 border border-purple-200'
        }`}
      >
        <GraduationCap size={12} className={isLead ? 'text-indigo-600' : 'text-purple-600'} />
        {isLead ? 'Lead Faculty' : 'Instructor'}
      </span>
    );
  };

  return (
    <TeacherShell pageTitle="My Assigned Courses">
      <div className="space-y-6">

        {/* 1. Header Hero Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-400/20 backdrop-blur-md">
                <BookOpen size={13} className="text-blue-400" />
                <span>Academic Curriculum & Syllabus</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                Assigned Courses & Curriculum
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Access your assigned academic courses, explore module hierarchies, inspect lesson syllabi, and manage curriculum learning materials.
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                  <BookOpen size={14} className="text-blue-400" />
                  <span>Courses</span>
                </div>
                <div className="text-2xl font-black text-white">{totalCount}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                  <Library size={14} className="text-indigo-400" />
                  <span>Cohorts</span>
                </div>
                <div className="text-2xl font-black text-white">{totalBatches}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                  <Users size={14} className="text-emerald-400" />
                  <span>Students</span>
                </div>
                <div className="text-2xl font-black text-white">{totalStudents}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
                  <Layers size={14} className="text-amber-400" />
                  <span>Lessons</span>
                </div>
                <div className="text-2xl font-black text-white">{totalLessons}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Filters & Search Control Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search assigned courses by title, slug or topic..."
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

            {/* Quick Refresh */}
            <button
              onClick={() => refresh()}
              title="Refresh course list"
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

        {/* 4. Course Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse">
                <div className="h-44 bg-slate-100 rounded-xl w-full" />
                <div className="h-5 bg-slate-200 rounded-lg w-3/4" />
                <div className="h-4 bg-slate-100 rounded-md w-1/2" />
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="h-8 bg-slate-100 rounded-lg" />
                  <div className="h-8 bg-slate-100 rounded-lg" />
                  <div className="h-8 bg-slate-100 rounded-lg" />
                </div>
                <div className="h-10 bg-slate-100 rounded-xl w-full pt-2" />
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <BookOpen size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-900">No Assigned Courses Found</h3>
              <p className="text-sm text-slate-500">
                {search || status !== 'ALL'
                  ? 'No courses matched your current filter criteria. Try resetting filters.'
                  : 'You are not currently assigned to instruct or teach any active courses in this institute.'}
              </p>
            </div>
            {(search || status !== 'ALL') && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden group"
              >
                {/* Course Header / Graphic Banner */}
                <div className="relative h-44 bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 overflow-hidden flex flex-col justify-between p-4">
                  {course.coverImage ? (
                    <img
                      src={course.coverImage}
                      alt={course.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 opacity-90" />
                  )}

                  <div className="relative z-10 flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/20">
                      {course.level || 'General'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(course.status)}
                    </div>
                  </div>

                  <div className="relative z-10 space-y-1">
                    <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">
                      {course.category}
                    </span>
                    <h3 className="text-lg font-bold text-white line-clamp-1 group-hover:text-blue-200 transition-colors">
                      {course.title}
                    </h3>
                  </div>
                </div>

                {/* Course Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  {/* Role and Language Row */}
                  <div className="flex items-center justify-between">
                    {getRoleBadge(course.role)}
                    <span className="text-xs text-slate-500 font-medium">
                      Language: <strong className="text-slate-700">{course.language || 'English'}</strong>
                    </span>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {course.description || 'Comprehensive biblical theology curriculum and foundational studies.'}
                  </p>

                  {/* Curriculum Stats Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Modules</div>
                      <div className="text-sm font-bold text-slate-800">
                        {course.curriculumStats.moduleCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Lessons</div>
                      <div className="text-sm font-bold text-slate-800">
                        {course.curriculumStats.lessonCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium">Resources</div>
                      <div className="text-sm font-bold text-slate-800">
                        {course.curriculumStats.resourceCount}
                      </div>
                    </div>
                  </div>

                  {/* Cohort & Student Counters */}
                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Library size={13} className="text-indigo-600" />
                      <span>{course.batchCount} Assigned Batches</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-blue-600" />
                      <span>{course.studentCount} Students</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    <Link
                      href={`/teacher/courses/${course.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      <BookOpen size={14} />
                      <span>Curriculum & Syllabus</span>
                    </Link>

                    <Link
                      href={`/teacher/materials?courseId=${course.id}`}
                      title="Browse course study materials"
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                    >
                      <FileText size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 5. Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total assigned courses)
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

      </div>
    </TeacherShell>
  );
}
