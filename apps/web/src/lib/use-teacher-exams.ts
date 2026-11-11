'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchResponse } from '@/lib/api';

export interface TeacherExamItem {
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
  questionCount: number;
  totalAttempts: number;
  pendingEvaluations: number;
  evaluatedCount: number;
  averageScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamMetrics {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
  completed: number;
  totalAttempts: number;
  pendingEvaluations: number;
  avgScore: number;
}

export function useTeacherExams(initialLimit = 10) {
  const [exams, setExams] = useState<TeacherExamItem[]>([]);
  const [metrics, setMetrics] = useState<ExamMetrics>({
    total: 0,
    published: 0,
    draft: 0,
    scheduled: 0,
    completed: 0,
    totalAttempts: 0,
    pendingEvaluations: 0,
    avgScore: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('ALL');
  const [batchId, setBatchId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (courseId && courseId !== 'ALL') params.set('courseId', courseId);
      if (batchId && batchId !== 'ALL') params.set('batchId', batchId);
      if (status && status !== 'ALL') params.set('status', status);

      const res = await apiFetchResponse(`/teachers/exams?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setExams(json.data || []);
        if (json.metrics) {
          setMetrics(json.metrics);
        }
        if (json.meta) {
          setTotalCount(json.meta.total || 0);
          setTotalPages(json.meta.totalPages || 1);
        }
      } else {
        throw new Error(json.error || 'Failed to fetch examinations');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading examinations');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, courseId, batchId, status]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const createExam = async (payload: {
    courseId: string;
    batchId?: string;
    title: string;
    instructions?: string;
    type?: string;
    durationMin: number;
    totalMarks: number;
    passMarks: number;
    startAt?: string;
    endAt?: string;
    status?: string;
  }) => {
    const res = await apiFetchResponse('/teachers/exams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to create examination');
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Failed to create examination');
    }

    await fetchExams();
    return json.data;
  };

  return {
    exams,
    metrics,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    courseId,
    batchId,
    status,
    isLoading,
    error,
    setPage,
    setLimit,
    setSearch,
    setCourseId,
    setBatchId,
    setStatus,
    refresh: fetchExams,
    createExam,
  };
}
