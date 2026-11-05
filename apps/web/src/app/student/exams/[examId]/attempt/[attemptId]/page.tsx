'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/lib/use-student-auth';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Flag,
  ArrowLeft,
  ArrowRight,
  Send,
  Save,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';

interface QuestionOption {
  id: string;
  label: string;
}

interface ExamQuestion {
  id: string;
  number: number;
  prompt: string;
  type: string;
  marks: number;
  options: QuestionOption[];
  savedAnswer: string | null;
}

interface AttemptData {
  id: string;
  examId: string;
  examTitle: string;
  durationMin: number;
  totalMarks: number;
  startedAt: string;
  status: string;
  remainingSec: number;
  isExpired: boolean;
}

export default function StudentExamPlayerPage({
  params,
}: {
  params: Promise<{ examId: string; attemptId: string }>;
}) {
  const { examId, attemptId } = use(params);
  const router = useRouter();
  const { student, profile, institute } = useStudentAuth();

  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load attempt and questions
  useEffect(() => {
    async function fetchAttempt() {
      try {
        setIsLoading(true);
        const headers: Record<string, string> = {};
        if (typeof window !== 'undefined') {
          const token =
            localStorage.getItem('token') ||
            localStorage.getItem('access_token') ||
            localStorage.getItem('auth_token');
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }

        if (profile?.studentProfileId) {
          headers['x-dev-user-id'] = student?.id || '';
          headers['x-dev-role'] = 'STUDENT';
          headers['x-dev-institute-id'] = institute?.id || '';
        }

        const res = await fetch(`/api/students/exams/${examId}/attempts/${attemptId}`, { headers });
        if (!res.ok) throw new Error('Failed to load exam attempt');
        const data = await res.json();

        setAttempt(data.attempt);
        setQuestions(data.questions || []);
        setRemainingSeconds(data.attempt?.remainingSec ?? 1800);

        // Pre-populate saved answers
        const initialAnswers: Record<string, string> = {};
        for (const q of data.questions || []) {
          if (q.savedAnswer) initialAnswers[q.id] = q.savedAnswer;
        }
        setAnswers(initialAnswers);
      } catch (err: any) {
        console.warn('Attempt fallback:', err.message);
        // Fallback mock questions for preview
        const mockQuestions: ExamQuestion[] = [
          {
            id: 'q1',
            number: 1,
            prompt: 'Which biblical genre requires distinguishing between normative narrative and descriptive history?',
            type: 'MCQ_SINGLE',
            marks: 5,
            options: [
              { id: 'opt1', label: 'Historical Narrative' },
              { id: 'opt2', label: 'Wisdom Literature' },
              { id: 'opt3', label: 'Apocalyptic Prophecy' },
              { id: 'opt4', label: 'Pauline Epistles' },
            ],
            savedAnswer: null,
          },
          {
            id: 'q2',
            number: 2,
            prompt: 'The grammatical-historical method prioritizes the author original intended meaning over modern reader interpretations.',
            type: 'TRUE_FALSE',
            marks: 5,
            options: [
              { id: 'opt-t', label: 'True' },
              { id: 'opt-f', label: 'False' },
            ],
            savedAnswer: null,
          },
        ];
        setQuestions(mockQuestions);
        setAttempt({
          id: attemptId,
          examId,
          examTitle: 'Mid-Term Examination: Biblical Hermeneutics & Exegesis',
          durationMin: 30,
          totalMarks: 50,
          startedAt: new Date().toISOString(),
          status: 'IN_PROGRESS',
          remainingSec: 1800,
          isExpired: false,
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchAttempt();
  }, [examId, attemptId, profile?.studentProfileId, student?.id, institute?.id]);

  // Server countdown timer
  useEffect(() => {
    if (isLoading || remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading, remainingSeconds]);

  // Answer selection
  const handleSelectAnswer = (questionId: string, value: string) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    // Background auto-save to server
    triggerAutoSave(questionId, value);
  };

  const triggerAutoSave = async (questionId: string, chosen: string) => {
    try {
      setIsSaving(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token =
          localStorage.getItem('token') ||
          localStorage.getItem('access_token') ||
          localStorage.getItem('auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      await fetch(`/api/students/exams/${examId}/attempts/${attemptId}/answers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers: { [questionId]: chosen } }),
      });
    } catch {
      // Background auto-save failure tolerated; final submission syncs all answers
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFlag = (questionId: string) => {
    setFlagged((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleFinalSubmit = async () => {
    try {
      setIsSubmitting(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token =
          localStorage.getItem('token') ||
          localStorage.getItem('access_token') ||
          localStorage.getItem('auth_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      if (profile?.studentProfileId) {
        headers['x-dev-user-id'] = student?.id || '';
        headers['x-dev-role'] = 'STUDENT';
        headers['x-dev-institute-id'] = institute?.id || '';
      }

      const res = await fetch(`/api/students/exams/${examId}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) throw new Error('Submission failed');
      router.push(`/student/exams/${examId}/results`);
    } catch (err: any) {
      alert(err.message);
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    alert('Time has expired! Your examination is being automatically submitted now.');
    handleFinalSubmit();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-xs text-slate-500">
        Loading examination player...
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isTimeCritical = remainingSeconds < 300; // < 5 mins

  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Examination Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div>
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
            Online Examination
          </div>
          <h1 className="text-base font-bold text-slate-900 truncate max-w-md">
            {attempt?.examTitle || 'Theological Examination'}
          </h1>
        </div>

        {/* Timer & Submit CTA */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-black tracking-tight ${
              isTimeCritical
                ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <Clock size={16} />
            <span>
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Send size={14} />
            Submit Exam
          </button>
        </div>
      </header>

      {/* Main Examination Stage */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Question Drawer / Navigator */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm h-fit space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700">Questions Navigator</span>
            <span className="text-xs font-semibold text-blue-600">
              {answeredCount} / {totalCount} Answered
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isFlagged = !!flagged[q.id];
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-xl text-xs font-bold transition-all relative flex items-center justify-center ${
                    isCurrent
                      ? 'ring-2 ring-blue-600 ring-offset-2 bg-blue-600 text-white'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {idx + 1}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" />
              <span>Unanswered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span>Marked for Review</span>
            </div>
          </div>
        </div>

        {/* Center: Active Question Display */}
        {currentQ && (
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              {/* Question Header */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                  Question {currentIndex + 1} of {questions.length}
                </span>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">{currentQ.marks} points</span>
                  <button
                    onClick={() => handleToggleFlag(currentQ.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium transition-all ${
                      flagged[currentQ.id]
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Flag size={12} />
                    {flagged[currentQ.id] ? 'Flagged' : 'Mark for Review'}
                  </button>
                </div>
              </div>

              {/* Question Prompt */}
              <div className="py-6">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                  {currentQ.prompt}
                </h2>
              </div>

              {/* Options */}
              <div className="space-y-3">
                {currentQ.options?.map((opt) => {
                  const isSelected = answers[currentQ.id] === opt.label || answers[currentQ.id] === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleSelectAnswer(currentQ.id, opt.label)}
                      className={`flex items-center gap-3.5 p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-semibold'
                          : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100/70 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQ.id}`}
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs sm:text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={14} />
                Previous Question
              </button>

              <button
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={currentIndex === questions.length - 1}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                Next Question
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Send size={22} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Submit Your Examination?</h3>
              <p className="text-xs text-slate-500">
                You have answered <strong>{answeredCount}</strong> out of <strong>{totalCount}</strong> questions.
                {totalCount - answeredCount > 0 && (
                  <span className="block text-amber-600 font-semibold mt-1">
                    Warning: You have {totalCount - answeredCount} unanswered questions remaining.
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Continue Exam
              </button>

              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

