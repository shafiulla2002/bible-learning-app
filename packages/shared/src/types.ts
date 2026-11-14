import type { RoleType } from './roles-permissions';

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
  courseType?: 'REGULAR' | 'BOOK' | 'SELF_PACED' | 'COHORT' | 'LIVE' | 'DIPLOMA' | 'CERTIFICATE';
  learningMode?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  durationLabel?: string;
  eligibility?: string;
  language: string;
  pricing: 'FREE' | 'PAID';
  price: number;
  salePrice?: number;
  registrationFee?: number;
  requiresApproval?: boolean;
  enrollmentStartsAt?: string;
  enrollmentEndsAt?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  coverImage?: string;
  author?: string | null;
  pdfStorageKey?: string | null;
  pdfOriginalName?: string | null;
  pdfFileSize?: number | null;
  pdfPageCount?: number | null;
  publicationInfo?: string | null;
  bookMetadata?: any;
  enrolledCount: number;
  moduleCount: number;
  lessonCount: number;
  durationMinutes: number;
  leadTeacherName?: string;
  updatedAt: string;
}

export interface StudentBookItem {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  description: string;
  coverImage?: string | null;
  author?: string | null;
  category?: string;
  price: number;
  pdfOriginalName?: string | null;
  pdfFileSize?: number | null;
  pdfPageCount?: number | null;
  publicationInfo?: string | null;
  enrolmentId: string;
  enrolledAt: string;
  status: string;
  lastReadPage: number;
  totalPages: number;
  progressPct: number;
  lastReadAt?: string | null;
}

