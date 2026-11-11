'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetchResponse, clearCache } from './api';

export interface TeacherScheduleItem {
  id: string;
  title: string;
  courseTitle: string;
  batchName: string;
  batchCode: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  room: string | null;
  joinUrl: string | null;
}

export interface TeacherAssignedBatch {
  id: string;
  name: string;
  code: string | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  courseLevel: string;
  academicYear: string | null;
  term: string | null;
  enrolledStudentsCount: number;
  teacherRole: 'LEAD' | 'ASSISTANT';
  status: string;
}

export interface TeacherPendingAssignment {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  batchId: string | null;
  batchName: string | null;
  batchCode: string | null;
  dueAt: string;
  status: string;
  maxMarks: number;
  submissionCount: number;
  pendingReviewCount: number;
}

export interface TeacherUpcomingEvent {
  id: string;
  title: string;
  eventType: 'LIVE_CLASS' | 'EXAMINATION';
  courseTitle: string;
  batchName: string | null;
  eventDate: string;
  endDate?: string | null;
  status: string;
  room?: string | null;
  joinUrl?: string | null;
  durationMin?: number | null;
}

export interface TeacherAttendanceSummary {
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  totalSessionsMarked: number;
  attendanceRatePct: number;
}

export interface TeacherDashboardData {
  teacher: {
    teacherProfileId: string;
    userId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    employeeCode: string | null;
    qualifications: string | null;
    specialization: string | null;
    experienceYears: number | null;
    photoUrl: string | null;
    status: string;
  };
  institute: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    timezone: string;
  };
  statistics: {
    assignedBatchesCount: number;
    assignedStudentsCount: number;
    instructingCoursesCount: number;
    todayClassesCount: number;
    pendingAssignmentsCount: number;
    attendanceRatePct: number;
    totalAttendanceRecords: number;
  };
  todaySchedule: TeacherScheduleItem[];
  assignedBatches: TeacherAssignedBatch[];
  pendingAssignments: TeacherPendingAssignment[];
  upcomingEvents: TeacherUpcomingEvent[];
  attendanceSummary: TeacherAttendanceSummary;
}

export interface UseTeacherDashboardOptions {
  requireAuth?: boolean;
  redirectTo?: string;
}

export function useTeacherDashboard(
  options: UseTeacherDashboardOptions = { requireAuth: false, redirectTo: '/login' }
) {
  const router = useRouter();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetchResponse('/teachers/dashboard', { cache: 'no-store' });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to load dashboard (${res.status})`);
      }

      const json = await res.json();
      if (json && json.success) {
        setData(json);
      } else {
        throw new Error(json?.message || 'Invalid dashboard response');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to load teacher dashboard data';
      setError(errMsg);
      setData(null);

      if (options.requireAuth && typeof window !== 'undefined') {
        router.push(options.redirectTo || '/login');
      }
    } finally {
      setIsLoading(false);
    }
  }, [options.requireAuth, options.redirectTo, router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    data,
    teacher: data?.teacher || null,
    institute: data?.institute || null,
    statistics: data?.statistics || {
      assignedBatchesCount: 0,
      assignedStudentsCount: 0,
      instructingCoursesCount: 0,
      todayClassesCount: 0,
      pendingAssignmentsCount: 0,
      attendanceRatePct: 0,
      totalAttendanceRecords: 0,
    },
    todaySchedule: data?.todaySchedule || [],
    assignedBatches: data?.assignedBatches || [],
    pendingAssignments: data?.pendingAssignments || [],
    upcomingEvents: data?.upcomingEvents || [],
    attendanceSummary: data?.attendanceSummary || {
      totalRecords: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      totalSessionsMarked: 0,
      attendanceRatePct: 0,
    },
    isLoading,
    error,
    refresh: fetchDashboard,
  };
}

