'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearCache } from './api';

export interface StudentAuthContext {
  student: {
    id: string;
    fullName: string;
    email: string | null;
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
  activeEnrolmentCount: number;
}

export const DEFAULT_SHAFIULLA_AUTH: StudentAuthContext = {
  student: {
    id: '0b1dd816-4c77-4a7a-9837-22c3627d0bdc',
    fullName: 'Shaik Shafiulla',
    email: 'shaikshafiulla20012@gmail.com',
    phone: '+91 9642402639',
    avatarUrl: null,
  },
  profile: {
    studentProfileId: '6a0ce008-8794-4395-bb24-8562a1bdc561',
    admissionNo: 'ADM-2026-038',
    church: 'Grace Bible Church, Hyderabad',
    preferredLanguage: 'English',
    status: 'ACTIVE',
  },
  institute: {
    id: 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5',
    name: 'Grace Bible Institute',
    code: 'GBI',
    logoUrl: null,
  },
  activeEnrolmentCount: 4,
};

export interface UseStudentAuthOptions {
  requireAuth?: boolean;
  redirectTo?: string;
}

export function useStudentAuth(options: UseStudentAuthOptions = { requireAuth: true, redirectTo: '/login' }) {
  const router = useRouter();
  const [data, setData] = useState<StudentAuthContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user_role');
        localStorage.removeItem('current_student_profile_id');
        localStorage.removeItem('current_teacher_profile_id');
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
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
      } catch {}

      // Always perform hard navigation to /login to flush React state and unmount portals
      const target = options.redirectTo || '/login';
      window.location.href = target;
    }
  }, [options.redirectTo]);

  const fetchStudentContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (typeof window !== 'undefined') {
        const hasToken =
          localStorage.getItem('token') ||
          localStorage.getItem('access_token') ||
          localStorage.getItem('auth_token') ||
          document.cookie.includes('auth_token=');

        if (!hasToken && options.requireAuth) {
          throw new Error('401 Unauthorized: Session terminated');
        }
      }

      const res = await apiFetch<StudentAuthContext>('/students/me', {
        ttlMs: 60000, // 1 min safe cache
      });

      if (res && res.student && res.profile) {
        setData(res);
        if (typeof window !== 'undefined') {
          localStorage.setItem('current_student_profile_id', res.profile.studentProfileId);
          localStorage.setItem('current_institute_id', res.institute.id);
        }
      } else {
        throw new Error('Incomplete student authentication profile');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Authentication error';
      setError(errMsg);

      // If unauthorized and requireAuth is active, immediately redirect to login
      if (options.requireAuth) {
        setData(null);
        logout();
        return;
      }

      // For preview / demo purposes, only fallback gracefully when requireAuth is false
      setData(DEFAULT_SHAFIULLA_AUTH);
    } finally {
      setIsLoading(false);
    }
  }, [options.requireAuth, logout]);

  useEffect(() => {
    fetchStudentContext();
  }, [fetchStudentContext]);

  const resolved = data || DEFAULT_SHAFIULLA_AUTH;

  return {
    student: resolved.student,
    profile: resolved.profile,
    institute: resolved.institute,
    activeEnrolmentCount: resolved.activeEnrolmentCount,
    isLoading,
    isAuthenticated: !!data,
    error,
    logout,
    refresh: fetchStudentContext,
  };
}
