import { RoleType } from './roles-permissions.js';

export interface UserSession {
  userId: string;
  phoneNumber: string;
  fullName: string;
  avatarUrl?: string;
  activeMembershipId: string;
  instituteId: string;
  instituteName: string;
  role: RoleType;
  permissions: string[];
}

export interface InstituteSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  timezone: string;
  currency: string;
}

export interface StudentProfileSummary {
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

export interface StudentDetail extends StudentProfileSummary {
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

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  coverImage?: string;
  level: string;
  language: string;
  price: number; // in paise (e.g. 1500000 = ₹15,000)
  salePrice?: number;
  isFree: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  totalLessons: number;
  totalStudents: number;
  leadTeacherName?: string;
}

export interface LiveSessionSummary {
  id: string;
  courseTitle: string;
  batchName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  joinUrl?: string;
  teacherName: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  markedAt: string;
}

export interface AssignmentSummary {
  id: string;
  courseTitle: string;
  title: string;
  dueAt: string;
  maxMarks: number;
  totalSubmissions: number;
  gradedCount: number;
}

// ----------------------------------------------------
// COURSE & CURRICULUM MANAGEMENT TYPES (Milestone 2.2)
// ----------------------------------------------------

export interface CourseSummaryItem {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  language: string;
  pricing: 'FREE' | 'PAID';
  price: number;
  salePrice?: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  coverImage?: string;
  enrolledCount: number;
  moduleCount: number;
  lessonCount: number;
  durationMinutes: number;
  leadTeacherName?: string;
  updatedAt: string;
}

export interface ResourceItemDetail {
  id: string;
  lessonId: string;
  mediaAssetId: string;
  kind: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: string;
  downloadable: boolean;
  createdAt: string;
}

export interface LessonItemDetail {
  id: string;
  chapterId: string;
  title: string;
  type: 'VIDEO' | 'PDF' | 'AUDIO' | 'TEXT' | 'QUIZ' | 'LIVE';
  body?: string;
  durationSec: number;
  isPreview: boolean;
  isMandatory: boolean;
  position: number;
  resources: ResourceItemDetail[];
}

export interface ChapterItemDetail {
  id: string;
  moduleId: string;
  title: string;
  position: number;
  lessons: LessonItemDetail[];
}

export interface ModuleItemDetail {
  id: string;
  courseId: string;
  title: string;
  position: number;
  chapters: ChapterItemDetail[];
}

export interface CourseInstructorDetail {
  id: string;
  courseId: string;
  teacherProfileId: string;
  teacherName: string;
  teacherEmail?: string;
  role: 'LEAD' | 'ASSISTANT';
}

export interface CourseHierarchyDetail extends CourseSummaryItem {
  description: string;
  accessDays?: number;
  modules: ModuleItemDetail[];
  instructors: CourseInstructorDetail[];
  completionRule?: {
    minProgressPct: number;
    allMandatory: boolean;
    minExamPct: number;
    minAttendancePct: number;
  };
}
