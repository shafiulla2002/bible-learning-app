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
      setData(null);

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

  return {
    student: data?.student ?? null,
    profile: data?.profile ?? null,
    institute: data?.institute ?? null,
    activeEnrolmentCount: data?.activeEnrolmentCount ?? 0,
    isLoading,
    isAuthenticated: !!data,
    error,
    refresh: fetchStudentContext,
    logout,
  };
}

