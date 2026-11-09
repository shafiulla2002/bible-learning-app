'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileCheck2,
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  Library,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Edit,
  Download,
  FileText,
  X,
  MessageSquare,
  Award,
  Sparkles,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import {
  useTeacherAssignmentDetail,
  StudentSubmissionItem,
} from '@/lib/use-teacher-assignment-detail';

export default function TeacherAssignmentDetailPage() {
  const params = useParams();
  const assignmentId = params?.assignmentId as string;

  const {
    assignment,
    isLoading,
    error,
    refresh,
    updateAssignment,
    gradeSubmission,
  } = useTeacherAssignmentDetail(assignmentId);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SUBMITTED' | 'GRADED' | 'PENDING' | 'LATE'>('ALL');
  const [studentSearch, setStudentSearch] = useState('');

  // Grading Modal State
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmissionItem | null>(null);
  const [gradingMarks, setGradingMarks] = useState<number>(0);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [isGradingSubmitting, setIsGradingSubmitting] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [gradingSuccess, setGradingSuccess] = useState<string | null>(null);

  // Edit Assignment Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    instructions: '',
    dueAt: '',
    maxMarks: 100,
    status: 'PUBLISHED',
  });
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const handleOpenGradeModal = (sub: StudentSubmissionItem) => {
    setSelectedSubmission(sub);
    setGradingMarks(sub.marksAwarded !== null ? sub.marksAwarded : 0);
    setGradingFeedback(sub.feedback || '');
    setGradingError(null);
    setGradingSuccess(null);
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission || !selectedSubmission.submissionId) {
      setGradingError('Cannot grade an unsubmitted assignment');
      return;
    }

    if (gradingMarks < 0 || gradingMarks > (assignment?.maxMarks || 100)) {
      setGradingError(`Marks must be between 0 and ${assignment?.maxMarks || 100}`);
      return;
    }

    setIsGradingSubmitting(true);
    setGradingError(null);
    setGradingSuccess(null);

    try {
      await gradeSubmission(selectedSubmission.submissionId, {
        marksAwarded: gradingMarks,
        feedback: gradingFeedback.trim(),
      });

      setGradingSuccess('Grade and feedback saved successfully!');
      setTimeout(() => {
        setSelectedSubmission(null);
        refresh();
      }, 1000);
    } catch (err: any) {
      setGradingError(err?.message || 'Error saving grade');
    } finally {
      setIsGradingSubmitting(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!assignment) return;
    const due = new Date(assignment.dueAt);
    const localIso = due.toISOString().slice(0, 16);

    setEditForm({
      title: assignment.title,
      instructions: assignment.instructions,
      dueAt: localIso,
      maxMarks: assignment.maxMarks,
      status: assignment.status,
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.instructions.trim()) {
      setEditError('Title and instructions are required');
      return;
    }

    setIsEditSubmitting(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      await updateAssignment({
        title: editForm.title.trim(),
        instructions: editForm.instructions.trim(),
        dueAt: new Date(editForm.dueAt).toISOString(),
        maxMarks: Number(editForm.maxMarks),
        status: editForm.status,
      });

      setEditSuccess('Assignment updated successfully!');
      setTimeout(() => {
        setEditModalOpen(false);
        refresh();
      }, 1000);
    } catch (err: any) {
      setEditError(err?.message || 'Error updating assignment');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Filter submissions roster
  const filteredSubmissions = (assignment?.submissions || []).filter((sub) => {
    // 1. Status Filter
    if (activeFilter === 'SUBMITTED' && sub.status !== 'SUBMITTED') return false;
    if (activeFilter === 'GRADED' && sub.status !== 'GRADED') return false;
    if (activeFilter === 'PENDING' && sub.status !== 'PENDING') return false;
    if (activeFilter === 'LATE' && !sub.isLate) return false;

    // 2. Search Filter
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const nameMatch = sub.studentName.toLowerCase().includes(q);
      const admMatch = sub.admissionNo.toLowerCase().includes(q);
      const emailMatch = sub.email ? sub.email.toLowerCase().includes(q) : false;
      if (!nameMatch && !admMatch && !emailMatch) return false;
    }

    return true;
  });

  return (
    <TeacherShell pageTitle={assignment ? `${assignment.title} - Submissions` : 'Assignment Details'}>
      <div className="space-y-6">

        {/* 1. Breadcrumbs Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/teacher/assignments"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft size={16} />
            Back to Assignments
          </Link>

          <div className="flex items-center gap-2">
            {assignment && (
              <button
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <Edit size={14} className="text-slate-500" />
                Edit Assignment
              </button>
            )}

            <button
              onClick={() => refresh()}
              title="Refresh submissions"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>

        {/* 2. Loading State */}
        {isLoading && !assignment ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4 animate-pulse">
            <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
              <div className="h-20 bg-slate-100 rounded-xl" />
            </div>
          </div>
        ) : error || !assignment ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 flex flex-col items-center justify-center space-y-3">
            <AlertCircle size={32} className="text-rose-600" />
            <p className="text-base font-bold">{error || 'Assignment not found or access denied'}</p>
            <Link
              href="/teacher/assignments"
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
            >
              Return to Assignments
            </Link>
          </div>
        ) : (
          <>
            {/* 3. Hero Header Banner */}
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/20">
                      {assignment.courseTitle}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                      {assignment.batchName}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      assignment.status === 'PUBLISHED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/20'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-400/20'
                    }`}>
                      {assignment.status}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/20 text-white">
                      Max: {assignment.maxMarks} marks
                    </span>
                  </div>

                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                    {assignment.title}
                  </h1>

                  <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-slate-300 leading-relaxed">
                    {assignment.instructions}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-400" />
                      <span>Due: {new Date(assignment.dueAt).toLocaleDateString()} at {new Date(assignment.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Students</div>
                    <div className="text-2xl font-black text-white">{assignment.summary.totalStudents}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Submitted</div>
                    <div className="text-2xl font-black text-white">{assignment.summary.submittedCount}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Graded</div>
                    <div className="text-2xl font-black text-emerald-400">{assignment.summary.gradedCount}</div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md text-center">
                    <div className="text-xs text-slate-400 font-medium">Pending</div>
                    <div className="text-2xl font-black text-amber-400">{assignment.summary.pendingCount}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Filter & Search Controls */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Filter student by name or admission number..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-medium">
                {[
                  { label: 'All Students', value: 'ALL', count: assignment.summary.totalStudents },
                  { label: 'Submitted', value: 'SUBMITTED', count: assignment.summary.submittedCount - assignment.summary.gradedCount },
                  { label: 'Graded', value: 'GRADED', count: assignment.summary.gradedCount },
                  { label: 'Not Submitted', value: 'PENDING', count: assignment.summary.pendingCount },
                  { label: 'Late', value: 'LATE', count: assignment.summary.lateCount },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveFilter(tab.value as any)}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeFilter === tab.value
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Submissions List */}
            {filteredSubmissions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500 space-y-2">
                <Users size={28} className="mx-auto text-slate-400" />
                <p className="text-sm font-semibold">No submissions match the current filter</p>
                <p className="text-xs text-slate-400">Try switching tabs or clearing your student search input.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {filteredSubmissions.map((sub) => {
                    const isGraded = sub.status === 'GRADED';
                    const isSubmitted = sub.status === 'SUBMITTED' || isGraded;

                    return (
                      <div
                        key={sub.studentProfileId}
                        className="p-4 md:p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        {/* Student Details */}
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-sm">
                            {sub.studentName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-900">{sub.studentName}</h4>
                              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {sub.admissionNo}
                              </span>
                              {sub.isLate && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  Late Submission
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              Cohort: <strong>{sub.batchName}</strong> • {sub.email || 'No email registered'}
                            </div>

                            {/* Submitted Work Snippet */}
                            {isSubmitted && (
                              <div className="pt-1.5 space-y-1 max-w-xl">
                                {sub.answerText && (
                                  <p className="text-xs text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    "{sub.answerText}"
                                  </p>
                                )}
                                {sub.fileUrl && (
                                  <a
                                    href={sub.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                                  >
                                    <FileText size={13} />
                                    <span>Attached File / Document</span>
                                    <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status & Grading Action Column */}
                        <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                          {isGraded ? (
                            <div className="text-right space-y-0.5">
                              <div className="text-xs text-slate-400 font-medium">Awarded Grade</div>
                              <div className="text-base font-extrabold text-emerald-600">
                                {sub.marksAwarded} / {assignment.maxMarks}
                              </div>
                              {sub.feedback && (
                                <div className="text-[11px] text-slate-500 truncate max-w-[180px]" title={sub.feedback}>
                                  Feedback: "{sub.feedback}"
                                </div>
                              )}
                            </div>
                          ) : isSubmitted ? (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Clock size={12} className="text-blue-500" />
                                Awaiting Grading
                              </span>
                            </div>
                          ) : (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                                Not Submitted
                              </span>
                            </div>
                          )}

                          {isSubmitted ? (
                            <button
                              onClick={() => handleOpenGradeModal(sub)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                                isGraded
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                              }`}
                            >
                              {isGraded ? 'Edit Grade' : 'Grade Submission'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No submission</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* 6. Grade Submission Modal */}
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Award size={18} className="text-emerald-600" />
                  Grade Student Submission
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {gradingError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  {gradingError}
                </div>
              )}

              {gradingSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  {gradingSuccess}
                </div>
              )}

              {/* Student Details Card */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{selectedSubmission.studentName}</span>
                  <span className="font-mono text-slate-500">{selectedSubmission.admissionNo}</span>
                </div>
                <div className="text-slate-500">
                  Submitted: {selectedSubmission.submittedAt ? new Date(selectedSubmission.submittedAt).toLocaleString() : 'N/A'}
                  {selectedSubmission.isLate && <strong className="text-amber-600 ml-2">(Late)</strong>}
                </div>
              </div>

              {/* Submitted Content Preview */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Submitted Work
                </label>
                {selectedSubmission.answerText ? (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 max-h-36 overflow-y-auto leading-relaxed border border-slate-200">
                    {selectedSubmission.answerText}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No written essay text provided.</p>
                )}

                {selectedSubmission.fileUrl && (
                  <div className="pt-1">
                    <a
                      href={selectedSubmission.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition"
                    >
                      <Download size={13} />
                      <span>Download / Inspect Submitted File</span>
                    </a>
                  </div>
                )}
              </div>

              <form onSubmit={handleGradeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Marks Awarded (Max: {assignment?.maxMarks || 100}) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={assignment?.maxMarks || 100}
                    required
                    value={gradingMarks}
                    onChange={(e) => setGradingMarks(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Faculty Feedback & Comments
                  </label>
                  <textarea
                    rows={3}
                    value={gradingFeedback}
                    onChange={(e) => setGradingFeedback(e.target.value)}
                    placeholder="Provide constructive feedback, notes on methodology, and areas for improvement..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedSubmission(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGradingSubmitting}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {isGradingSubmitting ? 'Saving...' : 'Save Grade & Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 7. Edit Assignment Modal */}
        {editModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Edit size={18} className="text-blue-600" />
                  Edit Assignment
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {editError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  {editError}
                </div>
              )}

              {editSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 font-medium flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  {editSuccess}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignment Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instructions & Prompt *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={editForm.instructions}
                    onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Due Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editForm.dueAt}
                      onChange={(e) => setEditForm({ ...editForm, dueAt: e.target.value })}
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
                      value={editForm.maxMarks}
                      onChange={(e) => setEditForm({ ...editForm, maxMarks: parseInt(e.target.value, 10) || 100 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  >
                    <option value="PUBLISHED">Published (Visible to students)</option>
                    <option value="DRAFT">Draft (Hidden from students)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEditSubmitting}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {isEditSubmitting ? 'Saving...' : 'Save Changes'}
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

