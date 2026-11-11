'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse } from '@/lib/api';
import {
  GraduationCap,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Search,
  Filter,
  ArrowRight,
  BookOpen,
  PlayCircle,
  Layers,
} from 'lucide-react';

interface ExamItem {
  id: string;
  title: string;
  type: 'QUIZ' | 'EXAM';
  courseId: string;
  courseTitle: string;
  instructorName: string;
  durationMin: number;
  totalMarks: number;
  passMarks: number;
  totalQuestions: number;
  status: 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED' | 'EVALUATED';
  latestAttempt: {
    id: string;
    startedAt: string;
    submittedAt: string | null;
    score: number | null;
    status: string;
    passed: boolean | null;
  } | null;
}

interface ExamsResponse {
  exams: ExamItem[];
  summary: {
    total: number;
    available: number;
    inProgress: number;
    completed: number;
  };
  courses: Array<{ id: string; title: string }>;
}

export default function StudentExamsPage() {
  const { student, profile, institute, logout } = useStudentAuth({ requireAuth: true, redirectTo: '/login' });
  const [data, setData] = useState<ExamsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'AVAILABLE' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function fetchExams() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (selectedCourse !== 'ALL') params.append('courseId', selectedCourse);
        if (searchQuery.trim()) params.append('q', searchQuery.trim());
        if (activeTab !== 'ALL') params.append('status', activeTab);

        const res = await apiFetchResponse(`/students/exams?${params.toString()}`);
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        if (!res.ok) throw new Error('Failed to load examinations');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error('Failed to load exams:', err?.message || err);
        setData({
          exams: [],
          summary: { total: 0, available: 0, inProgress: 0, completed: 0 },
          courses: [],
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchExams();
  }, [activeTab, selectedCourse, searchQuery, profile?.studentProfileId, student?.id, institute?.id]);

  const exams = data?.exams || [];
  const summary = data?.summary || { total: 0, available: 0, inProgress: 0, completed: 0 };
  const courses = data?.courses || [];

  return (
    <StudentShell pageTitle="Examinations">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                <GraduationCap size={14} className="text-white" />
                Examinations & Quizzes
              </span>
              <span className="text-xs text-blue-100">Timed Assessments & Automated Scoring</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Academic Examinations</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Take scheduled theological assessments, mid-term examinations, and evaluate your biblical knowledge under timed conditions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.available}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Available</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.inProgress}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">In Progress</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.completed}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Completed</div>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              All Tests ({summary.total})
            </button>
            <button
              onClick={() => setActiveTab('AVAILABLE')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'AVAILABLE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Ready to Take ({summary.available})
            </button>
            <button
              onClick={() => setActiveTab('IN_PROGRESS')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'IN_PROGRESS'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              In Progress ({summary.inProgress})
            </button>
            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'COMPLETED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Completed ({summary.completed})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {courses.length > 0 && (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ALL">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Exam Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm animate-pulse space-y-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-16 bg-slate-100 rounded" />
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <GraduationCap size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-bold text-slate-800">No Examinations Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are currently no examinations scheduled matching your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((ex) => (
              <div
                key={ex.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider truncate max-w-[180px]">
                      {ex.courseTitle}
                    </span>

                    {ex.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={12} />
                        Completed
                      </span>
                    ) : ex.status === 'IN_PROGRESS' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                        <Clock size={12} />
                        In Progress
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                        <PlayCircle size={12} />
                        Available
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug mb-2 line-clamp-2">
                    {ex.title}
                  </h3>

                  {/* Metadata */}
                  <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock size={14} className="text-slate-400" />
                        Time Allowed:
                      </span>
                      <span className="font-semibold text-slate-800">{ex.durationMin} minutes</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Layers size={14} className="text-slate-400" />
                        Total Questions:
                      </span>
                      <span className="font-semibold text-slate-800">{ex.totalQuestions} questions</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Award size={14} className="text-slate-400" />
                        Passing Marks:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {ex.passMarks} / {ex.totalMarks} pts
                      </span>
                    </div>

                    {ex.latestAttempt?.score !== null && ex.latestAttempt?.score !== undefined && (
                      <div className="flex items-center justify-between bg-emerald-50 px-3 py-1.5 rounded-xl text-emerald-900 mt-2">
                        <span className="font-bold text-xs">Your Score:</span>
                        <span className="font-black text-sm">
                          {ex.latestAttempt.score} / {ex.totalMarks} ({ex.latestAttempt.passed ? 'PASSED' : 'RETRY'})
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  {ex.status === 'COMPLETED' ? (
                    <Link
                      href={`/student/exams/${ex.id}/results`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      View Detailed Results
                      <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <Link
                      href={`/student/exams/${ex.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      {ex.status === 'IN_PROGRESS' ? 'Resume Examination' : 'Start Examination'}
                      <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
