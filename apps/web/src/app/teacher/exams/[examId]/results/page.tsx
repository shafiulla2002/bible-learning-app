'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Award,
  BookOpen,
  Users,
  Edit,
  Eye,
  Check,
  X,
  FileQuestion,
  User,
  Filter,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import {
  useTeacherExamResults,
  ExamResultItem,
  AttemptDetailData,
} from '@/lib/use-teacher-exam-results';

export default function TeacherExamResultsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const {
    data,
    isLoading,
    error,
    statusFilter,
    search,
    isActionLoading,
    setStatusFilter,
    setSearch,
    refresh,
    fetchAttempt,
    evaluateAttempt,
  } = useTeacherExamResults(examId);

  const [searchInput, setSearchInput] = useState(search);

  // Evaluation Modal State
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetailData | null>(null);
  const [evalScore, setEvalScore] = useState<number>(0);
  const [evalFeedback, setEvalFeedback] = useState<string>('');
  const [evalAnswers, setEvalAnswers] = useState<{ [qId: string]: { score: number; feedback: string } }>({});
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalSuccess, setEvalSuccess] = useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleOpenEvaluate = async (attemptId: string) => {
    setEvalModalOpen(true);
    setEvalLoading(true);
    setEvalError(null);
    setAttemptDetail(null);

    try {
      const att = await fetchAttempt(attemptId);
      setAttemptDetail(att);
      setEvalScore(att.score !== null ? att.score : 0);
      setEvalFeedback(att.feedback || '');

      const answersMap: { [qId: string]: { score: number; feedback: string } } = {};
      att.answers.forEach((ans) => {
        answersMap[ans.questionId] = {
          score: ans.scoreAwarded !== null ? ans.scoreAwarded : 0,
          feedback: ans.feedback || '',
        };
      });
      setEvalAnswers(answersMap);
    } catch (err: any) {
      setEvalError(err?.message || 'Failed to load attempt details');
    } finally {
      setEvalLoading(false);
    }
  };

  const handleAutoCalculateSum = () => {
    if (!attemptDetail) return;
    let sum = 0;
    attemptDetail.answers.forEach((ans) => {
      const score = evalAnswers[ans.questionId]?.score || 0;
      sum += Number(score);
    });
    setEvalScore(Math.min(sum, attemptDetail.totalMarks));
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attemptDetail) return;

    if (evalScore < 0 || evalScore > attemptDetail.totalMarks) {
      setEvalError(`Score must be between 0 and maximum exam marks (${attemptDetail.totalMarks})`);
      return;
    }

    setEvalError(null);
    try {
      const answerPayload = Object.entries(evalAnswers).map(([qId, val]) => ({
        questionId: qId,
        score: Number(val.score),
        feedback: val.feedback || undefined,
      }));

      await evaluateAttempt(attemptDetail.id, {
        score: Number(evalScore),
        feedback: evalFeedback.trim() || undefined,
        answers: answerPayload,
      });

      setEvalSuccess('Evaluation submitted successfully!');
      setTimeout(() => {
        setEvalSuccess(null);
        setEvalModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setEvalError(err?.message || 'Failed to submit evaluation');
    }
  };

  const exam = data?.exam;
  const summary = data?.summary;
  const results = data?.results || [];

  return (
    <TeacherShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/teacher/exams/${examId}`}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back to Exam Builder"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  Examination Results & Grading
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                {exam?.title || 'Examination Results'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/teacher/exams/${examId}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <FileQuestion className="w-4 h-4 text-slate-500" />
              Manage Questions
            </Link>
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Alert */}
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

        {/* KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Enrolled Students</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.totalStudents}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-indigo-600">Total Attempts</div>
              <div className="text-2xl font-bold text-indigo-700 mt-1">{summary.attemptedCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-rose-600">Pending Evaluation</div>
              <div className="text-2xl font-bold text-rose-700 mt-1">
                {summary.pendingEvaluationCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-emerald-600">Evaluated</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">{summary.evaluatedCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-medium text-teal-600">Pass Rate</div>
              <div className="text-2xl font-bold text-teal-700 mt-1">
                {summary.passRate}%{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({summary.passedCount}/{summary.attemptedCount})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search student by name, admission no, or email..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </form>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Student Statuses</option>
                <option value="PENDING_EVALUATION">Pending Evaluation</option>
                <option value="EVALUATED">Evaluated</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="NOT_ATTEMPTED">Not Attempted</option>
              </select>

              {(search || statusFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setStatusFilter('ALL');
                  }}
                  className="px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded"></div>
              ))}
            </div>
          </div>
        )}

        {/* Student Roster Table */}
        {!isLoading && results.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3">Score Awarded</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.map((r) => (
                    <tr key={r.studentProfileId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600 flex-shrink-0">
                            {r.studentName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{r.studentName}</div>
                            <div className="text-[11px] text-slate-500">
                              Adm: {r.admissionNo} • {r.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{r.batchName}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            r.evaluationStatus === 'EVALUATED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.evaluationStatus === 'PENDING_EVALUATION'
                              ? 'bg-rose-100 text-rose-800 font-semibold'
                              : r.evaluationStatus === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.evaluationStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {r.submittedAt ? (
                          new Date(r.submittedAt).toLocaleString()
                        ) : (
                          <span className="text-slate-400">Not submitted</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-slate-900">
                        {r.score !== null ? (
                          <span>
                            {r.score} / {r.totalMarks} pts
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {r.passed !== null ? (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              r.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {r.passed ? 'PASSED' : 'FAILED'} ({r.percentage}%)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {r.attemptId && (
                          <button
                            onClick={() => handleOpenEvaluate(r.attemptId!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            {r.evaluationStatus === 'EVALUATED' ? 'Review / Edit' : 'Evaluate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty Roster State */}
        {!isLoading && results.length === 0 && (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm max-w-md mx-auto">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 mb-1">No Students Found</h3>
            <p className="text-sm text-slate-500">
              {search || statusFilter !== 'ALL'
                ? 'No students matched your filter criteria.'
                : 'No students are actively enrolled in this course or batch.'}
            </p>
          </div>
        )}

        {/* Manual Evaluation Modal */}
        {evalModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-600" />
                    Student Attempt Evaluation
                  </h3>
                  {attemptDetail && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {attemptDetail.studentName} (Adm: {attemptDetail.admissionNo}) • Submitted:{' '}
                      {attemptDetail.submittedAt ? new Date(attemptDetail.submittedAt).toLocaleString() : 'N/A'}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEvalModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {evalLoading && (
                <div className="py-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Loading student submission details...</p>
                </div>
              )}

              {evalSuccess && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-700 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{evalSuccess}</span>
                </div>
              )}

              {evalError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{evalError}</span>
                </div>
              )}

              {!evalLoading && attemptDetail && (
                <form onSubmit={handleSaveEvaluation} className="mt-4 space-y-5">
                  {/* Question Answers Review */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Questions & Student Submissions ({attemptDetail.answers.length})
                      </h4>
                      <button
                        type="button"
                        onClick={handleAutoCalculateSum}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        Auto-Sum Total Marks
                      </button>
                    </div>

                    {attemptDetail.answers.map((ans, idx) => (
                      <div
                        key={ans.questionId}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{ans.prompt}</p>
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                {ans.type.replace('_', ' ')} • Max {ans.maxMarks} pts
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Student Answer */}
                        <div className="pl-7">
                          <div className="text-xs font-medium text-slate-600 mb-1">Student Answer:</div>
                          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 font-mono">
                            {ans.chosenText || <span className="text-slate-400 italic">No answer provided</span>}
                          </div>

                          {/* Options if available */}
                          {ans.options && ans.options.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                              {ans.options.map((o) => (
                                <div
                                  key={o.id}
                                  className={`p-1.5 rounded flex items-center justify-between ${
                                    o.isCorrect
                                      ? 'bg-emerald-50 text-emerald-900 font-medium'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  <span>{o.label}</span>
                                  {o.isCorrect && <Check className="w-3 h-3 text-emerald-600" />}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Individual question score input */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <label className="text-xs font-semibold text-slate-700">Marks:</label>
                              <input
                                type="number"
                                min={0}
                                max={ans.maxMarks}
                                value={evalAnswers[ans.questionId]?.score ?? 0}
                                onChange={(e) =>
                                  setEvalAnswers({
                                    ...evalAnswers,
                                    [ans.questionId]: {
                                      ...evalAnswers[ans.questionId],
                                      score: Number(e.target.value),
                                    },
                                  })
                                }
                                className="w-16 px-2 py-1 text-xs border border-slate-300 rounded font-bold text-center"
                              />
                              <span className="text-xs text-slate-400">/ {ans.maxMarks}</span>
                            </div>

                            <input
                              type="text"
                              placeholder="Feedback on this question (optional)"
                              value={evalAnswers[ans.questionId]?.feedback || ''}
                              onChange={(e) =>
                                setEvalAnswers({
                                  ...evalAnswers,
                                  [ans.questionId]: {
                                    ...evalAnswers[ans.questionId],
                                    feedback: e.target.value,
                                  },
                                })
                              }
                              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Score & Overall Feedback */}
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-900">
                        Final Awarded Score (Max {attemptDetail.totalMarks} Marks):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          required
                          min={0}
                          max={attemptDetail.totalMarks}
                          value={evalScore}
                          onChange={(e) => setEvalScore(Number(e.target.value))}
                          className="w-24 px-3 py-1.5 text-base font-bold text-center border-2 border-emerald-500 rounded-lg text-emerald-700 focus:outline-none"
                        />
                        <span className="text-sm font-semibold text-slate-600">
                          / {attemptDetail.totalMarks} pts
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Overall Evaluation Feedback
                      </label>
                      <textarea
                        rows={3}
                        value={evalFeedback}
                        onChange={(e) => setEvalFeedback(e.target.value)}
                        placeholder="Provide overall constructive feedback and guidance for the student..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEvalModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isActionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Submit Final Evaluation
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </TeacherShell>
  );
}
