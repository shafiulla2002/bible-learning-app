'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { CourseGridLoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse, getCachedPortalData, setCachedPortalData } from '@/lib/api';
import {
  BookOpen,
  Search,
  Filter,
  ArrowUpDown,
  GraduationCap,
  PlayCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  User,
  Layers,
  Loader2,
} from 'lucide-react';

export interface EnrolledCourseItem {
  enrolmentId: string;
  courseId: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string | null;
  category: string;
  level: string;
  instructor: string;
  totalModules: number;
  totalLessons: number;
  completedLessons: number;
  progressPct: number;
  status: string;
  batchName: string | null;
  enrolledAt: string;
}

export default function StudentCoursesPage() {
  const { student, profile, institute } = useStudentAuth();
  const cachedInitial = getCachedPortalData<any>('student_courses');
  const [courses, setCourses] = useState<EnrolledCourseItem[]>(() => {
    return cachedInitial?.courses || (Array.isArray(cachedInitial) ? cachedInitial : []);
  });
  const [categories, setCategories] = useState<string[]>(() => cachedInitial?.categories || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedInitial);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [sortBy, setSortBy] = useState<string>('recent');
  const [tabLoading, setTabLoading] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await apiFetchResponse('/students/courses');

      if (res.ok) {
        const json = await res.json();
        const list = json.courses || [];
        setCourses(list);
        if (json.categories && json.categories.length > 0) {
          setCategories(json.categories);
        }
        setCachedPortalData('student_courses', json, 15 * 60 * 1000);
      }
    } catch (err) {
      console.error('Failed to fetch enrolled courses:', err);
    } finally {
      setIsLoading(false);
      setTabLoading(null);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleTabChange = (tab: 'ALL' | 'IN_PROGRESS' | 'COMPLETED') => {
    setTabLoading(tab);
    setStatusFilter(tab);
    setTimeout(() => setTabLoading(null), 120);
  };

  // Accurate Counts for all 3 tabs
  const allCount = courses.length;
  const inProgressCount = courses.filter(
    (c) => (c.progressPct ?? 0) < 100 && c.status !== 'COMPLETED'
  ).length;
  const completedCount = courses.filter(
    (c) => (c.progressPct ?? 0) >= 100 || c.status === 'COMPLETED'
  ).length;

  // Instant 0ms Filtered Courses
  const filteredCourses = useMemo(() => {
    let result = [...courses];

    if (statusFilter === 'IN_PROGRESS') {
      result = result.filter((c) => (c.progressPct ?? 0) < 100 && c.status !== 'COMPLETED');
    } else if (statusFilter === 'COMPLETED') {
      result = result.filter((c) => (c.progressPct ?? 0) >= 100 || c.status === 'COMPLETED');
    }

    if (selectedCategory !== 'all') {
      result = result.filter(
        (c) => (c.category || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.title || '').toLowerCase().includes(q) ||
          (c.instructor || '').toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q)
      );
    }

    if (sortBy === 'progress') {
      result.sort((a, b) => (b.progressPct ?? 0) - (a.progressPct ?? 0));
    } else if (sortBy === 'title') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      result.sort((a, b) => new Date(b.enrolledAt || 0).getTime() - new Date(a.enrolledAt || 0).getTime());
    }

    return result;
  }, [courses, statusFilter, selectedCategory, searchQuery, sortBy]);

  return (
    <StudentShell pageTitle="My Courses">
      <div className="space-y-6">
        
        {/* Header & Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              My Courses
            </h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Access your enrolled curriculum, track your lessons and continue your theological studies.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search courses, instructors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* Filter Pills & Status Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
          {/* Status Tabs with counts on ALL tabs and loading spinners */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => handleTabChange('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                statusFilter === 'ALL'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tabLoading === 'ALL' ? (
                <Loader2 size={13} className="animate-spin text-blue-600" />
              ) : null}
              <span>All Courses ({allCount})</span>
            </button>
            <button
              onClick={() => handleTabChange('IN_PROGRESS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                statusFilter === 'IN_PROGRESS'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tabLoading === 'IN_PROGRESS' ? (
                <Loader2 size={13} className="animate-spin text-blue-600" />
              ) : null}
              <span>In Progress ({inProgressCount})</span>
            </button>
            <button
              onClick={() => handleTabChange('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                statusFilter === 'COMPLETED'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tabLoading === 'COMPLETED' ? (
                <Loader2 size={13} className="animate-spin text-blue-600" />
              ) : null}
              <span>Completed ({completedCount})</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <ArrowUpDown size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
            >
              <option value="recent">Recently Enrolled</option>
              <option value="progress">Progress: High to Low</option>
              <option value="title">Course Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Course Cards Grid */}
        {isLoading && courses.length === 0 ? (
          <CourseGridLoadingSkeleton message="Loading enrolled courses..." />
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course, idx) => {
              const gradient = idx % 2 === 0
                ? 'from-blue-700 to-indigo-900'
                : 'from-emerald-700 to-teal-900';
              const isCompleted = course.progressPct === 100 || course.status === 'COMPLETED';

              return (
                <div
                  key={course.courseId}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Course Thumbnail */}
                    <div className={`relative h-44 w-full bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
                      {course.coverImage ? (
                        <img
                          src={course.coverImage}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <BookOpen size={44} className="text-white/70" />
                      )}

                      {/* Category Tag */}
                      <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-slate-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                        {course.category}
                      </span>

                      {/* Status Tag */}
                      {isCompleted ? (
                        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Completed</span>
                        </span>
                      ) : (
                        <span className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
                          {course.level}
                        </span>
                      )}

                      {/* Cohort / Batch badge */}
                      {course.batchName && (
                        <span className="absolute bottom-3 left-3 text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md">
                          {course.batchName}
                        </span>
                      )}
                    </div>

                    {/* Course Body */}
                    <div className="p-5 space-y-3">
                      <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course.description || 'Comprehensive biblical study and ministry preparation syllabus.'}
                      </p>

                      {/* Instructor & Module info */}
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          <span className="font-medium truncate max-w-[140px]">{course.instructor}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Layers size={13} />
                          <span>{course.totalModules || 1} Modules</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Course Footer & Progress */}
                  <div className="px-5 pb-5 pt-0 space-y-3">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-medium">
                          {course.completedLessons}/{course.totalLessons} Lessons
                        </span>
                        <span className="font-bold text-blue-600">{course.progressPct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#2563EB] h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, course.progressPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Button */}
                    <Link
                      href={`/student/courses/${course.courseId}`}
                      onClick={() => setNavigatingId(course.courseId)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition group"
                    >
                      {navigatingId === course.courseId ? (
                        <>
                          <Loader2 size={15} className="animate-spin text-white" />
                          <span>Opening Course...</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle size={15} />
                          <span>{isCompleted ? 'Review Course' : course.progressPct > 0 ? 'Continue Learning' : 'Start Course'}</span>
                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Empty State
          <div className="bg-white rounded-3xl p-12 border border-slate-200/80 shadow-sm text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <BookOpen size={32} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">No courses match your filter</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {searchQuery || selectedCategory !== 'all' || statusFilter !== 'ALL'
                  ? 'Try clearing your search query or switching your filter criteria.'
                  : 'You do not have any enrolled courses in this term. Please reach out to your institute administrator for course allocations.'}
              </p>
            </div>
            {(searchQuery || selectedCategory !== 'all' || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStatusFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-blue-600 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

      </div>
    </StudentShell>
  );
}
