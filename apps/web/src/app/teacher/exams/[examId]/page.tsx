'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  ArrowLeft,
  Plus,
  Clock,
  Award,
  BookOpen,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit,
  Trash2,
  Check,
  X,
  FileQuestion,
  HelpCircle,
  GraduationCap,
  Calendar,
  Layers,
  Send,
  Eye,
} from 'lucide-react';
import { TeacherShell } from '@/components/teacher/TeacherShell';
import { useTeacherExamDetail, ExamQuestion, ExamQuestionOption } from '@/lib/use-teacher-exam-detail';

export default function TeacherExamDetailPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const {
    exam,
    isLoading,
    error,
    isActionLoading,
    refresh,
    publishExam,
    updateExam,
    addQuestion,
    updateQuestion,
    deleteQuestion,
  } = useTeacherExamDetail(examId);

  // Question Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<{
    prompt: string;
    type: string;
    marks: number;
    position: number;
    options: { label: string; isCorrect: boolean }[];
  }>({
    prompt: '',
    type: 'MCQ_SINGLE',
    marks: 5,
    position: 1,
    options: [
      { label: '', isCorrect: true },
      { label: '', isCorrect: false },
      { label: '', isCorrect: false },
      { label: '', isCorrect: false },
    ],
  });
  const [questionError, setQuestionError] = useState<string | null>(null);

  // Edit Settings Modal State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    title: '',
    instructions: '',
    durationMin: 60,
    totalMarks: 100,
    passMarks: 40,
    startAt: '',
    endAt: '',
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Handlers
  const handleOpenAddQuestion = () => {
    setEditingQuestionId(null);
    setQuestionError(null);
    const nextPos = (exam?.questions.length || 0) + 1;
    setQuestionForm({
      prompt: '',
      type: 'MCQ_SINGLE',
      marks: 5,
      position: nextPos,
      options: [
        { label: '', isCorrect: true },
        { label: '', isCorrect: false },
        { label: '', isCorrect: false },
        { label: '', isCorrect: false },
      ],
    });
    setQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (q: ExamQuestion) => {
    setEditingQuestionId(q.id);
    setQuestionError(null);
    setQuestionForm({
      prompt: q.prompt,
      type: q.type,
      marks: q.marks,
      position: q.position,
      options:
        q.options.length > 0
          ? q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect }))
          : [
              { label: '', isCorrect: true },
              { label: '', isCorrect: false },
            ],
    });
    setQuestionModalOpen(true);
  };

  const handleQuestionTypeChange = (newType: string) => {
    if (newType === 'TRUE_FALSE') {
      setQuestionForm({
        ...questionForm,
        type: newType,
        options: [
          { label: 'True', isCorrect: true },
          { label: 'False', isCorrect: false },
        ],
      });
    } else if (newType === 'SHORT' || newType === 'DESCRIPTIVE') {
      setQuestionForm({
        ...questionForm,
        type: newType,
        options: [],
      });
    } else {
      // MCQ
      setQuestionForm({
        ...questionForm,
        type: newType,
        options:
          questionForm.options.length >= 2
            ? questionForm.options
            : [
                { label: '', isCorrect: true },
                { label: '', isCorrect: false },
                { label: '', isCorrect: false },
                { label: '', isCorrect: false },
              ],
      });
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.prompt.trim()) {
      setQuestionError('Question prompt is required');
      return;
    }
    if (questionForm.marks <= 0) {
      setQuestionError('Marks must be greater than zero');
      return;
    }

    // Validate options if MCQ or TRUE_FALSE
    if (questionForm.type === 'MCQ_SINGLE' || questionForm.type === 'MCQ_MULTI' || questionForm.type === 'TRUE_FALSE') {
      if (questionForm.options.length < 2) {
        setQuestionError('At least 2 options are required');
        return;
      }
      for (const opt of questionForm.options) {
        if (!opt.label.trim()) {
          setQuestionError('All option labels must be filled out');
          return;
        }
      }
      const hasCorrect = questionForm.options.some((o) => o.isCorrect);
      if (!hasCorrect) {
        setQuestionError('Please designate at least one correct option');
        return;
      }
    }

    setQuestionError(null);
    try {
      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, {
          prompt: questionForm.prompt.trim(),
          type: questionForm.type,
          marks: Number(questionForm.marks),
          position: Number(questionForm.position),
          options: questionForm.options.map((o) => ({ label: o.label.trim(), isCorrect: o.isCorrect })),
        });
      } else {
        await addQuestion({
          prompt: questionForm.prompt.trim(),
          type: questionForm.type,
          marks: Number(questionForm.marks),
          position: Number(questionForm.position),
          options: questionForm.options.map((o) => ({ label: o.label.trim(), isCorrect: o.isCorrect })),
        });
      }
      setQuestionModalOpen(false);
      setSuccessBanner('Question saved successfully');
      setTimeout(() => setSuccessBanner(null), 3500);
    } catch (err: any) {
      setQuestionError(err?.message || 'Failed to save question');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) return;
    try {
      await deleteQuestion(qId);
      setSuccessBanner('Question deleted');
      setTimeout(() => setSuccessBanner(null), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete question');
    }
  };

  const handlePublishExam = async () => {
    if (!confirm('Publish this examination now? Students will be able to view and attempt it.')) return;
    try {
      await publishExam();
      setSuccessBanner('Examination published successfully!');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to publish examination');
    }
  };

  const handleOpenSettings = () => {
    if (!exam) return;
    setSettingsError(null);
    setSettingsForm({
      title: exam.title,
      instructions: exam.instructions || '',
      durationMin: exam.durationMin,
      totalMarks: exam.totalMarks,
      passMarks: exam.passMarks,
      startAt: exam.startAt ? new Date(exam.startAt).toISOString().slice(0, 16) : '',
      endAt: exam.endAt ? new Date(exam.endAt).toISOString().slice(0, 16) : '',
    });
    setSettingsModalOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm.title.trim()) {
      setSettingsError('Title is required');
      return;
    }
    if (settingsForm.totalMarks <= 0) {
      setSettingsError('Total marks must be greater than zero');
      return;
    }
    if (settingsForm.passMarks > settingsForm.totalMarks) {
      setSettingsError('Passing marks cannot exceed total marks');
      return;
    }
    setSettingsError(null);
    try {
      await updateExam({
        title: settingsForm.title.trim(),
        instructions: settingsForm.instructions.trim() || undefined,
        durationMin: Number(settingsForm.durationMin),
        totalMarks: Number(settingsForm.totalMarks),
        passMarks: Number(settingsForm.passMarks),
        startAt: settingsForm.startAt ? new Date(settingsForm.startAt).toISOString() : null,
        endAt: settingsForm.endAt ? new Date(settingsForm.endAt).toISOString() : null,
      });
      setSettingsModalOpen(false);
      setSuccessBanner('Settings updated successfully');
      setTimeout(() => setSuccessBanner(null), 3500);
    } catch (err: any) {
      setSettingsError(err?.message || 'Failed to update exam settings');
    }
  };

  return (
    <TeacherShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/exams"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back to Examinations"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {exam?.type || 'EXAM'}
                </span>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                    exam?.status === 'PUBLISHED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : exam?.status === 'DRAFT'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {exam?.status || 'LOADING'}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
                {exam?.title || 'Loading examination...'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSettings}
              disabled={isLoading || isActionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            >
              <Edit className="w-4 h-4" />
              Settings
            </button>

            <Link
              href={`/teacher/exams/${examId}/results`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shadow-sm"
            >
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              Results & Grading
            </Link>

            {exam?.status === 'DRAFT' && (
              <button
                onClick={handlePublishExam}
                disabled={isActionLoading || (exam?.questions.length || 0) === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                title={
                  (exam?.questions.length || 0) === 0
                    ? 'Add at least one question before publishing'
                    : 'Publish exam to students'
                }
              >
                <Send className="w-4 h-4" />
                Publish Examination
              </button>
            )}
          </div>
        </div>

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
        )}

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

        {/* Examination Metadata Summary Bar */}
        {exam && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Course</div>
                <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                  {exam.courseTitle}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Batch Scope</div>
                <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                  {exam.batchName || 'All Batches'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Duration</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {exam.durationMin} minutes
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Exam Marks</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {exam.totalMarks} marks (Pass: {exam.passMarks})
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Questions Added</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {exam.questions.length} questions
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Marks Allocation</div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${
                    exam.stats.sumQuestionMarks === exam.totalMarks
                      ? 'text-emerald-600'
                      : exam.stats.sumQuestionMarks > exam.totalMarks
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  }`}
                >
                  {exam.stats.sumQuestionMarks} / {exam.totalMarks} pts
                </div>
              </div>
            </div>

            {exam.instructions && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold uppercase text-slate-400">Student Instructions:</span>
                <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{exam.instructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Question Bank Header & Add Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileQuestion className="w-6 h-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">Question Bank</h2>
            <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
              {exam?.questions.length || 0}
            </span>
          </div>
          <button
            onClick={handleOpenAddQuestion}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                <div className="h-16 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Empty Question State */}
        {!isLoading && exam && exam.questions.length === 0 && (
          <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm max-w-md mx-auto">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Questions Yet</h3>
            <p className="text-sm text-slate-500 mb-6">
              Start building your question bank by adding multiple-choice, true/false, or descriptive questions.
            </p>
            <button
              onClick={handleOpenAddQuestion}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add First Question
            </button>
          </div>
        )}

        {/* Question Cards List */}
        {!isLoading && exam && exam.questions.length > 0 && (
          <div className="space-y-4">
            {exam.questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {q.type.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 whitespace-pre-line mt-1">
                        {q.prompt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditQuestion(q)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit Question"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Options (for MCQ & TRUE_FALSE) */}
                {q.options && q.options.length > 0 && (
                  <div className="mt-4 pl-10 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={opt.id || oIdx}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                            opt.isCorrect
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-500">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span>{opt.label}</span>
                          </div>
                          {opt.isCorrect && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              Correct Answer
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit Question Modal */}
        {questionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileQuestion className="w-5 h-5 text-emerald-600" />
                  {editingQuestionId ? 'Edit Question' : 'Add New Question'}
                </h3>
                <button
                  onClick={() => setQuestionModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {questionError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{questionError}</span>
                </div>
              )}

              <form onSubmit={handleSaveQuestion} className="mt-4 space-y-4">
                {/* Question Type & Marks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Question Type</label>
                    <select
                      value={questionForm.type}
                      onChange={(e) => handleQuestionTypeChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="MCQ_SINGLE">Multiple Choice (Single Answer)</option>
                      <option value="MCQ_MULTI">Multiple Choice (Multiple Answers)</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="SHORT">Short Answer</option>
                      <option value="DESCRIPTIVE">Descriptive / Essay Question</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Marks <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={questionForm.marks}
                      onChange={(e) => setQuestionForm({ ...questionForm, marks: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Question Prompt / Text <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={questionForm.prompt}
                    onChange={(e) => setQuestionForm({ ...questionForm, prompt: e.target.value })}
                    placeholder="Enter question prompt here..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Options Manager (for MCQ and TRUE_FALSE) */}
                {(questionForm.type === 'MCQ_SINGLE' ||
                  questionForm.type === 'MCQ_MULTI' ||
                  questionForm.type === 'TRUE_FALSE') && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700">
                        Answer Options & Correct Answer Designation
                      </label>
                      {questionForm.type.startsWith('MCQ') && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuestionForm({
                              ...questionForm,
                              options: [...questionForm.options, { label: '', isCorrect: false }],
                            })
                          }
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Option
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {questionForm.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {/* Radio for single / TrueFalse, Checkbox for multi */}
                          <input
                            type={questionForm.type === 'MCQ_MULTI' ? 'checkbox' : 'radio'}
                            name="correctOption"
                            checked={opt.isCorrect}
                            onChange={(e) => {
                              if (questionForm.type === 'MCQ_MULTI') {
                                const newOpts = [...questionForm.options];
                                newOpts[idx].isCorrect = e.target.checked;
                                setQuestionForm({ ...questionForm, options: newOpts });
                              } else {
                                const newOpts = questionForm.options.map((o, i) => ({
                                  ...o,
                                  isCorrect: i === idx,
                                }));
                                setQuestionForm({ ...questionForm, options: newOpts });
                              }
                            }}
                            className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            title="Mark as correct answer"
                          />

                          <input
                            type="text"
                            required
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...questionForm.options];
                              newOpts[idx].label = e.target.value;
                              setQuestionForm({ ...questionForm, options: newOpts });
                            }}
                            placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />

                          {questionForm.type.startsWith('MCQ') && questionForm.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = questionForm.options.filter((_, i) => i !== idx);
                                setQuestionForm({ ...questionForm, options: newOpts });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              title="Remove option"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setQuestionModalOpen(false)}
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
                    Save Question
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Examination Settings Modal */}
        {settingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Edit className="w-5 h-5 text-emerald-600" />
                  Edit Examination Settings
                </h3>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {settingsError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.title}
                    onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Min)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={settingsForm.durationMin}
                      onChange={(e) => setSettingsForm({ ...settingsForm, durationMin: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Marks</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={settingsForm.totalMarks}
                      onChange={(e) => setSettingsForm({ ...settingsForm, totalMarks: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pass Marks</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={settingsForm.passMarks}
                      onChange={(e) => setSettingsForm({ ...settingsForm, passMarks: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start Window</label>
                    <input
                      type="datetime-local"
                      value={settingsForm.startAt}
                      onChange={(e) => setSettingsForm({ ...settingsForm, startAt: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">End Window</label>
                    <input
                      type="datetime-local"
                      value={settingsForm.endAt}
                      onChange={(e) => setSettingsForm({ ...settingsForm, endAt: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Instructions</label>
                  <textarea
                    rows={3}
                    value={settingsForm.instructions}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instructions: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(false)}
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
                    Save Changes
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
