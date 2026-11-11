'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetchResponse, clearCache } from './api';

export interface TeacherAuthData {
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
    bio?: string | null;
    photoUrl: string | null;
    status: string;
  };
  institute: {
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
  };
  stats: {
    assignedBatchesCount: number;
    assignedCoursesCount: number;
    assignedStudentsCount: number;
  };
}

export interface UseTeacherAuthOptions {
  requireAuth?: boolean;
  redirectTo?: string;
}

export function useTeacherAuth(
  options: UseTeacherAuthOptions = { requireAuth: true, redirectTo: '/login' }
) {
  const router = useRouter();
  const [data, setData] = useState<TeacherAuthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_teacher_profile_id');
        localStorage.removeItem('current_student_profile_id');
        localStorage.removeItem('current_institute_id');
        sessionStorage.clear();
      } catch (e) {
        console.warn('localStorage clear note:', e);
      }

      try {
        // Clear authentication cookies across domain and security flags
        const cookieKeys = ['auth_token', 'token', 'access_token'];
        cookieKeys.forEach((key) => {
          document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
          document.cookie = `${key}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
        });
      } catch (e) {
        console.warn('cookie clear note:', e);
      }

      try {
        clearCache();
      } catch (e) {}

      // Server-side cookie clear request
      try {
        apiFetchResponse('/auth/logout', { method: 'POST' }).catch(() => null);
      } catch {}

      const target = options.redirectTo || '/login';
      window.location.href = target;
    }
  }, [options.redirectTo]);

  const fetchTeacherContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetchResponse('/teachers/me', { cache: 'no-store' });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Authentication error (${res.status})`);
      }

      const json = await res.json();
      if (json && json.success && json.teacher) {
        setData(json);
        if (typeof window !== 'undefined') {
          localStorage.setItem('current_teacher_profile_id', json.teacher.teacherProfileId);
          localStorage.setItem('current_institute_id', json.institute.id);
        }
      } else {
        throw new Error(json?.message || 'Invalid teacher authentication response');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to authenticate teacher session';
      setError(errMsg);
      setData(null);

      if (options.requireAuth) {
        logout();
      }
    } finally {
      setIsLoading(false);
    }
  }, [options.requireAuth, logout]);

  useEffect(() => {
    fetchTeacherContext();
  }, [fetchTeacherContext]);

  return {
    teacher: data?.teacher || null,
    institute: data?.institute || null,
    stats: data?.stats || { assignedBatchesCount: 0, assignedCoursesCount: 0, assignedStudentsCount: 0 },
    isLoading,
    isAuthenticated: !!data,
    error,
    logout,
    refresh: fetchTeacherContext,
  };
}

