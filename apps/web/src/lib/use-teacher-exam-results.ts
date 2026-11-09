'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ExamResultItem {
  studentProfileId: string;
  admissionNo: string;
  studentName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  batchName: string;
  attemptId: string | null;
  attemptStatus: string;
  evaluationStatus: 'NOT_ATTEMPTED' | 'IN_PROGRESS' | 'PENDING_EVALUATION' | 'EVALUATED';
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  totalMarks: number;
  passMarks: number;
  percentage: number | null;
  passed: boolean | null;
  feedback: string | null;
}

export interface ExamResultsData {
  exam: {
    id: string;
    title: string;
    courseId: string;
    courseTitle: string;
    batchId: string | null;
    batchName: string;
    totalMarks: number;
    passMarks: number;
    durationMin: number;
  };
  summary: {
    totalStudents: number;
    attemptedCount: number;
    evaluatedCount: number;
    pendingEvaluationCount: number;
    passedCount: number;
    passRate: number;
  };
  results: ExamResultItem[];
}

export interface AttemptAnswerItem {
  questionId: string;
  prompt: string;
  type: string;
  maxMarks: number;
  chosenText: string | null;
  scoreAwarded: number | null;
  feedback: string | null;
  options: { id: string; label: string; isCorrect: boolean }[];
}

export interface AttemptDetailData {
  id: string;
  examId: string;
  studentName: string;
  admissionNo: string;
  email: string;
  avatarUrl: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  status: string;
  score: number | null;
  totalMarks: number;
  passMarks: number;
  feedback: string | null;
  answers: AttemptAnswerItem[];
}

export function useTeacherExamResults(examId: string) {
  const [data, setData] = useState<ExamResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/teachers/exams/${examId}/results?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Failed to fetch examination results');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading examination results');
    } finally {
      setIsLoading(false);
    }
  }, [examId, statusFilter, search]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const fetchAttempt = async (attemptId: string): Promise<AttemptDetailData> => {
    const res = await fetch(`/api/teachers/exams/${examId}/attempts/${attemptId}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to fetch student attempt');
    }
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to fetch student attempt');
    }
    return json.data;
  };

  const evaluateAttempt = async (
    attemptId: string,
    payload: {
      score: number;
      feedback?: string;
      answers?: { questionId: string; score: number; feedback?: string }[];
    }
  ) => {
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/teachers/exams/${examId}/attempts/${attemptId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit evaluation');
      }

      await fetchResults();
      return json.data;
    } finally {
      setIsActionLoading(false);
    }
  };

  return {
    data,
    isLoading,
    error,
    statusFilter,
    search,
    isActionLoading,
    setStatusFilter,
    setSearch,
    refresh: fetchResults,
    fetchAttempt,
    evaluateAttempt,
  };
}
