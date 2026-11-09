'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TeacherLiveClassItem {
  id: string;
  title: string;
  description: string | null;
  room: string | null;
  startsAt: string;
  endsAt: string;
  isRecurring: boolean;
  recurrenceRule: string | null;
  joinUrl: string | null;
  recordingUrl: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  courseCode: string | null;
  attendanceCount: number;
  enrolledCount: number;
}

export interface LiveClassMetrics {
  totalScheduled: number;
  classesToday: number;
  upcomingClasses: number;
  ongoingClasses: number;
  completedClasses: number;
  cancelledClasses: number;
  totalAssignedBatches: number;
}

export interface AssignedOption {
  id: string;
  title?: string;
  name?: string;
  code?: string | null;
  courseId?: string;
  courseTitle?: string;
}

export function useTeacherLiveClasses(initialLimit = 10) {
  const [sessions, setSessions] = useState<TeacherLiveClassItem[]>([]);
  const [metrics, setMetrics] = useState<LiveClassMetrics>({
    totalScheduled: 0,
    classesToday: 0,
    upcomingClasses: 0,
    ongoingClasses: 0,
    completedClasses: 0,
    cancelledClasses: 0,
    totalAssignedBatches: 0,
  });
  const [courses, setCourses] = useState<AssignedOption[]>([]);
  const [batches, setBatches] = useState<AssignedOption[]>([]);

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

  const fetchSessions = useCallback(async () => {
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

      const res = await fetch(`/api/teachers/live-classes?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch live classes (${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setSessions(json.data || []);
        if (json.metrics) setMetrics(json.metrics);
        if (json.meta) {
          setTotalCount(json.meta.total || 0);
          setTotalPages(json.meta.totalPages || 1);
        }
        if (json.filters) {
          if (json.filters.courses) setCourses(json.filters.courses);
          if (json.filters.batches) setBatches(json.filters.batches);
        }
      } else {
        throw new Error(json.message || 'Failed to fetch live classes');
      }
    } catch (err: any) {
      console.error('fetchSessions error:', err);
      setError(err.message || 'Failed to load live classes');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, courseId, batchId, status]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const scheduleClass = async (payload: {
    title: string;
    description?: string;
    courseId: string;
    batchId: string;
    startsAt: string;
    endsAt: string;
    joinUrl?: string;
    room?: string;
  }) => {
    try {
      const res = await fetch('/api/teachers/live-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to schedule class (${res.status})`);
      }

      await fetchSessions();
      return json.data;
    } catch (err: any) {
      throw err;
    }
  };

  const cancelClass = async (sessionId: string, reason?: string) => {
    try {
      const res = await fetch(`/api/teachers/live-classes/${sessionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to cancel class (${res.status})`);
      }

      await fetchSessions();
      return json.data;
    } catch (err: any) {
      throw err;
    }
  };

  return {
    sessions,
    metrics,
    courses,
    batches,
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
    scheduleClass,
    cancelClass,
    refresh: fetchSessions,
  };
}

