/**
 * Bible Institute LMS - API Client
 * Centralized API client communicating with the central NestJS /api/v1 backend.
 */

export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalhost) {
      return '/api/v1';
    }
  }
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (configured) {
    return configured.endsWith('/api/v1') ? configured : `${configured}/api/v1`;
  }
  if (typeof window !== 'undefined') {
    return 'http://localhost:4000/api/v1';
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000/api/v1';
  }
  return '/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

function readBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface ApiFetchOptions extends RequestInit {
  token?: string;
  instituteId?: string;
  bypassCache?: boolean;
  ttlMs?: number;
}

// In-Flight Promise Deduplication (Phase 2 & 5)
const inFlightRequests = new Map<string, Promise<any>>();

// Fast In-Memory Request Cache with TTL & Scope Isolation (Phase 5 & 7)
const memoryCache = new Map<string, { data: any; expiry: number }>();

export function getCached<T>(key: string): T | null {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

export function setCached<T>(key: string, data: T, ttlMs = 30000): void {
  memoryCache.set(key, { data, expiry: Date.now() + ttlMs });
}

export function clearCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix) || k.includes(prefix)) {
      memoryCache.delete(k);
    }
  }
}

function autoInvalidateOnMutation(endpoint: string) {
  const ep = endpoint.toLowerCase();
  if (ep.includes('/students')) {
    clearCache('students');
    clearCache('dashboard');
  } else if (ep.includes('/courses')) {
    clearCache('courses');
    clearCache('dashboard');
  } else if (ep.includes('/batches')) {
    clearCache('batches');
    clearCache('dashboard');
  } else if (ep.includes('/attendance')) {
    clearCache('attendance');
    clearCache('dashboard');
  } else if (ep.includes('/finance') || ep.includes('/invoices') || ep.includes('/payments')) {
    clearCache('finance');
    clearCache('dashboard');
  } else if (ep.includes('/teachers')) {
    clearCache('teachers');
    clearCache('dashboard');
  } else if (ep.includes('/settings')) {
    clearCache('settings');
  } else if (ep.includes('/notifications')) {
    clearCache('notifications');
  } else {
    clearCache('/institutes');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bible-lms:cache-invalidated', { detail: { endpoint } }));
  }
}

export function resolveApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let normalizedEndpoint = cleanEndpoint;
  if (cleanEndpoint.startsWith('/api/v1')) {
    normalizedEndpoint = cleanEndpoint.slice('/api/v1'.length) || '/';
  } else if (cleanEndpoint.startsWith('/api/')) {
    normalizedEndpoint = cleanEndpoint.slice('/api'.length) || '/';
  }
  return `${resolveApiBaseUrl()}${normalizedEndpoint}`;
}

export async function apiFetchResponse(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = resolveApiUrl(endpoint);
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (!headers['Authorization'] && typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
  }

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrfToken = readBrowserCookie('csrf_token');
    if (csrfToken && !headers['x-csrf-token']) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  return fetch(url, {
    ...options,
    credentials: options.credentials ?? 'include',
    headers,
  });
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, instituteId, bypassCache, ttlMs = 25000, headers: customHeaders, ...rest } = options;
  const method = (rest.method || 'GET').toUpperCase();
  const url = resolveApiUrl(endpoint);

  // 1. GET requests: Check in-memory cache and in-flight deduplication
  if (method === 'GET' && !bypassCache) {
    const cached = getCached<T>(url);
    if (cached !== null) {
      return cached;
    }

    if (inFlightRequests.has(url)) {
      return inFlightRequests.get(url) as Promise<T>;
    }
  }

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

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrfToken = readBrowserCookie('csrf_token');
    if (csrfToken && !headers['x-csrf-token']) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  const executionPromise = (async () => {
    try {
      const response = await fetch(url, {
        ...rest,
        credentials: rest.credentials ?? 'include',
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

      if (response.status === 204) {
        return {} as T;
      }

      const result = await response.json();

      // Cache successful GET responses
      if (method === 'GET' && !bypassCache) {
        setCached(url, result, ttlMs);
      }

      // Auto-invalidate related caches on mutation
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
        autoInvalidateOnMutation(url);
      }

      return result as T;
    } finally {
      if (method === 'GET') {
        inFlightRequests.delete(url);
      }
    }
  })();

  if (method === 'GET' && !bypassCache) {
    inFlightRequests.set(url, executionPromise);
  }

  return executionPromise;
}

function buildCleanQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      searchParams.set(k, String(v));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

// -----------------------------------------------------------------------------
// STUDENT SERVICES
// -----------------------------------------------------------------------------

export interface StudentProfileSummaryDto {
  avatarUrl?: string | null;
  id: string;
  userId: string;
  admissionNo: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  preferredLanguage: string;
  gender?: string;
  church?: string;
  status: 'APPLICANT' | 'APPLIED' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTIVE' | 'INACTIVE' | 'REJECTED' | 'COMPLETED';
  admissionDate: string;
  enrolledCourseName?: string;
  enrolledBatchName?: string;
  totalEnrolments: number;
}

export interface StudentDetailDto extends StudentProfileSummaryDto {
  avatarUrl?: string | null;
  dateOfBirth?: string;
  educationLevel?: string;
  emergencyContact?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  guardian?: {
    name?: string;
    relation?: string;
    phoneNumber?: string;
    email?: string;
  };
  enrolments: Array<{
    id: string;
    courseId: string;
    courseTitle: string;
    batchId?: string;
    batchName?: string;
    status: string;
    progressPct: number;
    enrolledAt: string;
  }>;
  admissionHistory: Array<{
    id: string;
    status: string;
    statement?: string;
    interviewNotes?: string;
    interviewAt?: string;
    createdAt: string;
  }>;
}

export interface PaginatedStudentsDto {
  data: StudentProfileSummaryDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const studentApi = {
  getStudents: (
    instituteId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      courseId?: string;
      batchId?: string;
    },
  ) => {
    const q = buildCleanQueryString(params);
    return apiFetch<PaginatedStudentsDto>(`/institutes/${instituteId}/students${q}`);
  },

  getStudent: (instituteId: string, studentId: string) =>
    apiFetch<StudentDetailDto>(`/institutes/${instituteId}/students/${studentId}`),

