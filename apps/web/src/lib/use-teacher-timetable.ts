'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchResponse, apiFetchSwr, getStaleCached, resolveApiUrl } from '@/lib/api';
import { AssignedOption } from './use-teacher-live-classes';

export interface TimetableEvent {
  id: string;
  title: string;
  description: string | null;
  room: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  joinUrl: string | null;
  recordingUrl: string | null;
  batchId: string;
  batchName: string;
  courseId: string;
  courseTitle: string;
  courseCode: string | null;
  attendanceCount: number;
  enrolledCount: number;
}

export interface TimetableSummary {
  totalEvents: number;
  upcoming: number;
  live: number;
  completed: number;
}

export type TimetableViewMode = 'day' | 'week' | 'month';

export function useTeacherTimetable() {
  const [events, setEvents] = useState<TimetableEvent[]>([]);
  const [summary, setSummary] = useState<TimetableSummary>({
    totalEvents: 0,
    upcoming: 0,
    live: 0,
    completed: 0,
  });
  const [courses, setCourses] = useState<AssignedOption[]>([]);
  const [batches, setBatches] = useState<AssignedOption[]>([]);

  const [viewMode, setViewMode] = useState<TimetableViewMode>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [courseId, setCourseId] = useState('ALL');
  const [batchId, setBatchId] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calculate start and end date based on viewMode and currentDate
  const getDateRange = useCallback(() => {
    const d = new Date(currentDate);
    let start: Date;
    let end: Date;

    if (viewMode === 'day') {
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    } else if (viewMode === 'month') {
      start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      // Week: Monday to Sunday
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(d.setDate(diff));
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [currentDate, viewMode]);

  const fetchTimetable = useCallback(async (forceRefresh = false) => {
    const { start, end } = getDateRange();
    const params = new URLSearchParams();
    params.set('startDate', start.toISOString());
    params.set('endDate', end.toISOString());
    if (courseId !== 'ALL') params.set('courseId', courseId);
    if (batchId !== 'ALL') params.set('batchId', batchId);
    const endpoint = `/teachers/timetable?${params.toString()}`;

    const cached = !forceRefresh ? getStaleCached<any>(resolveApiUrl(endpoint)) : null;
    if (cached?.data?.success && cached?.data?.data) {
      setEvents(cached.data.data.events || []);
      if (cached.data.data.summary) setSummary(cached.data.data.summary);
      if (cached.data.data.filters) {
        if (cached.data.data.filters.courses) setCourses(cached.data.data.filters.courses);
        if (cached.data.data.filters.batches) setBatches(cached.data.data.filters.batches);
      }
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const json = await apiFetchSwr<any>(endpoint, {
        ttlMs: 30000,
        bypassCache: forceRefresh,
        onRevalidate: (fresh) => {
          if (fresh?.success && fresh?.data) {
            setEvents(fresh.data.events || []);
            if (fresh.data.summary) setSummary(fresh.data.summary);
            if (fresh.data.filters) {
              if (fresh.data.filters.courses) setCourses(fresh.data.filters.courses);
              if (fresh.data.filters.batches) setBatches(fresh.data.filters.batches);
            }
          }
        },
      });
      if (json.success && json.data) {
        setEvents(json.data.events || []);
        if (json.data.summary) setSummary(json.data.summary);
        if (json.data.filters) {
          if (json.data.filters.courses) setCourses(json.data.filters.courses);
          if (json.data.filters.batches) setBatches(json.data.filters.batches);
        }
      } else {
        throw new Error(json.message || 'Failed to fetch timetable');
      }
    } catch (err: any) {
      console.error('fetchTimetable error:', err);
      setError(err.message || 'Failed to load timetable');
    } finally {
      setIsLoading(false);
    }
  }, [getDateRange, courseId, batchId]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToPrevious = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else {
        d.setDate(d.getDate() - 7);
      }
      return d;
    });
  };

  const goToNext = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else {
        d.setDate(d.getDate() + 7);
      }
      return d;
    });
  };

  return {
    events,
    summary,
    courses,
    batches,
    viewMode,
    currentDate,
    courseId,
    batchId,
    isLoading,
    error,
    setViewMode,
    setCurrentDate,
    setCourseId,
    setBatchId,
    goToToday,
    goToPrevious,
    goToNext,
    refresh: () => fetchTimetable(true),
  };
}

