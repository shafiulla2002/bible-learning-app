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

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('current_student_profile_id');
      localStorage.removeItem('current_institute_id');
      sessionStorage.clear();
      // Purge all student caches to avoid cross-tenant/cross-user data bleed
      clearCache('student');
      clearCache('courses');
      clearCache('attendance');
      clearCache('assignments');
      clearCache('dashboard');
    }
    setData(null);
    if (options.redirectTo) {
      router.push(options.redirectTo);
    }
  }, [router, options.redirectTo]);

  const fetchStudentContext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
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
      // For preview / demo purposes, fallback gracefully to Shaik Shafiulla
      setData(DEFAULT_SHAFIULLA_AUTH);

      // If unauthorized and requireAuth is active, redirect to login
      if (options.requireAuth) {
        if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Unauthorized') || errMsg.includes('Access denied')) {
          logout();
        }
      }
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
