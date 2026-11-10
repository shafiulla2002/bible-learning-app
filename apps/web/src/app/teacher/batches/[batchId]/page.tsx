'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Library,
  Users,
  Calendar,
  Clock,
  BookOpen,
  CalendarCheck,
  FileCheck2,
  GraduationCap,
  Radio,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Award,
  ExternalLink,
  Mail,
  Phone,
  Search,
  UserCheck,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherBatchDetail } from '@/lib/use-teacher-batches';

export default function TeacherBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = (params?.batchId as string) || '';

  const { data, isLoading, error, refresh } = useTeacherBatchDetail(batchId);
  const [activeTab, setActiveTab] = useState<'roster' | 'live' | 'tasks' | 'overview'>('roster');
  const [studentSearch, setStudentSearch] = useState('');

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <TeacherShell pageTitle="Cohort Details">
        <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4" />
          <div className="h-28 bg-white border border-slate-200 rounded-xl p-6" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl" />
            ))}
          </div>
          <div className="h-96 bg-white border border-slate-200 rounded-xl" />
        </div>
      </TeacherShell>
    );
  }

  if (error || !data) {
    return (
      <TeacherShell pageTitle="Cohort Details">
        <div className="max-w-xl mx-auto my-12 bg-white p-8 rounded-xl border border-slate-200 text-center shadow-sm">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Unable to Load Cohort Details</h2>
          <p className="text-sm text-slate-600 mt-2">
            {error || 'The requested batch could not be found or you are not authorized to view it.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/teacher/batches"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
            >
              <ArrowLeft size={16} />
              Back to My Batches
            </Link>
            <button
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        </div>
      </TeacherShell>
    );
  }

  const { batch, faculty, students, stats, liveSessions, assignments, exams } = data;

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.admissionNo?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    );
  });

  return (
    <TeacherShell pageTitle={`${batch.name} – Cohort Details`}>
      <div className="max-w-7xl mx-auto space-y-6 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/batches"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft size={16} />
            Back to My Batches
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/attendance?batchId=${batch.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition shadow-sm"
            >
              <CalendarCheck size={14} />
              Mark Attendance
            </Link>
            <Link
              href={`/teacher/courses/${batch.course.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition shadow-sm"
            >
              <BookOpen size={14} />
              Course Syllabus
            </Link>
            <button
              onClick={() => refresh()}
              className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm"
              title="Refresh cohort data"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Batch Hero Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-xs font-bold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Award size={12} className="inline mr-1 -mt-0.5" />
                  {batch.assignedRole} Faculty
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {batch.status}
                </span>
                {batch.code && (
                  <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                    {batch.code}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {batch.name}
              </h1>
              <p className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                <BookOpen size={16} className="text-slate-400" />
                {batch.course.title}
                {batch.termName && (
                  <span className="text-slate-400">
                    • {batch.termName} {batch.academicYearName ? `(${batch.academicYearName})` : ''}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-100 shrink-0">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Start Date</p>
                <p className="font-medium text-slate-800">{formatDate(batch.startDate)}</p>
              </div>
              <div className="hidden sm:block md:hidden lg:block w-px bg-slate-200 mx-1" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">End Date</p>
                <p className="font-medium text-slate-800">{formatDate(batch.endDate)}</p>
              </div>
              <div className="hidden sm:block md:hidden lg:block w-px bg-slate-200 mx-1" />
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Capacity</p>
                <p className="font-medium text-slate-800">
                  {stats.activeEnrolled} / {batch.capacity} Students
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Enrolled Students</span>
              <Users size={18} className="text-sky-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{stats.activeEnrolled}</p>
            <p className="text-xs text-slate-500 mt-1">Total active learners</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Avg Attendance</span>
              <UserCheck size={18} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{stats.averageAttendancePct}%</p>
            <p className="text-xs text-slate-500 mt-1">Across {stats.totalAttendanceSessions} sessions</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Live Sessions</span>
              <Radio size={18} className="text-rose-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{liveSessions.length}</p>
            <p className="text-xs text-slate-500 mt-1">Scheduled & conducted</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase">Assessments</span>
              <FileCheck2 size={18} className="text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">
              {stats.totalAssignments + stats.totalExams}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {stats.totalAssignments} assignments, {stats.totalExams} exams
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 flex items-center gap-6">
          <button
            onClick={() => setActiveTab('roster')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'roster'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            Student Roster ({students.length})
          </button>

          <button
            onClick={() => setActiveTab('live')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'live'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio size={16} />
            Live Classes ({liveSessions.length})
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'tasks'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck2 size={16} />
            Assignments & Exams ({assignments.length + exams.length})
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Library size={16} />
            Faculty & Information
          </button>
        </div>

        {/* Tab 1: Student Roster */}
        {activeTab === 'roster' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative w-full sm:max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Filter roster by student name..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="text-xs text-slate-500">
                Showing {filteredStudents.length} of {students.length} students
              </div>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                No enrolled students found matching your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Admission No</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Curriculum Progress</th>
                      <th className="py-3 px-4">Attendance Rate</th>
                      <th className="py-3 px-4">Enrolled On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {student.fullName ? student.fullName[0] : 'S'}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{student.fullName}</p>
                              <span className="text-[10px] text-emerald-600 font-medium">
                                {student.status}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {student.admissionNo || '—'}
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          {student.email && (
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Mail size={12} className="text-slate-400" />
                              <span>{student.email}</span>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Phone size={11} className="text-slate-400" />
                              <span>{student.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="w-32">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                              <span>{student.progressPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-600 rounded-full"
                                style={{ width: `${student.progressPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {student.attendance.ratePct !== null ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                                student.attendance.ratePct >= 75
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : student.attendance.ratePct >= 50
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {student.attendance.ratePct}% ({student.attendance.present}/
                              {student.attendance.total})
                            </span>
                          ) : (
                            <span className="text-slate-400">No records</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {formatDate(student.enrolledAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live Classes */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Scheduled & Conducted Live Sessions
              </h3>
              <Link
                href="/teacher/live-classes"
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
              >
                Go to Live Classes Manager <ExternalLink size={12} />
              </Link>
            </div>

            {liveSessions.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
                No live sessions scheduled for this cohort yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveSessions.map((session) => (
                  <div
                    key={session.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-slate-100 text-slate-700">
                        {session.status}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(session.startsAt)}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900">{session.title}</h4>
                    {session.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{session.description}</p>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Host: <strong className="text-slate-700">{session.instructorName || 'Faculty'}</strong>
                      </span>
                      {session.joinUrl && (
                        <a
                          href={session.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition"
                        >
                          Join Class <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Assignments & Exams */}
        {activeTab === 'tasks' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assignments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 size={18} className="text-indigo-600" />
                  Cohort Assignments ({assignments.length})
                </h3>
                <Link
                  href="/teacher/assignments"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  View All
                </Link>
              </div>

              {assignments.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                  No assignments created for this cohort.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{a.title}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-700">
                          {a.totalMarks} Marks
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Due: {formatDate(a.dueDate)}</span>
                        <span>{a.submissionsCount} Submissions</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exams */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap size={18} className="text-purple-600" />
                  Cohort Examinations ({exams.length})
                </h3>
                <Link
                  href="/teacher/exams"
                  className="text-xs font-semibold text-purple-600 hover:underline"
                >
                  View All
                </Link>
              </div>

              {exams.length === 0 ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-slate-500 text-xs">
                  No examinations scheduled for this cohort.
                </div>
              ) : (
                <div className="space-y-3">
                  {exams.map((ex) => (
                    <div
                      key={ex.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{ex.title}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 rounded">
                          {ex.totalMarks} Marks ({ex.duration}m)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Starts: {formatDateTime(ex.startsAt)}</span>
                        <span>{ex.attemptsCount} Attempts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Overview & Faculty */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900">Course Syllabus & Description</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {batch.course.description ||
                    'Comprehensive curriculum covering theological foundations, hermeneutics, and ministry practice for this cohort.'}
                </p>
                <div className="pt-2">
                  <Link
                    href={`/teacher/courses/${batch.course.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                  >
                    Open Complete Course Materials
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Assigned Faculty ({faculty.length})
                </h3>
                <div className="space-y-3">
                  {faculty.map((f) => (
                    <div
                      key={f.teacherProfileId}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                          {f.fullName ? f.fullName[0] : 'F'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{f.fullName}</p>
                          <p className="text-[11px] text-slate-500">{f.email}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-white border border-slate-200 text-slate-700">
                        {f.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
