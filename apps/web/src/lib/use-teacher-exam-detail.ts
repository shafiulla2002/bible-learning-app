'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchResponse } from '@/lib/api';

export interface ExamQuestionOption {
  id?: string;
  label: string;
  isCorrect: boolean;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  type: string;
  marks: number;
  position: number;
  options: ExamQuestionOption[];
}

export interface ExamDetail {
  id: string;
  title: string;
  instructions: string | null;
  type: string;
  durationMin: number;
  totalMarks: number;
  passMarks: number;
  status: string;
  startAt: string | null;
  endAt: string | null;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string;
  createdAt: string;
  updatedAt: string;
  questions: ExamQuestion[];
  stats: {
    totalQuestions: number;
    sumQuestionMarks: number;
    totalAttempts: number;
    pendingEvaluations: number;
    evaluatedCount: number;
  };
}

export function useTeacherExamDetail(examId: string) {
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchExam = useCallback(async () => {
    if (!examId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetchResponse(`/teachers/exams/${examId}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setExam(json.data);
      } else {
        throw new Error(json.error || 'Failed to fetch examination');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading examination');
    } finally {
      setIsLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  const publishExam = async () => {
    setIsActionLoading(true);
    try {
      const res = await apiFetchResponse(`/teachers/exams/${examId}/publish`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to publish examination');
      }
      await fetchExam();
      return json;
    } finally {
      setIsActionLoading(false);
    }
  };

  const updateExam = async (payload: {
    title?: string;
    instructions?: string;
    durationMin?: number;
    totalMarks?: number;
    passMarks?: number;
    status?: string;
    startAt?: string | null;
    endAt?: string | null;
  }) => {
    setIsActionLoading(true);
    try {
      const res = await apiFetchResponse(`/teachers/exams/${examId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update examination');
      }
      await fetchExam();
      return json;
    } finally {
      setIsActionLoading(false);
    }
  };

  const addQuestion = async (payload: {
    prompt: string;
    type: string;
    marks: number;
    position?: number;
    options?: { label: string; isCorrect: boolean }[];
  }) => {
    setIsActionLoading(true);
    try {
      const res = await apiFetchResponse(`/teachers/exams/${examId}/questions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to add question');
      }
      await fetchExam();
      return json.data;
    } finally {
      setIsActionLoading(false);
    }
  };

  const updateQuestion = async (
    questionId: string,
    payload: {
      prompt?: string;
      type?: string;
      marks?: number;
      position?: number;
      options?: { label: string; isCorrect: boolean }[];
    }
  ) => {
    setIsActionLoading(true);
    try {
      const res = await apiFetchResponse(`/teachers/exams/${examId}/questions/${questionId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to update question');
      }
      await fetchExam();
      return json.data;
    } finally {
      setIsActionLoading(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    setIsActionLoading(true);
    try {
      const res = await apiFetchResponse(`/teachers/exams/${examId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete question');
      }
      await fetchExam();
      return json;
    } finally {
      setIsActionLoading(false);
    }
  };

  return {
    exam,
    isLoading,
    error,
    isActionLoading,
    refresh: fetchExam,
    publishExam,
    updateExam,
    addQuestion,
    updateQuestion,
    deleteQuestion,
  };
}
