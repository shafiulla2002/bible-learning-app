'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse } from '@/lib/api';
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
  const [courses, setCourses] = useState<EnrolledCourseItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('recent');

  const fetchCourses = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (sortBy) params.set('sort', sortBy);

      const res = await apiFetchResponse(`/students/courses?${params.toString()}`);

      if (res.ok) {
        const json = await res.json();
        setCourses(json.courses || []);
        if (json.categories && json.categories.length > 0) {
          setCategories(json.categories);
        }
      }
    } catch (err) {
      console.error('Failed to fetch enrolled courses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, statusFilter, sortBy, profile?.studentProfileId, student?.id, institute?.id]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

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
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ALL'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Courses ({courses.length})
            </button>
            <button
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'IN_PROGRESS'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'COMPLETED'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed
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
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-pulse">
                <div className="w-full h-40 bg-slate-200 rounded-xl" />
                <div className="w-24 h-4 bg-slate-200 rounded" />
                <div className="w-3/4 h-5 bg-slate-200 rounded" />
                <div className="w-full h-10 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : courses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course, idx) => {
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
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-sm transition group"
                    >
                      <PlayCircle size={15} />
                      <span>{isCompleted ? 'Review Course' : course.progressPct > 0 ? 'Continue Learning' : 'Start Course'}</span>
                      <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
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
