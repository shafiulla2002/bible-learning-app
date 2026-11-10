'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TeacherBatchItem {
  id: string;
  name: string;
  code: string | null;
  status: string;
  startDate: string;
  endDate: string;
  capacity: number;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  termName: string | null;
  academicYearName: string | null;
  assignedRole: string;
  activeStudentsCount: number;
  nextLiveSession: {
    id: string;
    title: string;
    startsAt: string;
  } | null;
}

export interface TeacherBatchesMetrics {
  totalAssignedBatches: number;
  activeBatches: number;
  totalStudents: number;
  associatedCoursesCount: number;
}

export function useTeacherBatches() {
  const [batches, setBatches] = useState<TeacherBatchItem[]>([]);
  const [metrics, setMetrics] = useState<TeacherBatchesMetrics>({
    totalAssignedBatches: 0,
    activeBatches: 0,
    totalStudents: 0,
    associatedCoursesCount: 0,
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status && status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/teachers/batches?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success) {
        setBatches(json.data || []);
        if (json.metrics) {
          setMetrics(json.metrics);
        }
      } else {
        throw new Error(json.error || 'Failed to fetch assigned batches');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading batches');
    } finally {
      setIsLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  return {
    batches,
    metrics,
    search,
    setSearch,
    status,
    setStatus,
    isLoading,
    error,
    refresh: fetchBatches,
  };
}

export interface TeacherBatchDetail {
  batch: {
    id: string;
    name: string;
    code: string | null;
    status: string;
    startDate: string;
    endDate: string;
    capacity: number;
    termName: string | null;
    academicYearName: string | null;
    assignedRole: string;
    course: {
      id: string;
      title: string;
      slug: string;
      code: string | null;
      level: string;
      description: string | null;
    };
  };
  faculty: Array<{
    teacherProfileId: string;
    fullName: string;
    email: string;
    employeeCode: string | null;
    photoUrl: string | null;
    role: string;
  }>;
  students: Array<{
    id: string;
    enrolmentId: string;
    fullName: string;
    email: string;
    phone: string | null;
    admissionNo: string;
    photoUrl: string | null;
    status: string;
    progressPct: number;
    enrolledAt: string;
    attendance: {
      present: number;
      total: number;
      ratePct: number | null;
    };
  }>;
  stats: {
    totalEnrolled: number;
    activeEnrolled: number;
    totalFaculty: number;
    totalAttendanceSessions: number;
    averageAttendancePct: number;
    totalAssignments: number;
    totalExams: number;
  };
  liveSessions: Array<{
    id: string;
    title: string;
    description: string | null;
    room: string | null;
    startsAt: string;
    endsAt: string;
    status: string;
    joinUrl: string | null;
    instructorName: string | null;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    totalMarks: number;
    status: string;
    submissionsCount: number;
  }>;
  exams: Array<{
    id: string;
    title: string;
    duration: number;
    totalMarks: number;
    passMarks: number;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    attemptsCount: number;
  }>;
}

export function useTeacherBatchDetail(batchId: string) {
  const [data, setData] = useState<TeacherBatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!batchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teachers/batches/${batchId}`, {
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
        throw new Error(json.error || 'Failed to fetch batch details');
      }
    } catch (err: any) {
      setError(err?.message || 'Error loading batch detail');
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchDetail,
  };
}
