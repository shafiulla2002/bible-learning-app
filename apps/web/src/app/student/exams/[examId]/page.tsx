'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import { apiFetchResponse } from '@/lib/api';
import {
  ArrowLeft,
  GraduationCap,
  Clock,
  Award,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Play,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';

interface ExamDetailData {
  id: string;
  title: string;
  type: string;
  courseId: string;
  courseTitle: string;
  instructorName: string;
  durationMin: number;
  totalMarks: number;
  passMarks: number;
  totalQuestions: number;
  activeAttemptId: string | null;
}

export default function StudentExamInstructionsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();
  const { logout } = useStudentAuth({ requireAuth: true, redirectTo: '/login' });

  const [exam, setExam] = useState<ExamDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState<boolean>(false);

  useEffect(() => {
    async function fetchDetail() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await apiFetchResponse(`/students/exams/${examId}`);
        if (res.status === 401 || res.status === 403) {
          logout();
          return;
        }
        if (!res.ok) throw new Error(`Failed to load examination (${res.status})`);
        const json = await res.json();
        setExam(json.exam);
      } catch (err: any) {
        console.error('Failed to load exam details:', err?.message || err);
        setExam(null);
        setError(err?.message || 'Unable to load examination');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDetail();
  }, [examId]);

  const handleStartExam = async () => {
    try {
      setIsStarting(true);
      const res = await apiFetchResponse(`/students/exams/${examId}/start`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to start examination');
      }

      const data = await res.json();
      router.push(`/student/exams/${examId}/attempt/${data.attemptId}`);
    } catch (err: any) {
      alert(err.message);
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <StudentShell pageTitle="Examination">
        <div className="p-8 text-center text-xs text-slate-400">Loading examination instructions...</div>
      </StudentShell>
    );
  }

  if (!exam) {
    return (
      <StudentShell pageTitle="Examination">
        <div className="p-8 text-center text-sm text-slate-600">Examination not found</div>
      </StudentShell>
    );
  }

  return (
    <StudentShell pageTitle="Examination Instructions">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/student/exams"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Examinations Catalog
        </Link>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
            <BookOpen size={14} />
            {exam.courseTitle}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-4">
            {exam.title}
          </h1>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 mb-6 text-center">
            <div>
              <div className="text-xs text-slate-500 font-medium">Duration</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{exam.durationMin} mins</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Marks</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{exam.totalMarks} pts</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Passing Marks</div>
              <div className="text-lg font-bold text-emerald-600 mt-0.5">{exam.passMarks} pts</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Questions</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{exam.totalQuestions}</div>
            </div>
          </div>

          {/* Instructions List */}
          <div className="space-y-4 pb-6 border-b border-slate-100 text-xs text-slate-600 leading-relaxed">
            <h3 className="text-sm font-bold text-slate-900">Official Instructions & Exam Rules</h3>
            <ul className="space-y-2.5 list-disc pl-5">
              <li>
                <strong>Server-Authoritative Countdown:</strong> The countdown timer will start immediately upon clicking "Start Examination". The timer is validated by the server and will not pause if you refresh or close your browser.
              </li>
              <li>
                <strong>Automatic Answer Saving:</strong> Your answers are saved automatically each time you select an option and navigate between questions.
              </li>
              <li>
                <strong>Automated Submission:</strong> When time expires, your exam will be automatically submitted with all saved answers.
              </li>
              <li>
                <strong>Single Active Session:</strong> You may only take this assessment from one browser window at a time.
              </li>
              <li>
                <strong>Honor Code:</strong> By proceeding, you certify that all answers submitted will be your own individual theological work without unauthorized assistance.
              </li>
            </ul>
          </div>

          {/* Honor Code Checkbox */}
          <div className="pt-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-700 font-medium">
                I have read and understood the examination rules. I agree to uphold academic integrity and complete this assessment within the allotted {exam.durationMin} minutes.
              </span>
            </label>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleStartExam}
                disabled={!agreed || isStarting}
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={14} className="fill-white" />
                {isStarting ? 'Preparing Assessment...' : exam.activeAttemptId ? 'Resume Examination' : 'Start Examination Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}

