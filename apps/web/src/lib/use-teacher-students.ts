'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetchResponse } from '@/lib/api';

export interface TeacherStudentItem {
  id: string;
  enrolmentId: string;
  studentProfileId: string;
  admissionNo: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  batchId: string;
  batchName: string;
  batchCode: string | null;
  courseId: string;
  courseTitle: string;
  enrolmentStatus: string;
  enrolledAt: string;
}

export interface TeacherAssignedBatchOption {
  id: string;
  name: string;
  code: string | null;
  courseTitle: string;
}

export interface TeacherStudentsResponse {
  success: boolean;
  items: TeacherStudentItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  assignedBatches: TeacherAssignedBatchOption[];
}

export interface UseTeacherStudentsOptions {
  initialBatchId?: string;
  initialStatus?: string;
  initialLimit?: number;
}

export function useTeacherStudents(options: UseTeacherStudentsOptions = {}) {
  const router = useRouter();
  const [items, setItems] = useState<TeacherStudentItem[]>([]);
  const [assignedBatches, setAssignedBatches] = useState<TeacherAssignedBatchOption[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(options.initialLimit || 10);
  const [search, setSearch] = useState<string>('');
  const [batchId, setBatchId] = useState<string>(options.initialBatchId || 'ALL');
  const [status, setStatus] = useState<string>(options.initialStatus || 'ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (batchId && batchId !== 'ALL') params.set('batchId', batchId);
      if (status && status !== 'ALL') params.set('status', status);
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const res = await apiFetchResponse(`/teachers/students?${params.toString()}`);

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Failed to fetch students (${res.status})`);
      }

      const data: TeacherStudentsResponse = await res.json();
      if (data && data.success) {
        setItems(data.items || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        if (data.assignedBatches) {
          setAssignedBatches(data.assignedBatches);
        }
      } else {
        throw new Error('Invalid student roster response');
      }
    } catch (err: any) {
      console.error('Failed to load teacher students:', err);
      setError(err?.message || 'Unable to connect to student records');
      setItems([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [search, batchId, status, page, limit, router]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return {
    items,
    assignedBatches,
    totalCount,
    totalPages,
    page,
    limit,
    search,
    batchId,
    status,
    isLoading,
    error,
    setPage,
    setLimit,
    setSearch,
    setBatchId,
    setStatus,
    refresh: fetchStudents,
  };
}

