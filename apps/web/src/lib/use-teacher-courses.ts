'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetchSwr, getStaleCached, resolveApiUrl } from '@/lib/api';

export interface TeacherCourseItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  level: string;
  language: string;
  pricing: string;
  price: number;
  salePrice: number | null;
  status: string;
  category: string;
  categoryId: string | null;
  role: string;
  batchCount: number;
  studentCount: number;
  assignedBatches?: { id: string; name: string; studentCount: number }[];
  curriculumStats: {
    moduleCount: number;
    chapterCount: number;
    lessonCount: number;
    resourceCount: number;
    totalDurationMinutes: number;
  };
  updatedAt: string;
}

export function useTeacherCourses(initialLimit = 12) {
  const [courses, setCourses] = useState<TeacherCourseItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async (forceRefresh = false) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', limit.toString());
    if (search.trim()) params.set('search', search.trim());
    if (status && status !== 'ALL') params.set('status', status);
    const endpoint = `/teachers/courses?${params.toString()}`;

    const cached = !forceRefresh ? getStaleCached<any>(resolveApiUrl(endpoint)) : null;
    if (cached?.data?.success) {
      setCourses(cached.data.data || []);
      if (cached.data.meta) {
        setTotalCount(cached.data.meta.total || 0);
        setTotalPages(cached.data.meta.totalPages || 1);
      }
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const json = await apiFetchSwr<any>(endpoint, {
        ttlMs: 45000,
        bypassCache: forceRefresh,
        onRevalidate: (fresh) => {
          if (fresh?.success) {
            setCourses(fresh.data || []);
            if (fresh.meta) {
              setTotalCount(fresh.meta.total || 0);
              setTotalPages(fresh.meta.totalPages || 1);
            }
          }
        },
      });
      if (json.success) {
        setCourses(json.data || []);
        if (json.meta) {
          setTotalCount(json.meta.total || 0);
          setTotalPages(json.meta.totalPages || 1);
        }
      } else {
        throw new Error(json.error || 'Failed to fetch assigned courses');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading courses');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, status]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return {
    courses,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    status,
    isLoading,
    error,
    setPage,
    setLimit,
    setSearch,
    setStatus,
    refresh: fetchCourses,
  };
}