  createStudent: (instituteId: string, data: any) =>
    apiFetch<StudentProfileSummaryDto>(`/institutes/${instituteId}/students`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStudent: (instituteId: string, studentId: string, data: any) =>
    apiFetch<StudentDetailDto>(`/institutes/${instituteId}/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateStatus: (instituteId: string, studentId: string, status: string, notes?: string) =>
    apiFetch<{ id: string; status: string; notes?: string }>(
      `/institutes/${instituteId}/students/${studentId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      },
    ),

  enrollStudent: (instituteId: string, studentId: string, courseId: string, batchId?: string) =>
    apiFetch<{ id: string; studentProfileId: string; courseId: string; batchId?: string; status: string }>(
      `/institutes/${instituteId}/students/${studentId}/enrollments`,
      {
        method: 'POST',
        body: JSON.stringify({ courseId, batchId }),
      },
    ),

  bulkImport: (instituteId: string, rows: any[], execute = false) =>
    apiFetch<{ importedCount: number; errors: any[] }>(`/institutes/${instituteId}/students/bulk-import`, {
      method: 'POST',
      body: JSON.stringify({ rows, execute }),
    }),

  deleteStudent: (instituteId: string, studentId: string) =>
    apiFetch<{ success: boolean; message: string; id: string }>(
      `/institutes/${instituteId}/students/${studentId}`,
      {
        method: 'DELETE',
      },
    ),

  getFinanceHistory: (instituteId: string, studentId: string) =>
    apiFetch<any>(`/institutes/${instituteId}/students/${studentId}/finance`),
};

export const admissionsApi = {
  listAdmissions: (
    instituteId: string,
    params?: { status?: string; courseId?: string; search?: string; page?: number; limit?: number },
  ) => {
    const q = buildCleanQueryString(params);
    return apiFetch<{
      data: any[];
      summary: Record<string, number>;
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/institutes/${instituteId}/admissions${q}`);
  },

  getAdmission: (instituteId: string, admissionId: string) =>
    apiFetch<any>(`/institutes/${instituteId}/admissions/${admissionId}`),

  reviewAdmission: (
    instituteId: string,
    admissionId: string,
    data: { status: 'UNDER_REVIEW' | 'INTERVIEW_SCHEDULED'; interviewAt?: string; interviewNotes?: string },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/admissions/${admissionId}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  approveAdmission: (
    instituteId: string,
    admissionId: string,
    data: { batchId?: string; source?: 'PURCHASE' | 'FREE' | 'ADMIN' | 'SCHOLARSHIP'; notes?: string; createFeeInvoice?: boolean },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/admissions/${admissionId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  rejectAdmission: (instituteId: string, admissionId: string, reason: string) =>
    apiFetch<any>(`/institutes/${instituteId}/admissions/${admissionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// -----------------------------------------------------------------------------
// COURSE & CURRICULUM SERVICES
// -----------------------------------------------------------------------------

export interface CourseCategoryDto {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export interface LessonResourceDto {
  id: string;
  title: string;
  kind: string;
  storageKey?: string;
  downloadable?: boolean;
}

export interface LessonDto {
  id: string;
  title: string;
  type: string;
  body?: string | null;
  durationSec?: number;
  isPreview?: boolean;
  isMandatory?: boolean;
  position: number;
  resources?: LessonResourceDto[];
}

export interface ChapterDto {
  id: string;
  title: string;
  position: number;
  lessons: LessonDto[];
}

export interface ModuleDto {
  id: string;
  title: string;
  position: number;
  chapters: ChapterDto[];
}

export interface CourseDto {
  id: string;
  instituteId?: string;
  categoryId: string;
  categoryName?: string;
  category?: CourseCategoryDto;
  title: string;
  slug: string;
  description?: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | string;
  courseType?: 'SELF_PACED' | 'COHORT' | 'LIVE' | 'DIPLOMA' | 'CERTIFICATE';
  learningMode?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  durationLabel?: string;
  eligibility?: string;
  language: string;
  price: number; // in paise
  salePrice?: number;
  registrationFee?: number; // in paise
  accessDays?: number;
  enrollmentStartsAt?: string;
  enrollmentEndsAt?: string;
  requiresApproval?: boolean;
  pricing: 'FREE' | 'PAID' | string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  coverImage?: string | null;
  modules?: ModuleDto[];
  instructors?: Array<{
    id: string;
    courseId: string;
    teacherProfileId: string;
    teacherName: string;
    teacherEmail?: string;
    role: 'LEAD' | 'ASSISTANT';
  }>;
  completionRule?: {
    minProgressPct: number;
    allMandatory: boolean;
    minExamPct: number;
    minAttendancePct: number;
  };
  moduleCount?: number;
  lessonCount?: number;
  durationMinutes?: number;
  leadTeacherName?: string;
  modulesCount?: number;
  lessonsCount?: number;
  enrolledCount?: number;
  updatedAt?: string;
  _count?: {
    enrolments: number;
    batches: number;
    instructors: number;
  };
}

export interface PaginatedCoursesDto {
  data: CourseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const courseApi = {
  getCourses: (
    instituteId: string,
    params?: {
      status?: string;
      categoryId?: string;
      level?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) => {
    const q = buildCleanQueryString(params);
    return apiFetch<PaginatedCoursesDto>(`/institutes/${instituteId}/courses${q}`);
  },

  getCategories: (instituteId: string) =>
    apiFetch<CourseCategoryDto[]>(`/institutes/${instituteId}/courses/categories`),

  createCategory: (instituteId: string, data: { name: string; slug?: string }) =>
    apiFetch<CourseCategoryDto>(`/institutes/${instituteId}/courses/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (instituteId: string, categoryId: string, data: { name?: string; slug?: string }) =>
    apiFetch<CourseCategoryDto>(`/institutes/${instituteId}/courses/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCategory: (instituteId: string, categoryId: string) =>
    apiFetch<{ success: boolean }>(`/institutes/${instituteId}/courses/categories/${categoryId}`, {
      method: 'DELETE',
    }),

  getCourse: (instituteId: string, courseId: string) =>
    apiFetch<CourseDto>(`/institutes/${instituteId}/courses/${courseId}`),

  createCourse: (instituteId: string, data: any) => {
    clearCache(`courses:${instituteId}`);
    return apiFetch<CourseDto>(`/institutes/${instituteId}/courses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCourse: (instituteId: string, courseId: string, data: any) =>
    apiFetch<CourseDto>(`/institutes/${instituteId}/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateStatus: (instituteId: string, courseId: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') =>
    apiFetch<CourseDto>(`/institutes/${instituteId}/courses/${courseId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteCourse: (instituteId: string, courseId: string) =>
    apiFetch<{ success: boolean }>(`/institutes/${instituteId}/courses/${courseId}`, {
      method: 'DELETE',
    }),

  upsertCompletionRule: (
    instituteId: string,
    courseId: string,
    data: { minProgressPct: number; allMandatory: boolean; minExamPct: number; minAttendancePct: number },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/courses/${courseId}/completion-rule`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getCourseEnrolments: (instituteId: string, courseId: string) =>
    apiFetch<
      Array<{
        id: string;
        studentProfileId: string;
        admissionNo: string;
        studentName: string;
        phoneNumber?: string;
        email?: string;
        batchId?: string;
        batchName?: string;
        status: string;
        source: string;
        progressPct: number;
        enrolledAt: string;
      }>
    >(`/institutes/${instituteId}/courses/${courseId}/enrolments`),

  assignInstructor: (
    instituteId: string,
    courseId: string,
    data: { teacherProfileId: string; role: 'LEAD' | 'ASSISTANT' },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/courses/${courseId}/instructors`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeInstructor: (instituteId: string, courseId: string, teacherProfileId: string) =>
    apiFetch<{ success: boolean }>(
      `/institutes/${instituteId}/courses/${courseId}/instructors/${teacherProfileId}`,
      { method: 'DELETE' },
    ),

  createModule: (instituteId: string, courseId: string, data: { title: string; position?: number }) =>
    apiFetch<ModuleDto>(`/institutes/${instituteId}/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateModule: (instituteId: string, courseId: string, moduleId: string, data: { title?: string; position?: number }) =>
    apiFetch<ModuleDto>(`/institutes/${instituteId}/courses/${courseId}/modules/${moduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteModule: (instituteId: string, courseId: string, moduleId: string) =>
    apiFetch<{ success: boolean }>(`/institutes/${instituteId}/courses/${courseId}/modules/${moduleId}`, {
      method: 'DELETE',
    }),

  createChapter: (instituteId: string, courseId: string, moduleId: string, data: { title: string; position?: number }) =>
    apiFetch<ChapterDto>(`/institutes/${instituteId}/courses/${courseId}/modules/${moduleId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateChapter: (instituteId: string, courseId: string, chapterId: string, data: { title?: string; position?: number }) =>
    apiFetch<ChapterDto>(`/institutes/${instituteId}/courses/${courseId}/chapters/${chapterId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteChapter: (instituteId: string, courseId: string, chapterId: string) =>
    apiFetch<{ success: boolean }>(`/institutes/${instituteId}/courses/${courseId}/chapters/${chapterId}`, {
      method: 'DELETE',
    }),

  createLesson: (instituteId: string, courseId: string, chapterId: string, data: any) =>
    apiFetch<LessonDto>(`/institutes/${instituteId}/courses/${courseId}/chapters/${chapterId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLesson: (instituteId: string, courseId: string, lessonId: string, data: any) =>
    apiFetch<LessonDto>(`/institutes/${instituteId}/courses/${courseId}/lessons/${lessonId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteLesson: (instituteId: string, courseId: string, lessonId: string) =>
    apiFetch<{ success: boolean }>(`/institutes/${instituteId}/courses/${courseId}/lessons/${lessonId}`, {
      method: 'DELETE',
    }),

  attachResource: (
    instituteId: string,
    courseId: string,
    lessonId: string,
    data: { kind: 'VIDEO' | 'PDF' | 'AUDIO' | 'IMAGE' | 'FILE'; storageKey: string; mimeType: string; sizeBytes: string; downloadable: boolean },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/courses/${courseId}/lessons/${lessonId}/resources`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateResource: (
    instituteId: string,
    courseId: string,
    resourceId: string,
    data: { downloadable?: boolean; kind?: string },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/courses/${courseId}/resources/${resourceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  removeResource: (instituteId: string, courseId: string, resourceId: string) =>
    apiFetch<{ success: boolean }>(`/institutes/${instituteId}/courses/${courseId}/resources/${resourceId}`, {
      method: 'DELETE',
    }),
};

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
  assignTeacher: (instituteId: string, batchId: string, data: { teacherProfileId: string; role?: 'LEAD' | 'ASSISTANT' }) =>
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

// -----------------------------------------------------------------------------
// ATTENDANCE MANAGEMENT SERVICES (MILESTONE 2.4)
// -----------------------------------------------------------------------------

export interface AttendanceRecordDto {
  id: string;
  date: string;
  studentProfileId: string;
  admissionNo: string;
  studentName: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  mode: 'DAILY_BATCH' | 'LIVE_SESSION';
  remarks?: string | null;
  liveSessionTitle?: string;
  markedAt: string;
  hasBeenEdited?: boolean;
}

export interface AttendanceRosterItemDto {
  studentProfileId: string;
  admissionNo: string;
  fullName: string;
  email?: string;
  phone?: string;
  enrolmentId: string;
  enrolmentStatus: string;
  enrolledAt: string;
  attendanceId?: string;
  status?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  remarks?: string;
  markedAt?: string;
}

export interface AttendanceOverviewDto {
  summary: {
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    attendancePercentage: number | null;
  };
  batches: Array<{
    batchId: string;
    batchName: string;
    courseTitle: string;
    academicYear?: string;
    term?: string;
    totalEnrolled: number;
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    attendancePercentage: number | null;
  }>;
}

export const attendanceApi = {
  // Overview KPIs & batch breakdown
  getOverview: (instituteId: string, params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch<AttendanceOverviewDto>(`/institutes/${instituteId}/attendance/overview${q}`);
  },

  // Paginated attendance records list
  getRecords: (instituteId: string, params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch<{
      data: Array<{
        id: string;
        date: string;
        status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
        mode: string;
        remarks?: string;
        markedAt?: string;
        student: { id: string; admissionNo: string; fullName: string };
        batch: { id: string; name: string };
        course: { title: string };
      }>;
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(`/institutes/${instituteId}/attendance/records${q}`);
  },

  // Batch roster for roll-call marking
  getBatchRoster: (instituteId: string, batchId: string, date: string, liveSessionId?: string) => {
    const params = new URLSearchParams({ date });
    if (liveSessionId) params.append('liveSessionId', liveSessionId);
    return apiFetch<{
      batchId: string;
      batchName: string;
      courseTitle: string;
      date: string;
      mode: 'DAILY_BATCH' | 'LIVE_SESSION';
      liveSessionId?: string;
      totalEnrolled: number;
      markedCount: number;
      roster: AttendanceRosterItemDto[];
    }>(`/institutes/${instituteId}/attendance/batches/${batchId}/roster?${params.toString()}`);
  },

  // Atomic bulk attendance recording
  markBulkAttendance: (instituteId: string, batchId: string, data: {
    date: string;
    mode?: 'DAILY_BATCH' | 'LIVE_SESSION';
    liveSessionId?: string;
    records: Array<{
      studentProfileId: string;
      status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
      remarks?: string;
    }>;
  }) =>
    apiFetch<{
      success: boolean;
      batchId: string;
      date: string;
      mode: string;
      totalSubmitted: number;
      createdCount: number;
      updatedCount: number;
    }>(`/institutes/${instituteId}/attendance/batches/${batchId}/bulk`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Individual record update with audit trail
  updateIndividualAttendance: (instituteId: string, attendanceId: string, data: {
    status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
    remarks?: string;
  }) =>
    apiFetch<any>(`/institutes/${instituteId}/attendance/${attendanceId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Batch attendance history
  getBatchHistory: (instituteId: string, batchId: string, params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch<{
      data: AttendanceRecordDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(`/institutes/${instituteId}/attendance/batches/${batchId}/history${q}`);
  },

  // Student personal attendance history
  getStudentHistory: (instituteId: string, studentProfileId: string, params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch<{
      student: { id: string; admissionNo: string; fullName: string };
      summary: {
        totalSessions: number;
        presentCount: number;
        lateCount: number;
        absentCount: number;
        excusedCount: number;
        attendancePercentage: number | null;
      };
      monthlySummary: Array<{
        month: string;
        present: number;
        late: number;
        absent: number;
        excused: number;
        percentage: number | null;
      }>;
      records: Array<{
        id: string;
        batchName: string;
        date: string;
        status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
        mode: string;
        remarks?: string;
        sessionTitle?: string;
      }>;
    }>(`/institutes/${instituteId}/attendance/students/${studentProfileId}${q}`);
  },

  // Export CSV url
  getExportUrl: (instituteId: string, params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return `${API_BASE_URL}/institutes/${instituteId}/attendance/export${q}`;
  },
};

// -----------------------------------------------------------------------------
// TEACHER & FACULTY SERVICES (Milestone 2.6)
// -----------------------------------------------------------------------------

export interface TeacherSummaryDto {
  photoUrl?: string | null;
  id: string;
  employeeCode?: string | null;
  fullName: string;
  phoneE164: string;
  email?: string | null;
  specialization?: string | null;
  highestDegree?: string | null;
  experienceYears?: number | null;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'ON_LEAVE';
  assignedCoursesCount: number;
  assignedBatchesCount: number;
  joiningDate?: string | null;
  createdAt: string;
}

export interface TeacherDetailDto extends TeacherSummaryDto {
  photoUrl?: string | null;
  bio?: string | null;
  address?: any;
  courses: Array<{
    courseId: string;
    title: string;
    slug: string;
    categoryName?: string;
    role: 'LEAD' | 'ASSISTANT' | 'GUEST';
    assignedAt: string;
  }>;
  batches: Array<{
    batchId: string;
    name: string;
    code: string;
    courseTitle: string;
    role: 'LEAD' | 'ASSISTANT' | 'GUEST';
    batchStatus: string;
    startDate: string;
    endDate: string;
  }>;
  workload: {
    totalCourses: number;
    totalBatches: number;
    upcomingSessionsCount: number;
    weeklyScheduledHours: number;
    sessionsThisWeek: Array<{
      id: string;
      batchId: string;
      batchName: string;
      title: string;
      startsAt: string;
      endsAt: string;
      status: string;
      durationMinutes: number;
    }>;
  };
}

export const teacherApi = {
  getTeachers: (instituteId: string, params?: Record<string, any>) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch<{
      data: TeacherSummaryDto[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(`/institutes/${instituteId}/teachers${q}`);
  },

  getTeacher: (instituteId: string, teacherId: string) => {
    return apiFetch<TeacherDetailDto>(`/institutes/${instituteId}/teachers/${teacherId}`);
  },

  createTeacher: (instituteId: string, data: any) => {
    return apiFetch<TeacherDetailDto>(`/institutes/${instituteId}/teachers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateTeacher: (instituteId: string, teacherId: string, data: any) => {
    return apiFetch<TeacherDetailDto>(`/institutes/${instituteId}/teachers/${teacherId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updateStatus: (instituteId: string, teacherId: string, status: string, reason?: string) => {
    return apiFetch<{ id: string; status: string; message: string }>(
      `/institutes/${instituteId}/teachers/${teacherId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      },
    );
  },

  assignCourse: (instituteId: string, teacherId: string, data: { courseId: string; role?: string }) => {
    return apiFetch(`/institutes/${instituteId}/teachers/${teacherId}/courses`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  removeCourse: (instituteId: string, teacherId: string, courseId: string) => {
    return apiFetch(`/institutes/${instituteId}/teachers/${teacherId}/courses/${courseId}`, {
      method: 'DELETE',
    });
  },

  assignBatch: (instituteId: string, teacherId: string, data: { batchId: string; role?: string }) => {
    return apiFetch(`/institutes/${instituteId}/teachers/${teacherId}/batches`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  removeBatch: (instituteId: string, teacherId: string, batchId: string) => {
    return apiFetch(`/institutes/${instituteId}/teachers/${teacherId}/batches/${batchId}`, {
      method: 'DELETE',
    });
  },

  getWorkload: (instituteId: string, teacherId: string) => {
    return apiFetch<TeacherDetailDto['workload']>(
      `/institutes/${instituteId}/teachers/${teacherId}/workload`,
    );
  },

  checkScheduleConflict: (
    instituteId: string,
    data: { teacherProfileId: string; startsAt: string; endsAt: string; excludeSessionId?: string },
  ) => {
    return apiFetch<{
      hasConflict: boolean;
      conflictType?: string;
      conflictingSession?: any;
      message?: string;
    }>(`/institutes/${instituteId}/teachers/check-conflict`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export interface TeacherPortalSettingsDto {
  emailNotifications: boolean;
  submissionAlerts: boolean;
  liveSessionReminders: boolean;
  examDeadlineAlerts: boolean;
  preferredLanguage: string;
  timezone: string;
}

export const teacherMeApi = {
  getProfile: () => apiFetch<{ success: boolean; teacher: any; institute: any; stats: any }>('/teachers/me'),
  updateProfile: (data: {
    fullName?: string;
    email?: string;
    qualifications?: string;
    specialization?: string;
    experienceYears?: number;
    bio?: string;
  }) =>
    apiFetch<{ success: boolean; teacher: any; institute: any; stats: any }>('/teachers/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getSettings: () => apiFetch<{ success: boolean; settings: TeacherPortalSettingsDto }>('/teachers/settings'),
  updateSettings: (data: Partial<TeacherPortalSettingsDto>) =>
    apiFetch<{ success: boolean; settings: TeacherPortalSettingsDto }>('/teachers/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};



// --- DASHBOARD OVERVIEW & ANALYTICS (MILESTONE 2.8) ---

export type DateRangePreset =
  | 'TODAY'
  | '7D'
  | '30D'
  | 'THIS_MONTH'
  | 'PREV_MONTH'
  | 'THIS_TERM'
  | 'THIS_YEAR'
  | 'CUSTOM'
  | 'ALL';

export type ExportReportType =
  | 'enrollments'
  | 'fee-collection'
  | 'pending-fees'
  | 'attendance'
  | 'teacher-workload'
  | 'transactions';

export interface DashboardContextDto {
  instituteId: string;
  instituteName: string;
  displayName: string;
  code: string;
  currency: string;
  timezone: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    role: string;
  };
}

export interface KpiComparisonDto {
  periodValue: number;
  previousPeriodValue: number | null;
  changePct: number | null;
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NONE';
  periodLabel: string;
}

export interface DashboardKpiDto {
  totalStudents: number;
  activeStudents: number;
  pendingAdmissionsCount: number;
  totalTeachers: number;
  activeTeachers: number;
  onLeaveTeachers: number;
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  activeBatches: number;
  totalBatches: number;
  totalFeeCollected: number; // in paise
  totalFeePending: number;   // in paise
  overdueFeeAmount: number;  // in paise
  pendingInvoicesCount: number;
  upcomingSessionsCount: number;
  sessionsTodayCount: number;
  attendancePercentage: number | null;
  comparisons?: {
    studentsRegistered: KpiComparisonDto;
    feeCollection: KpiComparisonDto;
    enrolments: KpiComparisonDto;
  };
}

export interface EnrolmentTrendItem {
  month: string;
  label: string;
  count: number;
  registrations?: number;
}

export interface FinancialTrendItem {
  month: string;
  label: string;
  collected: number; // in paise
  invoiced?: number; // in paise
  pending: number;   // in paise
}

export interface CourseDistributionItem {
  courseId?: string;
  courseTitle: string;
  fullTitle?: string;
  status?: string;
  studentCount: number;
  activeEnrolments?: number;
  completedEnrolments?: number;
}

export interface BatchDistributionItem {
  batchId: string;
  batchName: string;
  courseTitle: string;
  status: string;
  capacity: number;
  enrolledCount: number;
  utilizationPct: number;
}

export interface PaymentStatusBreakdownItem {
  status: string;
  label: string;
  count: number;
  amountPaise: number;
}

export interface BatchAttendancePerformanceItem {
  batchId: string;
  batchName: string;
  courseTitle: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalRecords: number;
  attendancePercentage: number | null;
}

export interface CourseAttendanceSummaryItem {
  courseId: string;
  courseTitle: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalRecords: number;
  attendancePercentage: number | null;
}

export interface AttendanceTrendItem {
  period: string;
  label: string;
  percentage: number | null;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalRecords: number;
}

export interface TeacherWorkloadItemDto {
  teacherId: string;
  employeeCode: string | null;
  fullName: string;
  specialization: string | null;
  status: string;
  assignedCoursesCount: number;
  assignedBatchesCount: number;
  upcomingSessionsCount: number;
  scheduledHoursInPeriod: number;
}

export interface RecentAdmissionDto {
  id: string;
  admissionNo: string;
  fullName: string;
  email?: string | null;
  courseName?: string;
  batchName?: string;
  status: string;
  createdAt: string;
}

export interface RecentActivityItemDto {
  id: string;
  category:
    | 'STUDENT'
    | 'TEACHER'
    | 'COURSE'
    | 'BATCH'
    | 'ATTENDANCE'
    | 'FEE'
    | 'ADMIN';
  action: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
  link: string;
}

export interface UpcomingSessionDto {
  id: string;
  title: string;
  batchId?: string;
  batchName: string;
  courseTitle: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  room?: string | null;
}

export interface TransactionItemDto {
  id: string;
  invoiceId?: string;
  invoiceNumber: string;
  invoiceStatus?: string;
  paymentNumber: string;
  receiptNumber?: string | null;
  studentId?: string;
  admissionNo?: string;
  studentName: string;
  courseName?: string;
  batchName?: string;
  amount: number; // gross in paise
  reversedAmount?: number;
  netAmount?: number;
  paymentMode: string;
  paymentDate: string;
  status: string;
  referenceNumber?: string | null;
}

export type RecentPaymentDto = TransactionItemDto;

export interface PaginatedTransactionsDto {
  data: TransactionItemDto[];
  summary: {
    totalTransactions: number;
    totalGrossPaise: number;
    totalNetPaise: number;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DashboardExportResponseDto {
  filename: string;
  mimeType: string;
  reportTitle: string;
  instituteName: string;
  dateRangeLabel: string;
  generatedAt: string;
  rowCount: number;
  csvContent: string;
}

export interface DashboardOverviewDto {
  institute?: {
    id: string;
    name: string;
    displayName: string;
    code: string;
    currency: string;
    timezone: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  viewer?: {
    userId: string;
    fullName: string;
    role: string;
  };
  dateFilter?: {
    preset: DateRangePreset;
    label: string;
    from: string | null;
    to: string | null;
    previousFrom: string | null;
    previousTo: string | null;
  };
  kpi: DashboardKpiDto;
  enrolmentTrend: EnrolmentTrendItem[];
  financialTrend: FinancialTrendItem[];
  courseDistribution: CourseDistributionItem[];
  batchDistribution?: BatchDistributionItem[];
  financialAnalytics?: {
    totalCollectedPaise: number;
    collectedInPeriodPaise: number;
    pendingAmountPaise: number;
    overdueAmountPaise: number;
    invoiceTotals: {
      totalInvoicedPaise: number;
      totalPaidPaise: number;
      outstandingBalancePaise: number;
      issuedInvoicesCount: number;
      paidCount: number;
      partiallyPaidCount: number;
      unpaidIssuedCount: number;
      overdueCount: number;
      draftCount: number;
      cancelledCount: number;
    };
    paymentSummary: {
      successfulPaymentsCount: number;
      successfulAmountPaise: number;
      periodSuccessfulCount: number;
      periodSuccessfulAmountPaise: number;
      partiallyReversedCount: number;
      reversedCount: number;
      totalReversedAmountPaise: number;
    };
    paymentStatusBreakdown: PaymentStatusBreakdownItem[];
  };
  attendanceAnalytics?: {
    overallPercentage: number | null;
    periodPercentage: number | null;
    minThresholdPct: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    totalRecords: number;
    trend: AttendanceTrendItem[];
    byBatch: BatchAttendancePerformanceItem[];
    byCourse: CourseAttendanceSummaryItem[];
  };
  teacherAcademicAnalytics?: {
    summary: {
      totalTeachers: number;
      activeTeachers: number;
      onLeaveTeachers: number;
      inactiveTeachers: number;
      totalCourseAssignments: number;
      totalBatchAssignments: number;
      upcomingScheduledSessions: number;
    };
    teacherWorkload: TeacherWorkloadItemDto[];
  };
  recentAdmissions: RecentAdmissionDto[];
  recentActivities?: RecentActivityItemDto[];
  upcomingSessions: UpcomingSessionDto[];
  recentPayments: TransactionItemDto[];
}

let cachedContextPromise: Promise<DashboardContextDto> | null = null;

/**
 * Resolves the verified administrative institute context once per browser session,
 * avoiding duplicate /dashboard/context calls across header NotificationBell and pages.
 */
export async function resolveVerifiedAdminContext(
  forceRefresh = false,
): Promise<DashboardContextDto> {
  if (!cachedContextPromise || forceRefresh) {
    cachedContextPromise = apiFetch<DashboardContextDto>('/dashboard/context')
      .then((ctx) => {
        if (typeof window !== 'undefined' && ctx?.instituteId) {
          localStorage.setItem('current_institute_id', ctx.instituteId);
        }
        return ctx;
      })
      .catch((err) => {
        cachedContextPromise = null;
        throw err;
      });
  }
  return cachedContextPromise;
}

export const dashboardApi = {
  getContext: () => resolveVerifiedAdminContext(),

  getOverview: (
    instituteId: string,
    params?: { preset?: DateRangePreset; from?: string; to?: string },
  ) => {
    const q = buildCleanQueryString(params);
    return apiFetch<DashboardOverviewDto>(
      `/institutes/${instituteId}/dashboard/overview${q}`,
    );
  },

  getTransactions: (
    instituteId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      paymentMode?: string;
      preset?: DateRangePreset;
      from?: string;
      to?: string;
    },
  ) => {
    const q = buildCleanQueryString(params);
    return apiFetch<PaginatedTransactionsDto>(
      `/institutes/${instituteId}/dashboard/transactions${q}`,
    );
  },

  exportReport: (
    instituteId: string,
    params: {
      type: ExportReportType;
      preset?: DateRangePreset;
      from?: string;
      to?: string;
    },
  ) => {
    const q = buildCleanQueryString(params);
    return apiFetch<DashboardExportResponseDto>(
      `/institutes/${instituteId}/dashboard/export${q}`,
    );
  },
};


// --- INSTITUTE SETTINGS & BRANDING (MILESTONE 2.7) ---

export interface InstituteProfileData {
  name: string;
  displayName: string;
  code: string;
  registrationNumber?: string;
  description?: string;
  email?: string;
  phone?: string;
  alternatePhone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  primaryContactName?: string;
  timezone: string;
  status: string;
}

export interface InstituteBrandingData {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  displayName?: string;
}

export interface AcademicSettingsData {
  currentAcademicYearId?: string | null;
  currentAcademicYearName?: string | null;
  currentAcademicTermId?: string | null;
  currentAcademicTermName?: string | null;
  timezone: string;
  workingDays: string[];
  defaultSessionDurationMinutes: number;
  minAttendancePercentage: number;
  academicCalendarType: string;
  availableYears: Array<{ id: string; name: string; isCurrent: boolean }>;
  availableTerms: Array<{ id: string; name: string; isCurrent: boolean; academicYearId: string }>;
}

export interface FinancialSettingsData {
  currency: string;
  invoicePrefix: string;
  receiptPrefix: string;
  defaultDueDays: number;
  financialContactEmail?: string;
  financialContactPhone?: string;
  billingAddress?: string;
  taxOrGstNumber?: string;
  showInstituteLogoOnInvoice: boolean;
}

export interface SecurityPreferencesData {
  sessionTimeoutMinutes: number;
  studentSelfRegistration: boolean;
  notifyOnStudentRegistration: boolean;
  notifyOnFeePayment: boolean;
  notifyOnAttendanceAlert: boolean;
  notifyOnTeacherManagement?: boolean;
  notifyOnAcademicActivity?: boolean;
  notifyOnAdminSecurity?: boolean;
}

export interface FullInstituteSettingsResponse {
  profile: InstituteProfileData;
  branding: InstituteBrandingData;
  academic: AcademicSettingsData;
  financial: FinancialSettingsData;
  security: SecurityPreferencesData;
}

export interface InstituteUserItemDto {
  id: string;
  membershipId: string;
  fullName: string;
  email?: string | null;
  phone: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface AuditLogItemDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  actorName?: string;
  metadata?: any;
  createdAt: string;
}

export const settingsApi = {
  getSettings: (instituteId: string) =>
    apiFetch<FullInstituteSettingsResponse>(`/institutes/${instituteId}/settings`),
  updateProfile: (instituteId: string, data: Partial<InstituteProfileData>) =>
    apiFetch<InstituteProfileData>(`/institutes/${instituteId}/settings/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateBranding: (instituteId: string, data: Partial<InstituteBrandingData>) =>
    apiFetch<InstituteBrandingData>(`/institutes/${instituteId}/settings/branding`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  resetBranding: (instituteId: string) =>
    apiFetch<InstituteBrandingData>(`/institutes/${instituteId}/settings/branding/reset`, {
      method: 'POST',
    }),
  updateAcademic: (instituteId: string, data: Partial<AcademicSettingsData>) =>
    apiFetch<AcademicSettingsData>(`/institutes/${instituteId}/settings/academic`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateFinancial: (instituteId: string, data: Partial<FinancialSettingsData>) =>
    apiFetch<FinancialSettingsData>(`/institutes/${instituteId}/settings/financial`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  updateSecurity: (instituteId: string, data: Partial<SecurityPreferencesData>) =>
    apiFetch<SecurityPreferencesData>(`/institutes/${instituteId}/settings/security`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getUsers: (instituteId: string, query?: { role?: string; status?: string; search?: string }) => {
    const q = query ? '?' + new URLSearchParams(query as any).toString() : '';
    return apiFetch<InstituteUserItemDto[]>(`/institutes/${instituteId}/settings/users${q}`);
  },
  updateUserStatus: (
    instituteId: string,
    membershipId: string,
    status: 'ACTIVE' | 'INVITED' | 'SUSPENDED',
  ) =>
    apiFetch<{ membershipId: string; userId: string; status: string; message: string }>(
      `/institutes/${instituteId}/settings/users/${membershipId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    ),
  getAuditLogs: (instituteId: string, limit?: number) => {
    const q = limit ? `?limit=${limit}` : '';
    return apiFetch<AuditLogItemDto[]>(`/institutes/${instituteId}/settings/audit-logs${q}`);
  },
  getPaymentGateway: (instituteId: string) =>
    apiFetch<{
      configured: boolean;
      mode: 'LIVE' | 'TEST' | 'UNCONFIGURED';
      keyIdPreview: string | null;
      hasWebhookSecret: boolean;
      source: string;
    }>(`/institutes/${instituteId}/settings/payment-gateway`),
  updatePaymentGateway: (
    instituteId: string,
    data: { keyId: string; keySecret: string; webhookSecret?: string },
  ) =>
    apiFetch<{
      configured: boolean;
      mode: 'LIVE' | 'TEST' | 'UNCONFIGURED';
      keyIdPreview: string | null;
      hasWebhookSecret: boolean;
      source: string;
    }>(`/institutes/${instituteId}/settings/payment-gateway`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export async function resolveActiveInstituteId(): Promise<string> {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem('current_institute_id');
  if (stored) return stored;
  try {
    const me = await apiFetch<{
      instituteId?: string;
      memberships?: Array<{ instituteId: string }>;
    }>('/auth/me');
    const id = me?.instituteId || me?.memberships?.[0]?.instituteId || '';
    if (id) localStorage.setItem('current_institute_id', id);
    return id;
  } catch {
    return '';
  }
}

// --- ADMIN NOTIFICATION CENTER (MILESTONE 2.8) ---

export type NotificationCategory =
  | 'STUDENT'
  | 'TEACHER'
  | 'ATTENDANCE'
  | 'FEE'
  | 'ACADEMIC'
  | 'ADMIN';

export interface NotificationItemDto {
  id: string;
  instituteId: string | null;
  userId: string;
  category: NotificationCategory;
  eventType: string;
  referenceId: string | null;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginatedNotificationsDto {
  data: NotificationItemDto[];
  unreadCount: number;
  byCategory: Record<NotificationCategory, number>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UnreadCountDto {
  unreadCount: number;
  byCategory: Record<NotificationCategory, number>;
}

export interface NotificationPreferencesDto {
  notifyOnStudentRegistration: boolean;
  notifyOnFeePayment: boolean;
  notifyOnAttendanceAlert: boolean;
  notifyOnTeacherManagement: boolean;
  notifyOnAcademicActivity: boolean;
  notifyOnAdminSecurity: boolean;
}

export const notificationsApi = {
  getNotifications: (
    instituteId: string,
    query?: {
      page?: number;
      limit?: number;
      category?: 'ALL' | NotificationCategory;
      status?: 'ALL' | 'UNREAD' | 'READ';
      search?: string;
    },
  ) => {
    const q = buildCleanQueryString(query);
    return apiFetch<PaginatedNotificationsDto>(
      `/institutes/${instituteId}/notifications${q}`,
    );
  },

  getUnreadCount: (instituteId: string) =>
    apiFetch<UnreadCountDto>(
      `/institutes/${instituteId}/notifications/unread-count`,
    ),

  markAsRead: (instituteId: string, notificationId: string) =>
    apiFetch<NotificationItemDto>(
      `/institutes/${instituteId}/notifications/${notificationId}/read`,
      { method: 'PATCH' },
    ),

  markAllAsRead: (
    instituteId: string,
    category?: 'ALL' | NotificationCategory,
  ) =>
    apiFetch<{ updatedCount: number; unreadCount: number }>(
      `/institutes/${instituteId}/notifications/mark-all-read`,
      {
        method: 'POST',
        body: JSON.stringify(category ? { category } : {}),
      },
    ),

  getPreferences: (instituteId: string) =>
    apiFetch<NotificationPreferencesDto>(
      `/institutes/${instituteId}/notifications/preferences`,
    ),

  updatePreferences: (
    instituteId: string,
    data: Partial<NotificationPreferencesDto>,
  ) =>
    apiFetch<NotificationPreferencesDto>(
      `/institutes/${instituteId}/notifications/preferences`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    ),
};

// -----------------------------------------------------------------------------
// FINANCE, FEE MANAGEMENT & INVOICING (MILESTONE 2.5)
// -----------------------------------------------------------------------------

export interface FinanceOverviewDto {
  summary: {
    totalInvoicedPaise: number;
    totalPaidPaise: number;
    totalPendingPaise: number;
    overdueAmountPaise: number;
    totalInvoicesCount: number;
    paidInvoicesCount: number;
    pendingInvoicesCount: number;
  };
  categories: Array<{
    id: string;
    name: string;
    code: string;
    description?: string;
    isActive: boolean;
  }>;
  structures: Array<{
    id: string;
    name: string;
    code: string;
    periodType: string;
    amount: number;
    currency: string;
    description?: string;
    isActive: boolean;
    feeCategoryId: string;
    categoryName: string;
    academicYearName?: string;
    allocationsCount: number;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    issueDate: string | null;
    dueDate: string | null;
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    currency: string;
    notes?: string;
    studentProfileId: string;
    admissionNo: string;
    studentName: string;
    studentPhone: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    amount: number;
    reversedAmount: number;
    netAmount: number;
    paymentMode: string;
    paymentDate: string;
    status: string;
    referenceNumber?: string;
    remarks?: string;
    invoiceId: string;
    invoiceNumber: string;
    studentProfileId: string;
    admissionNo: string;
    studentName: string;
    receiptNumber?: string;
  }>;
}

export const financeApi = {
  getOverview: (instituteId: string) =>
    apiFetch<FinanceOverviewDto>(`/institutes/${instituteId}/finance/overview`),

  createFeeStructure: (
    instituteId: string,
    data: {
      name: string;
      code?: string;
      categoryName: string;
      periodType: string;
      amountInRupees: number;
      description?: string;
    },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/finance/structures`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  issueInvoice: (
    instituteId: string,
    data: {
      studentProfileId: string;
      feeStructureId: string;
      dueDate?: string;
      notes?: string;
    },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/finance/invoices`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  recordPayment: (
    instituteId: string,
    data: {
      invoiceId: string;
      amountInRupees: number;
      paymentMode: string;
      referenceNumber?: string;
      remarks?: string;
    },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/finance/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reversePayment: (
    instituteId: string,
    paymentId: string,
    data: { reversedAmountPaise?: number; reason: string },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/finance/payments/${paymentId}/reverse`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAllocation: (
    instituteId: string,
    data: {
      studentProfileId: string;
      feeStructureId: string;
      billingPeriod: string;
      customAmountPaise?: number;
      remarks?: string;
    },
  ) =>
    apiFetch<any>(`/institutes/${instituteId}/finance/allocations`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStudentFinance: (instituteId: string, studentId: string) =>
    apiFetch<any>(`/institutes/${instituteId}/students/${studentId}/finance`),
};

// --- SUPER ADMIN PLATFORM SAAS API ---

export interface PlatformAnalyticsDto {
  metrics: {
    totalInstitutes: number;
    activeInstitutes: number;
    suspendedInstitutes: number;
    pendingApplications: number;
    totalStudents: number;
    totalTeachers: number;
    totalCourses: number;
    activeSubscriptions: number;
    platformMrrPaise: number;
    totalPlatformRevenuePaise: number;
  };
  institutes: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    currency: string;
    timezone: string;
    createdAt: string;
    studentsCount: number;
    teachersCount: number;
    coursesCount: number;
    subscription: {
      id: string;
      status: string;
      cycle: string;
      planName?: string;
      planCode?: string;
      periodEnd: string;
    } | null;
  }>;
  recentApplications: Array<any>;
}

export const platformApi = {
  getAnalytics: () => apiFetch<PlatformAnalyticsDto>('/platform/analytics'),
  listInstitutes: () => apiFetch<PlatformAnalyticsDto['institutes']>('/platform/institutes'),
  createInstitute: (data: {
    name: string;
    slug: string;
    adminName: string;
    adminPhoneE164: string;
    adminEmail?: string;
    planCode?: string;
  }) =>
    apiFetch<any>('/platform/institutes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInstituteStatus: (instituteId: string, status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CLOSED', reason?: string) =>
    apiFetch<any>(`/platform/institutes/${instituteId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),
  listApplications: (status?: string) =>
    apiFetch<any[]>(`/platform/applications${status ? `?status=${status}` : ''}`),
  approveApplication: (id: string) =>
    apiFetch<any>(`/platform/applications/${id}/approve`, { method: 'POST' }),
  rejectApplication: (id: string, reason: string) =>
    apiFetch<any>(`/platform/applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  listPlans: () => apiFetch<any[]>('/platform/plans'),
  createPlan: (data: {
    code: string;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    trialDays?: number;
    maxStudents?: number;
    maxTeachers?: number;
    maxCourses?: number;
    storageGb?: number;
  }) =>
    apiFetch<any>('/platform/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePlan: (planId: string, data: Record<string, any>) =>
    apiFetch<any>(`/platform/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  listSubscriptions: () => apiFetch<any[]>('/platform/subscriptions'),
  assignSubscription: (data: {
    instituteId: string;
    planId: string;
    cycle?: 'MONTHLY' | 'YEARLY';
    status?: 'TRIALING' | 'ACTIVE';
  }) =>
    apiFetch<any>('/platform/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listInvoices: () => apiFetch<any[]>('/platform/invoices'),
  markInvoicePaid: (invoiceId: string) =>
    apiFetch<any>(`/platform/invoices/${invoiceId}/mark-paid`, { method: 'PATCH' }),
  listAuditLogs: (limit: number = 50) =>
    apiFetch<any[]>(`/platform/audit-logs?limit=${limit}`),
};
