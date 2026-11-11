'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse } from '@/lib/api';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Award,
  Search,
  Filter,
  ArrowRight,
  BookOpen,
  Send,
} from 'lucide-react';

interface AssignmentItem {
  id: string;
  title: string;
  instructions: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string | null;
  dueAt: string;
  maxMarks: number;
  status: 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'GRADED' | 'OVERDUE';
  isOverdue: boolean;
  submission: {
    id: string;
    submittedAt: string;
    answerText: string | null;
    fileUrl: string | null;
    marksAwarded: number | null;
    feedback: string | null;
    status: string;
  } | null;
}

interface AssignmentsResponse {
  assignments: AssignmentItem[];
  summary: {
    total: number;
    pending: number;
    submitted: number;
    graded: number;
    overdue: number;
  };
  courses: Array<{ id: string; title: string }>;
}

export default function StudentAssignmentsPage() {
  const { student, profile, institute, logout } = useStudentAuth({ requireAuth: true, redirectTo: '/login' });
  const [data, setData] = useState<AssignmentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SUBMITTED' | 'GRADED' | 'OVERDUE'>('ALL');
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    async function fetchAssignments() {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (selectedCourse !== 'ALL') params.append('courseId', selectedCourse);
        if (searchQuery.trim()) params.append('q', searchQuery.trim());
        if (activeTab !== 'ALL') params.append('status', activeTab);

        const res = await apiFetchResponse(`/students/assignments?${params.toString()}`);
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        if (!res.ok) throw new Error('Failed to load assignments');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error('Failed to load assignments:', err?.message || err);
        setData({
          assignments: [],
          summary: { total: 0, pending: 0, submitted: 0, graded: 0, overdue: 0 },
          courses: [],
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchAssignments();
  }, [activeTab, selectedCourse, searchQuery, profile?.studentProfileId, student?.id, institute?.id]);

  const assignments = data?.assignments || [];
  const summary = data?.summary || { total: 0, pending: 0, submitted: 0, graded: 0, overdue: 0 };
  const courses = data?.courses || [];

  return (
    <StudentShell pageTitle="Assignments">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm">
                <FileText size={14} className="text-white" />
                Academic Tasks & Essays
              </span>
              <span className="text-xs text-blue-100">Evaluations & Faculty Feedback</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Assignment Submissions</h1>
            <p className="text-blue-100 text-sm mt-1 max-w-xl">
              Access your course assignments, review research guidelines, submit academic papers, and view graded marks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.pending}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Pending</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.graded}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Graded</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-center">
              <div className="text-2xl font-black">{summary.overdue}</div>
              <div className="text-[11px] text-blue-100 font-medium uppercase tracking-wider">Overdue</div>
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
              All ({summary.total})
            </button>
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'PENDING'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Pending ({summary.pending})
            </button>
            <button
              onClick={() => setActiveTab('SUBMITTED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'SUBMITTED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Submitted ({summary.submitted})
            </button>
            <button
              onClick={() => setActiveTab('GRADED')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'GRADED'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Graded ({summary.graded})
            </button>
            <button
              onClick={() => setActiveTab('OVERDUE')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'OVERDUE'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Overdue ({summary.overdue})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search assignments..."
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

        {/* Assignment Cards Grid */}
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
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm">
            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
            <h3 className="text-base font-bold text-slate-800">No Assignments Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are currently no assignments matching your selected filter criteria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((a) => {
              const due = new Date(a.dueAt);
              const dueFormatted = due.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={a.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider truncate max-w-[180px]">
                        {a.courseTitle}
                      </span>

                      {a.status === 'GRADED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 size={12} />
                          Graded
                        </span>
                      ) : a.status === 'SUBMITTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
                          <Clock size={12} />
                          Submitted
                        </span>
                      ) : a.status === 'OVERDUE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                          <AlertCircle size={12} />
                          Overdue
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800">
                          <Clock size={12} />
                          Pending
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug mb-2 line-clamp-2">
                      {a.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-3 mb-4">{a.instructions}</p>

                    {/* Metadata */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Calendar size={14} className="text-slate-400" />
                          Due Date:
                        </span>
                        <span className={`font-semibold ${a.isOverdue ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                          {dueFormatted}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Award size={14} className="text-slate-400" />
                          Maximum Marks:
                        </span>
                        <span className="font-semibold text-slate-800">{a.maxMarks} pts</span>
                      </div>

                      {a.submission?.marksAwarded !== null && a.submission?.marksAwarded !== undefined && (
                        <div className="flex items-center justify-between bg-emerald-50 px-3 py-1.5 rounded-xl text-emerald-900 mt-2">
                          <span className="font-bold text-xs">Score Awarded:</span>
                          <span className="font-black text-sm">
                            {a.submission.marksAwarded} / {a.maxMarks}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <Link
                      href={`/student/assignments/${a.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      {a.submission ? 'View Submission & Grade' : 'Open & Submit Assignment'}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
