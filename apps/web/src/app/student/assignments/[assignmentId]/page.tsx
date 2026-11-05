'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentShell } from '@/components/layout/student-shell';
import { useStudentAuth } from '@/lib/use-student-auth';
import {
  ArrowLeft,
  Calendar,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  Send,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

interface AssignmentDetailData {
  id: string;
  title: string;
  instructions: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string | null;
  instructorName: string;
  dueAt: string;
  maxMarks: number;
  status: 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'GRADED' | 'OVERDUE';
  isOverdue: boolean;
  canSubmit: boolean;
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

export default function StudentAssignmentDetailPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = use(params);
  const router = useRouter();
  const { student, profile, institute } = useStudentAuth();

  const [assignment, setAssignment] = useState<AssignmentDetailData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [answerText, setAnswerText] = useState<string>('');
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        setIsLoading(true);
        setError(null);

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

        const res = await fetch(`/api/students/assignments/${assignmentId}`, { headers });
        if (!res.ok) throw new Error(`Failed to load assignment details (${res.status})`);
        const json = await res.json();
        setAssignment(json.assignment);
        if (json.assignment?.submission?.answerText) {
          setAnswerText(json.assignment.submission.answerText);
        }
        if (json.assignment?.submission?.fileUrl) {
          setFileUrl(json.assignment.submission.fileUrl);
        }
      } catch (err: any) {
        console.warn('Assignment detail fallback:', err.message);
        // Fallback demo data
        setAssignment({
          id: assignmentId,
          title: 'Theological Essay: Covenant & Dispensational Frameworks',
          instructions:
            'Submit a 1,500-word critical evaluation comparing Covenant Theology and Progressive Dispensationalism. Cite at least 5 scholarly sources including Herman Bavinck and Geerhardus Vos.',
          courseId: 'c1',
          courseTitle: 'Building Biblical Theology',
          batchId: 'b1',
          batchName: 'Batch 2026-A Diploma',
          instructorName: 'Dr. Mary Thomas',
          dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
          maxMarks: 100,
          status: 'PENDING',
          isOverdue: false,
          canSubmit: true,
          submission: null,
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchDetail();
  }, [assignmentId, profile?.studentProfileId, student?.id, institute?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answerText.trim() && !fileUrl.trim()) {
      alert('Please enter your written answer or provide a document link to submit.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitSuccess(null);

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

      const res = await fetch(`/api/students/assignments/${assignmentId}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answerText, fileUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Submission failed');
      }

      setSubmitSuccess('Your assignment has been submitted successfully to your faculty instructor!');
      // Update local assignment state
      if (assignment) {
        setAssignment({
          ...assignment,
          status: 'SUBMITTED',
          submission: {
            id: 'sub-new',
            submittedAt: new Date().toISOString(),
            answerText,
            fileUrl,
            marksAwarded: null,
            feedback: null,
            status: 'SUBMITTED',
          },
        });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <StudentShell pageTitle="Assignment">
        <div className="p-8 text-center text-xs text-slate-400">Loading assignment...</div>
      </StudentShell>
    );
  }

  if (!assignment) {
    return (
      <StudentShell pageTitle="Assignment">
        <div className="p-8 text-center text-sm text-slate-600">Assignment not found</div>
      </StudentShell>
    );
  }

  const due = new Date(assignment.dueAt);
  const dueFormatted = due.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <StudentShell pageTitle="Assignment Submission">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/student/assignments"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Assignments Catalog
        </Link>

        {/* Main Details Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              {assignment.courseTitle}
            </span>

            {assignment.status === 'GRADED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <CheckCircle2 size={14} />
                Graded
              </span>
            ) : assignment.status === 'SUBMITTED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                <Clock size={14} />
                Submitted • Under Review
              </span>
            ) : assignment.isOverdue ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                <AlertCircle size={14} />
                Overdue
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800">
                <Clock size={14} />
                Pending Submission
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">
            {assignment.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pb-6 border-b border-slate-100">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} className="text-slate-400" />
              Due: <strong className="text-slate-800">{dueFormatted}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Award size={14} className="text-slate-400" />
              Max Marks: <strong className="text-slate-800">{assignment.maxMarks} points</strong>
            </span>
            {assignment.instructorName && (
              <>
                <span>•</span>
                <span>Instructor: <strong className="text-slate-800">{assignment.instructorName}</strong></span>
              </>
            )}
          </div>

          <div className="py-6 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Instructions & Guidelines</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {assignment.instructions}
            </p>
          </div>

          {/* Graded Feedback Card */}
          {assignment.submission?.status === 'GRADED' && (
            <div className="mt-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Award size={18} className="text-emerald-700" />
                  Faculty Evaluation & Marks
                </h4>
                <div className="text-xl font-black text-emerald-800">
                  {assignment.submission.marksAwarded} / {assignment.maxMarks}
                </div>
              </div>

              {assignment.submission.feedback && (
                <div className="mt-2 text-xs text-emerald-900 bg-white/70 p-4 rounded-xl border border-emerald-100">
                  <div className="font-semibold text-emerald-950 mb-1 flex items-center gap-1">
                    <MessageSquare size={14} />
                    Faculty Remarks:
                  </div>
                  {assignment.submission.feedback}
                </div>
              )}
            </div>
          )}

          {/* Submission Form / History */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              {assignment.submission ? 'Your Submitted Work' : 'Submit Your Academic Work'}
            </h3>

            {submitSuccess && (
              <div className="mb-4 p-4 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                {submitSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Written Response / Abstract (Optional if file attached)
                </label>
                <textarea
                  rows={6}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  disabled={!assignment.canSubmit}
                  placeholder="Paste or type your theological essay, analysis, or submission summary here..."
                  className="w-full p-4 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document / Research Paper Link (PDF, DOCX or Google Drive)
                </label>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  disabled={!assignment.canSubmit}
                  placeholder="https://drive.google.com/... or https://storage.bible-lms.com/..."
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              {assignment.canSubmit && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    <Send size={14} />
                    {isSubmitting ? 'Submitting...' : assignment.submission ? 'Update Submission' : 'Submit Assignment'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </StudentShell>
  );
}

