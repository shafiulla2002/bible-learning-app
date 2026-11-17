'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStudentAuth } from './use-student-auth';
import { apiFetchSwr, getStaleCached, resolveApiUrl } from './api';

export interface StudentDashboardData {
  student: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
  };
  profile: {
    studentProfileId: string;
    admissionNo: string;
    church: string | null;
    preferredLanguage: string;
    status: string;
  };
  institute: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  statistics: {
    enrolledCoursesCount: number;
    completedCoursesCount: number;
    learningHours: number;
    learningStreak: number;
    xpPoints: string;
    overallProgressPct: number;
  };
  continueLearningCourses: Array<{
    enrolmentId: string;
    courseId: string;
    title: string;
    slug?: string;
    coverImage?: string | null;
    category: string;
    instructorName: string;
    completedLessons: number;
    totalLessons: number;
    progressPct: number;
    batchName?: string | null;
    nextLessonTitle: string;
  }>;
  upcomingLiveClasses: Array<{
    id: string;
    title: string;
    courseName: string;
    instructor: string;
    startsAt: string;
    endsAt: string;
    status: string;
    joinUrl: string | null;
    room?: string | null;
    canJoin: boolean;
  }>;
  calendarEvents: Array<{
    date: string;
    type: 'LIVE_CLASS' | 'ASSIGNMENT' | 'EXAM' | 'ATTENDANCE';
    title: string;
  }>;
  learningProgressChart: {
    overallProgressPct: number;
    categories: Array<{
      name: string;
      percentage: number;
      color: string;
    }>;
  };
}

export function useStudentDashboard() {
  const { logout } = useStudentAuth({ requireAuth: true, redirectTo: '/login' });
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (forceRefresh = false) => {
    try {
      const cached = !forceRefresh
        ? getStaleCached<StudentDashboardData>(resolveApiUrl('/students/dashboard'))
        : null;
      if (cached?.data) {
        setData(cached.data);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const json = await apiFetchSwr<StudentDashboardData>('/students/dashboard', {
        ttlMs: 30000,
        bypassCache: forceRefresh,
        onRevalidate: (fresh) => setData(fresh),
      });
      setData(json);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load dashboard';
      if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized')) {
        logout();
        return;
      }
      setError(msg);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    dashboardData: data,
    isLoading,
    error,
    refresh: () => fetchDashboard(true),
  };
}
