/**
 * Bible Institute LMS - API Client
 * Centralized API client supporting both real API requests and seamless fallback
 * to demo mock data when running in detached/prototype preview mode.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiFetchOptions extends RequestInit {
  token?: string;
  instituteId?: string;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, instituteId, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const response = await fetch(url, {
    ...rest,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorMessage = errJson.message || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// BATCHES & ACADEMIC SERVICES
// -----------------------------------------------------------------------------

export interface AcademicYearDto {
  id: string;
  instituteId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms?: AcademicTermDto[];
}

export interface AcademicTermDto {
  id: string;
  instituteId: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface BatchDto {
  id: string;
  instituteId: string;
  courseId: string;
  name: string;
  code: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
  startDate: string;
  endDate: string;
  capacity: number;
  academicYearId?: string | null;
  termId?: string | null;
  course?: {
    id: string;
    title: string;
    slug: string;
  };
  academicYear?: {
    id: string;
    name: string;
    isCurrent: boolean;
  } | null;
  academicTerm?: {
    id: string;
    name: string;
    isCurrent: boolean;
  } | null;
  _count?: {
    enrolments: number;
    teachers: number;
    liveSessions: number;
  };
}

export const batchApi = {
  // Academic Years
  getAcademicYears: (instituteId: string) =>
    apiFetch<AcademicYearDto[]>(`/institutes/${instituteId}/academic-years`),

  createAcademicYear: (instituteId: string, data: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
    apiFetch<AcademicYearDto>(`/institutes/${instituteId}/academic-years`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setCurrentAcademicYear: (instituteId: string, yearId: string) =>
    apiFetch<AcademicYearDto>(`/institutes/${instituteId}/academic-years/${yearId}/set-current`, {
      method: 'PATCH',
    }),

  // Academic Terms
  getAcademicTerms: (instituteId: string, academicYearId?: string) =>
    apiFetch<AcademicTermDto[]>(
      `/institutes/${instituteId}/academic-terms${academicYearId ? `?academicYearId=${academicYearId}` : ''}`,
    ),

  createAcademicTerm: (instituteId: string, data: { academicYearId: string; name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
    apiFetch<AcademicTermDto>(`/institutes/${instituteId}/academic-terms`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setCurrentAcademicTerm: (instituteId: string, termId: string) =>
    apiFetch<AcademicTermDto>(`/institutes/${instituteId}/academic-terms/${termId}/set-current`, {
      method: 'PATCH',
    }),

  // Batches
  getBatches: (instituteId: string, query?: { status?: string; academicYearId?: string; termId?: string; courseId?: string }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.academicYearId) params.set('academicYearId', query.academicYearId);
    if (query?.termId) params.set('termId', query.termId);
    if (query?.courseId) params.set('courseId', query.courseId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<BatchDto[]>(`/institutes/${instituteId}/batches${qs}`);
  },

  getBatch: (instituteId: string, batchId: string) =>
    apiFetch<any>(`/institutes/${instituteId}/batches/${batchId}`),

  createBatch: (instituteId: string, data: {
    courseId: string;
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    capacity: number;
    academicYearId?: string;
    termId?: string;
  }) =>
    apiFetch<BatchDto>(`/institutes/${instituteId}/batches`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBatch: (instituteId: string, batchId: string, data: any) =>
    apiFetch<BatchDto>(`/institutes/${instituteId}/batches/${batchId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Student Enrolment & Transfer
  enrollStudent: (instituteId: string, batchId: string, studentProfileId: string) =>
    apiFetch<any>(`/institutes/${instituteId}/batches/${batchId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ studentProfileId }),
    }),

  transferStudent: (instituteId: string, sourceBatchId: string, data: {
    studentProfileId: string;
    targetBatchId: string;
    reason?: string;
  }) =>
    apiFetch<any>(`/institutes/${instituteId}/batches/${sourceBatchId}/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Faculty Assignment
  assignTeacher: (instituteId: string, batchId: string, data: { teacherProfileId: string; role?: 'PRIMARY' | 'ASSISTANT' | 'GUEST' }) =>
    apiFetch<any>(`/institutes/${instituteId}/batches/${batchId}/teachers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeTeacher: (instituteId: string, batchId: string, teacherProfileId: string) =>
    apiFetch<any>(`/institutes/${instituteId}/batches/${batchId}/teachers/${teacherProfileId}`, {
      method: 'DELETE',
    }),

  // Timetable Scheduling
  createSchedule: (instituteId: string, data: {
    batchId: string;
    teacherProfileId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    room?: string;
    description?: string;
    joinUrl?: string;
  }) =>
    apiFetch<any>(`/institutes/${instituteId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateRecurringWeeklySchedule: (instituteId: string, data: {
    batchId: string;
    teacherProfileId: string;
    title: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    room?: string;
    exceptions?: string[];
  }) =>
    apiFetch<any>(`/institutes/${instituteId}/schedules/recurring`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  checkConflict: (instituteId: string, data: {
    teacherProfileId?: string;
    room?: string;
    batchId?: string;
    startsAt: string;
    endsAt: string;
    excludeSessionId?: string;
  }) =>
    apiFetch<{ hasConflict: boolean; conflicts: any[] }>(`/institutes/${instituteId}/schedules/check-conflict`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
