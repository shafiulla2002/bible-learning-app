'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiFetchResponse, clearCache } from './api';

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

const EMPTY_STUDENT_AUTH: StudentAuthContext = {
  student: {
    id: '',
    fullName: '',
    email: null,
    phone: null,
    avatarUrl: null,
  },
  profile: {
    studentProfileId: '',
    admissionNo: '',
    church: null,
    preferredLanguage: 'English',
    status: 'PENDING',
  },
  institute: {
    id: '',
    name: '',
    code: '',
    logoUrl: null,
  },
  activeEnrolmentCount: 0,
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
        apiFetchResponse('/auth/logout', { method: 'POST' }).catch(() => null);
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
      const rawRes = await apiFetchResponse('/students/me', {
        cache: 'no-store',
      });
      if (!rawRes.ok) {
        const errJson = await rawRes.json().catch(() => ({}));
        throw new Error(errJson?.message || `${rawRes.status} Unauthorized`);
      }
      const res: StudentAuthContext = await rawRes.json();

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

      // If unauthorized and requireAuth is active (default), immediately redirect to login
      setData(null);
      if (options.requireAuth !== false) {
        logout();
        return;
      }
    } finally {
      setIsLoading(false);
    }
  }, [options.requireAuth, logout]);

  useEffect(() => {
    fetchStudentContext();
  }, [fetchStudentContext]);

  const resolved = data || EMPTY_STUDENT_AUTH;

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