export interface BookProgressData {
  courseId: string;
  lastReadPage: number;
  totalPages: number;
  progressPct: number;
  lastReadAt?: string;
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

// ----------------------------------------------------
// BATCHES, ACADEMIC TERMS & SCHEDULING (Milestone 2.3)
// ----------------------------------------------------

export interface AcademicYearSummary {
  id: string;
  instituteId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  termCount?: number;
  batchCount?: number;
}

export interface AcademicTermSummary {
  id: string;
  instituteId: string;
  academicYearId: string;
  academicYearName?: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  batchCount?: number;
}

export type BatchStatus = 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export interface BatchTeacherItem {
  id: string;
  teacherProfileId: string;
  name: string;
  email?: string;
  photoUrl?: string;
  role: 'LEAD' | 'ASSISTANT';
}

export interface BatchSummaryItem {
  id: string;
  instituteId: string;
  courseId: string;
  courseTitle: string;
  academicYearId?: string;
  academicYearName?: string;
  termId?: string;
  termName?: string;
  name: string;
  code?: string;
  status: BatchStatus;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolledCount: number;
  leadTeacher?: {
    id: string;
    name: string;
    email?: string;
    photoUrl?: string;
  };
  assistantsCount: number;
  scheduledClassesCount: number;
  createdAt: string;
}

export interface BatchEnrolmentItem {
  id: string;
  studentProfileId: string;
  admissionNo: string;
  studentName: string;
  email?: string;
  phoneNumber?: string;
  enrolledAt: string;
  status: string;
}

export interface BatchTransferLogItem {
  id: string;
  instituteId: string;
  studentProfileId: string;
  studentName?: string;
  admissionNo?: string;
  sourceBatchId: string;
  sourceBatchName: string;
  targetBatchId: string;
  targetBatchName: string;
  reason?: string;
  transferredBy?: string;
  transferredAt: string;
}

export interface ClassScheduleItem {
  id: string;
  instituteId: string;
  batchId: string;
  batchName?: string;
  courseTitle?: string;
  teacherProfileId: string;
  teacherName?: string;
  title: string;
  description?: string;
  room?: string;
  startsAt: string;
  endsAt: string;
  isRecurring: boolean;
  recurrenceRule?: string;
  joinUrl?: string;
  recordingUrl?: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface ScheduleConflictResult {
  hasConflict: boolean;
  conflictType?: 'TEACHER_DOUBLE_BOOKED' | 'ROOM_DOUBLE_BOOKED' | 'BATCH_DOUBLE_BOOKED';
  conflictingSession?: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    teacherName?: string;
    room?: string;
    batchName?: string;
  };
  message?: string;
}

export interface RecurringScheduleRule {
  daysOfWeek: number[]; // 0: Sunday, 1: Monday, ... 6: Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  exceptions?: string[]; // YYYY-MM-DD dates to skip
}

// -----------------------------------------------------------------------------
// ATTENDANCE MANAGEMENT TYPES (Milestone 2.4)
// -----------------------------------------------------------------------------

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
export type AttendanceMode = 'DAILY_BATCH' | 'LIVE_SESSION';

export interface AttendanceItem {
  id: string;
  instituteId: string;
  batchId: string;
  batchName?: string;
  studentProfileId: string;
  studentName?: string;
  admissionNo?: string;
  date: string; // YYYY-MM-DD
  mode: AttendanceMode;
  status: AttendanceStatus;
  remarks?: string;
  liveSessionId?: string;
  liveSessionTitle?: string;
  markedById?: string;
  markedByRole?: string;
  markedAt: string;
  updatedAt?: string;
}

export interface AttendanceAuditLogItem {
  id: string;
  attendanceId: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  previousRemarks?: string;
  newRemarks?: string;
  changedById?: string;
  changedByRole?: string;
  changedAt: string;
}

export interface AttendanceSummary {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  attendancePercentage: number | null; // null if 0 applicable sessions
}

export interface StudentRosterAttendanceItem {
  studentProfileId: string;
  admissionNo: string;
  fullName: string;
  email?: string;
  phone?: string;
  enrolmentId: string;
  enrolmentStatus: string;
  enrolledAt: string;
  attendanceId?: string;
  status?: AttendanceStatus;
  remarks?: string;
}

export interface BatchAttendanceOverview {
  batchId: string;
  batchName: string;
  courseTitle: string;
  academicYearName?: string;
  termName?: string;
  totalStudents: number;
  totalDaysMarked: number;
  averageAttendancePct: number | null;
}

// -----------------------------------------------------------------------------
// TEACHER MANAGEMENT TYPES (Milestone 2.6)
// -----------------------------------------------------------------------------

export type TeacherStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type InstructorRole = 'LEAD' | 'ASSISTANT';

export interface TeacherAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface TeacherSummaryItem {
  id: string;
  instituteId: string;
  userId: string;
  membershipId: string;
  fullName: string;
  phoneE164: string;
  email?: string;
  avatarUrl?: string;
  employeeCode?: string;
  qualifications?: string;
  specialization?: string;
  experienceYears?: number;
  joiningDate?: string;
  status: TeacherStatus;
  assignedCoursesCount: number;
  assignedBatchesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAssignedCourse {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  code?: string;
  role: InstructorRole;
  createdAt?: string;
}

export interface TeacherAssignedBatch {
  id: string;
  batchId: string;
  name: string;
  courseTitle: string;
  role: InstructorRole;
  startDate: string;
  endDate: string;
  status: string;
  capacity?: number;
}

export interface TeacherLiveSessionItem {
  id: string;
  batchId: string;
  batchName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  room?: string;
  joinUrl?: string;
}

export interface TeacherWorkloadSummary {
  totalCourses: number;
  totalBatches: number;
  upcomingLiveSessionsCount: number;
  totalLiveSessionsConducted: number;
  weeklyHours: number;
}

export interface TeacherDetail extends TeacherSummaryItem {
  bio?: string;
  address?: TeacherAddress;
  assignedCourses: TeacherAssignedCourse[];
  assignedBatches: TeacherAssignedBatch[];
  workloadSummary: TeacherWorkloadSummary;
  recentLiveSessions: TeacherLiveSessionItem[];
  attendanceStats?: {
    totalSessionsConducted: number;
    totalAttendanceMarked: number;
  };
}




