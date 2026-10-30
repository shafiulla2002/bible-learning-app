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
  preferredLanguage: string;
  status: 'APPLICANT' | 'ACTIVE' | 'INACTIVE' | 'ALUMNI';
  enrolmentCount: number;
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
