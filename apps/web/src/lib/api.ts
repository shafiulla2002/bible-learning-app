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



// --- DASHBOARD OVERVIEW & ANALYTICS ---

export interface DashboardKpiDto {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalCourses: number;
  publishedCourses: number;
  activeBatches: number;
  totalFeeCollected: number; // in paise
  totalFeePending: number;   // in paise
  upcomingSessionsCount: number;
  attendancePercentage: number | null;
}

export interface EnrolmentTrendItem {
  month: string;
  label: string;
  count: number;
}

export interface FinancialTrendItem {
  month: string;
  label: string;
  collected: number; // in paise
  pending: number;   // in paise
}

export interface CourseDistributionItem {
  courseTitle: string;
  studentCount: number;
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

export interface UpcomingSessionDto {
  id: string;
  title: string;
  batchName: string;
  courseTitle: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  room?: string | null;
}

export interface RecentPaymentDto {
  id: string;
  invoiceNumber: string;
  paymentNumber: string;
  studentName: string;
  courseName?: string;
  amount: number; // in paise
  paymentMode: string;
  paymentDate: string;
  status: string;
}

export interface DashboardOverviewDto {
  kpi: DashboardKpiDto;
  enrolmentTrend: EnrolmentTrendItem[];
  financialTrend: FinancialTrendItem[];
  courseDistribution: CourseDistributionItem[];
  recentAdmissions: RecentAdmissionDto[];
  upcomingSessions: UpcomingSessionDto[];
  recentPayments: RecentPaymentDto[];
}

export const dashboardApi = {
  getOverview: (instituteId: string, params?: { from?: string; to?: string }) => {
    const q = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiFetch<DashboardOverviewDto>(`/institutes/${instituteId}/dashboard/overview${q}`);
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
};
