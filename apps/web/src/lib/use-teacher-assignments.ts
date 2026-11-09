'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TeacherAssignmentItem {
  id: string;
  title: string;
  instructions: string;
  dueAt: string;
  maxMarks: number;
  status: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string;
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  pendingCount: number;
  lateCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useTeacherAssignments(initialLimit = 10) {
  const [assignments, setAssignments] = useState<TeacherAssignmentItem[]>([]);
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

  const fetchAssignments = useCallback(async () => {
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

      const res = await fetch(`/api/teachers/assignments?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setAssignments(json.data || []);
        if (json.meta) {
          setTotalCount(json.meta.total || 0);
          setTotalPages(json.meta.totalPages || 1);
        }
      } else {
        throw new Error(json.error || 'Failed to fetch assignments');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading assignments');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, courseId, batchId, status]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const createAssignment = async (payload: {
    courseId: string;
    batchId?: string;
    title: string;
    instructions: string;
    dueAt: string;
    maxMarks?: number;
    status?: string;
  }) => {
    const res = await fetch('/api/teachers/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to create assignment');
    }

    const json = await res.json();
    await fetchAssignments();
    return json;
  };

  return {
    assignments,
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
    refresh: fetchAssignments,
    createAssignment,
  };
}
