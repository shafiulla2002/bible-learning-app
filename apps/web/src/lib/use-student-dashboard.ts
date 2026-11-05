'use client';

import { useState, useEffect, useCallback } from 'react';
import { useStudentAuth } from './use-student-auth';

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
    slug: string;
    coverImage: string | null;
    category: string;
    instructorName: string;
    completedLessons: number;
    totalLessons: number;
    progressPct: number;
    batchName: string | null;
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
    room: string | null;
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
  const { student, profile, institute } = useStudentAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = student?.id && institute?.id
    ? `bible_lms_student_dashboard_${institute.id}_${student.id}`
    : 'bible_lms_student_dashboard_default';

  const fetchDashboard = useCallback(async (ignoreCache = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check client-side cached data first if not ignoring cache
      if (!ignoreCache && typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.timestamp && Date.now() - parsed.timestamp < 30000) {
              setData(parsed.data);
              setIsLoading(false);
              return;
            }
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (typeof window !== 'undefined') {
        const storedToken =
          localStorage.getItem('token') ||
          localStorage.getItem('access_token') ||
          localStorage.getItem('auth_token');
        if (storedToken) {
          headers['Authorization'] = `Bearer ${storedToken}`;
        }
      }

      if (profile?.studentProfileId) {
        headers['x-dev-user-id'] = student?.id || '';
        headers['x-dev-role'] = 'STUDENT';
        headers['x-dev-institute-id'] = institute?.id || '';
      }

      const response = await fetch('/api/students/dashboard', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch dashboard (${response.status})`);
      }

      const json = await response.json();
      setData(json);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ data: json, timestamp: Date.now() })
        );
      }
    } catch (err: any) {
      console.error('Error fetching student dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, institute?.id, profile?.studentProfileId, student?.id]);

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
